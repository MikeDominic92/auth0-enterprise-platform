/**
 * Audit Log Model
 *
 * Records all significant system events for compliance, security monitoring,
 * and debugging purposes. Supports structured logging with full context.
 *
 * @module backend/models/AuditLog
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Audit event types categorized by domain
 */
const AUDIT_EVENT_TYPES = {
    // Authentication events
    AUTH: {
        LOGIN_SUCCESS: 'auth.login.success',
        LOGIN_FAILURE: 'auth.login.failure',
        LOGOUT: 'auth.logout',
        PASSWORD_CHANGE: 'auth.password.change',
        PASSWORD_RESET_REQUEST: 'auth.password.reset_request',
        PASSWORD_RESET_COMPLETE: 'auth.password.reset_complete',
        MFA_ENROLL: 'auth.mfa.enroll',
        MFA_CHALLENGE_SUCCESS: 'auth.mfa.success',
        MFA_CHALLENGE_FAILURE: 'auth.mfa.failure',
        TOKEN_REFRESH: 'auth.token.refresh',
        SESSION_EXPIRED: 'auth.session.expired',
    },

    // User management events
    USER: {
        CREATE: 'user.create',
        UPDATE: 'user.update',
        DELETE: 'user.delete',
        BLOCK: 'user.block',
        UNBLOCK: 'user.unblock',
        ROLE_ASSIGN: 'user.role.assign',
        ROLE_REMOVE: 'user.role.remove',
        INVITE: 'user.invite',
        ACTIVATE: 'user.activate',
    },

    // Team events
    TEAM: {
        CREATE: 'team.create',
        UPDATE: 'team.update',
        DELETE: 'team.delete',
        ARCHIVE: 'team.archive',
        MEMBER_ADD: 'team.member.add',
        MEMBER_REMOVE: 'team.member.remove',
        MEMBER_ROLE_CHANGE: 'team.member.role_change',
    },

    // Access events
    ACCESS: {
        PERMISSION_GRANTED: 'access.permission.granted',
        PERMISSION_DENIED: 'access.permission.denied',
        RESOURCE_ACCESS: 'access.resource',
        API_CALL: 'access.api',
    },

    // System events
    SYSTEM: {
        CONFIG_CHANGE: 'system.config.change',
        MAINTENANCE_START: 'system.maintenance.start',
        MAINTENANCE_END: 'system.maintenance.end',
        ERROR: 'system.error',
        SECURITY_ALERT: 'system.security.alert',
    },

    // Compliance events
    COMPLIANCE: {
        REPORT_GENERATE: 'compliance.report.generate',
        REPORT_DOWNLOAD: 'compliance.report.download',
        DATA_EXPORT: 'compliance.data.export',
        CONSENT_UPDATE: 'compliance.consent.update',
    },
};

/**
 * Severity levels for audit events
 */
const SEVERITY_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    NOTICE: 'notice',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
    ALERT: 'alert',
};

/**
 * Outcome status for audit events
 */
const OUTCOME_STATUS = {
    SUCCESS: 'success',
    FAILURE: 'failure',
    UNKNOWN: 'unknown',
};

// -----------------------------------------------------------------------------
// Model Schema Definition
// -----------------------------------------------------------------------------

/**
 * Audit log schema definition
 */
