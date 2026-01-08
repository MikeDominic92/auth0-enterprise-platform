#!/usr/bin/env node

/**
 * Demo Data Seeding Script
 *
 * Creates sample organizations, users, roles, and audit logs
 * for demonstration purposes.
 *
 * Usage: npm run db:seed:demo
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/auth0_enterprise',
});

// -----------------------------------------------------------------------------
// Demo Data Definitions
// -----------------------------------------------------------------------------

const ORGANIZATIONS = [
    {
        id: 'org_acme',
        name: 'acme-corporation',
        display_name: 'Acme Corporation',
        metadata: {
            subscription_tier: 'enterprise',
            features: ['sso', 'audit', 'compliance', 'api_access'],
            industry: 'Technology',
            employee_count: 500,
            data_residency: 'us-west-2',
        },
    },
    {
        id: 'org_techstart',
        name: 'tech-startup-inc',
        display_name: 'Tech Startup Inc',
        metadata: {
            subscription_tier: 'professional',
            features: ['sso', 'audit'],
            industry: 'SaaS',
            employee_count: 50,
            data_residency: 'us-east-1',
        },
    },
    {
        id: 'org_university',
        name: 'state-university',
        display_name: 'State University',
        metadata: {
            subscription_tier: 'education',
            features: ['sso', 'audit', 'compliance'],
            industry: 'Education',
            employee_count: 2000,
            data_residency: 'us-central-1',
        },
    },
];

const ROLES = [
    { id: 'role_super_admin', name: 'Super Admin', description: 'Full platform access' },
    { id: 'role_admin', name: 'Admin', description: 'Organization administrator' },
    { id: 'role_manager', name: 'Manager', description: 'Team and user management' },
    { id: 'role_member', name: 'Member', description: 'Standard user access' },
    { id: 'role_viewer', name: 'Viewer', description: 'Read-only access' },
    { id: 'role_compliance', name: 'Compliance Officer', description: 'Audit and compliance access' },
    { id: 'role_billing', name: 'Billing Admin', description: 'Billing and subscription management' },
];

const USERS = [
    // Acme Corporation Users
    {
        auth0_id: 'auth0|acme_admin_001',
        email: 'admin@acme.com',
        name: 'Alice Admin',
        organization_id: 'org_acme',
        roles: ['role_admin', 'role_compliance'],
        status: 'active',
    },
    {
        auth0_id: 'auth0|acme_manager_001',
        email: 'bob.manager@acme.com',
        name: 'Bob Manager',
        organization_id: 'org_acme',
        roles: ['role_manager'],
        status: 'active',
    },
    {
        auth0_id: 'auth0|acme_user_001',
        email: 'carol.user@acme.com',
        name: 'Carol User',
        organization_id: 'org_acme',
        roles: ['role_member'],
        status: 'active',
    },
    {
        auth0_id: 'auth0|acme_user_002',
        email: 'david.developer@acme.com',
        name: 'David Developer',
        organization_id: 'org_acme',
        roles: ['role_member'],
        status: 'active',
    },
    // Tech Startup Users
    {
        auth0_id: 'auth0|techstart_admin_001',
        email: 'admin@techstartup.io',
        name: 'Elena Founder',
        organization_id: 'org_techstart',
        roles: ['role_admin'],
        status: 'active',
    },
    {
        auth0_id: 'auth0|techstart_user_001',
        email: 'frank.engineer@techstartup.io',
        name: 'Frank Engineer',
        organization_id: 'org_techstart',
        roles: ['role_member'],
        status: 'active',
    },
    // University Users
    {
        auth0_id: 'auth0|university_admin_001',
        email: 'admin@university.edu',
        name: 'Grace Dean',
        organization_id: 'org_university',
        roles: ['role_admin', 'role_compliance'],
        status: 'active',
    },
    {
        auth0_id: 'auth0|university_viewer_001',
        email: 'viewer@university.edu',
        name: 'Henry Student',
        organization_id: 'org_university',
        roles: ['role_viewer'],
        status: 'active',
    },
    // Platform Admin
    {
        auth0_id: 'auth0|platform_admin_001',
        email: 'admin@platform.com',
        name: 'Platform Administrator',
        organization_id: 'org_acme',
        roles: ['role_super_admin'],
        status: 'active',
    },
];

const TEAMS = [
    {
        id: 'team_acme_engineering',
        name: 'Engineering',
        organization_id: 'org_acme',
        description: 'Software development team',
    },
    {
        id: 'team_acme_sales',
        name: 'Sales',
        organization_id: 'org_acme',
        description: 'Sales and business development',
    },
    {
        id: 'team_techstart_product',
        name: 'Product',
        organization_id: 'org_techstart',
        description: 'Product development',
    },
];

const AUDIT_EVENT_TYPES = [
    'user.login.success',
    'user.login.failed',
    'user.logout',
    'user.created',
    'user.updated',
    'user.deleted',
    'user.mfa_enrolled',
    'user.password_reset',
    'role.assigned',
    'role.removed',
    'organization.created',
    'organization.updated',
    'permission.denied',
    'compliance.report_generated',
    'admin.settings_changed',
];

// -----------------------------------------------------------------------------
// Seeding Functions
// -----------------------------------------------------------------------------

async function seedOrganizations(client) {
    console.log('[SEED] Creating organizations...');

    for (const org of ORGANIZATIONS) {
        await client.query(`
            INSERT INTO organizations (id, name, display_name, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                display_name = EXCLUDED.display_name,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `, [org.id, org.name, org.display_name, JSON.stringify(org.metadata)]);

        console.log(`  [+] Organization: ${org.display_name}`);
    }
}

async function seedRoles(client) {
    console.log('[SEED] Creating roles...');

    for (const role of ROLES) {
        await client.query(`
            INSERT INTO roles (id, name, description, created_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description
        `, [role.id, role.name, role.description]);

        console.log(`  [+] Role: ${role.name}`);
    }
}

async function seedUsers(client) {
    console.log('[SEED] Creating users...');

    for (const user of USERS) {
        // Insert user
        const result = await client.query(`
            INSERT INTO users (auth0_id, email, name, organization_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (auth0_id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                organization_id = EXCLUDED.organization_id,
                status = EXCLUDED.status,
                updated_at = NOW()
            RETURNING id
        `, [user.auth0_id, user.email, user.name, user.organization_id, user.status]);

        const userId = result.rows[0].id;

        // Assign roles
        for (const roleId of user.roles) {
            await client.query(`
                INSERT INTO user_roles (user_id, role_id, created_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (user_id, role_id) DO NOTHING
            `, [userId, roleId]);
        }

        console.log(`  [+] User: ${user.name} (${user.email})`);
    }
}

async function seedTeams(client) {
    console.log('[SEED] Creating teams...');

    for (const team of TEAMS) {
        await client.query(`
            INSERT INTO teams (id, name, organization_id, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                updated_at = NOW()
        `, [team.id, team.name, team.organization_id, team.description]);

        console.log(`  [+] Team: ${team.name}`);
    }
}

async function seedAuditLogs(client) {
    console.log('[SEED] Generating audit logs...');

    const now = new Date();
    let logCount = 0;

    // Generate logs for past 90 days
    for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);

        // Random number of events per day (5-20)
        const eventsPerDay = Math.floor(Math.random() * 16) + 5;

        for (let i = 0; i < eventsPerDay; i++) {
            const user = USERS[Math.floor(Math.random() * USERS.length)];
            const eventType = AUDIT_EVENT_TYPES[Math.floor(Math.random() * AUDIT_EVENT_TYPES.length)];

            // Random time during business hours
            const hour = Math.floor(Math.random() * 12) + 8; // 8 AM to 8 PM
            const minute = Math.floor(Math.random() * 60);
            date.setHours(hour, minute, 0, 0);

            await client.query(`
                INSERT INTO audit_logs (
                    organization_id,
                    user_id,
                    action,
                    resource_type,
                    resource_id,
                    details,
                    ip_address,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                user.organization_id,
                user.auth0_id,
                eventType,
                eventType.split('.')[0],
                `res_${Math.random().toString(36).substring(7)}`,
                JSON.stringify({
                    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    session_id: `sess_${Math.random().toString(36).substring(7)}`,
                    success: !eventType.includes('failed') && !eventType.includes('denied'),
                }),
                `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                date.toISOString(),
            ]);

            logCount++;
        }
    }

    console.log(`  [+] Generated ${logCount} audit log entries`);
}

async function seedComplianceReports(client) {
    console.log('[SEED] Creating compliance reports...');

    const frameworks = ['soc2', 'hipaa', 'gdpr'];
    const now = new Date();

    for (const org of ORGANIZATIONS) {
        for (const framework of frameworks) {
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() - 1);
            const periodStart = new Date(periodEnd);
            periodStart.setMonth(periodStart.getMonth() - 3);

            const controlResults = [];
            const numControls = Math.floor(Math.random() * 10) + 15;

            for (let i = 0; i < numControls; i++) {
                controlResults.push({
                    control_id: `${framework.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
                    title: `Control ${i + 1}`,
                    status: Math.random() > 0.15 ? 'passed' : 'failed',
                    evidence_count: Math.floor(Math.random() * 20) + 5,
                });
            }

            const passed = controlResults.filter(c => c.status === 'passed').length;
            const score = Math.round((passed / numControls) * 100);

            await client.query(`
                INSERT INTO compliance_reports (
                    organization_id,
                    framework,
                    period_start,
                    period_end,
                    status,
                    findings,
                    generated_by,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
                org.id,
                framework,
                periodStart.toISOString().split('T')[0],
                periodEnd.toISOString().split('T')[0],
                'completed',
                JSON.stringify({
                    control_results: controlResults,
                    summary: {
                        total_controls: numControls,
                        passed: passed,
                        failed: numControls - passed,
                        score: score,
                    },
                }),
                'system',
            ]);

            console.log(`  [+] ${framework.toUpperCase()} report for ${org.display_name} (Score: ${score}%)`);
        }
    }
}

// -----------------------------------------------------------------------------
// Main Execution
// -----------------------------------------------------------------------------

async function main() {
    console.log('');
    console.log('='.repeat(60));
    console.log('Auth0 Enterprise Platform - Demo Data Seeding');
    console.log('='.repeat(60));
    console.log('');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await seedOrganizations(client);
        await seedRoles(client);
        await seedUsers(client);
        await seedTeams(client);
        await seedAuditLogs(client);
        await seedComplianceReports(client);

        await client.query('COMMIT');

        console.log('');
        console.log('='.repeat(60));
        console.log('[SUCCESS] Demo data seeding completed');
        console.log('='.repeat(60));
        console.log('');
        console.log('Summary:');
        console.log(`  - Organizations: ${ORGANIZATIONS.length}`);
        console.log(`  - Roles: ${ROLES.length}`);
        console.log(`  - Users: ${USERS.length}`);
        console.log(`  - Teams: ${TEAMS.length}`);
        console.log('  - Audit Logs: ~1000+');
        console.log(`  - Compliance Reports: ${ORGANIZATIONS.length * 3}`);
        console.log('');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[ERROR] Seeding failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, ORGANIZATIONS, USERS, ROLES };
