/**
 * Permission Checking Middleware
 *
 * Role-based and permission-based access control middleware.
 * Supports hierarchical permissions, resource ownership, and dynamic checks.
 * Includes audit logging for security-sensitive operations.
 *
 * @module backend/middleware/permissions
 */

const pool = require('../db');

// -----------------------------------------------------------------------------
// Permission Constants
// -----------------------------------------------------------------------------

/**
 * Available permissions in the system
 */
const PERMISSIONS = {
    // User permissions
    USER_READ: 'user:read',
    USER_CREATE: 'user:create',
    USER_UPDATE: 'user:update',
    USER_DELETE: 'user:delete',
    USER_MANAGE_ROLES: 'user:manage-roles',

    // Team permissions
    TEAM_READ: 'team:read',
    TEAM_CREATE: 'team:create',
    TEAM_UPDATE: 'team:update',
    TEAM_DELETE: 'team:delete',
    TEAM_MANAGE_MEMBERS: 'team:manage-members',

    // Audit permissions
    AUDIT_READ: 'audit:read',
    AUDIT_EXPORT: 'audit:export',

    // Compliance permissions
    COMPLIANCE_READ: 'compliance:read',
    COMPLIANCE_GENERATE: 'compliance:generate',
    COMPLIANCE_EXPORT: 'compliance:export',

    // Admin permissions
    ADMIN_FULL: 'admin:full',
    ADMIN_READ: 'admin:read',
};

/**
 * Role definitions with associated permissions
 */
const ROLES = {
    SUPER_ADMIN: {
        name: 'Super Admin',
        permissions: Object.values(PERMISSIONS),
    },
    ADMIN: {
        name: 'Admin',
        permissions: [
            PERMISSIONS.USER_READ,
            PERMISSIONS.USER_CREATE,
            PERMISSIONS.USER_UPDATE,
            PERMISSIONS.USER_MANAGE_ROLES,
            PERMISSIONS.TEAM_READ,
            PERMISSIONS.TEAM_CREATE,
            PERMISSIONS.TEAM_UPDATE,
            PERMISSIONS.TEAM_MANAGE_MEMBERS,
            PERMISSIONS.AUDIT_READ,
            PERMISSIONS.AUDIT_EXPORT,
            PERMISSIONS.COMPLIANCE_READ,
            PERMISSIONS.COMPLIANCE_GENERATE,
            PERMISSIONS.ADMIN_READ,
        ],
    },
    MANAGER: {
        name: 'Manager',
        permissions: [
            PERMISSIONS.USER_READ,
            PERMISSIONS.USER_UPDATE,
            PERMISSIONS.TEAM_READ,
            PERMISSIONS.TEAM_UPDATE,
            PERMISSIONS.TEAM_MANAGE_MEMBERS,
            PERMISSIONS.AUDIT_READ,
            PERMISSIONS.COMPLIANCE_READ,
        ],
    },
    MEMBER: {
        name: 'Member',
        permissions: [
            PERMISSIONS.USER_READ,
            PERMISSIONS.TEAM_READ,
        ],
    },
    VIEWER: {
        name: 'Viewer',
        permissions: [
            PERMISSIONS.USER_READ,
            PERMISSIONS.TEAM_READ,
            PERMISSIONS.AUDIT_READ,
        ],
    },
};

// -----------------------------------------------------------------------------
// Permission Checking Functions
// -----------------------------------------------------------------------------

/**
 * Check if user has a specific permission
 *
 * @param {Object} user - User object from request
 * @param {string} permission - Permission to check
 * @returns {boolean} Whether user has the permission
 */
function hasPermission(user, permission) {
    if (!user || !permission) {
        return false;
    }

    // Check direct permissions
    if (user.permissions && user.permissions.includes(permission)) {
        return true;
    }

    // Check role-based permissions
    if (user.roles) {
        for (const roleName of user.roles) {
            const role = ROLES[roleName.toUpperCase().replace(/ /g, '_')];
            if (role && role.permissions.includes(permission)) {
                return true;
            }
        }
    }

    // Check for admin override (super admin bypass)
    if (user.permissions?.includes(PERMISSIONS.ADMIN_FULL)) {
        // Log super admin bypass for audit compliance
        auditAdminBypass(user, permission).catch(err => {
            console.error('[AUDIT] Failed to log admin bypass:', err.message);
        });
        return true;
    }

    return false;
}

/**
 * Log super admin permission bypass for compliance auditing
 * Critical for SOC2 and security monitoring
 *
 * @param {Object} user - User performing the action
 * @param {string} permission - Permission being bypassed
 */