const AuditLogSchema = {
    tableName: 'audit_logs',
    timestamps: true,

    fields: {
        id: {
            type: 'uuid',
            primaryKey: true,
            defaultValue: 'uuid_generate_v4()',
        },
        eventType: {
            type: 'string',
            length: 100,
            allowNull: false,
            index: true,
            comment: 'Type of audit event (e.g., user.create, auth.login)',
        },
        eventCategory: {
            type: 'string',
            length: 50,
            allowNull: false,
            index: true,
            comment: 'Category grouping (auth, user, team, access, system)',
        },
        severity: {
            type: 'enum',
            values: Object.values(SEVERITY_LEVELS),
            defaultValue: SEVERITY_LEVELS.INFO,
        },
        outcome: {
            type: 'enum',
            values: Object.values(OUTCOME_STATUS),
            defaultValue: OUTCOME_STATUS.SUCCESS,
        },
        actorId: {
            type: 'string',
            length: 255,
            allowNull: true,
            index: true,
            comment: 'User ID of the actor who performed the action',
        },
        actorType: {
            type: 'string',
            length: 50,
            defaultValue: 'user',
            comment: 'Type of actor (user, system, api)',
        },
        actorEmail: {
            type: 'string',
            length: 255,
            allowNull: true,
        },
        actorIp: {
            type: 'string',
            length: 45,
            allowNull: true,
            comment: 'IP address of the actor',
        },
        targetType: {
            type: 'string',
            length: 50,
            allowNull: true,
            comment: 'Type of target entity (user, team, resource)',
        },
        targetId: {
            type: 'string',
            length: 255,
            allowNull: true,
            index: true,
            comment: 'ID of the target entity',
        },
        targetName: {
            type: 'string',
            length: 255,
            allowNull: true,
        },
        description: {
            type: 'text',
            allowNull: true,
            comment: 'Human-readable description of the event',
        },
        changes: {
            type: 'json',
            defaultValue: null,
            comment: 'JSON object containing before/after values for changes',
        },
        metadata: {
            type: 'json',
            defaultValue: {},
            comment: 'Additional context and metadata',
        },
        requestId: {
            type: 'string',
            length: 100,
            allowNull: true,
            index: true,
            comment: 'Correlation ID for request tracing',
        },
        userAgent: {
            type: 'text',
            allowNull: true,
        },
        location: {
            type: 'json',
            defaultValue: null,
            comment: 'Geolocation data if available',
        },
        timestamp: {
            type: 'datetime',
            defaultValue: 'NOW()',
            index: true,
        },
        createdAt: {
            type: 'datetime',
            defaultValue: 'NOW()',
        },
    },

    indexes: [
        { fields: ['eventType'] },
        { fields: ['eventCategory'] },
        { fields: ['actorId'] },
        { fields: ['targetId'] },
        { fields: ['timestamp'] },
        { fields: ['requestId'] },
        { fields: ['severity'] },
        { fields: ['outcome'] },
        // Composite indexes for common queries
        { fields: ['actorId', 'timestamp'] },
        { fields: ['eventCategory', 'timestamp'] },
        { fields: ['targetType', 'targetId', 'timestamp'] },
    ],
};

// -----------------------------------------------------------------------------
// Audit Log Model Class
// -----------------------------------------------------------------------------

/**
 * Audit log model with business logic
 */
class AuditLog {
    /**
     * Create a new AuditLog instance
     *
     * @param {Object} data - Audit log data
     */
    constructor(data = {}) {
        this.id = data.id || null;
        this.eventType = data.eventType || null;
        this.eventCategory = data.eventCategory || this._extractCategory(data.eventType);
        this.severity = data.severity || SEVERITY_LEVELS.INFO;
        this.outcome = data.outcome || OUTCOME_STATUS.SUCCESS;

        // Actor information
        this.actorId = data.actorId || null;
        this.actorType = data.actorType || 'user';
        this.actorEmail = data.actorEmail || null;
        this.actorIp = data.actorIp || null;

        // Target information
        this.targetType = data.targetType || null;
        this.targetId = data.targetId || null;
        this.targetName = data.targetName || null;

        // Event details
        this.description = data.description || null;
        this.changes = data.changes || null;
        this.metadata = data.metadata || {};

        // Request context
        this.requestId = data.requestId || null;
        this.userAgent = data.userAgent || null;
        this.location = data.location || null;

        // Timestamps
        this.timestamp = data.timestamp || new Date();
        this.createdAt = data.createdAt || new Date();
    }

    /**
     * Extract category from event type
     * @private
     */
    _extractCategory(eventType) {
        if (!eventType) return null;
        const parts = eventType.split('.');
        return parts[0] || null;
    }

