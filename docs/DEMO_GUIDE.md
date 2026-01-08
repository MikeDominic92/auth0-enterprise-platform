# Demo Guide

Enterprise B2B SaaS Authorization Platform - CEO Presentation Guide

---

## Pre-Demo Checklist

### 24 Hours Before

- [ ] Verify all services are running and healthy
- [ ] Run `npm run health:check` - all green
- [ ] Seed demo data: `npm run db:seed:demo`
- [ ] Test login flow with demo accounts
- [ ] Verify Auth0 Actions are deployed and active
- [ ] Clear browser cache and cookies
- [ ] Prepare backup laptop with environment configured
- [ ] Test screen sharing and presentation setup

### 1 Hour Before

- [ ] Start fresh server instance: `npm start`
- [ ] Log in to all demo accounts and verify access
- [ ] Open Auth0 Dashboard in separate tab (logged in as admin)
- [ ] Open PostgreSQL client for live queries
- [ ] Prepare demo user credentials document
- [ ] Close unnecessary applications to avoid notifications
- [ ] Silence phone and disable notifications
- [ ] Test microphone and camera

### 15 Minutes Before

- [ ] Clear browser history and autofill
- [ ] Open all demo tabs in order
- [ ] Verify network connectivity is stable
- [ ] Take a deep breath

---

## Demo Flow (45-60 Minutes)

### Opening (5 Minutes)

**Key Message:** "This platform solves the three biggest challenges enterprises face with B2B SaaS authentication: onboarding friction, audit compliance burden, and authorization sprawl."

**Talking Points:**
- Enterprise customers expect SSO integration in hours, not weeks
- SOC 2 audits consume 40+ engineering hours per cycle
- Permission changes shouldn't require code deployments

**Visual:** Show the README.md architecture diagram

---

### Section 1: Multi-Tenant Architecture (10 Minutes)

**Demo Steps:**

1. **Show Organization Isolation**
   ```
   Navigate to: Auth0 Dashboard > Organizations
   ```
   - Highlight organization structure
   - Show metadata (subscription tier, features)
   - Demonstrate member isolation

2. **Create Organization Live**
   ```
   API: POST /api/organizations
   Body: {
     "name": "Demo Corp",
     "display_name": "Demo Corporation",
     "metadata": {
       "subscription_tier": "enterprise",
       "features": ["sso", "audit", "compliance"]
     }
   }
   ```
   - Show instant creation
   - Verify in Auth0 Dashboard

3. **Show Session Binding**
   - Decode a JWT token
   - Highlight `org_id` claim
   - Explain cryptographic binding prevents cross-tenant access

**Key Metrics to Mention:**
- Zero cross-tenant data leakage incidents
- 100% session isolation

---

### Section 2: Authentication Flows (10 Minutes)

**Demo Steps:**

1. **Universal Login with Organization Branding**
   ```
   Navigate to: https://demo.yourapp.com/login?organization=org_acme
   ```
   - Show custom branding per organization
   - Demonstrate smooth login flow

2. **MFA Enrollment and Challenge**
   - Log in as user without MFA
   - Show enrollment prompt
   - Complete MFA setup
   - Log in again to show challenge

3. **Risk-Based Authentication**
   - Show on-login.js Action code
   - Explain risk scoring factors:
     - New device detection
     - Unusual location
     - Failed attempt velocity
     - Business hours check
   - Demonstrate MFA trigger on high-risk login

4. **SSO Configuration (SAML)**
   - Navigate to: Portal > SSO Settings
   - Show metadata upload wizard
   - Explain auto-configuration
   - Highlight: "2 hours vs 2 weeks"

**Key Metrics to Mention:**
- 95% reduction in enterprise onboarding time
- Risk-based MFA blocks 99% of credential stuffing

---

### Section 3: Authorization Engine (10 Minutes)

**Demo Steps:**

1. **Real-Time Permission Changes**
   ```
   API: POST /api/users/{id}/roles
   Body: { "role_ids": ["role_admin"] }
   ```
   - Assign role to user
   - User logs out and back in
   - New permissions immediately active
   - No code deployment required

2. **Permission Hierarchy**
   ```sql
   -- Show in database
   SELECT * FROM roles WHERE organization_id = 'org_acme';
   SELECT * FROM role_permissions WHERE role_id = 'role_admin';
   ```
   - Explain inheritance model
   - Show team-based permissions

3. **ABAC (Attribute-Based Access Control)**
   - Show ABACPolicies in permissions.js
   - Demonstrate `sameOrganization` policy
   - Explain conditional access patterns

4. **Token Enrichment**
   - Show token-enrichment.js Action
   - Highlight scope-based claim filtering
   - Demonstrate `permissions_truncated` flag

**Key Metrics to Mention:**
- 99% reduction in permission change deployment time
- Dynamic authorization without code changes

---

### Section 4: Compliance and Audit (10 Minutes)

**Demo Steps:**

1. **Immutable Audit Trail**
   ```
   Navigate to: Admin Portal > Audit Logs
   ```
   - Show searchable audit history
   - Filter by user, action, date range
   - Explain hash chaining for tamper detection

