# Deployment Guide

Enterprise B2B SaaS Authorization Platform - Production Deployment

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.x LTS | 20.x LTS |
| PostgreSQL | 15.x | 16.x |
| Redis | 7.x | 7.2+ |
| Memory | 2GB | 4GB+ |
| CPU | 2 cores | 4 cores |

### Auth0 Requirements

- Auth0 account with Organizations feature enabled
- Appropriate plan tier (B2B/Enterprise features)
- Management API credentials with required scopes

### Required Auth0 Scopes

```
read:users
update:users
create:users
delete:users
read:roles
create:roles
update:roles
delete:roles
read:organizations
create:organizations
update:organizations
delete:organizations
read:organization_members
create:organization_members
delete:organization_members
read:organization_connections
create:organization_connections
delete:organization_connections
read:logs
read:connections
create:connections
update:connections
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Auth0 Configuration (REQUIRED)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_spa_client_id
AUTH0_CLIENT_SECRET=your_spa_client_secret
AUTH0_AUDIENCE=https://api.yourapp.com
AUTH0_ISSUER=https://your-tenant.auth0.com/

# Auth0 Management API (REQUIRED)
AUTH0_MGMT_CLIENT_ID=your_mgmt_client_id
AUTH0_MGMT_CLIENT_SECRET=your_mgmt_client_secret

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/dbname
# OR individual settings:
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=auth0_enterprise
DATABASE_USER=postgres
DATABASE_PASSWORD=your_secure_password

# Database Pool Settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_IDLE_TIMEOUT=30000
DATABASE_CONNECTION_TIMEOUT=5000

# SSL Configuration (for production)
DATABASE_SSL_ENABLED=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true

# Redis (REQUIRED for production)
REDIS_URL=redis://localhost:6379
# OR individual settings:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Application Configuration
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourapp.com

# Security
JWT_SECRET=generate_with_openssl_rand_base64_32
ENCRYPTION_KEY=generate_with_openssl_rand_base64_32

# Auth0 Claims Namespace
AUTH0_CLAIMS_NAMESPACE=https://yourapp.com/

# Retry Configuration
AUTH0_MAX_RETRIES=3
AUTH0_RETRY_BASE_DELAY=1000
AUTH0_RETRY_MAX_DELAY=10000

# Clock Tolerance (seconds)
AUTH0_CLOCK_TOLERANCE=30
```

### Optional Configuration

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
DATADOG_API_KEY=your_datadog_key
OPENTELEMETRY_ENDPOINT=your_otel_endpoint

# Feature Flags
ENABLE_COMPLIANCE_REPORTS=true
ENABLE_AUDIT_LOGGING=true
```

---

## Database Setup

### 1. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE auth0_enterprise;
CREATE USER auth0_app WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE auth0_enterprise TO auth0_app;

# Enable UUID extension
\c auth0_enterprise
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2. Run Migrations

```bash
# Apply all migrations
npm run db:migrate

# Verify migration status
npm run db:status
```

### 3. Seed Initial Data (Optional)

```bash
# Seed demo organizations and users
npm run db:seed

# Seed compliance framework data
npm run db:seed:compliance
```

---

## Auth0 Tenant Setup

### 1. Create Applications

**Regular Web Application (SPA)**
- Application Type: Single Page Application
- Allowed Callback URLs: `https://yourapp.com/callback`
- Allowed Logout URLs: `https://yourapp.com`
- Allowed Web Origins: `https://yourapp.com`

**Machine-to-Machine Application**
- Application Type: Machine to Machine
- Authorize for: Auth0 Management API
- Grant all required scopes listed above

### 2. Deploy Auth0 Actions

Deploy the following Actions to your Auth0 tenant:

```bash
# Navigate to Actions directory
cd src/auth0-actions

# Deploy using Auth0 Deploy CLI
auth0 deploy import --input-file actions-manifest.json
```

**Action Deployment Order:**
1. `on-login.js` - Post Login trigger
2. `on-signup.js` - Post User Registration trigger
3. `token-enrichment.js` - Post Login trigger (after on-login)

### 3. Configure Action Secrets

In Auth0 Dashboard > Actions > Library > [Action] > Secrets:

