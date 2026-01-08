/**
 * Organization Isolation Middleware
 *
 * Ensures multi-tenant data isolation by enforcing organization boundaries.
 * Critical for B2B SaaS security and compliance requirements.
 *
 * @module backend/middleware/orgIsolation
 */

const pool = require('../db');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * System admin header for cross-org access (requires system:admin permission)
 */
const ORG_OVERRIDE_HEADER = 'x-organization-override';

/**
 * Permission required to use organization override
 */
const SYSTEM_ADMIN_PERMISSION = 'system:admin';

// -----------------------------------------------------------------------------
// Core Middleware
// -----------------------------------------------------------------------------

/**
 * Enforce organization isolation on requests
 * Extracts and validates org_id from JWT token
 *
 * @param {Object} options - Configuration options
 * @param {boolean} [options.required=true] - Whether org_id is required
 * @param {boolean} [options.allowOverride=false] - Allow system admin override
 * @returns {Function} Express middleware
 */
function enforceOrgIsolation(options = {}) {
    const { required = true, allowOverride = false } = options;

    return (req, res, next) => {
        const user = req.user;

        if (!user && required) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required for organization context',
            });
        }

        // Extract org_id from token
        let orgId = user?.org_id;

        // Check for system admin override
        if (allowOverride && user?.permissions?.includes(SYSTEM_ADMIN_PERMISSION)) {
            const overrideOrgId = req.headers[ORG_OVERRIDE_HEADER];
            if (overrideOrgId) {
                console.log(`[ORG ISOLATION] System admin override: ${user.id} accessing org ${overrideOrgId}`);
                orgId = overrideOrgId;

                // Log the override for audit
                logOrgOverride(user, overrideOrgId, req).catch(err => {
                    console.error('[AUDIT] Failed to log org override:', err.message);
                });
            }
        }

        if (required && !orgId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'No organization context available',
                code: 'NO_ORG_CONTEXT',
            });
        }

        // Attach resolved org_id to request for downstream use
        req.orgId = orgId;
        req.orgContext = {
            id: orgId,
            isOverride: req.headers[ORG_OVERRIDE_HEADER] === orgId,
            userId: user?.id,
        };

        next();
    };
}

/**
 * Validate that a resource belongs to the user's organization
 *
 * @param {Function} getResourceOrgId - Function to extract org_id from resource
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/resources/:id',
 *   validateResourceOrg(async (req) => {
 *     const resource = await Resource.findById(req.params.id);
 *     return resource?.organization_id;
 *   }),
 *   handler
 * );
 */
function validateResourceOrg(getResourceOrgId) {
    return async (req, res, next) => {
        const userOrgId = req.orgId || req.user?.org_id;

        if (!userOrgId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'No organization context available',
            });
        }

        try {
            const resourceOrgId = await getResourceOrgId(req);

            if (!resourceOrgId) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'Resource not found',
                });
            }

            if (resourceOrgId !== userOrgId) {
                // Log cross-org access attempt
                console.warn('[SECURITY] Cross-org access attempt:', {
                    userId: req.user?.id,
                    userOrg: userOrgId,
                    resourceOrg: resourceOrgId,
                    path: req.path,
                    method: req.method,
                });

                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Cannot access resources from other organizations',
                    code: 'CROSS_ORG_ACCESS_DENIED',
                });
            }

            next();
        } catch (error) {
            console.error('[ORG ISOLATION] Error validating resource org:', error.message);
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to validate organization access',
            });
        }
    };
}

/**
 * Build organization-scoped database query
 * Automatically adds WHERE organization_id clause
 *
 * @param {Object} req - Express request object
 * @param {string} baseQuery - Base SQL query (must not include WHERE)
 * @param {Array} [baseParams=[]] - Base query parameters
 * @param {Object} [options={}] - Query options
 * @returns {Object} Query object with text and values
 */
