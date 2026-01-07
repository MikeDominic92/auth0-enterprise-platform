# Auth0 Actions Documentation

## Overview

Auth0 Actions provide a serverless extensibility platform for customizing authentication and authorization flows. This document covers available triggers, implementation patterns, testing procedures, and deployment processes.

---

## Table of Contents

1. [Introduction to Actions](#introduction-to-actions)
2. [Available Triggers](#available-triggers)
3. [Action Code Examples](#action-code-examples)
4. [Testing Actions](#testing-actions)
5. [Deployment Process](#deployment-process)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Introduction to Actions

### What Are Actions?

Actions are Node.js functions that execute at specific points during Auth0 flows. They provide:

- Custom logic injection into authentication flows
- Integration with external services
- Token customization
- User profile enrichment
- Security enforcement

### Action Anatomy

```javascript
/**
 * Handler that runs on every execution of the trigger.
 * @param {Event} event - Details about the user and context.
 * @param {API} api - Interface to modify the execution.
 */
exports.onExecutePostLogin = async (event, api) => {
  // Your custom logic here
};
```

---

## Available Triggers

### Login Triggers

| Trigger | Event | Use Cases |
|---------|-------|-----------|
| Post Login | After authentication | Token enrichment, security checks |
| Post User Registration | After user signs up | Welcome emails, profile setup |

### Token Triggers

| Trigger | Event | Use Cases |
|---------|-------|-----------|
| Post Credential Exchange | M2M token exchange | Scope validation, custom claims |

### Password Triggers

| Trigger | Event | Use Cases |
|---------|-------|-----------|
| Post Change Password | After password change | Notifications, audit logging |
| Send Phone Message | Phone verification | Custom SMS providers |

### Pre-User Registration

| Trigger | Event | Use Cases |
|---------|-------|-----------|
| Pre User Registration | Before user creation | Validation, domain restrictions |

---

## Action Code Examples

### Example 1: Add Custom Claims to Token

Add organization and role information to access tokens:

```javascript
/**
 * Post-Login Action: Enrich tokens with organization data
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://enterprise.yourcompany.com';

  // Add organization claims
  if (event.organization) {
    api.accessToken.setCustomClaim(`${namespace}/org_id`, event.organization.id);
    api.accessToken.setCustomClaim(`${namespace}/org_name`, event.organization.name);

    api.idToken.setCustomClaim(`${namespace}/org_id`, event.organization.id);
    api.idToken.setCustomClaim(`${namespace}/org_name`, event.organization.name);
  }

  // Add user metadata claims
  const userMetadata = event.user.user_metadata || {};
  const appMetadata = event.user.app_metadata || {};

  api.accessToken.setCustomClaim(`${namespace}/roles`, appMetadata.roles || []);
  api.accessToken.setCustomClaim(`${namespace}/permissions`, appMetadata.permissions || []);
  api.accessToken.setCustomClaim(`${namespace}/department`, userMetadata.department || null);
};
```

### Example 2: Enforce MFA for Admin Users

Require MFA for users with administrative roles:

```javascript
/**
 * Post-Login Action: Enforce MFA for privileged users
 */
exports.onExecutePostLogin = async (event, api) => {
  const appMetadata = event.user.app_metadata || {};
  const roles = appMetadata.roles || [];

  // Define roles that require MFA
  const privilegedRoles = ['admin', 'org_admin', 'security_admin'];

  const requiresMFA = roles.some(role => privilegedRoles.includes(role));

  if (requiresMFA) {
    // Check if MFA has been completed
    const mfaCompleted = event.authentication?.methods?.some(
      method => method.name === 'mfa'
    );

    if (!mfaCompleted) {
      api.multifactor.enable('any', { allowRememberBrowser: false });
    }
  }
};
```

### Example 3: Audit Logging Integration

Send authentication events to external audit system:

```javascript
const axios = require('axios');

/**
 * Post-Login Action: Send audit events to external system
 */
exports.onExecutePostLogin = async (event, api) => {
  const auditPayload = {
    timestamp: new Date().toISOString(),
    event_type: 'user.login',
    user_id: event.user.user_id,
    email: event.user.email,
    organization_id: event.organization?.id || null,
    connection: event.connection.name,
    ip_address: event.request.ip,
    user_agent: event.request.user_agent,
    geo: {
      country: event.request.geoip?.countryCode || 'unknown',
      city: event.request.geoip?.cityName || 'unknown'
    },
    success: true
  };

  try {
    await axios.post(event.secrets.AUDIT_ENDPOINT, auditPayload, {
      headers: {
        'Authorization': `Bearer ${event.secrets.AUDIT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
  } catch (error) {
    // Log error but don't block authentication
    console.error('Audit logging failed:', error.message);
  }
};
```

### Example 4: Domain-Based Organization Assignment

Automatically assign users to organizations based on email domain:

```javascript
const ManagementClient = require('auth0').ManagementClient;

/**
 * Post-Login Action: Auto-assign organization by email domain
 */
exports.onExecutePostLogin = async (event, api) => {
  // Skip if already in an organization context
  if (event.organization) {
    return;
  }

  const emailDomain = event.user.email?.split('@')[1];

  if (!emailDomain) {
    return;
  }

  // Domain to organization mapping
  const domainMappings = {
    'acme.com': 'org_acme123',
    'contoso.com': 'org_contoso456',
    'fabrikam.com': 'org_fabrikam789'
  };

  const targetOrg = domainMappings[emailDomain];

  if (targetOrg) {
    const management = new ManagementClient({
      domain: event.secrets.AUTH0_DOMAIN,
      clientId: event.secrets.AUTH0_M2M_CLIENT_ID,
      clientSecret: event.secrets.AUTH0_M2M_CLIENT_SECRET
    });

    try {
      await management.organizations.addMembers(
        { id: targetOrg },
        { members: [event.user.user_id] }
      );

      api.user.setAppMetadata('default_org', targetOrg);
    } catch (error) {
      if (error.statusCode !== 409) { // Ignore if already a member
        console.error('Organization assignment failed:', error.message);
      }
    }
  }
};
```

### Example 5: Risk-Based Access Control

Implement risk assessment for login attempts:

```javascript
/**
 * Post-Login Action: Risk-based access control
 */
exports.onExecutePostLogin = async (event, api) => {
  let riskScore = 0;
  const riskFactors = [];

  // Factor 1: New device
  const knownDevices = event.user.app_metadata?.known_devices || [];
  const currentDevice = event.request.user_agent;

  if (!knownDevices.includes(currentDevice)) {
    riskScore += 20;
    riskFactors.push('new_device');
  }

  // Factor 2: Unusual location
  const lastCountry = event.user.app_metadata?.last_country;
  const currentCountry = event.request.geoip?.countryCode;

  if (lastCountry && currentCountry !== lastCountry) {
    riskScore += 30;
    riskFactors.push('location_change');
  }

  // Factor 3: Unusual time
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    riskScore += 10;
    riskFactors.push('unusual_time');
  }

  // Factor 4: Multiple failed attempts (from anomaly detection)
  if (event.stats?.logins_count === 0 && event.user.last_login) {
    riskScore += 25;
    riskFactors.push('possible_account_takeover');
  }

  // Store risk assessment
  const namespace = 'https://enterprise.yourcompany.com';
  api.accessToken.setCustomClaim(`${namespace}/risk_score`, riskScore);
  api.accessToken.setCustomClaim(`${namespace}/risk_factors`, riskFactors);

  // Action based on risk level
  if (riskScore >= 50) {
    // High risk: require MFA
    api.multifactor.enable('any', { allowRememberBrowser: false });
  } else if (riskScore >= 30) {
    // Medium risk: log and notify
    console.warn(`Medium risk login: ${event.user.email}, score: ${riskScore}`);
  }

  // Update user metadata
  api.user.setAppMetadata('last_country', currentCountry);
  api.user.setAppMetadata('last_login_risk', riskScore);
};
```

### Example 6: Pre-Registration Validation

Validate user registration before account creation:

```javascript
/**
 * Pre-User Registration Action: Validate registration
 */
exports.onExecutePreUserRegistration = async (event, api) => {
  const email = event.user.email;
  const emailDomain = email?.split('@')[1];

  // Block disposable email domains
  const blockedDomains = [
    'tempmail.com',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email'
  ];

  if (blockedDomains.includes(emailDomain)) {
    api.access.deny('registration_blocked', 'Disposable email addresses are not allowed.');
    return;
  }

  // Validate password complexity beyond Auth0 defaults
  const password = event.user.password;

  if (password) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 12;

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial || !isLongEnough) {
      api.access.deny(
        'password_policy',
        'Password must be at least 12 characters with uppercase, lowercase, number, and special character.'
      );
      return;
    }
  }

  // Set initial metadata
  api.user.setUserMetadata('registration_source', event.request.query?.source || 'direct');
  api.user.setUserMetadata('registration_date', new Date().toISOString());
  api.user.setAppMetadata('status', 'pending_verification');
  api.user.setAppMetadata('roles', ['user']);
};
```

---

## Testing Actions

### Using the Action Editor

1. Navigate to Actions > Library in Auth0 Dashboard
2. Select your action
3. Click "Test" in the sidebar

### Mock Event Object

Create test scenarios with mock events:

```json
{
  "user": {
    "user_id": "auth0|123456789",
    "email": "test@acme.com",
    "email_verified": true,
    "name": "Test User",
    "app_metadata": {
      "roles": ["admin"]
    },
    "user_metadata": {
      "department": "Engineering"
    }
  },
  "organization": {
    "id": "org_abc123",
    "name": "Acme Corp",
    "metadata": {
      "tier": "enterprise"
    }
  },
  "request": {
    "ip": "192.168.1.1",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "geoip": {
      "countryCode": "US",
      "cityName": "San Francisco"
    }
  },
  "connection": {
    "name": "enterprise-db",
    "strategy": "auth0"
  },
  "secrets": {
    "AUDIT_ENDPOINT": "https://audit.example.com/events",
    "AUDIT_API_KEY": "test-api-key"
  }
}
```

### Unit Testing Locally

Create local tests for action logic:

```javascript
// test/actions/post-login.test.js
const { onExecutePostLogin } = require('../../actions/post-login');

describe('Post Login Action', () => {
  let mockEvent;
  let mockApi;

  beforeEach(() => {
    mockEvent = {
      user: {
        user_id: 'auth0|123',
        email: 'test@example.com',
        app_metadata: { roles: ['user'] }
      },
      organization: {
        id: 'org_test',
        name: 'Test Org'
      }
    };

    mockApi = {
      accessToken: {
        setCustomClaim: jest.fn()
      },
      idToken: {
        setCustomClaim: jest.fn()
      },
      multifactor: {
        enable: jest.fn()
      },
      user: {
        setAppMetadata: jest.fn()
      }
    };
  });

  test('adds organization claims to token', async () => {
    await onExecutePostLogin(mockEvent, mockApi);

    expect(mockApi.accessToken.setCustomClaim).toHaveBeenCalledWith(
      expect.stringContaining('org_id'),
      'org_test'
    );
  });

  test('enforces MFA for admin users', async () => {
    mockEvent.user.app_metadata.roles = ['admin'];

    await onExecutePostLogin(mockEvent, mockApi);

    expect(mockApi.multifactor.enable).toHaveBeenCalled();
  });
});
```

### Integration Testing

Test actions in a staging environment:

1. Create a staging tenant
2. Deploy actions to staging
3. Use Auth0 Authentication API to trigger flows
4. Verify token contents and side effects

```bash
# Test login flow
curl -X POST "https://staging-tenant.auth0.com/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "password",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "username": "test@example.com",
    "password": "TestPassword123!",
    "audience": "https://api.yourcompany.com",
    "scope": "openid profile email"
  }'
