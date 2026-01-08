/**
 * User Service
 *
 * Business logic layer for user management operations.
 * Coordinates between Auth0, local database, and audit logging.
 *
 * @module backend/services/UserService
 */

const auth0 = require('../auth0');
const { User, UserRepository } = require('../models/User');
const { AuditLogBuilder, AUDIT_EVENT_TYPES, SEVERITY_LEVELS } = require('../models/AuditLog');

// -----------------------------------------------------------------------------
// User Service Class
// -----------------------------------------------------------------------------

/**
 * Service class for user management operations
 */
class UserService {
    /**
     * Create UserService instance
     *
     * @param {Object} options - Service options
     * @param {Object} options.db - Database connection
     * @param {Object} options.auditLogRepository - Audit log repository
     */
    constructor(options = {}) {
        this.db = options.db;
        this.userRepository = options.db ? new UserRepository(options.db) : null;
        this.auditLogRepository = options.auditLogRepository;
    }

    // -------------------------------------------------------------------------
    // User CRUD Operations
    // -------------------------------------------------------------------------

    /**
     * Get all users with pagination and filtering
     *
     * @param {Object} options - Query options
     * @param {number} [options.page=0] - Page number
     * @param {number} [options.perPage=20] - Results per page
     * @param {string} [options.status] - Filter by status
     * @param {string} [options.search] - Search query
     * @param {string} [options.sortBy] - Sort field
     * @param {string} [options.sortOrder] - Sort direction
     * @returns {Promise<Object>} Paginated user list
     */
    async getUsers(options = {}) {
        try {
            // Get users from Auth0
            const auth0Users = await auth0.getUsers({
                page: options.page || 0,
                perPage: options.perPage || 20,
                search: options.search,
                sort: options.sortBy ? `${options.sortBy}:${options.sortOrder === 'DESC' ? -1 : 1}` : undefined,
            });

            // Transform Auth0 users to our User model format
            const users = auth0Users.users.map(u => new User({
                auth0Id: u.user_id,
                email: u.email,
                name: u.name,
                nickname: u.nickname,
                picture: u.picture,
                status: u.blocked ? 'blocked' : 'active',
                emailVerified: u.email_verified,
                lastLogin: u.last_login,
                loginCount: u.logins_count,
                metadata: u.user_metadata || {},
                appMetadata: u.app_metadata || {},
                createdAt: u.created_at,
                updatedAt: u.updated_at,
            }));

            return {
                data: users,
                pagination: {
                    page: options.page || 0,
                    perPage: options.perPage || 20,
                    total: auth0Users.total,
                    totalPages: Math.ceil(auth0Users.total / (options.perPage || 20)),
                },
            };
        } catch (error) {
            console.error('[ERROR] UserService.getUsers:', error.message);
            throw this._handleError(error, 'Failed to retrieve users');
        }
    }

    /**
     * Get a single user by ID
     *
     * @param {string} userId - Auth0 user ID
     * @returns {Promise<User|null>} User or null if not found
     */
    async getUserById(userId) {
        try {
            const auth0User = await auth0.getUser(userId);

            if (!auth0User) {
                return null;
            }

            return new User({
                auth0Id: auth0User.user_id,
                email: auth0User.email,
                name: auth0User.name,
                nickname: auth0User.nickname,
                picture: auth0User.picture,
                status: auth0User.blocked ? 'blocked' : 'active',
                emailVerified: auth0User.email_verified,
                lastLogin: auth0User.last_login,
                loginCount: auth0User.logins_count,
                metadata: auth0User.user_metadata || {},
                appMetadata: auth0User.app_metadata || {},
                createdAt: auth0User.created_at,
                updatedAt: auth0User.updated_at,
            });
        } catch (error) {
            console.error('[ERROR] UserService.getUserById:', error.message);
            throw this._handleError(error, 'Failed to retrieve user');
        }
    }