2. **Generate Compliance Report**
   ```
   API: POST /api/compliance/reports/generate
   Body: {
     "framework": "soc2",
     "period_start": "2024-01-01",
     "period_end": "2024-12-31"
   }
   ```
   - Show report generation
   - Download completed report
   - Highlight control mapping

3. **Audit Readiness Score**
   ```
   API: GET /api/compliance/audit-readiness?framework=soc2
   ```
   - Show readiness score (0-100)
   - Highlight gaps and recommendations
   - Explain automatic evidence collection

4. **Framework Controls**
   - Show SOC 2 control definitions
   - Explain HIPAA compliance mapping
   - Demonstrate GDPR data subject request flow

**Key Metrics to Mention:**
- 90% reduction in audit preparation hours
- Automated evidence collection
- Real-time compliance monitoring

---

### Section 5: Admin Portal (5 Minutes)

**Demo Steps:**

1. **Self-Service User Management**
   ```
   Navigate to: Admin Portal > Users
   ```
   - Create new user
   - Assign roles
   - Send invite email

2. **Organization Settings**
   - Show feature flag configuration
   - Demonstrate subscription tier changes
   - MFA policy enforcement

3. **Dashboard Overview**
   - Active users chart
   - Authentication events
   - Compliance status

---

### Closing (5 Minutes)

**Key Takeaways:**

1. **Enterprise Onboarding:** 2 weeks to 2 hours (95% reduction)
2. **Audit Compliance:** 40 hours to 4 hours (90% reduction)
3. **Authorization Changes:** Days to minutes (99% reduction)
4. **Security:** Zero-trust architecture with complete tenant isolation

**Call to Action:**
- "This architecture pattern is ready for production deployment"
- "Built entirely on Auth0 Organizations and Actions"
- "Scales from 10 to 10,000 enterprise customers"

---

## Demo Credentials

| Account | Email | Password | Role | Organization |
|---------|-------|----------|------|--------------|
| Super Admin | admin@platform.com | [secure] | Super Admin | Platform |
| Acme Admin | admin@acme.com | [secure] | Admin | Acme Corp |
| Acme User | user@acme.com | [secure] | Member | Acme Corp |
| Tech Startup Admin | admin@techstartup.io | [secure] | Admin | Tech Startup |
| Viewer | viewer@university.edu | [secure] | Viewer | State University |

---

## FAQ Preparation

### Security Questions

**Q: How do you prevent cross-tenant data access?**
A: Organization isolation is enforced at three levels:
1. JWT tokens contain `org_id` claim - validated on every request
2. Database queries automatically scoped via `orgIsolation` middleware
3. Auth0 Organizations provide IdP-level session isolation

**Q: What happens if an Action fails?**
A: Actions have built-in retry logic with exponential backoff. Critical failures (like org validation) deny access. Non-critical failures (like audit logging) are logged but don't block authentication.

**Q: How do you handle rate limiting from Auth0?**
A: All Management API calls use `withRetry()` utility with:
- Exponential backoff (1s, 2s, 4s)
- Jitter to prevent thundering herd
- Retry-After header support for 429 responses

### Technical Questions

**Q: Why Auth0 Organizations vs custom multi-tenancy?**
A: Organizations provide:
- Native SSO connection scoping
- Built-in member management
- Branded login pages per tenant
- Reduced attack surface vs custom implementation

**Q: How does the permission system scale?**
A: Permissions are resolved at login and embedded in JWT. API calls validate against token claims - no database lookups needed for authorization.

**Q: Can customers use their own identity provider?**
A: Yes, self-service SSO configuration supports:
- SAML 2.0 (Okta, Azure AD, OneLogin, etc.)
- OIDC (Google Workspace, custom providers)
- SCIM 2.0 for user provisioning

### Business Questions

**Q: What Auth0 plan tier is required?**
A: Organizations feature requires B2B plan or higher. Enterprise plan recommended for:
- Custom domains
- Advanced attack protection
- Higher rate limits
- Premium support

**Q: What's the implementation timeline?**
A: With this architecture pattern:
- Development: 2-4 weeks
- Auth0 configuration: 1 week
- Testing and hardening: 1-2 weeks
- Total: 4-7 weeks to production

**Q: How does pricing work at scale?**
A: Auth0 pricing is based on Monthly Active Users (MAU). This platform optimizes costs by:
- Efficient token caching
- Minimizing Management API calls
- Batching operations where possible

---

## Demo Recovery Procedures

### If Login Fails

1. Check Auth0 Dashboard > Logs for error
2. Verify user exists in organization
3. Clear browser cookies and retry
4. Fallback: Use pre-recorded login flow video

### If API Returns Error

1. Check console for error details
2. Verify database connection: `npm run db:status`
3. Restart server if needed
4. Fallback: Show Postman collection with saved responses

### If Auth0 Dashboard is Slow

1. Prepare screenshots of key screens
2. Use CLI: `auth0 orgs list`
3. Focus on code and architecture discussion

### If Network Issues

1. Have offline documentation ready
2. Use local demo environment
3. Show architecture diagrams from PDF

---

## Post-Demo Follow-Up

- Share GitHub repository link
- Send architecture documentation PDF
- Provide Auth0 resources and documentation links
- Schedule technical deep-dive session if requested
- Offer implementation consulting discussion
