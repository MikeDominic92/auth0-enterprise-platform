# Auth0 Tenant Configuration Guide

## Overview

This guide provides complete instructions for configuring Auth0 for the Enterprise Platform. It covers tenant creation, application setup, Organizations configuration, connections, and API configuration.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Tenant Creation](#tenant-creation)
3. [Application Configuration](#application-configuration)
4. [Organizations Setup](#organizations-setup)
5. [Connection Configuration](#connection-configuration)
6. [API Configuration](#api-configuration)
7. [Environment Variables](#environment-variables)
8. [Security Best Practices](#security-best-practices)

---

## Prerequisites

Before beginning setup, ensure you have:

- Auth0 account with Enterprise plan (required for Organizations)
- Administrative access to your Auth0 tenant
- Domain name for your application
- SSL certificates configured
- Access to your deployment environment

---

## Tenant Creation

### Step 1: Create New Tenant

1. Log in to the Auth0 Dashboard at https://manage.auth0.com
2. Click your tenant name in the top-left corner
3. Select "Create Tenant"
4. Configure the following:

| Setting | Recommended Value |
|---------|-------------------|
| Tenant Name | `{company}-enterprise-prod` |
| Region | Select closest to primary user base |
| Environment Tag | Production |

### Step 2: Tenant Settings

Navigate to Settings > General and configure:

```
Friendly Name: Enterprise Platform
Logo URL: https://cdn.yourcompany.com/logo.png
Support Email: support@yourcompany.com
Support URL: https://support.yourcompany.com
```

### Step 3: Configure Advanced Settings

Under Settings > Advanced:

```
Session Timeout: 7200 (2 hours)
Idle Session Timeout: 1800 (30 minutes)
```

Enable the following features:
- [x] Enable OIDC Conformant
- [x] Enable Proof Key for Code Exchange (PKCE)
- [x] Disable Legacy Grant Types

---

## Application Configuration

### Primary Web Application

Navigate to Applications > Create Application

**Settings:**

| Field | Value |
|-------|-------|
| Name | Enterprise Platform Web |
| Application Type | Regular Web Application |
| Token Endpoint Auth Method | Post |

**Allowed URLs Configuration:**

```
Allowed Callback URLs:
  https://app.yourcompany.com/api/auth/callback
  https://staging.yourcompany.com/api/auth/callback
  http://localhost:3000/api/auth/callback

Allowed Logout URLs:
  https://app.yourcompany.com
  https://staging.yourcompany.com
  http://localhost:3000

Allowed Web Origins:
  https://app.yourcompany.com
  https://staging.yourcompany.com
  http://localhost:3000
```

**Application Properties:**

```json
{
  "token_endpoint_auth_method": "client_secret_post",
  "app_type": "regular_web",
  "grant_types": [
    "authorization_code",
    "refresh_token"
  ],
  "oidc_conformant": true
}
```

### Machine-to-Machine Application

Create a second application for backend services:

| Field | Value |
|-------|-------|
| Name | Enterprise Platform M2M |
| Application Type | Machine to Machine |
| Authorized APIs | Enterprise Platform API |

Grant the following scopes:
- `read:users`
- `write:users`
- `read:organizations`
- `write:organizations`
- `read:audit_logs`

---

## Organizations Setup

Organizations enable multi-tenant functionality with isolated user pools.

### Step 1: Enable Organizations

1. Navigate to Organizations in the Auth0 Dashboard
2. Enable the Organizations feature

### Step 2: Configure Organization Settings

Under Organizations > Settings:

```
Default Connection: enterprise-sso
Member Invitation: Enabled
```

### Step 3: Create Organization Template

Create a template organization with standard settings:

```json
{
  "name": "template-org",
  "display_name": "Organization Template",
  "branding": {
    "logo_url": "",
    "colors": {
      "primary": "#0F172A",
      "page_background": "#F8FAFC"
    }
  },
  "metadata": {
    "tier": "enterprise",
    "features": ["sso", "audit_logs", "mfa"],
    "compliance": ["soc2"]
  }
}
```

### Step 4: Organization-Level Connections

Each organization can have specific connections:

| Connection Type | Use Case |
|-----------------|----------|
| Database | Self-service user registration |
| SAML | Enterprise SSO integration |
| OIDC | Third-party IdP integration |
| Azure AD | Microsoft 365 integration |

### Step 5: Organization Roles

Define roles at the organization level:

```
org_admin     - Full organization management
org_member    - Standard access
org_viewer    - Read-only access
org_auditor   - Audit log access only
```

---

## Connection Configuration

### Database Connection

Create a database connection for username/password authentication:

**Settings:**

```
Name: enterprise-db
Requires Username: Yes
Username Policy: alphanumeric with underscore
Minimum Username Length: 3
Maximum Username Length: 50
```

**Password Policy:**

```json
{
  "min_length": 12,
  "max_length": 128,
  "strength": "excellent",
  "history": {
    "enabled": true,
    "size": 5
  },
  "dictionary": {
    "enabled": true,
    "dictionary": ["password", "company", "123456"]
  },
  "no_personal_info": true
}
```

### Enterprise Connections (SAML)

For enterprise SSO integration:

**SAML Configuration:**

```
Entity ID: urn:auth0:{tenant}:{connection}
Assertion Consumer Service URL: https://{tenant}.auth0.com/login/callback
```

**Attribute Mapping:**

| SAML Attribute | Auth0 Attribute |
|----------------|-----------------|
| email | email |
| firstName | given_name |
| lastName | family_name |
| groups | app_metadata.groups |
| department | user_metadata.department |

### Social Connections (Optional)

Configure for development/testing only:

```
Google OAuth 2.0
  - Client ID: {from Google Cloud Console}
  - Client Secret: {from Google Cloud Console}
  - Scopes: openid profile email
```

---

## API Configuration

### Create API Definition

Navigate to Applications > APIs > Create API

**Settings:**

| Field | Value |
|-------|-------|
| Name | Enterprise Platform API |
| Identifier | https://api.yourcompany.com |
| Signing Algorithm | RS256 |

### Define Permissions (Scopes)

```
read:users          - Read user profiles
write:users         - Create/update users
delete:users        - Delete users
read:teams          - Read team data
write:teams         - Create/update teams
read:audit          - Read audit logs
read:compliance     - Read compliance data
write:compliance    - Update compliance settings
admin:platform      - Full platform administration
```

### Token Settings

```
Token Expiration: 86400 (24 hours)
Token Expiration for Browser Flows: 7200 (2 hours)
Enable RBAC: Yes
Add Permissions in the Access Token: Yes
```

### Machine-to-Machine Token Lifetimes

For M2M applications:

```
Access Token Lifetime: 86400 seconds
Enable Offline Access: No
```

---

## Environment Variables

### Required Variables

```bash
# Auth0 Domain and Application
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
AUTH0_CLIENT_SECRET=your_client_secret_here
AUTH0_AUDIENCE=https://api.yourcompany.com

# Auth0 Management API (for M2M operations)
AUTH0_M2M_CLIENT_ID=your_m2m_client_id
AUTH0_M2M_CLIENT_SECRET=your_m2m_client_secret

# Session Configuration
AUTH0_SECRET=use_a_random_32_character_string_here
AUTH0_BASE_URL=https://app.yourcompany.com

# Organization Settings
AUTH0_ORGANIZATION_ID=org_default_id
```

### Environment-Specific Configuration

**Development:**

```bash
AUTH0_DOMAIN=dev-tenant.auth0.com
AUTH0_BASE_URL=http://localhost:3000
AUTH0_DEBUG=true
```

**Staging:**

```bash
AUTH0_DOMAIN=staging-tenant.auth0.com
AUTH0_BASE_URL=https://staging.yourcompany.com
AUTH0_DEBUG=false
```

**Production:**

```bash
AUTH0_DOMAIN=prod-tenant.auth0.com
AUTH0_BASE_URL=https://app.yourcompany.com
AUTH0_DEBUG=false
AUTH0_CACHE_TTL=3600
```

### Secret Management

[!] Never commit secrets to version control.

Recommended secret management solutions:

| Environment | Solution |
|-------------|----------|
| Development | .env.local (gitignored) |
| Staging | AWS Secrets Manager / HashiCorp Vault |
| Production | AWS Secrets Manager / HashiCorp Vault |

---

## Security Best Practices

### Authentication Security

1. **Enforce MFA**
   - Enable MFA at the tenant level
   - Require MFA for all organization admins
   - Support WebAuthn for hardware keys

2. **Token Security**
   - Use short-lived access tokens (2 hours max for browser)
   - Implement refresh token rotation
   - Store tokens securely (httpOnly cookies)

3. **Session Security**
   - Configure appropriate session timeouts
   - Implement session fixation protection
   - Enable absolute session expiry

### Tenant Security

1. **IP Restrictions**
   - Whitelist known IP ranges for admin access
   - Enable anomaly detection

2. **Brute Force Protection**
   - Enable account lockout after failed attempts
   - Configure CAPTCHA for repeated failures

3. **Audit Logging**
   - Export logs to SIEM
   - Configure log retention (minimum 1 year for compliance)

### Connection Security

1. **Database Connections**
   - Use bcrypt for password hashing
   - Implement password history
   - Enable breached password detection

2. **Enterprise Connections**
   - Require signed SAML assertions
   - Validate certificate chains
   - Implement strict attribute mapping

---

## Verification Checklist

Before going to production, verify:

- [ ] Tenant settings configured correctly
- [ ] Applications created with correct URLs
- [ ] Organizations feature enabled and configured
- [ ] Connections tested and working
- [ ] API permissions defined
- [ ] Environment variables set in all environments
- [ ] MFA enabled and tested
- [ ] Audit logging configured
- [ ] Brute force protection enabled
- [ ] Password policies meet security requirements
- [ ] HTTPS enforced on all callback URLs
- [ ] Token lifetimes appropriate for use case

---

## Support and Resources

- Auth0 Documentation: https://auth0.com/docs
- Auth0 Community: https://community.auth0.com
- Enterprise Support: Contact your Auth0 account representative

---

*Document Version: 1.0*
*Last Updated: 2025-01*