async function auditAdminBypass(user, permission) {
    try {
        await pool.query(`
            INSERT INTO audit_logs (
                organization_id,
                user_id,
                action,
                resource_type,
                details,
                ip_address,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
            user.org_id || 'system',
            user.id || user.sub,
            'admin.permission_bypass',
            'permission',
            JSON.stringify({
                bypassed_permission: permission,
                user_roles: user.roles || [],
                user_permissions: user.permissions || [],
                reason: 'ADMIN_FULL permission granted'
            }),
            user._requestIp || 'unknown'
        ]);
    } catch (error) {
        // Don't throw - audit logging should never block operations
        console.error('[AUDIT] Failed to log admin bypass:', error.message);
    }
}

/**
 * Check if user has all specified permissions
 *
 * @param {Object} user - User object from request
 * @param {string[]} permissions - Permissions to check
 * @returns {boolean} Whether user has all permissions
 */
function hasAllPermissions(user, permissions) {
    return permissions.every(perm => hasPermission(user, perm));
}

/**
 * Check if user has any of the specified permissions
 *
 * @param {Object} user - User object from request
 * @param {string[]} permissions - Permissions to check
 * @returns {boolean} Whether user has any permission
 */
function hasAnyPermission(user, permissions) {
    return permissions.some(perm => hasPermission(user, perm));
}

/**
 * Check if user has a specific role
 *
 * @param {Object} user - User object from request
 * @param {string} roleName - Role name to check
 * @returns {boolean} Whether user has the role
 */
function hasRole(user, roleName) {
    if (!user || !user.roles) {
        return false;
    }

    const normalizedRoleName = roleName.toLowerCase();
    return user.roles.some(role => role.toLowerCase() === normalizedRoleName);
}

// -----------------------------------------------------------------------------
// Middleware Factories
// -----------------------------------------------------------------------------

/**
 * Create middleware requiring specific permissions
 *
 * @param {...string} requiredPermissions - Required permissions
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/users', requirePermissions(PERMISSIONS.USER_CREATE), createUser);
 */
function requirePermissions(...requiredPermissions) {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }

        if (!hasAllPermissions(user, requiredPermissions)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions',
                required: requiredPermissions,
                actual: user.permissions || [],
            });
        }

        next();
    };
}

/**
 * Create middleware requiring any of the specified permissions
 *
 * @param {...string} permissions - Acceptable permissions
 * @returns {Function} Express middleware
 */
function requireAnyPermission(...permissions) {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }

        if (!hasAnyPermission(user, permissions)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions',
                requiredAny: permissions,
            });
        }

        next();
    };
}

/**
 * Create middleware requiring specific roles
 *
 * @param {...string} requiredRoles - Required roles
 * @returns {Function} Express middleware
 */
function requireRoles(...requiredRoles) {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }

        const hasRequiredRole = requiredRoles.some(role => hasRole(user, role));

        if (!hasRequiredRole) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient role privileges',
                required: requiredRoles,
                actual: user.roles || [],
            });
        }

        next();
    };
}

/**
 * Create middleware for resource ownership check
 * Allows access if user owns the resource or has bypass permission
 *
 * @param {Function} getOwnerId - Function to extract owner ID from request
 * @param {string} [bypassPermission] - Permission that bypasses ownership check
 * @returns {Function} Express middleware
 *
 * @example
 * router.put('/users/:id', requireOwnership(req => req.params.id, PERMISSIONS.USER_UPDATE), updateUser);
 */
function requireOwnership(getOwnerId, bypassPermission = null) {
    return async (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }

        // Check bypass permission
        if (bypassPermission && hasPermission(user, bypassPermission)) {
            return next();
        }

        // Get owner ID
        let ownerId;
        try {
            ownerId = typeof getOwnerId === 'function'
                ? await getOwnerId(req)
                : req.params[getOwnerId];
        } catch (error) {
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to determine resource ownership',
            });
        }

        // Compare with user ID
        if (ownerId !== user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Not authorized to access this resource',
            });
        }

        next();
    };
}

/**
 * Create middleware for team membership check
 *
 * @param {Function|string} getTeamId - Function or param name to get team ID
 * @param {string} [bypassPermission] - Permission that bypasses check
 * @returns {Function} Express middleware
 */
function requireTeamMembership(getTeamId, bypassPermission = null) {
    return async (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }

        // Check bypass permission
        if (bypassPermission && hasPermission(user, bypassPermission)) {
            return next();
        }

        // Get team ID
        let teamId;
        try {
            teamId = typeof getTeamId === 'function'
                ? await getTeamId(req)
                : req.params[getTeamId];
        } catch (error) {
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to determine team membership',
            });
        }

        // Check team membership (would typically query database)
        const userTeams = user.metadata?.teams || [];
        if (!userTeams.includes(teamId)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Not a member of this team',
            });
        }

        next();
    };
}

/**
 * Create conditional permission middleware
 * Applies different permission checks based on request characteristics
 *
 * @param {Function} condition - Function returning true/false
 * @param {Function} trueMiddleware - Middleware if condition is true
 * @param {Function} falseMiddleware - Middleware if condition is false
 * @returns {Function} Express middleware
 */
function conditionalPermissions(condition, trueMiddleware, falseMiddleware) {
    return (req, res, next) => {
        const shouldApplyTrue = condition(req);
        const middleware = shouldApplyTrue ? trueMiddleware : falseMiddleware;

        if (middleware) {
            return middleware(req, res, next);
        }

        next();
    };
}

// -----------------------------------------------------------------------------
// Utility Middleware
// -----------------------------------------------------------------------------

/**
 * Middleware to attach permissions to response for client-side use
 */
function attachPermissionsToResponse(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
        if (req.user && typeof data === 'object' && data !== null) {
            data._permissions = {
                canEdit: hasPermission(req.user, PERMISSIONS.USER_UPDATE),
                canDelete: hasPermission(req.user, PERMISSIONS.USER_DELETE),
                canManageRoles: hasPermission(req.user, PERMISSIONS.USER_MANAGE_ROLES),
                isAdmin: hasRole(req.user, 'Admin') || hasRole(req.user, 'Super Admin'),
            };
        }
        return originalJson(data);
    };

    next();
}

/**
 * Log permission check results for auditing
 * Enhanced with database logging for compliance
 */
function logPermissionCheck(req, res, next) {
    const originalJson = res.json.bind(res);

    // Attach request IP to user for audit logging
    if (req.user) {
        req.user._requestIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    }

    res.json = (data) => {
        // Log permission-related responses
        if (res.statusCode === 403) {
            const auditEntry = {
                user: req.user?.id,
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString(),
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            };
            console.log('[AUDIT] Permission denied:', auditEntry);

            // Async database logging (don't await)
            logPermissionDenied(req, auditEntry).catch(err => {
                console.error('[AUDIT] Failed to log to database:', err.message);
            });
        }
        return originalJson(data);
    };

    next();
}

/**
 * Log permission denial to database for compliance
 */
async function logPermissionDenied(req, auditEntry) {
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
            req.user?.org_id || 'unknown',
            req.user?.id || 'anonymous',
            'permission.denied',
            'api_endpoint',
            `${auditEntry.method}:${auditEntry.path}`,
            JSON.stringify({
                method: auditEntry.method,
                path: auditEntry.path,
                userAgent: auditEntry.userAgent,
                userRoles: req.user?.roles || [],
                userPermissions: req.user?.permissions || []
            }),
            auditEntry.ip
        ]);
    } catch (error) {
        // Don't throw - just log the error
        throw error;
    }
}

// -----------------------------------------------------------------------------
// Attribute-Based Access Control (ABAC)
// -----------------------------------------------------------------------------

/**
 * ABAC Policy definitions for fine-grained access control
 */
const ABACPolicies = {
    /**
     * Require resource to belong to same organization as user
     */
    sameOrganization: (getResourceOrgId) => {
        return async (req) => {
            const resourceOrgId = typeof getResourceOrgId === 'function'
                ? await getResourceOrgId(req)
                : req.params[getResourceOrgId];

            return req.user?.org_id === resourceOrgId;
        };
    },

    /**
     * Require resource to be owned by the requesting user
     */
    ownedBy: (getOwnerId) => {
        return async (req) => {
            const ownerId = typeof getOwnerId === 'function'
                ? await getOwnerId(req)
                : req.params[getOwnerId];

            return req.user?.id === ownerId || req.user?.sub === ownerId;
        };
    },

    /**
     * Require user to have specific attribute value
     */
    hasAttribute: (attributeName, expectedValue) => {
        return async (req) => {
            const actualValue = req.user?.metadata?.[attributeName];
            if (typeof expectedValue === 'function') {
                return expectedValue(actualValue, req);
            }
            return actualValue === expectedValue;
        };
    },

    /**
     * Combine multiple policies with AND logic
     */
    all: (...policies) => {
        return async (req) => {
            for (const policy of policies) {
                if (!(await policy(req))) {
                    return false;
                }
            }
            return true;
        };
    },

    /**
     * Combine multiple policies with OR logic
     */
    any: (...policies) => {
        return async (req) => {
            for (const policy of policies) {
                if (await policy(req)) {
                    return true;
                }
            }
            return false;
        };
    }
};

/**
 * Create middleware requiring ABAC policy evaluation
 *
 * @param {Function} policy - ABAC policy function
 * @param {string} [bypassPermission] - Permission that bypasses ABAC check
 * @returns {Function} Express middleware
 */
function requireABAC(policy, bypassPermission = null) {
    return async (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
        }

        // Check bypass permission
        if (bypassPermission && hasPermission(user, bypassPermission)) {
            return next();
        }

        try {
            const allowed = await policy(req);
            if (!allowed) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Access denied by policy',
                });
            }
            next();
        } catch (error) {
            console.error('[ABAC] Policy evaluation error:', error.message);
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to evaluate access policy',
            });
        }
    };
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    // Constants
    PERMISSIONS,
    ROLES,

    // Check functions
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    hasRole,

    // Middleware factories
    requirePermissions,
    requireAnyPermission,
    requireRoles,
    requireOwnership,
    requireTeamMembership,
    conditionalPermissions,

    // ABAC
    requireABAC,
    ABACPolicies,

    // Utility middleware
    attachPermissionsToResponse,
    logPermissionCheck,

    // Compatibility alias
    requirePermission: requirePermissions,
};