    /**
     * Validate audit log data
     *
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];

        if (!this.eventType) {
            errors.push({ field: 'eventType', message: 'Event type is required' });
        }

        const validSeverities = Object.values(SEVERITY_LEVELS);
        if (!validSeverities.includes(this.severity)) {
            errors.push({ field: 'severity', message: `Severity must be one of: ${validSeverities.join(', ')}` });
        }

        const validOutcomes = Object.values(OUTCOME_STATUS);
        if (!validOutcomes.includes(this.outcome)) {
            errors.push({ field: 'outcome', message: `Outcome must be one of: ${validOutcomes.join(', ')}` });
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Convert to plain object
     *
     * @returns {Object} Plain object representation
     */
    toJSON() {
        return {
            id: this.id,
            eventType: this.eventType,
            eventCategory: this.eventCategory,
            severity: this.severity,
            outcome: this.outcome,
            actor: {
                id: this.actorId,
                type: this.actorType,
                email: this.actorEmail,
                ip: this.actorIp,
            },
            target: {
                type: this.targetType,
                id: this.targetId,
                name: this.targetName,
            },
            description: this.description,
            changes: this.changes,
            metadata: this.metadata,
            requestId: this.requestId,
            userAgent: this.userAgent,
            location: this.location,
            timestamp: this.timestamp,
            createdAt: this.createdAt,
        };
    }

    /**
     * Convert to storage format
     *
     * @returns {Object} Flat object for database storage
     */
    toStorageFormat() {
        return {
            id: this.id,
            eventType: this.eventType,
            eventCategory: this.eventCategory,
            severity: this.severity,
            outcome: this.outcome,
            actorId: this.actorId,
            actorType: this.actorType,
            actorEmail: this.actorEmail,
            actorIp: this.actorIp,
            targetType: this.targetType,
            targetId: this.targetId,
            targetName: this.targetName,
            description: this.description,
            changes: this.changes,
            metadata: this.metadata,
            requestId: this.requestId,
            userAgent: this.userAgent,
            location: this.location,
            timestamp: this.timestamp,
            createdAt: this.createdAt,
        };
    }

    /**
     * Check if this is a security-related event
     *
     * @returns {boolean}
     */
    isSecurityEvent() {
        const securityCategories = ['auth', 'access'];
        const securitySeverities = [SEVERITY_LEVELS.WARNING, SEVERITY_LEVELS.ERROR, SEVERITY_LEVELS.CRITICAL, SEVERITY_LEVELS.ALERT];

        return securityCategories.includes(this.eventCategory) ||
               securitySeverities.includes(this.severity);
    }

    /**
     * Check if this is a failed event
     *
     * @returns {boolean}
     */
    isFailed() {
        return this.outcome === OUTCOME_STATUS.FAILURE;
    }

    /**
     * Check if this is a high-severity event
     *
     * @returns {boolean}
     */
    isHighSeverity() {
        return [SEVERITY_LEVELS.ERROR, SEVERITY_LEVELS.CRITICAL, SEVERITY_LEVELS.ALERT].includes(this.severity);
    }
}

// -----------------------------------------------------------------------------
// Audit Log Builder
// -----------------------------------------------------------------------------

/**
 * Builder pattern for creating audit logs
 */
class AuditLogBuilder {
    constructor() {
        this.data = {};
    }

    /**
     * Set event type
     *
     * @param {string} eventType - Event type
     * @returns {AuditLogBuilder}
     */
    event(eventType) {
        this.data.eventType = eventType;
        this.data.eventCategory = eventType.split('.')[0];
        return this;
    }

    /**
     * Set severity level
     *
     * @param {string} severity - Severity level
     * @returns {AuditLogBuilder}
     */
    severity(severity) {
        this.data.severity = severity;
        return this;
    }

    /**
     * Set outcome status
     *
     * @param {string} outcome - Outcome status
     * @returns {AuditLogBuilder}
     */
    outcome(outcome) {
        this.data.outcome = outcome;
        return this;
    }

