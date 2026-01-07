/**
 * User Model
 *
 * Represents a user entity with relationships to teams, roles, and audit logs.
 * Uses a generic ORM pattern that can be adapted to Sequelize, TypeORM, or other ORMs.
 *
 * @module backend/models/User
 */

// -----------------------------------------------------------------------------
// Model Schema Definition
// -----------------------------------------------------------------------------

/**
 * User schema definition
 * This follows a pattern that can be easily mapped to various ORMs
 */
const UserSchema = {
    tableName: 'users',
    timestamps: true,

    fields: {
        id: {
            type: 'uuid',
            primaryKey: true,
            defaultValue: 'uuid_generate_v4()',
        },
        auth0Id: {
            type: 'string',
            length: 255,
            unique: true,
            allowNull: false,
            index: true,
            comment: 'Auth0 user identifier (sub claim)',
        },
        email: {
            type: 'string',
            length: 255,
            unique: true,
            allowNull: false,
            validate: {
                isEmail: true,
            },
        },
        name: {
            type: 'string',
            length: 255,
            allowNull: true,
        },
        nickname: {
            type: 'string',
            length: 100,
            allowNull: true,
        },
        picture: {
            type: 'string',
            length: 2048,
            allowNull: true,
            comment: 'URL to user profile picture',
        },
        status: {
            type: 'enum',
            values: ['active', 'inactive', 'blocked', 'pending'],
            defaultValue: 'active',
            allowNull: false,
        },
        emailVerified: {
            type: 'boolean',
            defaultValue: false,
        },
        lastLogin: {
            type: 'datetime',
            allowNull: true,
        },
        loginCount: {
            type: 'integer',
            defaultValue: 0,
        },
        metadata: {
            type: 'json',
            defaultValue: {},
            comment: 'Additional user metadata',
        },
        appMetadata: {
            type: 'json',
            defaultValue: {},
            comment: 'Application-specific metadata',
        },
        createdAt: {
            type: 'datetime',
            defaultValue: 'NOW()',
        },
        updatedAt: {
            type: 'datetime',
            defaultValue: 'NOW()',
        },
    },

    indexes: [
        { fields: ['email'], unique: true },
        { fields: ['auth0Id'], unique: true },
        { fields: ['status'] },
        { fields: ['createdAt'] },
        { fields: ['lastLogin'] },
    ],

    // Relationships defined separately for ORM mapping
    associations: {
        teams: {
            type: 'belongsToMany',
            target: 'Team',
            through: 'TeamMembers',
            foreignKey: 'userId',
            otherKey: 'teamId',
        },
        roles: {
            type: 'belongsToMany',
            target: 'Role',
            through: 'UserRoles',
            foreignKey: 'userId',
            otherKey: 'roleId',
        },
        auditLogs: {
            type: 'hasMany',
            target: 'AuditLog',
            foreignKey: 'userId',
        },
    },
};

// -----------------------------------------------------------------------------
// User Model Class
// -----------------------------------------------------------------------------

/**
 * User model with business logic and data access methods
 */