```
TOKEN_NAMESPACE=https://yourapp.com/
HIGH_RISK_COUNTRIES=KP,IR,SY,CU
RISK_THRESHOLD_MFA=50
RISK_THRESHOLD_BLOCK=80
REQUEST_TIMEOUT_MS=5000
AUDIT_LOG_ENDPOINT=https://api.yourapp.com/audit
AUDIT_LOG_API_KEY=your_audit_api_key
```

### 4. Enable Organizations

1. Navigate to Auth0 Dashboard > Settings > Features
2. Enable "Organizations"
3. Configure default organization settings

---

## Deployment Options

### Option A: Docker Deployment

```bash
# Build image
docker build -t auth0-enterprise-platform .

# Run container
docker run -d \
  --name auth0-platform \
  -p 3000:3000 \
  --env-file .env.production \
  auth0-enterprise-platform
```

**docker-compose.yml:**

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: auth0_enterprise
      POSTGRES_USER: auth0_app
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U auth0_app -d auth0_enterprise"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Option B: Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth0-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth0-platform
  template:
    metadata:
      labels:
        app: auth0-platform
    spec:
      containers:
      - name: api
        image: auth0-enterprise-platform:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: auth0-platform-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Option C: Cloud Provider Deployments

**AWS (Elastic Beanstalk / ECS)**
```bash
# Deploy to Elastic Beanstalk
eb init auth0-platform
eb create production
eb deploy
```

**Azure (App Service)**
```bash
# Deploy to Azure App Service
az webapp up --name auth0-platform --resource-group your-rg
```

**Google Cloud (Cloud Run)**
```bash
# Deploy to Cloud Run
gcloud run deploy auth0-platform \
  --image gcr.io/your-project/auth0-platform \
  --platform managed \
  --region us-central1
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# API health check
curl https://api.yourapp.com/api/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "auth0": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Auth0 Connectivity

```bash
# Verify Auth0 Management API access
npm run auth0:verify

# Expected output:
[AUTH0] Connection successful
[AUTH0] Scope validation passed
[AUTH0] Organizations feature: enabled
```

### 3. Database Verification

```bash
# Check database connection and tables
npm run db:status

# Expected output:
Database: auth0_enterprise
Connection: OK
Tables: 12
Migrations: up-to-date
```

### 4. End-to-End Test

```bash
# Run production smoke tests
npm run test:smoke

# Run full integration test suite
npm run test:integration
```

---

## Monitoring Setup

### Datadog Integration

```bash
# Install Datadog agent
DD_API_KEY=your_api_key bash -c "$(curl -L https://install.datadoghq.com/scripts/install_script.sh)"

# Configure application tracing
npm install dd-trace --save
```

### OpenTelemetry Configuration

```javascript
// instrumentation.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OPENTELEMETRY_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/health` | Overall health | `{ status: "healthy" }` |
| `/api/health/db` | Database status | `{ connected: true }` |
| `/api/health/redis` | Redis status | `{ connected: true }` |
| `/api/health/auth0` | Auth0 status | `{ connected: true }` |

---

## Rollback Procedures

### Database Rollback

```bash
# Rollback last migration
npm run db:migrate:undo

# Rollback to specific version
npm run db:migrate:undo:to VERSION_NUMBER
```

### Application Rollback

**Docker:**
```bash
# Roll back to previous image
docker run -d auth0-platform:previous-version
```

**Kubernetes:**
```bash
# Rollback deployment
kubectl rollout undo deployment/auth0-platform
```

### Auth0 Actions Rollback

1. Navigate to Auth0 Dashboard > Actions > Library
2. Select the Action
3. Click "Revisions" tab
4. Deploy previous revision

---

## Security Checklist

- [ ] All environment variables set correctly
- [ ] Database SSL enabled in production
- [ ] Redis password configured
- [ ] Auth0 tenant secured with appropriate IP restrictions
- [ ] HTTPS enabled with valid TLS certificates
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Monitoring and alerting configured
- [ ] Backup procedures in place
- [ ] Incident response plan documented

---

## Support

For deployment issues:
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review application logs: `npm run logs`
3. Check Auth0 logs in Dashboard > Logs
