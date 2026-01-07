/**
 * Auth0 Management API Client Wrapper
 *
 * Provides a centralized interface for interacting with Auth0's Management API.
 * Handles authentication, token management, and API operations.
 *
 * @module backend/auth0
 */

const { ManagementClient, AuthenticationClient } = require('auth0');

// Configuration validation
const REQUIRED_ENV_VARS = [
    'AUTH0_DOMAIN',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
];

/**
 * Validate required environment variables
 * @throws {Error} If required environment variables are missing
 */
function validateConfig() {
    const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        throw new Error(
            `[ERROR] Missing required Auth0 configuration: ${missing.join(', ')}`
        );
    }
}

// -----------------------------------------------------------------------------
// Auth0 Client Configuration
// -----------------------------------------------------------------------------

let managementClient = null;
let authenticationClient = null;

/**
 * Get or create the Auth0 Management Client
 * Uses lazy initialization and caches the client instance
 *
 * @returns {ManagementClient} Configured Management API client
 */
function getManagementClient() {
    if (!managementClient) {
        validateConfig();

        managementClient = new ManagementClient({
            domain: process.env.AUTH0_DOMAIN,
            clientId: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET,
            scope: 'read:users update:users create:users delete:users ' +
                   'read:roles create:roles update:roles delete:roles ' +
                   'read:role_members create:role_members delete:role_members ' +
                   'read:logs read:log_streams ' +
                   'read:organizations create:organizations update:organizations delete:organizations ' +
                   'read:organization_members create:organization_members delete:organization_members ' +
                   'read:connections',
            audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
            tokenProvider: {
                enableCache: true,
                cacheTTLInSeconds: 3600, // 1 hour cache
            },
        });
    }

    return managementClient;
}

/**
 * Get or create the Auth0 Authentication Client
 *
 * @returns {AuthenticationClient} Configured Authentication API client
 */
function getAuthenticationClient() {
    if (!authenticationClient) {
        validateConfig();

        authenticationClient = new AuthenticationClient({
            domain: process.env.AUTH0_DOMAIN,
            clientId: process.env.AUTH0_CLIENT_ID,
            clientSecret: process.env.AUTH0_CLIENT_SECRET,
        });
    }

    return authenticationClient;
}

// -----------------------------------------------------------------------------
// User Management Operations
// -----------------------------------------------------------------------------

/**
 * Get all users with pagination
 *
 * @param {Object} options - Query options
 * @param {number} [options.page=0] - Page number (zero-indexed)
 * @param {number} [options.perPage=10] - Number of users per page
 * @param {string} [options.search] - Search query (Lucene syntax)
 * @param {string} [options.sort] - Sort field and direction
 * @returns {Promise<Object>} Paginated user list
 */
async function getUsers(options = {}) {
    const client = getManagementClient();

    const params = {
        page: options.page || 0,
        per_page: Math.min(options.perPage || 10, 100), // Max 100 per page
        include_totals: true,
        search_engine: 'v3',
    };

    if (options.search) {
        params.q = options.search;
    }

    if (options.sort) {
        params.sort = options.sort;
    }

    try {
        const response = await client.users.getAll(params);
        return {
            users: response.data,
            total: response.data.length,
            page: params.page,
            perPage: params.per_page,
        };
    } catch (error) {
        console.error('[ERROR] Failed to fetch users:', error.message);
        throw new Auth0Error('Failed to fetch users', error);
    }
}

/**
 * Get a single user by ID
 *
 * @param {string} userId - Auth0 user ID
 * @returns {Promise<Object>} User object
 */
async function getUser(userId) {
    const client = getManagementClient();

    try {
        const response = await client.users.get({ id: userId });
        return response.data;
    } catch (error) {
        if (error.statusCode === 404) {
            return null;
        }
        console.error('[ERROR] Failed to fetch user:', error.message);
        throw new Auth0Error('Failed to fetch user', error);
    }
}

/**
 * Create a new user
 *
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.name - User name
 * @param {string} [userData.password] - User password (if using database connection)
 * @param {string} [userData.connection='Username-Password-Authentication'] - Auth0 connection
 * @returns {Promise<Object>} Created user object
 */
async function createUser(userData) {
    const client = getManagementClient();

    const user = {
        email: userData.email,
        name: userData.name,
        connection: userData.connection || 'Username-Password-Authentication',
        email_verified: userData.emailVerified || false,
        app_metadata: userData.appMetadata || {},
        user_metadata: userData.userMetadata || {},
    };

    // Only include password for database connections
    if (userData.password) {
        user.password = userData.password;
    }

    try {
        const response = await client.users.create(user);
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to create user:', error.message);
        throw new Auth0Error('Failed to create user', error);
    }
}

/**
 * Update an existing user
 *
 * @param {string} userId - Auth0 user ID
 * @param {Object} userData - Updated user data
 * @returns {Promise<Object>} Updated user object
 */
async function updateUser(userId, userData) {
    const client = getManagementClient();

    // Filter out undefined values and readonly fields
    const updateData = {};
    const allowedFields = [
        'email', 'name', 'nickname', 'picture',
        'app_metadata', 'user_metadata', 'blocked',
    ];

    for (const field of allowedFields) {
        if (userData[field] !== undefined) {
            updateData[field] = userData[field];
        }
    }

    try {
        const response = await client.users.update({ id: userId }, updateData);
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to update user:', error.message);
        throw new Auth0Error('Failed to update user', error);
    }
}