function buildOrgScopedQuery(req, baseQuery, baseParams = [], options = {}) {
    const { orgColumn = 'organization_id', includeWhere = true } = options;
    const orgId = req.orgId || req.user?.org_id;

    if (!orgId) {
        throw new Error('Organization context required for scoped query');
    }

    const paramIndex = baseParams.length + 1;
    const whereClause = includeWhere ? 'WHERE' : 'AND';

    const scopedQuery = `${baseQuery} ${whereClause} ${orgColumn} = $${paramIndex}`;
    const scopedParams = [...baseParams, orgId];

    return {
        text: scopedQuery,
        values: scopedParams,
        orgId,
    };
}

/**
 * Helper to add org_id filter to existing WHERE clause
 *
 * @param {Object} req - Express request object
 * @param {string} query - Existing query with WHERE clause
 * @param {Array} params - Existing parameters
 * @param {Object} [options={}] - Options
 * @returns {Object} Modified query and params
 */
function appendOrgFilter(req, query, params = [], options = {}) {
    const { orgColumn = 'organization_id' } = options;
    const orgId = req.orgId || req.user?.org_id;

    if (!orgId) {
        throw new Error('Organization context required');
    }

    const paramIndex = params.length + 1;
    const modifiedQuery = `${query} AND ${orgColumn} = $${paramIndex}`;
    const modifiedParams = [...params, orgId];

    return {
        text: modifiedQuery,
        values: modifiedParams,
        orgId,
    };
}

// -----------------------------------------------------------------------------
// Audit Helpers
// -----------------------------------------------------------------------------

/**
 * Log organization override for audit trail
 */
async function logOrgOverride(user, targetOrgId, req) {
    try {
        await pool.query(`
            INSERT INTO audit_logs (
                organization_id,
                user_id,
                action,
                resource_type,
                resource_id,
                details,
                ip_address,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            targetOrgId,
            user.id || user.sub,
            'admin.organization_override',
            'organization',
            targetOrgId,
            JSON.stringify({
                admin_org: user.org_id,
                target_org: targetOrgId,
                path: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'],
            }),
            req.ip || req.headers['x-forwarded-for'] || 'unknown',
        ]);
    } catch (error) {
        // Don't throw - audit logging should never block operations
        console.error('[AUDIT] Failed to log org override:', error.message);
    }
}

// -----------------------------------------------------------------------------
// Query Helpers for Common Patterns
// -----------------------------------------------------------------------------

/**
 * Create a scoped SELECT query helper
 *
 * @param {string} tableName - Table to query
 * @param {Object} options - Query options
 * @returns {Function} Query builder function
 */
function createScopedSelectBuilder(tableName, options = {}) {
    const { orgColumn = 'organization_id' } = options;

    return (req, columns = '*', additionalWhere = '', additionalParams = []) => {
        const orgId = req.orgId || req.user?.org_id;
        if (!orgId) {
            throw new Error('Organization context required');
        }

        let query = `SELECT ${columns} FROM ${tableName} WHERE ${orgColumn} = $1`;
        const params = [orgId];

        if (additionalWhere) {
            query += ` AND ${additionalWhere}`;
            params.push(...additionalParams);
        }

        return { text: query, values: params };
    };
}

/**
 * Create a scoped INSERT query helper
 *
 * @param {string} tableName - Table to insert into
 * @param {Object} options - Query options
 * @returns {Function} Query builder function
 */
function createScopedInsertBuilder(tableName, options = {}) {
    const { orgColumn = 'organization_id' } = options;

    return (req, data, returning = '*') => {
        const orgId = req.orgId || req.user?.org_id;
        if (!orgId) {
            throw new Error('Organization context required');
        }

        // Ensure org_id is set
        const dataWithOrg = { ...data, [orgColumn]: orgId };
        const columns = Object.keys(dataWithOrg);
        const values = Object.values(dataWithOrg);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        const query = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING ${returning}
        `;

        return { text: query, values };
    };
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    // Core middleware
    enforceOrgIsolation,
    validateResourceOrg,

    // Query helpers
    buildOrgScopedQuery,
    appendOrgFilter,
    createScopedSelectBuilder,
    createScopedInsertBuilder,

    // Constants
    ORG_OVERRIDE_HEADER,
    SYSTEM_ADMIN_PERMISSION,
};
