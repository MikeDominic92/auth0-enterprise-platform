/**
 * Team Model
 *
 * Represents a team entity with member management and organizational hierarchy.
 * Supports team-based access control and collaboration features.
 *
 * @module backend/models/Team
 */

// -----------------------------------------------------------------------------
// Model Schema Definition
// -----------------------------------------------------------------------------

/**
 * Team schema definition
 */
const TeamSchema = {
    tableName: 'teams',
    timestamps: true,

    fields: {
        id: {
            type: 'uuid',
            primaryKey: true,
            defaultValue: 'uuid_generate_v4()',
        },
        name: {
            type: 'string',
            length: 255,
            allowNull: false,
            index: true,
        },
        slug: {
            type: 'string',
            length: 100,
            unique: true,
            allowNull: false,
            comment: 'URL-friendly team identifier',
        },
        description: {
            type: 'text',
            allowNull: true,
        },
        type: {
            type: 'enum',
            values: ['department', 'project', 'functional', 'cross-functional', 'temporary'],
            defaultValue: 'functional',
        },
        status: {
            type: 'enum',
            values: ['active', 'inactive', 'archived'],
            defaultValue: 'active',
        },
        visibility: {
            type: 'enum',
            values: ['public', 'private', 'hidden'],
            defaultValue: 'private',
            comment: 'Team visibility within organization',
        },
        parentTeamId: {
            type: 'uuid',
            allowNull: true,
            references: 'teams.id',
            comment: 'Parent team for hierarchical structure',
        },
        ownerId: {
            type: 'uuid',
            allowNull: false,
            references: 'users.id',
            comment: 'Team owner/creator',
        },
        settings: {
            type: 'json',
            defaultValue: {},
            comment: 'Team-specific settings and preferences',
        },
        metadata: {
            type: 'json',
            defaultValue: {},
        },
        maxMembers: {
            type: 'integer',
            defaultValue: null,
            comment: 'Maximum number of members (null = unlimited)',
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
        { fields: ['name'] },
        { fields: ['slug'], unique: true },
        { fields: ['status'] },
        { fields: ['parentTeamId'] },
        { fields: ['ownerId'] },
    ],

    associations: {
        members: {
            type: 'belongsToMany',
            target: 'User',
            through: 'TeamMembers',
            foreignKey: 'teamId',
            otherKey: 'userId',
        },
        owner: {
            type: 'belongsTo',
            target: 'User',
            foreignKey: 'ownerId',
        },
        parentTeam: {
            type: 'belongsTo',
            target: 'Team',
            foreignKey: 'parentTeamId',
            as: 'parent',
        },
        childTeams: {
            type: 'hasMany',
            target: 'Team',
            foreignKey: 'parentTeamId',
            as: 'children',
        },
    },
};

/**
 * Team membership schema (join table)
 */
const TeamMemberSchema = {
    tableName: 'team_members',
    timestamps: true,

    fields: {
        id: {
            type: 'uuid',
            primaryKey: true,
            defaultValue: 'uuid_generate_v4()',
        },
        teamId: {
            type: 'uuid',
            allowNull: false,
            references: 'teams.id',
        },
        userId: {
            type: 'uuid',
            allowNull: false,
            references: 'users.id',
        },
        role: {
            type: 'enum',
            values: ['owner', 'admin', 'member', 'guest'],
            defaultValue: 'member',
        },
        joinedAt: {
            type: 'datetime',
            defaultValue: 'NOW()',
        },
        invitedBy: {
            type: 'uuid',
            allowNull: true,
            references: 'users.id',
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
        { fields: ['teamId', 'userId'], unique: true },
        { fields: ['userId'] },
        { fields: ['role'] },
    ],
};

// -----------------------------------------------------------------------------
// Team Model Class
// -----------------------------------------------------------------------------

/**
 * Team model with business logic
 */
class Team {
    /**
     * Create a new Team instance
     *
     * @param {Object} data - Team data
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || null;
        this.slug = data.slug || null;
        this.description = data.description || null;
        this.type = data.type || 'functional';
        this.status = data.status || 'active';
        this.visibility = data.visibility || 'private';
        this.parentTeamId = data.parentTeamId || null;
        this.ownerId = data.ownerId || null;
        this.settings = data.settings || {};
        this.metadata = data.metadata || {};
        this.maxMembers = data.maxMembers || null;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();

        // Relationships
        this.members = data.members || [];
        this.owner = data.owner || null;
        this.parentTeam = data.parentTeam || null;
        this.childTeams = data.childTeams || [];
    }

    /**
     * Validate team data
     *
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];

        if (!this.name) {
            errors.push({ field: 'name', message: 'Team name is required' });
        } else if (this.name.length < 2) {
            errors.push({ field: 'name', message: 'Team name must be at least 2 characters' });
        } else if (this.name.length > 255) {
            errors.push({ field: 'name', message: 'Team name must be 255 characters or less' });
        }

        if (!this.slug) {
            errors.push({ field: 'slug', message: 'Team slug is required' });
        } else if (!/^[a-z0-9-]+$/.test(this.slug)) {
            errors.push({ field: 'slug', message: 'Slug must contain only lowercase letters, numbers, and hyphens' });
        }

        if (!this.ownerId) {
            errors.push({ field: 'ownerId', message: 'Team owner is required' });
        }

        const validTypes = ['department', 'project', 'functional', 'cross-functional', 'temporary'];
        if (!validTypes.includes(this.type)) {
            errors.push({ field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` });
        }

        const validStatuses = ['active', 'inactive', 'archived'];
        if (!validStatuses.includes(this.status)) {
            errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Generate slug from name
     *
     * @param {string} name - Team name
     * @returns {string} URL-friendly slug
     */
    static generateSlug(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Convert to plain object
     *
     * @param {Object} options - Serialization options
     * @returns {Object} Plain object representation
     */
    toJSON(options = {}) {
        const json = {
            id: this.id,
            name: this.name,
            slug: this.slug,
            description: this.description,
            type: this.type,
            status: this.status,
            visibility: this.visibility,
            parentTeamId: this.parentTeamId,
            ownerId: this.ownerId,
            maxMembers: this.maxMembers,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };

        if (options.includeSettings) {
            json.settings = this.settings;
            json.metadata = this.metadata;
        }

        if (options.includeMembers) {
            json.members = this.members;
            json.memberCount = this.members.length;
        }

        if (options.includeHierarchy) {
            json.parentTeam = this.parentTeam;
            json.childTeams = this.childTeams;
        }

        return json;
    }

    /**
     * Check if team is active
     *
     * @returns {boolean}
     */
    isActive() {
        return this.status === 'active';
    }

    /**
     * Check if team is public
     *
     * @returns {boolean}
     */
    isPublic() {
        return this.visibility === 'public';
    }

    /**
     * Check if team can accept more members
     *
     * @returns {boolean}
     */
    canAddMembers() {
        if (!this.maxMembers) {
            return true;
        }
        return this.members.length < this.maxMembers;
    }

    /**
     * Get member count
     *
     * @returns {number}
     */
    getMemberCount() {
        return this.members.length;
    }

    /**
     * Check if user is a member
     *
     * @param {string} userId - User ID to check
     * @returns {boolean}
     */
    hasMember(userId) {
        return this.members.some(member =>
            member.userId === userId || member.id === userId
        );
    }

    /**
     * Get member's role in team
     *
     * @param {string} userId - User ID
     * @returns {string|null} Role or null if not a member
     */
    getMemberRole(userId) {
        const member = this.members.find(m =>
            m.userId === userId || m.id === userId
        );
        return member?.role || null;
    }

    /**
     * Check if user is team admin
     *
     * @param {string} userId - User ID
     * @returns {boolean}
     */
    isAdmin(userId) {
        const role = this.getMemberRole(userId);
        return role === 'owner' || role === 'admin';
    }

    /**
     * Archive the team
     *
     * @returns {Team}
     */
    archive() {
        this.status = 'archived';
        this.metadata.archivedAt = new Date().toISOString();
        this.updatedAt = new Date();
        return this;
    }

    /**
     * Restore archived team
     *
     * @returns {Team}
     */
    restore() {
        this.status = 'active';
        delete this.metadata.archivedAt;
        this.updatedAt = new Date();
        return this;
    }
}

// -----------------------------------------------------------------------------
// Team Member Class
// -----------------------------------------------------------------------------

/**
 * Team member model for membership management
 */
class TeamMember {
    /**
     * Create a new TeamMember instance
     *
     * @param {Object} data - Membership data
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.teamId = data.teamId || null;
        this.userId = data.userId || null;
        this.role = data.role || 'member';
        this.joinedAt = data.joinedAt || new Date();
        this.invitedBy = data.invitedBy || null;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();

        // Related entities
        this.user = data.user || null;
        this.team = data.team || null;
    }

    /**
     * Validate membership data
     *
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];

        if (!this.teamId) {
            errors.push({ field: 'teamId', message: 'Team ID is required' });
        }

        if (!this.userId) {
            errors.push({ field: 'userId', message: 'User ID is required' });
        }

        const validRoles = ['owner', 'admin', 'member', 'guest'];
        if (!validRoles.includes(this.role)) {
            errors.push({ field: 'role', message: `Role must be one of: ${validRoles.join(', ')}` });
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Convert to plain object
     *
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            teamId: this.teamId,
            userId: this.userId,
            role: this.role,
            joinedAt: this.joinedAt,
            invitedBy: this.invitedBy,
            user: this.user,
        };
    }

    /**
     * Check if member has admin privileges
     *
     * @returns {boolean}
     */
    isAdmin() {
        return this.role === 'owner' || this.role === 'admin';
    }

    /**
     * Promote to admin
     *
     * @returns {TeamMember}
     */
    promoteToAdmin() {
        if (this.role !== 'owner') {
            this.role = 'admin';
            this.updatedAt = new Date();
        }
        return this;
    }

    /**
     * Demote to member
     *
     * @returns {TeamMember}
     */
    demoteToMember() {
        if (this.role !== 'owner') {
            this.role = 'member';
            this.updatedAt = new Date();
        }
        return this;
    }
}

// -----------------------------------------------------------------------------
// Repository Implementation
// -----------------------------------------------------------------------------

/**
 * Team repository for data access
 */
class TeamRepository {
    constructor(db) {
        this.db = db;
        this.table = TeamSchema.tableName;
        this.memberTable = TeamMemberSchema.tableName;
    }

    /**
     * Find team by ID
     *
     * @param {string} id - Team ID
     * @param {Object} options - Query options
     * @returns {Promise<Team|null>}
     */
    async findById(id, options = {}) {
        const query = {
            table: this.table,
            where: { id },
        };

        const result = await this.db.findOne(query);

        if (!result) {
            return null;
        }

        const team = new Team(result);

        if (options.includeMembers) {
            team.members = await this.getMembers(id);
        }

        return team;
    }

    /**
     * Find team by slug
     *
     * @param {string} slug - Team slug
     * @returns {Promise<Team|null>}
     */
    async findBySlug(slug) {
        const query = {
            table: this.table,
            where: { slug },
        };

        const result = await this.db.findOne(query);
        return result ? new Team(result) : null;
    }

    /**
     * Find all teams with pagination
     *
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async findAll(options = {}) {
        const {
            page = 0,
            perPage = 20,
            status,
            type,
            visibility,
            search,
            parentTeamId,
            sortBy = 'name',
            sortOrder = 'ASC',
        } = options;

        const query = {
            table: this.table,
            where: {},
            limit: perPage,
            offset: page * perPage,
            orderBy: [[sortBy, sortOrder]],
        };

        if (status) query.where.status = status;
        if (type) query.where.type = type;
        if (visibility) query.where.visibility = visibility;
        if (parentTeamId !== undefined) query.where.parentTeamId = parentTeamId;

        if (search) {
            query.where.$or = [
                { name: { $like: `%${search}%` } },
                { description: { $like: `%${search}%` } },
            ];
        }

        const [results, total] = await Promise.all([
            this.db.findMany(query),
            this.db.count({ table: this.table, where: query.where }),
        ]);

        return {
            data: results.map(r => new Team(r)),
            pagination: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        };
    }

    /**
     * Create a new team
     *
     * @param {Team|Object} team - Team data
     * @returns {Promise<Team>}
     */
    async create(team) {
        const teamData = team instanceof Team ? team.toJSON({ includeSettings: true }) : team;

        // Generate slug if not provided
        if (!teamData.slug && teamData.name) {
            teamData.slug = Team.generateSlug(teamData.name);
        }

        const teamInstance = new Team(teamData);

        const validation = teamInstance.validate();
        if (!validation.isValid) {
            const error = new Error('Validation failed');
            error.errors = validation.errors;
            throw error;
        }

        const result = await this.db.insert({
            table: this.table,
            data: teamInstance.toJSON({ includeSettings: true }),
        });

        // Add owner as team member
        if (result.id && result.ownerId) {
            await this.addMember(result.id, result.ownerId, 'owner');
        }

        return new Team(result);
    }

    /**
     * Update a team
     *
     * @param {string} id - Team ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Team>}
     */
    async update(id, updates) {
        const existing = await this.findById(id);
        if (!existing) {
            const error = new Error('Team not found');
            error.statusCode = 404;
            throw error;
        }

        const updatedTeam = new Team({
            ...existing.toJSON({ includeSettings: true }),
            ...updates,
            updatedAt: new Date(),
        });

        const validation = updatedTeam.validate();
        if (!validation.isValid) {
            const error = new Error('Validation failed');
            error.errors = validation.errors;
            throw error;
        }

        await this.db.update({
            table: this.table,
            where: { id },
            data: updatedTeam.toJSON({ includeSettings: true }),
        });

        return updatedTeam;
    }

    /**
     * Delete a team
     *
     * @param {string} id - Team ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        // Remove all members first
        await this.db.delete({
            table: this.memberTable,
            where: { teamId: id },
        });

        const result = await this.db.delete({
            table: this.table,
            where: { id },
        });

        return result.affectedRows > 0;
    }

    /**
     * Get team members
     *
     * @param {string} teamId - Team ID
     * @returns {Promise<TeamMember[]>}
     */
    async getMembers(teamId) {
        const query = {
            table: this.memberTable,
            where: { teamId },
            join: {
                table: 'users',
                on: `${this.memberTable}.userId = users.id`,
            },
        };

        const results = await this.db.findMany(query);
        return results.map(r => new TeamMember(r));
    }

    /**
     * Add member to team
     *
     * @param {string} teamId - Team ID
     * @param {string} userId - User ID
     * @param {string} role - Member role
     * @param {string} invitedBy - Inviter user ID
     * @returns {Promise<TeamMember>}
     */
    async addMember(teamId, userId, role = 'member', invitedBy = null) {
        const team = await this.findById(teamId, { includeMembers: true });

        if (!team) {
            const error = new Error('Team not found');
            error.statusCode = 404;
            throw error;
        }

        if (!team.canAddMembers()) {
            const error = new Error('Team has reached maximum member limit');
            error.statusCode = 400;
            throw error;
        }

        const membership = new TeamMember({
            teamId,
            userId,
            role,
            invitedBy,
            joinedAt: new Date(),
        });

        const validation = membership.validate();
        if (!validation.isValid) {
            const error = new Error('Validation failed');
            error.errors = validation.errors;
            throw error;
        }

        const result = await this.db.insert({
            table: this.memberTable,
            data: membership.toJSON(),
        });

        return new TeamMember(result);
    }

    /**
     * Remove member from team
     *
     * @param {string} teamId - Team ID
     * @param {string} userId - User ID
     * @returns {Promise<boolean>}
     */
    async removeMember(teamId, userId) {
        const result = await this.db.delete({
            table: this.memberTable,
            where: { teamId, userId },
        });

        return result.affectedRows > 0;
    }

    /**
     * Update member role
     *
     * @param {string} teamId - Team ID
     * @param {string} userId - User ID
     * @param {string} newRole - New role
     * @returns {Promise<TeamMember>}
     */
    async updateMemberRole(teamId, userId, newRole) {
        const result = await this.db.update({
            table: this.memberTable,
            where: { teamId, userId },
            data: { role: newRole, updatedAt: new Date() },
        });

        if (result.affectedRows === 0) {
            const error = new Error('Team member not found');
            error.statusCode = 404;
            throw error;
        }

        return this.db.findOne({
            table: this.memberTable,
            where: { teamId, userId },
        }).then(r => new TeamMember(r));
    }

    /**
     * Get teams for a user
     *
     * @param {string} userId - User ID
     * @returns {Promise<Team[]>}
     */
    async findByUser(userId) {
        const query = {
            table: this.table,
            join: {
                table: this.memberTable,
                on: `${this.table}.id = ${this.memberTable}.teamId`,
            },
            where: { [`${this.memberTable}.userId`]: userId },
        };

        const results = await this.db.findMany(query);
        return results.map(r => new Team(r));
    }
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    Team,
    TeamMember,
    TeamSchema,
    TeamMemberSchema,
    TeamRepository,
};