    /**
     * Mark as success
     *
     * @returns {AuditLogBuilder}
     */
    success() {
        this.data.outcome = OUTCOME_STATUS.SUCCESS;
        return this;
    }

    /**
     * Mark as failure
     *
     * @returns {AuditLogBuilder}
     */
    failure() {
        this.data.outcome = OUTCOME_STATUS.FAILURE;
        return this;
    }

    /**
     * Set actor information
     *
     * @param {Object} actor - Actor data
     * @returns {AuditLogBuilder}
     */
    actor(actor) {
        this.data.actorId = actor.id || actor.sub;
        this.data.actorType = actor.type || 'user';
        this.data.actorEmail = actor.email;
        this.data.actorIp = actor.ip;
        return this;
    }

    /**
     * Set actor from request
     *
     * @param {Object} req - Express request object
     * @returns {AuditLogBuilder}
     */
    fromRequest(req) {
        if (req.user) {
            this.data.actorId = req.user.id;
            this.data.actorEmail = req.user.email;
            this.data.actorType = 'user';
        }
        this.data.actorIp = req.ip || req.connection?.remoteAddress;
        this.data.userAgent = req.get('User-Agent');
        this.data.requestId = req.id || req.get('X-Request-ID');
        return this;
    }

    /**
     * Set target information
     *
     * @param {string} type - Target type
     * @param {string} id - Target ID
     * @param {string} name - Target name
     * @returns {AuditLogBuilder}
     */
    target(type, id, name = null) {
        this.data.targetType = type;
        this.data.targetId = id;
        this.data.targetName = name;
        return this;
    }

    /**
     * Set description
     *
     * @param {string} description - Event description
     * @returns {AuditLogBuilder}
     */
    describe(description) {
        this.data.description = description;
        return this;
    }

    /**
     * Set changes (before/after values)
     *
     * @param {Object} before - Previous values
     * @param {Object} after - New values
     * @returns {AuditLogBuilder}
     */
    changes(before, after) {
        this.data.changes = { before, after };
        return this;
    }

    /**
     * Add metadata
     *
     * @param {Object} metadata - Additional metadata
     * @returns {AuditLogBuilder}
     */
    meta(metadata) {
        this.data.metadata = { ...this.data.metadata, ...metadata };
        return this;
    }

    /**
     * Set location data
     *
     * @param {Object} location - Geolocation data
     * @returns {AuditLogBuilder}
     */
    location(location) {
        this.data.location = location;
        return this;
    }

    /**
     * Build the audit log instance
     *
     * @returns {AuditLog}
     */
    build() {
        return new AuditLog(this.data);
    }
}

// -----------------------------------------------------------------------------
// Repository Implementation
// -----------------------------------------------------------------------------

/**
 * Audit log repository for data access
 */
class AuditLogRepository {
    constructor(db) {
        this.db = db;
        this.table = AuditLogSchema.tableName;
    }

    /**
     * Create a new audit log entry
     *
     * @param {AuditLog|Object} log - Audit log data
     * @returns {Promise<AuditLog>}
     */
    async create(log) {
        const logData = log instanceof AuditLog ? log.toStorageFormat() : log;
        const logInstance = new AuditLog(logData);

        const validation = logInstance.validate();
        if (!validation.isValid) {
            const error = new Error('Validation failed');
            error.errors = validation.errors;
            throw error;
        }

        const result = await this.db.insert({
            table: this.table,
            data: logInstance.toStorageFormat(),
        });

        return new AuditLog(result);
    }

    /**
     * Find audit log by ID
     *
     * @param {string} id - Log ID
     * @returns {Promise<AuditLog|null>}
     */
    async findById(id) {
        const result = await this.db.findOne({
            table: this.table,
            where: { id },
        });

        return result ? new AuditLog(result) : null;
    }