    /**
     * Get user by email
     *
     * @param {string} email - User email
     * @returns {Promise<User|null>}
     */
    async getUserByEmail(email) {
        try {
            const result = await auth0.getUsers({
                search: `email:"${email}"`,
                perPage: 1,
            });

            if (!result.users || result.users.length === 0) {
                return null;
            }

            const auth0User = result.users[0];
            return new User({
                auth0Id: auth0User.user_id,
                email: auth0User.email,
                name: auth0User.name,
                nickname: auth0User.nickname,
                picture: auth0User.picture,
                status: auth0User.blocked ? 'blocked' : 'active',
                emailVerified: auth0User.email_verified,
                lastLogin: auth0User.last_login,
                loginCount: auth0User.logins_count,
                metadata: auth0User.user_metadata || {},
                appMetadata: auth0User.app_metadata || {},
            });
        } catch (error) {
            console.error('[ERROR] UserService.getUserByEmail:', error.message);
            throw this._handleError(error, 'Failed to retrieve user by email');
        }
    }

    /**
     * Create a new user
     *
     * @param {Object} userData - User data
     * @param {Object} context - Request context for audit
     * @returns {Promise<User>} Created user
     */
    async createUser(userData, context = {}) {
        try {
            // Validate required fields
            if (!userData.email) {
                const error = new Error('Email is required');
                error.statusCode = 400;
                throw error;
            }

            // Check if user already exists
            const existingUser = await this.getUserByEmail(userData.email);
            if (existingUser) {
                const error = new Error('User with this email already exists');
                error.statusCode = 409;
                throw error;
            }

            // Create user in Auth0
            const auth0User = await auth0.createUser({
                email: userData.email,
                name: userData.name,
                password: userData.password,
                connection: userData.connection || 'Username-Password-Authentication',
                emailVerified: userData.emailVerified || false,
                userMetadata: userData.metadata || {},
                appMetadata: userData.appMetadata || {},
            });

            const newUser = new User({
                auth0Id: auth0User.user_id,
                email: auth0User.email,
                name: auth0User.name,
                status: 'active',
                emailVerified: auth0User.email_verified,
                metadata: auth0User.user_metadata || {},
                appMetadata: auth0User.app_metadata || {},
                createdAt: auth0User.created_at,
            });

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.CREATE,
                newUser,
                context,
                `Created user: ${newUser.email}`
            );

            return newUser;
        } catch (error) {
            console.error('[ERROR] UserService.createUser:', error.message);
            throw this._handleError(error, 'Failed to create user');
        }
    }

    /**
     * Update an existing user
     *
     * @param {string} userId - Auth0 user ID
     * @param {Object} updates - Fields to update
     * @param {Object} context - Request context for audit
     * @returns {Promise<User>} Updated user
     */
    async updateUser(userId, updates, context = {}) {
        try {
            // Get existing user for audit trail
            const existingUser = await this.getUserById(userId);
            if (!existingUser) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Prepare update data for Auth0
            const auth0Updates = {};
            if (updates.name !== undefined) auth0Updates.name = updates.name;
            if (updates.nickname !== undefined) auth0Updates.nickname = updates.nickname;
            if (updates.picture !== undefined) auth0Updates.picture = updates.picture;
            if (updates.metadata !== undefined) auth0Updates.user_metadata = updates.metadata;
            if (updates.appMetadata !== undefined) auth0Updates.app_metadata = updates.appMetadata;

            // Update in Auth0
            const auth0User = await auth0.updateUser(userId, auth0Updates);

            const updatedUser = new User({
                auth0Id: auth0User.user_id,
                email: auth0User.email,
                name: auth0User.name,
                nickname: auth0User.nickname,
                picture: auth0User.picture,
                status: auth0User.blocked ? 'blocked' : 'active',
                emailVerified: auth0User.email_verified,
                lastLogin: auth0User.last_login,
                loginCount: auth0User.logins_count,
                metadata: auth0User.user_metadata || {},
                appMetadata: auth0User.app_metadata || {},
                updatedAt: auth0User.updated_at,
            });

            // Log audit event with changes
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.UPDATE,
                updatedUser,
                context,
                `Updated user: ${updatedUser.email}`,
                { before: existingUser.toJSON(), after: updatedUser.toJSON() }
            );

            return updatedUser;
        } catch (error) {
            console.error('[ERROR] UserService.updateUser:', error.message);
            throw this._handleError(error, 'Failed to update user');
        }
    }

    /**
     * Delete a user
     *
     * @param {string} userId - Auth0 user ID
     * @param {Object} context - Request context for audit
     * @returns {Promise<boolean>}
     */
    async deleteUser(userId, context = {}) {
        try {
            // Get user for audit trail
            const existingUser = await this.getUserById(userId);
            if (!existingUser) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Delete from Auth0
            await auth0.deleteUser(userId);

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.DELETE,
                existingUser,
                context,
                `Deleted user: ${existingUser.email}`
            );

            return true;
        } catch (error) {
            console.error('[ERROR] UserService.deleteUser:', error.message);
            throw this._handleError(error, 'Failed to delete user');
        }
    }

    // -------------------------------------------------------------------------
    // User Status Operations
    // -------------------------------------------------------------------------

    /**
     * Block a user
     *
     * @param {string} userId - Auth0 user ID
     * @param {string} reason - Reason for blocking
     * @param {Object} context - Request context
     * @returns {Promise<User>}
     */
    async blockUser(userId, reason = null, context = {}) {
        try {
            const existingUser = await this.getUserById(userId);
            if (!existingUser) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Update in Auth0
            await auth0.updateUser(userId, {
                blocked: true,
                app_metadata: {
                    ...existingUser.appMetadata,
                    blockReason: reason,
                    blockedAt: new Date().toISOString(),
                },
            });

            const blockedUser = await this.getUserById(userId);

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.BLOCK,
                blockedUser,
                context,
                `Blocked user: ${blockedUser.email}${reason ? ` - Reason: ${reason}` : ''}`,
                null,
                SEVERITY_LEVELS.WARNING
            );

            return blockedUser;
        } catch (error) {
            console.error('[ERROR] UserService.blockUser:', error.message);
            throw this._handleError(error, 'Failed to block user');
        }
    }

    /**
     * Unblock a user
     *
     * @param {string} userId - Auth0 user ID
     * @param {Object} context - Request context
     * @returns {Promise<User>}
     */
    async unblockUser(userId, context = {}) {
        try {
            const existingUser = await this.getUserById(userId);
            if (!existingUser) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Remove block metadata
            const updatedMetadata = { ...existingUser.appMetadata };
            delete updatedMetadata.blockReason;
            delete updatedMetadata.blockedAt;

            // Update in Auth0
            await auth0.updateUser(userId, {
                blocked: false,
                app_metadata: updatedMetadata,
            });

            const unblockedUser = await this.getUserById(userId);

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.UNBLOCK,
                unblockedUser,
                context,
                `Unblocked user: ${unblockedUser.email}`
            );

            return unblockedUser;
        } catch (error) {
            console.error('[ERROR] UserService.unblockUser:', error.message);
            throw this._handleError(error, 'Failed to unblock user');
        }
    }

    // -------------------------------------------------------------------------
    // Role Management
    // -------------------------------------------------------------------------

    /**
     * Get user's roles
     *
     * @param {string} userId - Auth0 user ID
     * @returns {Promise<Array>}
     */
    async getUserRoles(userId) {
        try {
            return await auth0.getUserRoles(userId);
        } catch (error) {
            console.error('[ERROR] UserService.getUserRoles:', error.message);
            throw this._handleError(error, 'Failed to get user roles');
        }
    }

    /**
     * Assign roles to user
     *
     * @param {string} userId - Auth0 user ID
     * @param {string[]} roleIds - Role IDs to assign
     * @param {Object} context - Request context
     * @returns {Promise<Array>} Updated roles
     */
    async assignRoles(userId, roleIds, context = {}) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Get current roles for audit
            const currentRoles = await auth0.getUserRoles(userId);

            // Assign new roles
            await auth0.assignRolesToUser(userId, roleIds);

            // Get updated roles
            const updatedRoles = await auth0.getUserRoles(userId);

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.ROLE_ASSIGN,
                user,
                context,
                `Assigned roles to user: ${user.email}`,
                { before: currentRoles, after: updatedRoles }
            );

            return updatedRoles;
        } catch (error) {
            console.error('[ERROR] UserService.assignRoles:', error.message);
            throw this._handleError(error, 'Failed to assign roles');
        }
    }

    /**
     * Remove roles from user
     *
     * @param {string} userId - Auth0 user ID
     * @param {string[]} roleIds - Role IDs to remove
     * @param {Object} context - Request context
     * @returns {Promise<Array>} Updated roles
     */
    async removeRoles(userId, roleIds, context = {}) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Get current roles for audit
            const currentRoles = await auth0.getUserRoles(userId);

            // Remove roles
            await auth0.removeRolesFromUser(userId, roleIds);

            // Get updated roles
            const updatedRoles = await auth0.getUserRoles(userId);

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.ROLE_REMOVE,
                user,
                context,
                `Removed roles from user: ${user.email}`,
                { before: currentRoles, after: updatedRoles }
            );

            return updatedRoles;
        } catch (error) {
            console.error('[ERROR] UserService.removeRoles:', error.message);
            throw this._handleError(error, 'Failed to remove roles');
        }
    }

    // -------------------------------------------------------------------------
    // Single Role Management (Route Compatibility)
    // -------------------------------------------------------------------------

    /**
     * List all users with filtering and pagination
     * Wrapper for getUsers with route-compatible interface
     *
     * @param {Object} options - Query options
     * @param {number} [options.page=1] - Page number (1-indexed)
     * @param {number} [options.limit=20] - Results per page
     * @param {string} [options.search] - Search query
     * @param {string} [options.role] - Filter by role
     * @param {string} [options.status] - Filter by status
     * @param {string} [options.organizationId] - Filter by organization
     * @returns {Promise<Object>} Paginated user list
     */
    async listUsers(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                search,
                role,
                status,
                organizationId,
            } = options;

            // Build Auth0 search query
            const queryParts = [];

            if (search) {
                queryParts.push(`(email:*${search}* OR name:*${search}*)`);
            }

            if (status === 'blocked') {
                queryParts.push('blocked:true');
            } else if (status === 'active') {
                queryParts.push('blocked:false');
            }

            if (organizationId) {
                queryParts.push(`app_metadata.organization_id:"${organizationId}"`);
            }

            const searchQuery = queryParts.length > 0 ? queryParts.join(' AND ') : undefined;

            // Get users from Auth0
            const auth0Users = await auth0.getUsers({
                page: page - 1, // Auth0 uses 0-indexed pages
                perPage: limit,
                search: searchQuery,
            });

            // Transform Auth0 users to our User model format
            let users = auth0Users.users.map(u => new User({
                auth0Id: u.user_id,
                email: u.email,
                name: u.name,
                nickname: u.nickname,
                picture: u.picture,
                status: u.blocked ? 'blocked' : 'active',
                emailVerified: u.email_verified,
                lastLogin: u.last_login,
                loginCount: u.logins_count,
                metadata: u.user_metadata || {},
                appMetadata: u.app_metadata || {},
                createdAt: u.created_at,
                updatedAt: u.updated_at,
            }));

            // Filter by role if specified (requires additional API calls)
            if (role) {
                const usersWithRole = [];
                for (const user of users) {
                    const userRoles = await auth0.getUserRoles(user.auth0Id);
                    if (userRoles.some(r => r.id === role || r.name === role)) {
                        user.roles = userRoles;
                        usersWithRole.push(user);
                    }
                }
                users = usersWithRole;
            }

            return {
                users,
                page,
                limit,
                total: auth0Users.total,
            };
        } catch (error) {
            console.error('[ERROR] UserService.listUsers:', error.message);
            throw this._handleError(error, 'Failed to list users');
        }
    }

    /**
     * Remove a single role from user
     *
     * @param {string} userId - Auth0 user ID
     * @param {string} roleId - Role ID to remove
     * @param {Object} context - Request context
     * @returns {Promise<Array>} Updated roles
     */
    async removeRole(userId, roleId, context = {}) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            // Get current roles for audit
            const currentRoles = await auth0.getUserRoles(userId);

            // Remove the single role
            await auth0.removeRolesFromUser(userId, [roleId]);

            // Get updated roles
            const updatedRoles = await auth0.getUserRoles(userId);

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.USER.ROLE_REMOVE,
                user,
                context,
                `Removed role ${roleId} from user: ${user.email}`,
                { before: currentRoles, after: updatedRoles }
            );

            return updatedRoles;
        } catch (error) {
            console.error('[ERROR] UserService.removeRole:', error.message);
            throw this._handleError(error, 'Failed to remove role');
        }
    }

    // -------------------------------------------------------------------------
    // MFA Operations
    // -------------------------------------------------------------------------

    /**
     * Reset user MFA enrollment
     *
     * @param {string} userId - Auth0 user ID
     * @param {Object} context - Request context
     * @returns {Promise<boolean>}
     */
    async resetMFA(userId, context = {}) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const client = auth0.getManagementClient();

            // Get all MFA enrollments for the user
            let enrollments = [];
            try {
                const response = await client.users.getEnrollments({ id: userId });
                enrollments = response.data || [];
            } catch (err) {
                // If no enrollments exist, continue
                if (err.statusCode !== 404) {
                    throw err;
                }
            }

            // Delete each MFA enrollment
            for (const enrollment of enrollments) {
                try {
                    await client.users.deleteMultifactorProvider({
                        id: userId,
                        provider: enrollment.type || enrollment.authenticator_type,
                    });
                } catch (err) {
                    console.warn('[WARN] Failed to delete MFA enrollment:', err.message);
                }
            }

            // Update app_metadata to track MFA reset
            await auth0.updateUser(userId, {
                app_metadata: {
                    ...user.appMetadata,
                    mfaResetAt: new Date().toISOString(),
                    mfaResetBy: context.resetBy,
                },
            });

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.AUTH?.MFA_RESET || 'auth.mfa_reset',
                user,
                context,
                `MFA reset for user: ${user.email}`,
                null,
                SEVERITY_LEVELS.WARNING
            );

            return true;
        } catch (error) {
            console.error('[ERROR] UserService.resetMFA:', error.message);
            throw this._handleError(error, 'Failed to reset MFA');
        }
    }

    // -------------------------------------------------------------------------
    // Password Operations
    // -------------------------------------------------------------------------

    /**
     * Send password reset email
     *
     * @param {string} userId - Auth0 user ID
     * @param {Object} context - Request context
     * @returns {Promise<boolean>}
     */
    async sendPasswordReset(userId, context = {}) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const authClient = auth0.getAuthenticationClient();

            // Request password reset
            await authClient.database.changePassword({
                email: user.email,
                connection: 'Username-Password-Authentication',
            });

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.AUTH?.PASSWORD_RESET_REQUEST || 'auth.password_reset_request',
                user,
                context,
                `Password reset requested for user: ${user.email}`,
                null,
                SEVERITY_LEVELS.NOTICE || SEVERITY_LEVELS.INFO
            );

            return true;
        } catch (error) {
            console.error('[ERROR] UserService.sendPasswordReset:', error.message);
            throw this._handleError(error, 'Failed to send password reset');
        }
    }

    // -------------------------------------------------------------------------
    // Session Management
    // -------------------------------------------------------------------------

    /**
     * Get active sessions for a user
     *
     * @param {string} userId - Auth0 user ID
     * @returns {Promise<Array>} Active sessions
     */
    async getActiveSessions(userId) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const client = auth0.getManagementClient();

            // Get user sessions (refresh tokens act as sessions in Auth0)
            let sessions = [];
            try {
                const response = await client.users.getRefreshTokens({ id: userId });
                sessions = response.data || [];
            } catch (err) {
                // If no sessions exist, return empty array
                if (err.statusCode !== 404) {
                    throw err;
                }
            }

            return sessions.map(session => ({
                id: session.id,
                clientId: session.client_id,
                clientName: session.client?.name,
                createdAt: session.created_at,
                expiresAt: session.expires_at,
                lastUsedAt: session.last_used_at,
                userAgent: session.device?.name,
                ip: session.device?.last_ip,
            }));
        } catch (error) {
            console.error('[ERROR] UserService.getActiveSessions:', error.message);
            throw this._handleError(error, 'Failed to get active sessions');
        }
    }

    /**
     * Revoke all sessions for a user
     *
     * @param {string} userId - Auth0 user ID
     * @param {Object} context - Request context
     * @returns {Promise<boolean>}
     */
    async revokeAllSessions(userId, context = {}) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }

            const client = auth0.getManagementClient();

            // Revoke all refresh tokens (effectively ending all sessions)
            try {
                await client.users.deleteRefreshTokens({ id: userId });
            } catch (err) {
                // If no tokens exist, continue
                if (err.statusCode !== 404) {
                    throw err;
                }
            }

            // Log audit event
            await this._logAuditEvent(
                AUDIT_EVENT_TYPES.AUTH?.SESSION_REVOKE || 'auth.session_revoke',
                user,
                context,
                `All sessions revoked for user: ${user.email}`,
                null,
                SEVERITY_LEVELS.WARNING
            );

            return true;
        } catch (error) {
            console.error('[ERROR] UserService.revokeAllSessions:', error.message);
            throw this._handleError(error, 'Failed to revoke sessions');
        }
    }

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Bulk import users
     *
     * @param {Array} usersData - Array of user data
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Import results
     */
    async bulkImport(usersData, context = {}) {
        const results = {
            success: [],
            failed: [],
            total: usersData.length,
        };

        for (const userData of usersData) {
            try {
                const user = await this.createUser(userData, context);
                results.success.push({
                    email: user.email,
                    id: user.auth0Id,
                });
            } catch (error) {
                results.failed.push({
                    email: userData.email,
                    error: error.message,
                });
            }
        }

        return results;
    }

    /**
     * Bulk update user status
     *
     * @param {string[]} userIds - User IDs
     * @param {string} status - New status ('active' or 'blocked')
     * @param {Object} context - Request context
     * @returns {Promise<Object>} Update results
     */
    async bulkUpdateStatus(userIds, status, context = {}) {
        const results = {
            success: [],
            failed: [],
            total: userIds.length,
        };

        const action = status === 'blocked' ? this.blockUser.bind(this) : this.unblockUser.bind(this);

        for (const userId of userIds) {
            try {
                await action(userId, null, context);
                results.success.push(userId);
            } catch (error) {
                results.failed.push({
                    userId,
                    error: error.message,
                });
            }
        }

        return results;
    }

    // -------------------------------------------------------------------------
    // Private Helper Methods
    // -------------------------------------------------------------------------

    /**
     * Log audit event
     * @private
     */
    async _logAuditEvent(eventType, user, context, description, changes = null, severity = SEVERITY_LEVELS.INFO) {
        if (!this.auditLogRepository) {
            console.log('[AUDIT]', eventType, user?.email, description);
            return;
        }

        try {
            const builder = new AuditLogBuilder()
                .event(eventType)
                .severity(severity)
                .success()
                .target('user', user?.auth0Id, user?.email)
                .describe(description);

            if (context.user) {
                builder.actor({
                    id: context.user.id,
                    email: context.user.email,
                    ip: context.ip,
                });
            }

            if (context.requestId) {
                builder.meta({ requestId: context.requestId });
            }

            if (changes) {
                builder.changes(changes.before, changes.after);
            }

            await this.auditLogRepository.create(builder.build());
        } catch (error) {
            console.error('[ERROR] Failed to log audit event:', error.message);
            // Don't throw - audit logging should not break main operations
        }
    }

    /**
     * Handle and transform errors
     * @private
     */
    _handleError(error, defaultMessage) {
        // If already has statusCode, it's a known error
        if (error.statusCode) {
            return error;
        }

        // Transform Auth0 errors
        if (error.name === 'Auth0Error') {
            const newError = new Error(error.message || defaultMessage);
            newError.statusCode = error.statusCode || 500;
            newError.code = error.errorCode;
            return newError;
        }

        // Generic error
        const newError = new Error(defaultMessage);
        newError.statusCode = 500;
        newError.originalError = error;
        return newError;
    }
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = UserService;