class User {
    /**
     * Create a new User instance
     *
     * @param {Object} data - User data
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.auth0Id = data.auth0Id || null;
        this.email = data.email || null;
        this.name = data.name || null;
        this.nickname = data.nickname || null;
        this.picture = data.picture || null;
        this.status = data.status || 'active';
        this.emailVerified = data.emailVerified || false;
        this.lastLogin = data.lastLogin || null;
        this.loginCount = data.loginCount || 0;
        this.metadata = data.metadata || {};
        this.appMetadata = data.appMetadata || {};
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();

        // Relationships
        this.teams = data.teams || [];
        this.roles = data.roles || [];
    }

    /**
     * Validate user data
     *
     * @returns {Object} Validation result with isValid flag and errors array
     */
    validate() {
        const errors = [];

        if (!this.email) {
            errors.push({ field: 'email', message: 'Email is required' });
        } else if (!this._isValidEmail(this.email)) {
            errors.push({ field: 'email', message: 'Invalid email format' });
        }

        if (!this.auth0Id) {
            errors.push({ field: 'auth0Id', message: 'Auth0 ID is required' });
        }

        if (this.name && this.name.length > 255) {
            errors.push({ field: 'name', message: 'Name must be 255 characters or less' });
        }

        const validStatuses = ['active', 'inactive', 'blocked', 'pending'];
        if (!validStatuses.includes(this.status)) {
            errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Check if email format is valid
     * @private
     */
    _isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Convert to plain object for serialization
     *
     * @param {Object} options - Serialization options
     * @param {boolean} options.includeMetadata - Include metadata fields
     * @param {boolean} options.includeRelationships - Include related entities
     * @returns {Object} Plain object representation
     */
    toJSON(options = {}) {
        const json = {
            id: this.id,
            auth0Id: this.auth0Id,
            email: this.email,
            name: this.name,
            nickname: this.nickname,
            picture: this.picture,
            status: this.status,
            emailVerified: this.emailVerified,
            lastLogin: this.lastLogin,
            loginCount: this.loginCount,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };

        if (options.includeMetadata !== false) {
            json.metadata = this.metadata;
            json.appMetadata = this.appMetadata;
        }

        if (options.includeRelationships) {
            json.teams = this.teams;
            json.roles = this.roles;
        }

        return json;
    }

    /**
     * Get display name (name or email fallback)
     *
     * @returns {string} Display name
     */
    getDisplayName() {
        return this.name || this.nickname || this.email.split('@')[0];
    }

    /**
     * Check if user has a specific role
     *
     * @param {string} roleName - Role name to check
     * @returns {boolean} Whether user has the role
     */
    hasRole(roleName) {
        return this.roles.some(role =>
            role.name?.toLowerCase() === roleName.toLowerCase()
        );
    }

    /**
     * Check if user is active
     *
     * @returns {boolean} Whether user is active
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Check if user is blocked
     *
     * @returns {boolean} Whether user is blocked
     */
    isBlocked() {
        return this.status === 'blocked';
    }

    /**
     * Update login statistics
     *
     * @returns {User} Updated user instance
     */
    recordLogin() {
        this.lastLogin = new Date();
        this.loginCount += 1;
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Block the user
     *
     * @param {string} reason - Reason for blocking
     * @returns {User} Updated user instance
     */
    block(reason = null) {
        this.status = 'blocked';
        if (reason) {
            this.metadata.blockReason = reason;
            this.metadata.blockedAt = new Date().toISOString();
        }
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Unblock the user
     *
     * @returns {User} Updated user instance
     */
    unblock() {
        this.status = 'active';
        delete this.metadata.blockReason;
        delete this.metadata.blockedAt;
        this.updatedAt = new Date();
        return this;
    }
}

// -----------------------------------------------------------------------------
// Repository Pattern Implementation
// -----------------------------------------------------------------------------

/**
 * User repository for data access operations
 * This abstraction allows swapping the underlying data store
 */
class UserRepository {
    /**
     * Create repository with database connection
     *
     * @param {Object} db - Database connection/client
     */
    constructor(db) {
        this.db = db;
        this.table = UserSchema.tableName;
    }

    /**
     * Find user by ID
     *
     * @param {string} id - User ID
     * @param {Object} options - Query options
     * @returns {Promise<User|null>} User or null if not found
     */
    async findById(id, options = {}) {
        // Implementation depends on the ORM being used
        // This is a placeholder for the actual database query
        const query = {
            table: this.table,
            where: { id },
            include: options.includeRelationships ? ['teams', 'roles'] : [],
        };

        const result = await this.db.findOne(query);
        return result ? new User(result) : null;
    }

    /**
     * Find user by Auth0 ID
     *
     * @param {string} auth0Id - Auth0 user ID
     * @returns {Promise<User|null>} User or null if not found
     */
    async findByAuth0Id(auth0Id) {
        const query = {
            table: this.table,
            where: { auth0Id },
        };

        const result = await this.db.findOne(query);
        return result ? new User(result) : null;
    }

    /**
     * Find user by email
     *
     * @param {string} email - User email
     * @returns {Promise<User|null>} User or null if not found
     */
    async findByEmail(email) {
        const query = {
            table: this.table,
            where: { email: email.toLowerCase() },
        };

        const result = await this.db.findOne(query);
        return result ? new User(result) : null;
    }

    /**
     * Find all users with pagination
     *
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Paginated results
     */
    async findAll(options = {}) {
        const {
            page = 0,
            perPage = 20,
            status,
            search,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
        } = options;

        const query = {
            table: this.table,
            where: {},
            limit: perPage,
            offset: page * perPage,
            orderBy: [[sortBy, sortOrder]],
        };

        if (status) {
            query.where.status = status;
        }

        if (search) {
            query.where.$or = [
                { email: { $like: `%${search}%` } },
                { name: { $like: `%${search}%` } },
            ];
        }

        const [results, total] = await Promise.all([
            this.db.findMany(query),
            this.db.count({ table: this.table, where: query.where }),
        ]);

        return {
            data: results.map(r => new User(r)),
            pagination: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        };
    }

    /**
     * Create a new user
     *
     * @param {User|Object} user - User data
     * @returns {Promise<User>} Created user
     */
    async create(user) {
        const userData = user instanceof User ? user.toJSON() : user;
        const userInstance = new User(userData);

        const validation = userInstance.validate();
        if (!validation.isValid) {
            const error = new Error('Validation failed');
            error.errors = validation.errors;
            throw error;
        }

        const result = await this.db.insert({
            table: this.table,
            data: userInstance.toJSON({ includeMetadata: true }),
        });

        return new User(result);
    }

    /**
     * Update a user
     *
     * @param {string} id - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<User>} Updated user
     */
    async update(id, updates) {
        const existing = await this.findById(id);
        if (!existing) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        // Merge updates with existing data
        const updatedUser = new User({
            ...existing.toJSON({ includeMetadata: true }),
            ...updates,
            updatedAt: new Date(),
        });

        const validation = updatedUser.validate();
        if (!validation.isValid) {
            const error = new Error('Validation failed');
            error.errors = validation.errors;
            throw error;
        }

        await this.db.update({
            table: this.table,
            where: { id },
            data: updatedUser.toJSON({ includeMetadata: true }),
        });

        return updatedUser;
    }

    /**
     * Delete a user
     *
     * @param {string} id - User ID
     * @returns {Promise<boolean>} Success indicator
     */
    async delete(id) {
        const result = await this.db.delete({
            table: this.table,
            where: { id },
        });

        return result.affectedRows > 0;
    }

    /**
     * Find users by team
     *
     * @param {string} teamId - Team ID
     * @returns {Promise<User[]>} Users in the team
     */
    async findByTeam(teamId) {
        const query = {
            table: this.table,
            join: {
                table: 'team_members',
                on: 'users.id = team_members.user_id',
            },
            where: { 'team_members.team_id': teamId },
        };

        const results = await this.db.findMany(query);
        return results.map(r => new User(r));
    }
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    User,
    UserSchema,
    UserRepository,
};
