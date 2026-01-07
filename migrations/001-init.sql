-- ============================================================================
-- Auth0 Enterprise Platform - Initial Database Schema
-- Migration: 001-init.sql
-- Description: Creates core tables for multi-tenant authentication platform
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ORGANIZATIONS TABLE
-- Multi-tenant organization management
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    description TEXT,

    -- Auth0 Integration
    auth0_org_id VARCHAR(100) UNIQUE,
    auth0_connection_id VARCHAR(100),

    -- Contact Information
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    billing_email VARCHAR(255),

    -- Settings (JSONB for flexibility)
    settings JSONB DEFAULT '{
        "branding": {
            "logo_url": null,
            "primary_color": "#0066CC",
            "background_color": "#FFFFFF"
        },
        "security": {
            "mfa_required": false,
            "password_policy": "good",
            "session_lifetime_hours": 24,
            "idle_timeout_minutes": 30
        },
        "features": {
            "sso_enabled": true,
            "api_access": true,
            "webhooks_enabled": false
        }
    }'::jsonb,

    -- Subscription and Billing
    subscription_tier VARCHAR(50) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled')),
    trial_ends_at TIMESTAMPTZ,

    -- Limits
    max_users INTEGER DEFAULT 10,
    max_teams INTEGER DEFAULT 5,
    max_api_calls_per_month INTEGER DEFAULT 10000,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'suspended')),
    verified_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT organizations_name_length CHECK (char_length(name) >= 2),
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
);

-- Organizations indexes
CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_auth0_org_id ON organizations(auth0_org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_subscription ON organizations(subscription_tier, subscription_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- ============================================================================
-- USERS TABLE
-- User accounts with Auth0 integration
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organization relationship
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Auth0 Integration
    auth0_user_id VARCHAR(255) UNIQUE,

    -- Basic Information
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    username VARCHAR(100),

    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) GENERATED ALWAYS AS (
        CASE
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL
            THEN first_name || ' ' || last_name
            WHEN first_name IS NOT NULL THEN first_name
            WHEN last_name IS NOT NULL THEN last_name
            ELSE NULL
        END
    ) STORED,
    avatar_url TEXT,
    phone_number VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,

    -- Locale and Preferences
    locale VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferences JSONB DEFAULT '{
        "notifications": {
            "email": true,
            "push": true,
            "sms": false
        },
        "ui": {
            "theme": "system",
            "density": "comfortable"
        }
    }'::jsonb,

    -- Security
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_methods JSONB DEFAULT '[]'::jsonb,
    password_changed_at TIMESTAMPTZ,
    last_password_reset TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,

    -- Session tracking
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    last_active_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'suspended', 'blocked')),
    invited_at TIMESTAMPTZ,
    invited_by UUID REFERENCES users(id),
    activated_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    app_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_unique_email_per_org UNIQUE (organization_id, email)
);

-- Users indexes
CREATE INDEX idx_users_organization_id ON users(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_auth0_user_id ON users(auth0_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_login ON users(last_login_at DESC NULLS LAST);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_full_name ON users(full_name) WHERE deleted_at IS NULL;

-- ============================================================================
-- TEAMS TABLE
-- Team/group management within organizations
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organization relationship
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    -- Hierarchy (for nested teams)
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    path LTREE,

    -- Settings
    settings JSONB DEFAULT '{
        "visibility": "private",
        "join_policy": "invite_only",
        "default_role": "member"
    }'::jsonb,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Ownership
    created_by UUID REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT teams_unique_slug_per_org UNIQUE (organization_id, slug),
    CONSTRAINT teams_name_length CHECK (char_length(name) >= 2)
);

-- Enable ltree extension for hierarchical team paths
CREATE EXTENSION IF NOT EXISTS ltree;

