# Troubleshooting Guide

Enterprise B2B SaaS Authorization Platform - Common Issues and Solutions

---

## Quick Diagnostics

Run these commands first to identify issues:

```bash
# Check overall system health
npm run health:check

# Verify database connection
npm run db:status

# Test Auth0 connectivity
npm run auth0:verify

# View recent logs
npm run logs -- --lines 100
```

---

## Startup Failures

### Issue: MODULE_NOT_FOUND Error

**Symptom:**
```
Error: Cannot find module '../db'
```

**Cause:** Missing database connection module

**Solution:**
1. Verify `src/backend/db.js` exists
2. Check file path in require statement
3. Run `npm install` to ensure dependencies are installed

```bash
# Verify file exists
ls -la src/backend/db.js

# Reinstall dependencies
rm -rf node_modules && npm install
```

### Issue: Environment Variables Not Loading

**Symptom:**
```
Error: AUTH0_DOMAIN environment variable is required
```

**Cause:** Missing or incorrect environment configuration

**Solution:**
1. Verify `.env` file exists (or `.env.local` / `.env.production`)
2. Check variable names match exactly (case-sensitive)
3. Ensure no trailing whitespace in values

```bash
# Check environment file
cat .env | grep AUTH0

# Verify variable is loaded
node -e "console.log(process.env.AUTH0_DOMAIN)"
```

### Issue: Database Connection Failed

**Symptom:**
```
Error: Database connection failed: ECONNREFUSED
```

**Causes and Solutions:**

| Cause | Solution |
|-------|----------|
| Database not running | Start PostgreSQL service |
| Wrong host/port | Check DATABASE_HOST and DATABASE_PORT |
| Authentication failed | Verify DATABASE_USER and DATABASE_PASSWORD |
| Database doesn't exist | Create database with `createdb auth0_enterprise` |

```bash
# Test database connection
psql -h localhost -U postgres -d auth0_enterprise -c "SELECT 1"

# Check PostgreSQL status
systemctl status postgresql
# or on macOS:
brew services list | grep postgresql
```

---

## Authentication Issues

### Issue: Invalid Token Error

**Symptom:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "code": "invalid_token"
}
```

**Possible Causes:**

1. **Token expired** - Check token expiration time
2. **Wrong audience** - Verify AUTH0_AUDIENCE matches API identifier
3. **Wrong issuer** - Verify AUTH0_ISSUER matches your tenant URL
4. **Clock skew** - Server time differs from Auth0 by more than 30 seconds

**Debug Steps:**
```bash
# Decode and inspect token (without verifying)
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .

# Check server time
date -u

# Compare with Auth0 token 'iat' claim
```

**Solution:**
```bash
# Increase clock tolerance if needed
AUTH0_CLOCK_TOLERANCE=60

# Sync server time
sudo ntpdate pool.ntp.org
```

### Issue: MFA Loop - User Stuck in MFA Prompt

**Symptom:** User completes MFA but is immediately prompted again

**Causes:**
1. Session not persisting correctly
2. MFA enrollment not completing
3. Risk score triggering repeated MFA

**Solution:**
1. Check browser cookies are enabled
2. Clear Auth0 session: `https://your-tenant.auth0.com/logout`
3. Check Auth0 Dashboard > Logs for MFA events
4. Review risk score thresholds in on-login Action

```javascript
// In on-login.js, check RISK_THRESHOLD_MFA
RISK_THRESHOLD_MFA: parseInt(event.secrets.RISK_THRESHOLD_MFA) || 50
```

### Issue: Organization Not Found

**Symptom:**
```json
{
  "error": "Forbidden",
  "message": "No organization context available"
}
```

**Causes:**
1. User not logged in with organization context
2. Organization ID not in token claims
3. User not a member of the organization

**Solution:**
```javascript
// Ensure login uses organization
loginWithRedirect({
  authorizationParams: {
    organization: 'org_xxx'
  }
});
```

---

## Authorization Issues

### Issue: 403 Forbidden - Permission Denied

**Symptom:**
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions",
  "required": ["users:create"]
}
```

**Debug Steps:**
1. Decode access token to view claims
2. Check `permissions` array in token
3. Verify role assignment in Auth0 Dashboard

```bash
# Decode token and check permissions
echo $ACCESS_TOKEN | cut -d'.' -f2 | base64 -d | jq '.permissions'
```

**Common Fixes:**
- Assign missing role to user in Auth0 Dashboard
- Add permission to role
- Verify token-enrichment Action is deployed and active

### Issue: Cross-Organization Access Denied

**Symptom:**
```json
{
  "error": "Forbidden",
  "code": "CROSS_ORG_ACCESS_DENIED"
}
```

**Cause:** User attempting to access resources from a different organization

**Solution:**
1. This is expected behavior - organizations are isolated
2. For system admins, use X-Organization-Override header
3. Verify user is member of correct organization

```bash
# For system admins only:
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Organization-Override: org_target" \
     https://api.yourapp.com/users
```

---

## Database Issues

### Issue: Pool Exhaustion

**Symptom:**
```
Error: Connection pool exhausted - all connections in use
```

**Causes:**
1. Too many concurrent connections
2. Connections not being released
3. Long-running queries

**Solution:**
```bash
# Increase pool size
DATABASE_POOL_MAX=50

# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'auth0_enterprise';

# Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'auth0_enterprise'
  AND state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';
```

### Issue: Migration Failed

**Symptom:**
```
Error: Migration 20240115_create_users failed
```

**Solution:**
```bash
# Check migration status
npm run db:migrate:status

# View pending migrations
npm run db:migrate:pending

# Manually fix and retry
npm run db:migrate:up
```

### Issue: Query Timeout

**Symptom:**
```
Error: Query read timeout
```

**Solution:**
```bash
# Increase connection timeout
DATABASE_CONNECTION_TIMEOUT=10000

# Check for slow queries
SELECT query, state, now() - query_start AS duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```

---

## Performance Issues

### Issue: Slow API Response Times

**Symptom:** API calls taking > 2 seconds

**Debug Steps:**

1. **Check database performance:**
```sql
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

2. **Check Auth0 latency:**
```bash
time curl https://your-tenant.auth0.com/.well-known/openid-configuration
```

3. **Check Redis performance:**
```bash
redis-cli --latency
```

**Common Fixes:**
- Add database indexes for frequently queried columns
- Enable Redis caching for Auth0 JWKS
- Increase connection pool sizes
- Scale horizontally with more application instances

### Issue: High Memory Usage

**Symptom:** Node.js process using > 1GB memory

**Debug Steps:**
```bash
# Generate heap snapshot
node --inspect-brk src/server.js
# Connect Chrome DevTools and take heap snapshot

# Check for memory leaks
node --expose-gc -e "gc(); console.log(process.memoryUsage())"
```

**Common Fixes:**
- Check for unclosed database connections
- Verify event listeners are removed
- Review large object allocations

---

## Auth0 Integration Issues

### Issue: Actions Not Firing

**Symptom:** Custom claims not appearing in tokens

**Debug Steps:**
1. Check Auth0 Dashboard > Actions > Flows
2. Verify Action is attached to correct trigger
3. Check Action logs for errors

```bash
# View Action execution logs
curl -H "Authorization: Bearer $MGMT_TOKEN" \
  "https://your-tenant.auth0.com/api/v2/logs?q=type:fsa"
```

**Common Fixes:**
- Ensure Action is deployed (not draft)
- Check Action is in correct position in flow
- Verify no syntax errors in Action code
- Check Action secrets are set correctly

### Issue: Rate Limiting (429 Errors)

**Symptom:**
```json
{
  "error": "Too Many Requests",
  "error_description": "Rate limit exceeded"
}
```

**Solution:**
1. Check Auth0 rate limits for your plan
2. Implement caching for Management API calls
3. Use exponential backoff retry logic (already implemented in auth0.js)

```bash
# Check retry configuration
AUTH0_MAX_RETRIES=3
AUTH0_RETRY_BASE_DELAY=1000
AUTH0_RETRY_MAX_DELAY=10000
```

### Issue: JWKS Fetch Failed

**Symptom:**
```
Error: Unable to fetch JWKS from issuer
```

**Causes:**
1. Network connectivity issue
2. Auth0 tenant URL incorrect
3. Firewall blocking outbound HTTPS

**Solution:**
```bash
# Test JWKS endpoint
curl https://your-tenant.auth0.com/.well-known/jwks.json

# Check DNS resolution
nslookup your-tenant.auth0.com

# Verify no proxy issues
curl -v --proxy "" https://your-tenant.auth0.com/.well-known/jwks.json
```

---

## Logging and Debugging

### Enable Debug Mode

```bash
# Enable all debug logs
DEBUG=* npm start

# Enable specific debug namespaces
DEBUG=auth0:*,express:* npm start

# Enable verbose Auth0 SDK logging
AUTH0_DEBUG=true npm start
```

### Log Levels

| Level | When to Use |
|-------|-------------|
| error | Production - errors only |
| warn | Production - warnings and errors |
| info | Production - general info |
| debug | Development - detailed debugging |
| trace | Development - everything |

```bash
LOG_LEVEL=debug npm start
```

### Check Auth0 Logs

1. Navigate to Auth0 Dashboard > Logs
2. Filter by log type:
   - `s` - Success Login
   - `f` - Failed Login
   - `w` - Warning
   - `fsa` - Action Failed
   - `ssa` - Action Success

### Export Logs for Analysis

```bash
# Export recent logs to file
npm run logs:export -- --from 2024-01-01 --to 2024-01-15 > logs.json

# Analyze error frequency
cat logs.json | jq '.[] | select(.type | startswith("f"))' | jq -s 'group_by(.type) | map({type: .[0].type, count: length})'
```

---

## Support Escalation

If issues persist after following this guide:

1. **Collect diagnostics:**
   ```bash
   npm run diagnostics > diagnostics.txt
   ```

2. **Include in support request:**
   - diagnostics.txt output
   - Relevant log entries
   - Steps to reproduce
   - Expected vs actual behavior

3. **Check documentation:**
   - [Auth0 Documentation](https://auth0.com/docs)
   - [Auth0 Community](https://community.auth0.com)

4. **Contact Auth0 Support:**
   - Include tenant name
   - Provide request IDs from logs