/**
 * Delete a user
 *
 * @param {string} userId - Auth0 user ID
 * @returns {Promise<void>}
 */
async function deleteUser(userId) {
    const client = getManagementClient();

    try {
        await client.users.delete({ id: userId });
    } catch (error) {
        console.error('[ERROR] Failed to delete user:', error.message);
        throw new Auth0Error('Failed to delete user', error);
    }
}

// -----------------------------------------------------------------------------
// Role Management Operations
// -----------------------------------------------------------------------------

/**
 * Get all roles
 *
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of roles
 */
async function getRoles(options = {}) {
    const client = getManagementClient();

    try {
        const response = await client.roles.getAll({
            page: options.page || 0,
            per_page: options.perPage || 50,
            include_totals: true,
        });
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to fetch roles:', error.message);
        throw new Auth0Error('Failed to fetch roles', error);
    }
}

/**
 * Assign roles to a user
 *
 * @param {string} userId - Auth0 user ID
 * @param {string[]} roleIds - Array of role IDs to assign
 * @returns {Promise<void>}
 */
async function assignRolesToUser(userId, roleIds) {
    const client = getManagementClient();

    try {
        await client.users.assignRoles({ id: userId }, { roles: roleIds });
    } catch (error) {
        console.error('[ERROR] Failed to assign roles:', error.message);
        throw new Auth0Error('Failed to assign roles to user', error);
    }
}

/**
 * Remove roles from a user
 *
 * @param {string} userId - Auth0 user ID
 * @param {string[]} roleIds - Array of role IDs to remove
 * @returns {Promise<void>}
 */
async function removeRolesFromUser(userId, roleIds) {
    const client = getManagementClient();

    try {
        await client.users.deleteRoles({ id: userId }, { roles: roleIds });
    } catch (error) {
        console.error('[ERROR] Failed to remove roles:', error.message);
        throw new Auth0Error('Failed to remove roles from user', error);
    }
}

/**
 * Get roles assigned to a user
 *
 * @param {string} userId - Auth0 user ID
 * @returns {Promise<Array>} List of roles
 */
async function getUserRoles(userId) {
    const client = getManagementClient();

    try {
        const response = await client.users.getRoles({ id: userId });
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to fetch user roles:', error.message);
        throw new Auth0Error('Failed to fetch user roles', error);
    }
}

// -----------------------------------------------------------------------------
// Organization Management Operations
// -----------------------------------------------------------------------------

/**
 * Get all organizations
 *
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of organizations
 */
async function getOrganizations(options = {}) {
    const client = getManagementClient();

    try {
        const response = await client.organizations.getAll({
            page: options.page || 0,
            per_page: options.perPage || 50,
            include_totals: true,
        });
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to fetch organizations:', error.message);
        throw new Auth0Error('Failed to fetch organizations', error);
    }
}

/**
 * Get organization members
 *
 * @param {string} orgId - Organization ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of organization members
 */
async function getOrganizationMembers(orgId, options = {}) {
    const client = getManagementClient();

    try {
        const response = await client.organizations.getMembers({
            id: orgId,
            page: options.page || 0,
            per_page: options.perPage || 50,
            include_totals: true,
        });
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to fetch organization members:', error.message);
        throw new Auth0Error('Failed to fetch organization members', error);
    }
}

// -----------------------------------------------------------------------------
// Logs Operations
// -----------------------------------------------------------------------------

/**
 * Get audit logs
 *
 * @param {Object} options - Query options
 * @param {string} [options.from] - Log ID to start from
 * @param {number} [options.take] - Number of logs to retrieve
 * @param {string} [options.q] - Query string (Lucene syntax)
 * @returns {Promise<Array>} List of log entries
 */
async function getLogs(options = {}) {
    const client = getManagementClient();

    const params = {
        per_page: Math.min(options.take || 100, 100),
        include_totals: true,
    };

    if (options.from) {
        params.from = options.from;
    }

    if (options.q) {
        params.q = options.q;
    }

    try {
        const response = await client.logs.getAll(params);
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to fetch logs:', error.message);
        throw new Auth0Error('Failed to fetch logs', error);
    }
}

/**
 * Get a specific log entry
 *
 * @param {string} logId - Log entry ID
 * @returns {Promise<Object>} Log entry
 */
async function getLog(logId) {
    const client = getManagementClient();

    try {
        const response = await client.logs.get({ id: logId });
        return response.data;
    } catch (error) {
        console.error('[ERROR] Failed to fetch log:', error.message);
        throw new Auth0Error('Failed to fetch log', error);
    }
}

// -----------------------------------------------------------------------------
// Custom Error Class
// -----------------------------------------------------------------------------

/**
 * Custom error class for Auth0 API errors
 */
class Auth0Error extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = 'Auth0Error';
        this.originalError = originalError;
        this.statusCode = originalError?.statusCode || 500;
        this.errorCode = originalError?.errorCode || 'unknown_error';

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON-serializable object
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            errorCode: this.errorCode,
        };
    }
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    // Client getters
    getManagementClient,
    getAuthenticationClient,

    // User operations
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,

    // Role operations
    getRoles,
    assignRolesToUser,
    removeRolesFromUser,
    getUserRoles,

    // Organization operations
    getOrganizations,
    getOrganizationMembers,

    // Log operations
    getLogs,
    getLog,

    // Error class
    Auth0Error,
};