-- Teams indexes
CREATE INDEX idx_teams_organization_id ON teams(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams_parent_team_id ON teams(parent_team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams_slug ON teams(organization_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams_path ON teams USING GIST(path) WHERE deleted_at IS NULL;
CREATE INDEX idx_teams_created_at ON teams(created_at);

-- ============================================================================
-- TEAM_MEMBERS TABLE
-- Junction table for team membership
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationships
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role within team
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

    -- Membership details
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    invited_by UUID REFERENCES users(id),
    invitation_accepted_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT team_members_unique_membership UNIQUE (team_id, user_id)
);

-- Team members indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(team_id, role);
CREATE INDEX idx_team_members_status ON team_members(status);

-- ============================================================================
-- ROLES TABLE
-- Role definitions for RBAC
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organization relationship (NULL for system roles)
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Basic Information
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    -- Role type
    type VARCHAR(50) DEFAULT 'custom' CHECK (type IN ('system', 'custom')),

    -- Permissions (array of permission strings)
    permissions JSONB DEFAULT '[]'::jsonb,

    -- Inheritance
    inherits_from UUID REFERENCES roles(id),

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT roles_unique_slug_per_org UNIQUE (organization_id, slug),
    CONSTRAINT roles_name_length CHECK (char_length(name) >= 2)
);

-- Roles indexes
CREATE INDEX idx_roles_organization_id ON roles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_slug ON roles(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_type ON roles(type) WHERE deleted_at IS NULL;

-- ============================================================================
-- USER_ROLES TABLE
-- Junction table for user role assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationships
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,

    -- Scope (optional - for resource-specific roles)
    resource_type VARCHAR(100),
    resource_id UUID,

    -- Assignment details
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Expiration (for temporary role assignments)
    expires_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Constraints
    CONSTRAINT user_roles_unique_assignment UNIQUE (user_id, role_id, resource_type, resource_id)
);

-- User roles indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_resource ON user_roles(resource_type, resource_id);
CREATE INDEX idx_user_roles_expires_at ON user_roles(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_user_roles_status ON user_roles(status);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- Comprehensive audit logging for compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organization context
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- Actor information
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('user', 'system', 'api', 'webhook', 'scheduled')),
    actor_email VARCHAR(255),
    actor_ip INET,
    actor_user_agent TEXT,

    -- Action details
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL CHECK (action_category IN (
        'authentication', 'authorization', 'user_management',
        'organization_management', 'team_management', 'role_management',
        'settings', 'api', 'security', 'compliance', 'system'
    )),
    action_status VARCHAR(50) DEFAULT 'success' CHECK (action_status IN ('success', 'failure', 'pending', 'partial')),

    -- Target resource
    resource_type VARCHAR(100),
    resource_id UUID,
    resource_name VARCHAR(255),

    -- Change tracking
    changes JSONB DEFAULT '{}'::jsonb,
    previous_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,

    -- Request context
    request_id UUID,
    session_id VARCHAR(255),
    correlation_id UUID,

    -- Location and device
    geo_location JSONB DEFAULT '{}'::jsonb,
    device_info JSONB DEFAULT '{}'::jsonb,

    -- Risk and security
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors JSONB DEFAULT '[]'::jsonb,

    -- Error details (for failures)
    error_code VARCHAR(100),
    error_message TEXT,
    error_details JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags VARCHAR(100)[] DEFAULT '{}',

    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Retention
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 years')
);

-- Audit logs indexes (optimized for common query patterns)
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_action_status ON audit_logs(action_status);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_expires_at ON audit_logs(expires_at);
CREATE INDEX idx_audit_logs_risk_score ON audit_logs(risk_score) WHERE risk_score IS NOT NULL;
CREATE INDEX idx_audit_logs_tags ON audit_logs USING GIN(tags);
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN(metadata);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_org_timestamp ON audit_logs(organization_id, timestamp DESC);
CREATE INDEX idx_audit_logs_actor_timestamp ON audit_logs(actor_id, timestamp DESC);