```

---

## Deployment Process

### Manual Deployment

1. Navigate to Actions > Library
2. Select the action to deploy
3. Click "Deploy" button
4. Verify the action appears in the appropriate flow

### Flow Configuration

After deploying, add actions to flows:

1. Go to Actions > Flows
2. Select the trigger (e.g., Login)
3. Drag deployed actions to the flow
4. Order actions by execution priority
5. Click "Apply"

### Deployment via CLI (auth0-deploy-cli)

Install the CLI:

```bash
npm install -g auth0-deploy-cli
```

Create action definition:

```yaml
# tenant.yaml
actions:
  - name: Enrich Tokens
    code: ./actions/enrich-tokens.js
    dependencies:
      - name: axios
        version: 0.27.2
    secrets:
      - name: AUDIT_ENDPOINT
        value: "##AUDIT_ENDPOINT##"
    supported_triggers:
      - id: post-login
        version: v3
    runtime: node18
    status: built
```

Deploy:

```bash
a0deploy import --config_file config.json --input_file tenant.yaml
```

### CI/CD Pipeline Integration

Example GitHub Actions workflow:

```yaml
name: Deploy Auth0 Actions

on:
  push:
    branches: [main]
    paths:
      - 'auth0/actions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install auth0-deploy-cli
        run: npm install -g auth0-deploy-cli

      - name: Run Tests
        run: npm test

      - name: Deploy to Staging
        if: github.ref == 'refs/heads/main'
        env:
          AUTH0_DOMAIN: ${{ secrets.AUTH0_STAGING_DOMAIN }}
          AUTH0_CLIENT_ID: ${{ secrets.AUTH0_STAGING_CLIENT_ID }}
          AUTH0_CLIENT_SECRET: ${{ secrets.AUTH0_STAGING_CLIENT_SECRET }}
        run: |
          a0deploy import \
            --config_file auth0/config.staging.json \
            --input_file auth0/tenant.yaml

      - name: Deploy to Production
        if: github.ref == 'refs/heads/main' && github.event_name == 'workflow_dispatch'
        env:
          AUTH0_DOMAIN: ${{ secrets.AUTH0_PROD_DOMAIN }}
          AUTH0_CLIENT_ID: ${{ secrets.AUTH0_PROD_CLIENT_ID }}
          AUTH0_CLIENT_SECRET: ${{ secrets.AUTH0_PROD_CLIENT_SECRET }}
        run: |
          a0deploy import \
            --config_file auth0/config.prod.json \
            --input_file auth0/tenant.yaml