    /**
     * Query audit logs with filtering
     *
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async query(options = {}) {
        const {
            page = 0,
            perPage = 50,
            eventType,
            eventCategory,
            severity,
            outcome,
            actorId,
            targetType,
            targetId,
            startDate,
            endDate,
            search,
            sortBy = 'timestamp',
            sortOrder = 'DESC',
        } = options;

        const query = {
            table: this.table,
            where: {},
            limit: perPage,
            offset: page * perPage,
            orderBy: [[sortBy, sortOrder]],
        };

        // Apply filters
        if (eventType) query.where.eventType = eventType;
        if (eventCategory) query.where.eventCategory = eventCategory;
        if (severity) query.where.severity = severity;
        if (outcome) query.where.outcome = outcome;
        if (actorId) query.where.actorId = actorId;
        if (targetType) query.where.targetType = targetType;
        if (targetId) query.where.targetId = targetId;

        // Date range filter
        if (startDate || endDate) {
            query.where.timestamp = {};
            if (startDate) query.where.timestamp.$gte = new Date(startDate);
            if (endDate) query.where.timestamp.$lte = new Date(endDate);
        }

        // Search filter
        if (search) {
            query.where.$or = [
                { description: { $like: `%${search}%` } },
                { actorEmail: { $like: `%${search}%` } },
                { targetName: { $like: `%${search}%` } },
            ];
        }

        const [results, total] = await Promise.all([
            this.db.findMany(query),
            this.db.count({ table: this.table, where: query.where }),
        ]);

        return {
            data: results.map(r => new AuditLog(r)),
            pagination: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        };
    }

    /**
     * Get logs for a specific actor
     *
     * @param {string} actorId - Actor ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async findByActor(actorId, options = {}) {
        return this.query({ ...options, actorId });
    }

    /**
     * Get logs for a specific target
     *
     * @param {string} targetType - Target type
     * @param {string} targetId - Target ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async findByTarget(targetType, targetId, options = {}) {
        return this.query({ ...options, targetType, targetId });
    }

    /**
     * Get security events
     *
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getSecurityEvents(options = {}) {
        const securityCategories = ['auth', 'access'];

        return this.query({
            ...options,
            where: {
                $or: [
                    { eventCategory: { $in: securityCategories } },
                    { severity: { $in: ['warning', 'error', 'critical', 'alert'] } },
                ],
            },
        });
    }

    /**
     * Get failed events
     *
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getFailedEvents(options = {}) {
        return this.query({ ...options, outcome: OUTCOME_STATUS.FAILURE });
    }

    /**
     * Count events by type in date range
     *
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>}
     */
    async countByType(startDate, endDate) {
        const query = {
            table: this.table,
            select: ['eventType', 'COUNT(*) as count'],
            where: {
                timestamp: {
                    $gte: startDate,
                    $lte: endDate,
                },
            },
            groupBy: ['eventType'],
        };

        return this.db.aggregate(query);
    }

    /**
     * Export logs to CSV format
     *
     * @param {Object} options - Query options
     * @returns {Promise<string>} CSV string
     */
    async exportToCsv(options = {}) {
        const result = await this.query({ ...options, perPage: 10000 });
        const logs = result.data;

        const headers = [
            'ID', 'Timestamp', 'Event Type', 'Category', 'Severity', 'Outcome',
            'Actor ID', 'Actor Email', 'Actor IP',
            'Target Type', 'Target ID', 'Target Name',
            'Description',
        ];

        const rows = logs.map(log => [
            log.id,
            log.timestamp.toISOString(),
            log.eventType,
            log.eventCategory,
            log.severity,
            log.outcome,
            log.actorId || '',
            log.actorEmail || '',
            log.actorIp || '',
            log.targetType || '',
            log.targetId || '',
            log.targetName || '',
            (log.description || '').replace(/"/g, '""'),
        ]);

        const csvRows = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ];

        return csvRows.join('\n');
    }
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    AuditLog,
    AuditLogBuilder,
    AuditLogSchema,
    AuditLogRepository,
    AUDIT_EVENT_TYPES,
    SEVERITY_LEVELS,
    OUTCOME_STATUS,
};