-- ============================================================================
-- COMPLIANCE_REPORTS TABLE
-- Compliance report generation and storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Organization relationship
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Report details
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Report type and framework
    report_type VARCHAR(100) NOT NULL CHECK (report_type IN (
        'access_review', 'permission_audit', 'login_activity',
        'security_assessment', 'data_access', 'gdpr_request',
        'soc2_evidence', 'custom'
    )),
    compliance_framework VARCHAR(50) CHECK (compliance_framework IN (
        'SOC2', 'GDPR', 'HIPAA', 'PCI-DSS', 'ISO27001', 'CCPA', 'custom'
    )),

    -- Report period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Report content
    parameters JSONB DEFAULT '{}'::jsonb,
    filters JSONB DEFAULT '{}'::jsonb,
    summary JSONB DEFAULT '{}'::jsonb,
    findings JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,

    -- Statistics
    statistics JSONB DEFAULT '{}'::jsonb,

    -- File storage
    file_url TEXT,
    file_format VARCHAR(20) CHECK (file_format IN ('pdf', 'csv', 'json', 'xlsx')),
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),

    -- Generation details
    generated_by UUID REFERENCES users(id),
    generation_started_at TIMESTAMPTZ,
    generation_completed_at TIMESTAMPTZ,
    generation_duration_ms INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'generating', 'completed', 'failed', 'expired', 'archived'
    )),
    error_message TEXT,

    -- Scheduling
    is_scheduled BOOLEAN DEFAULT FALSE,
    schedule_cron VARCHAR(100),
    next_run_at TIMESTAMPTZ,

    -- Access control
    visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'organization', 'team')),
    shared_with UUID[] DEFAULT '{}',

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags VARCHAR(100)[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT compliance_reports_period_valid CHECK (period_start < period_end)
);

-- Compliance reports indexes
CREATE INDEX idx_compliance_reports_organization_id ON compliance_reports(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_reports_type ON compliance_reports(report_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_reports_framework ON compliance_reports(compliance_framework) WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_reports_status ON compliance_reports(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_compliance_reports_period ON compliance_reports(period_start, period_end);
CREATE INDEX idx_compliance_reports_generated_by ON compliance_reports(generated_by);
CREATE INDEX idx_compliance_reports_scheduled ON compliance_reports(is_scheduled, next_run_at) WHERE is_scheduled = TRUE;
CREATE INDEX idx_compliance_reports_created_at ON compliance_reports(created_at DESC);
CREATE INDEX idx_compliance_reports_tags ON compliance_reports USING GIN(tags);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at column
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_reports_updated_at
    BEFORE UPDATE ON compliance_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT SYSTEM ROLES
-- ============================================================================

INSERT INTO roles (id, organization_id, name, slug, description, type, permissions, status)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        NULL,
        'Super Admin',
        'super-admin',
        'Full system access with all permissions',
        'system',
        '["*"]'::jsonb,
        'active'
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        NULL,
        'Organization Admin',
        'org-admin',
        'Full administrative access within an organization',
        'system',
        '["org:*", "users:*", "teams:*", "roles:*", "audit:read", "compliance:*"]'::jsonb,
        'active'
    ),
    (
        'a0000000-0000-0000-0000-000000000003',
        NULL,
        'Organization Member',
        'org-member',
        'Standard member access within an organization',
        'system',
        '["users:read:self", "users:update:self", "teams:read", "teams:join"]'::jsonb,
        'active'
    ),
    (
        'a0000000-0000-0000-0000-000000000004',
        NULL,
        'Read Only',
        'read-only',
        'View-only access to organization resources',
        'system',
        '["users:read", "teams:read", "roles:read"]'::jsonb,
        'active'
    ),
    (
        'a0000000-0000-0000-0000-000000000005',
        NULL,
        'Auditor',
        'auditor',
        'Access to audit logs and compliance reports',
        'system',
        '["audit:read", "compliance:read", "users:read", "teams:read"]'::jsonb,
        'active'
    )
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE organizations IS 'Multi-tenant organizations with Auth0 integration';
COMMENT ON TABLE users IS 'User accounts linked to Auth0 identities';
COMMENT ON TABLE teams IS 'Teams/groups within organizations for resource organization';
COMMENT ON TABLE team_members IS 'Junction table linking users to teams with roles';
COMMENT ON TABLE roles IS 'Role definitions for role-based access control (RBAC)';
COMMENT ON TABLE user_roles IS 'User role assignments with optional resource scoping';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance and security monitoring';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports and evidence';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