```

---

## Best Practices

### Performance

1. **Minimize External Calls**
   - Cache responses where possible
   - Use connection pooling
   - Set aggressive timeouts (5s max)

2. **Optimize Code**
   - Avoid unnecessary async/await
   - Return early when possible
   - Minimize dependency usage

3. **Handle Failures Gracefully**
   - Never block auth for non-critical operations
   - Use try/catch for external calls
   - Log errors for debugging

### Security

1. **Secrets Management**
   - Store sensitive values in Action Secrets
   - Never hardcode credentials
   - Rotate secrets regularly

2. **Input Validation**
   - Validate all user inputs
   - Sanitize data before external calls
   - Use allowlists over blocklists

3. **Least Privilege**
   - Request only needed scopes
   - Limit M2M permissions
   - Audit action permissions regularly

### Maintenance

1. **Version Control**
   - Store action code in git
   - Use semantic versioning
   - Document changes

2. **Monitoring**
   - Review action logs regularly
   - Set up alerts for failures
   - Track execution times

3. **Testing**
   - Write unit tests for logic
   - Test in staging before production
   - Create rollback procedures

---

## Troubleshooting

### Common Issues

**Issue: Action not executing**

Causes and solutions:
- Action not deployed: Check Actions > Flows
- Action not in flow: Add action to appropriate trigger
- Action disabled: Enable in Actions > Library

**Issue: Secrets not available**

Causes and solutions:
- Secret not defined: Add in Actions > Library > Secrets
- Typo in secret name: Verify `event.secrets.SECRET_NAME`
- Deployment issue: Redeploy action

**Issue: External API timeout**

Causes and solutions:
- API slow: Increase timeout (max 20s)
- Network issue: Check Auth0 outbound IPs
- Rate limiting: Implement backoff

### Debugging

Enable logging in actions:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  console.log('User:', JSON.stringify(event.user, null, 2));
  console.log('Request:', JSON.stringify(event.request, null, 2));

  // Your logic here

  console.log('Action completed successfully');
};
```

View logs:

1. Navigate to Monitoring > Logs
2. Filter by "Action" type
3. Review "Log" entries for console output

### Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| `action_execution_error` | Runtime error in action | Check logs for stack trace |
| `action_timeout` | Execution exceeded limit | Optimize code, reduce external calls |
| `action_dependency_error` | npm package issue | Verify dependency versions |
| `access_denied` | api.access.deny called | Expected behavior if validation fails |

---

## Appendix: Action Templates

### Template: Token Enrichment

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://yourcompany.com';

  // Add custom claims
  api.accessToken.setCustomClaim(`${namespace}/custom`, 'value');
};
```

### Template: MFA Enforcement

```javascript
exports.onExecutePostLogin = async (event, api) => {
  if (shouldRequireMFA(event)) {
    api.multifactor.enable('any');
  }
};

function shouldRequireMFA(event) {
  // Your logic
  return true;
}
```

### Template: User Blocking

```javascript
exports.onExecutePostLogin = async (event, api) => {
  if (isBlocked(event.user)) {
    api.access.deny('blocked', 'Your account has been suspended.');
  }
};

function isBlocked(user) {
  return user.app_metadata?.blocked === true;
}
```

---

*Document Version: 1.0*
*Last Updated: 2025-01*
