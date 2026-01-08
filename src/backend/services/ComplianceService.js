/**
 * Compliance Service
 *
 * Generates compliance reports, handles data exports, and provides
 * regulatory compliance functionality (GDPR, SOC2, HIPAA).
 *
 * @module backend/services/ComplianceService
 */

const { AuditLogRepository, AUDIT_EVENT_TYPES, SEVERITY_LEVELS } = require('../models/AuditLog');

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Report types supported by the service
 */
const REPORT_TYPES = {
    ACCESS_REVIEW: 'access-review',
    LOGIN_ACTIVITY: 'login-activity',
    USER_LIFECYCLE: 'user-lifecycle',
    PERMISSION_CHANGES: 'permission-changes',
    SECURITY_EVENTS: 'security-events',
    DATA_EXPORT: 'data-export',
    AUDIT_SUMMARY: 'audit-summary',
    COMPLIANCE_OVERVIEW: 'compliance-overview',
};

/**
 * Compliance frameworks
 */
const COMPLIANCE_FRAMEWORKS = {
    SOC2: 'soc2',
    GDPR: 'gdpr',
    HIPAA: 'hipaa',
    ISO27001: 'iso27001',
};

/**
 * Export formats
 */
const EXPORT_FORMATS = {
    CSV: 'csv',
    JSON: 'json',
    PDF: 'pdf',
};

// -----------------------------------------------------------------------------
// Compliance Service Class
// -----------------------------------------------------------------------------

/**
 * Service class for compliance and reporting operations
 */
class ComplianceService {
    /**
     * Create ComplianceService instance
     *
     * @param {Object} options - Service options
     * @param {Object} options.db - Database connection
     * @param {UserService} options.userService - User service instance
     * @param {Object} options.auditLogRepository - Audit log repository
     */
    constructor(options = {}) {
        this.db = options.db;
        this.userService = options.userService;
        this.auditLogRepository = options.auditLogRepository ||
            (options.db ? new AuditLogRepository(options.db) : null);
    }

    // -------------------------------------------------------------------------
    // Report Generation
    // -------------------------------------------------------------------------

    /**
     * Generate a compliance report
     *
     * @param {string} reportType - Type of report to generate
     * @param {Object} options - Report options
     * @param {Date} options.startDate - Report start date
     * @param {Date} options.endDate - Report end date
     * @param {string} options.format - Output format
     * @param {Object} options.filters - Additional filters
     * @returns {Promise<Object>} Generated report
     */
    async generateReport(reportType, options = {}) {
        const {
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            endDate = new Date(),
            format = EXPORT_FORMATS.JSON,
            filters = {},
        } = options;

        const reportGenerators = {
            [REPORT_TYPES.ACCESS_REVIEW]: this._generateAccessReviewReport.bind(this),
            [REPORT_TYPES.LOGIN_ACTIVITY]: this._generateLoginActivityReport.bind(this),
            [REPORT_TYPES.USER_LIFECYCLE]: this._generateUserLifecycleReport.bind(this),
            [REPORT_TYPES.PERMISSION_CHANGES]: this._generatePermissionChangesReport.bind(this),
            [REPORT_TYPES.SECURITY_EVENTS]: this._generateSecurityEventsReport.bind(this),
            [REPORT_TYPES.DATA_EXPORT]: this._generateDataExportReport.bind(this),
            [REPORT_TYPES.AUDIT_SUMMARY]: this._generateAuditSummaryReport.bind(this),
            [REPORT_TYPES.COMPLIANCE_OVERVIEW]: this._generateComplianceOverviewReport.bind(this),
        };

        const generator = reportGenerators[reportType];
        if (!generator) {
            const error = new Error(`Unknown report type: ${reportType}`);
            error.statusCode = 400;
            throw error;
        }

        try {
            const reportData = await generator(startDate, endDate, filters);

            return {
                id: this._generateReportId(),
                type: reportType,
                generatedAt: new Date().toISOString(),
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                },
                format,
                filters,
                data: reportData,
                metadata: {
                    recordCount: this._countRecords(reportData),
                    generatedBy: 'ComplianceService',
                },
            };
        } catch (error) {
            console.error('[ERROR] ComplianceService.generateReport:', error.message);
            throw this._handleError(error, 'Failed to generate report');
        }
    }

    /**
     * Generate access review report
     * @private
     */
    async _generateAccessReviewReport(startDate, endDate, filters) {
        // Query permission-related audit events
        const events = await this._queryAuditLogs({
            startDate,
            endDate,
            eventCategory: 'access',
            ...filters,
        });

        // Aggregate by user
        const userAccess = this._aggregateByUser(events);

        // Calculate statistics
        const stats = {
            totalAccessEvents: events.length,
            uniqueUsers: Object.keys(userAccess).length,
            permissionChanges: events.filter(e =>
                e.eventType.includes('permission') || e.eventType.includes('role')
            ).length,
            accessDenials: events.filter(e =>
                e.eventType === AUDIT_EVENT_TYPES.ACCESS.PERMISSION_DENIED
            ).length,
        };

        return {
            summary: stats,
            userAccessMatrix: userAccess,
            events: events.slice(0, 1000), // Limit raw events
        };
    }

    /**
     * Generate login activity report
     * @private
     */
    async _generateLoginActivityReport(startDate, endDate, filters) {
        const events = await this._queryAuditLogs({
            startDate,
            endDate,
            eventCategory: 'auth',
            ...filters,
        });

        // Separate by outcome
        const successfulLogins = events.filter(e =>
            e.eventType === AUDIT_EVENT_TYPES.AUTH.LOGIN_SUCCESS
        );
        const failedLogins = events.filter(e =>
            e.eventType === AUDIT_EVENT_TYPES.AUTH.LOGIN_FAILURE
        );

        // Group by day
        const dailyStats = this._groupByDay(events);

        // Identify suspicious patterns
        const suspiciousActivity = this._detectSuspiciousLoginActivity(events);

        return {
            summary: {
                totalLogins: successfulLogins.length,
                failedAttempts: failedLogins.length,
                successRate: successfulLogins.length /
                    (successfulLogins.length + failedLogins.length) * 100 || 0,
                uniqueUsers: new Set(events.map(e => e.actorId)).size,
                uniqueIPs: new Set(events.map(e => e.actorIp).filter(Boolean)).size,
            },
            dailyBreakdown: dailyStats,
            suspiciousActivity,
            topUsers: this._getTopUsers(successfulLogins, 10),
            geographicDistribution: this._getGeographicDistribution(events),
        };
    }

    /**
     * Generate user lifecycle report
     * @private
     */
    async _generateUserLifecycleReport(startDate, endDate, filters) {
        const events = await this._queryAuditLogs({
            startDate,
            endDate,
            eventCategory: 'user',
            ...filters,
        });

        // Categorize events
        const created = events.filter(e => e.eventType === AUDIT_EVENT_TYPES.USER.CREATE);
        const updated = events.filter(e => e.eventType === AUDIT_EVENT_TYPES.USER.UPDATE);
        const deleted = events.filter(e => e.eventType === AUDIT_EVENT_TYPES.USER.DELETE);
        const blocked = events.filter(e => e.eventType === AUDIT_EVENT_TYPES.USER.BLOCK);
        const unblocked = events.filter(e => e.eventType === AUDIT_EVENT_TYPES.USER.UNBLOCK);

        return {
            summary: {
                usersCreated: created.length,
                usersUpdated: updated.length,
                usersDeleted: deleted.length,
                usersBlocked: blocked.length,
                usersUnblocked: unblocked.length,
                netGrowth: created.length - deleted.length,
            },
            timeline: this._createTimeline(events),
            createdUsers: created.map(e => ({
                id: e.targetId,
                name: e.targetName,
                createdAt: e.timestamp,
                createdBy: e.actorEmail,
            })),
            blockedUsers: blocked.map(e => ({
                id: e.targetId,
                name: e.targetName,
                blockedAt: e.timestamp,
                blockedBy: e.actorEmail,
                reason: e.metadata?.reason,
            })),
        };
    }

    /**
     * Generate permission changes report
     * @private
     */
    async _generatePermissionChangesReport(startDate, endDate, filters) {
        const events = await this._queryAuditLogs({
            startDate,
            endDate,
            eventTypes: [
                AUDIT_EVENT_TYPES.USER.ROLE_ASSIGN,
                AUDIT_EVENT_TYPES.USER.ROLE_REMOVE,
                AUDIT_EVENT_TYPES.ACCESS.PERMISSION_GRANTED,
            ],
            ...filters,
        });

        // Group by user
        const changesByUser = {};
        for (const event of events) {
            const userId = event.targetId;
            if (!changesByUser[userId]) {
                changesByUser[userId] = {
                    userId,
                    userName: event.targetName,
                    changes: [],
                };
            }
            changesByUser[userId].changes.push({
                type: event.eventType,
                timestamp: event.timestamp,
                changedBy: event.actorEmail,
                before: event.changes?.before,
                after: event.changes?.after,
            });
        }

        return {
            summary: {
                totalChanges: events.length,
                usersAffected: Object.keys(changesByUser).length,
                roleAssignments: events.filter(e =>
                    e.eventType === AUDIT_EVENT_TYPES.USER.ROLE_ASSIGN
                ).length,
                roleRemovals: events.filter(e =>
                    e.eventType === AUDIT_EVENT_TYPES.USER.ROLE_REMOVE
                ).length,
            },
            changesByUser: Object.values(changesByUser),
            highPrivilegeChanges: events.filter(e =>
                this._isHighPrivilegeChange(e)
            ),
        };
    }

    /**
     * Generate security events report
     * @private
     */
    async _generateSecurityEventsReport(startDate, endDate, filters) {
        const events = await this._queryAuditLogs({
            startDate,
            endDate,
            severities: [SEVERITY_LEVELS.WARNING, SEVERITY_LEVELS.ERROR, SEVERITY_LEVELS.CRITICAL],
            ...filters,
        });

        // Categorize by severity
        const bySeverity = {
            warning: events.filter(e => e.severity === SEVERITY_LEVELS.WARNING),
            error: events.filter(e => e.severity === SEVERITY_LEVELS.ERROR),
            critical: events.filter(e => e.severity === SEVERITY_LEVELS.CRITICAL),
        };

        // Identify incident patterns
        const incidents = this._identifyIncidents(events);

        return {
            summary: {
                totalSecurityEvents: events.length,
                criticalEvents: bySeverity.critical.length,
                errorEvents: bySeverity.error.length,
                warningEvents: bySeverity.warning.length,
                incidentsDetected: incidents.length,
            },
            bySeverity,
            incidents,
            topThreats: this._identifyTopThreats(events),
            affectedUsers: this._getAffectedUsers(events),
            recommendations: this._generateSecurityRecommendations(events),
        };
    }

    /**
     * Generate data export report (GDPR)
     * @private
     */
    async _generateDataExportReport(startDate, endDate, filters) {
        const { userId } = filters;

        if (!userId) {
            const error = new Error('User ID is required for data export');
            error.statusCode = 400;
            throw error;
        }

        // Get user data
        const userData = await this.userService?.getUserById(userId);

        // Get user's audit trail
        const auditTrail = await this._queryAuditLogs({
            startDate: new Date(0), // All time
            endDate: new Date(),
            actorId: userId,
        });

        // Get events targeting this user
        const targetedEvents = await this._queryAuditLogs({
            startDate: new Date(0),
            endDate: new Date(),
            targetId: userId,
        });

        return {
            exportDate: new Date().toISOString(),
            dataSubject: {
                id: userId,
                email: userData?.email,
                name: userData?.name,
            },
            personalData: userData?.toJSON() || {},
            activityHistory: auditTrail.map(e => ({
                date: e.timestamp,
                action: e.eventType,
                description: e.description,
            })),
            dataProcessingHistory: targetedEvents.map(e => ({
                date: e.timestamp,
                action: e.eventType,
                processedBy: e.actorEmail,
            })),
            consents: userData?.metadata?.consents || [],
        };
    }

    /**
     * Generate audit summary report
     * @private
     */
    async _generateAuditSummaryReport(startDate, endDate, filters) {
        const events = await this._queryAuditLogs({
            startDate,
            endDate,
            ...filters,
        });

        // Group by category
        const byCategory = {};
        for (const event of events) {
            const category = event.eventCategory;
            if (!byCategory[category]) {
                byCategory[category] = {
                    total: 0,
                    success: 0,
                    failure: 0,
                    events: [],
                };
            }
            byCategory[category].total++;
            if (event.outcome === 'success') byCategory[category].success++;
            if (event.outcome === 'failure') byCategory[category].failure++;
        }

        // Daily activity
        const dailyActivity = this._groupByDay(events);

        // Peak hours analysis
        const peakHours = this._analyzePeakHours(events);

        return {
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                durationDays: Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)),
            },
            summary: {
                totalEvents: events.length,
                successRate: events.filter(e => e.outcome === 'success').length / events.length * 100 || 0,
                uniqueActors: new Set(events.map(e => e.actorId).filter(Boolean)).size,
                categoriesTracked: Object.keys(byCategory).length,
            },
            byCategory,
            dailyActivity,
            peakHours,
            topEventTypes: this._getTopEventTypes(events, 10),
        };
    }

    /**
     * Generate compliance overview report
     * @private
     */
    async _generateComplianceOverviewReport(startDate, endDate, filters) {
        const { framework = 'general' } = filters;

        // Gather all relevant data
        const [loginReport, userReport, permissionReport, securityReport] = await Promise.all([
            this._generateLoginActivityReport(startDate, endDate, {}),
            this._generateUserLifecycleReport(startDate, endDate, {}),
            this._generatePermissionChangesReport(startDate, endDate, {}),
            this._generateSecurityEventsReport(startDate, endDate, {}),
        ]);

        // Calculate compliance scores
        const complianceScores = this._calculateComplianceScores({
            loginReport,
            userReport,
            permissionReport,
            securityReport,
        });

        // Generate findings
        const findings = this._generateComplianceFindings({
            loginReport,
            userReport,
            permissionReport,
            securityReport,
        });

        return {
            framework,
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
            overallScore: complianceScores.overall,
            scores: complianceScores,
            findings,
            recommendations: this._generateComplianceRecommendations(findings),
            summary: {
                totalUsers: userReport.summary.usersCreated,
                activeSecurityEvents: securityReport.summary.totalSecurityEvents,
                permissionChanges: permissionReport.summary.totalChanges,
                loginSuccessRate: loginReport.summary.successRate,
            },
        };
    }

    // -------------------------------------------------------------------------
    // Export Operations
    // -------------------------------------------------------------------------

    /**
     * Export report to specified format
     *
     * @param {Object} report - Report data
     * @param {string} format - Export format
     * @returns {Promise<Object>} Exported data with content type
     */
    async exportReport(report, format = EXPORT_FORMATS.JSON) {
        switch (format) {
            case EXPORT_FORMATS.CSV:
                return this._exportToCsv(report);
            case EXPORT_FORMATS.JSON:
                return this._exportToJson(report);
            case EXPORT_FORMATS.PDF:
                return this._exportToPdf(report);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Export to CSV format
     * @private
     */
    _exportToCsv(report) {
        // Flatten report data for CSV
        const flatData = this._flattenForCsv(report.data);

        if (flatData.length === 0) {
            return {
                content: '',
                contentType: 'text/csv',
                filename: `${report.type}-${Date.now()}.csv`,
            };
        }

        // Get headers from first row
        const headers = Object.keys(flatData[0]);

        // Build CSV content
        const csvRows = [
            headers.join(','),
            ...flatData.map(row =>
                headers.map(h => {
                    const value = row[h];
                    const stringValue = value === null || value === undefined ? '' : String(value);
                    // Escape quotes and wrap in quotes if contains comma
                    if (stringValue.includes(',') || stringValue.includes('"')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                }).join(',')
            ),
        ];

        return {
            content: csvRows.join('\n'),
            contentType: 'text/csv',
            filename: `${report.type}-${Date.now()}.csv`,
        };
    }

    /**
     * Export to JSON format
     * @private
     */
    _exportToJson(report) {
        return {
            content: JSON.stringify(report, null, 2),
            contentType: 'application/json',
            filename: `${report.type}-${Date.now()}.json`,
        };
    }

    /**
     * Export to PDF format (stub - would require PDF library)
     * @private
     */
    _exportToPdf(report) {
        // In a real implementation, this would use a library like pdfkit or puppeteer
        console.log('[INFO] PDF export requested - would generate PDF document');

        return {
            content: JSON.stringify(report), // Fallback to JSON
            contentType: 'application/pdf',
            filename: `${report.type}-${Date.now()}.pdf`,
            note: 'PDF generation requires additional library integration',
        };
    }

    // -------------------------------------------------------------------------
    // Helper Methods
    // -------------------------------------------------------------------------

    /**
     * Query audit logs with filters
     * @private
     */
    async _queryAuditLogs(options) {
        if (!this.auditLogRepository) {
            // Return mock data if no repository configured
            return this._getMockAuditLogs(options);
        }

        const result = await this.auditLogRepository.query({
            startDate: options.startDate,
            endDate: options.endDate,
            eventCategory: options.eventCategory,
            severity: options.severity,
            actorId: options.actorId,
            targetId: options.targetId,
            perPage: 10000, // Get all for reports
        });

        return result.data;
    }

    /**
     * Generate mock audit logs for testing
     * @private
     */
    _getMockAuditLogs(options) {
        // Return empty array when no real data source
        return [];
    }

    /**
     * Aggregate events by user
     * @private
     */
    _aggregateByUser(events) {
        const byUser = {};
        for (const event of events) {
            const userId = event.actorId || 'system';
            if (!byUser[userId]) {
                byUser[userId] = {
                    userId,
                    email: event.actorEmail,
                    eventCount: 0,
                    lastActivity: null,
                    eventTypes: new Set(),
                };
            }
            byUser[userId].eventCount++;
            byUser[userId].lastActivity = event.timestamp;
            byUser[userId].eventTypes.add(event.eventType);
        }

        // Convert sets to arrays
        for (const user of Object.values(byUser)) {
            user.eventTypes = Array.from(user.eventTypes);
        }

        return byUser;
    }

    /**
     * Group events by day
     * @private
     */
    _groupByDay(events) {
        const byDay = {};
        for (const event of events) {
            const day = event.timestamp.toISOString().split('T')[0];
            if (!byDay[day]) {
                byDay[day] = { date: day, count: 0, events: [] };
            }
            byDay[day].count++;
        }
        return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Detect suspicious login activity
     * @private
     */
    _detectSuspiciousLoginActivity(events) {
        const suspicious = [];

        // Check for multiple failed logins
        const failedByUser = {};
        for (const event of events) {
            if (event.eventType === AUDIT_EVENT_TYPES.AUTH.LOGIN_FAILURE) {
                const userId = event.actorId || event.actorEmail;
                if (!failedByUser[userId]) {
                    failedByUser[userId] = [];
                }
                failedByUser[userId].push(event);
            }
        }

        // Flag users with more than 5 failed attempts
        for (const [userId, failures] of Object.entries(failedByUser)) {
            if (failures.length >= 5) {
                suspicious.push({
                    type: 'multiple_failed_logins',
                    userId,
                    count: failures.length,
                    severity: failures.length >= 10 ? 'high' : 'medium',
                    firstAttempt: failures[0].timestamp,
                    lastAttempt: failures[failures.length - 1].timestamp,
                });
            }
        }

        // Check for logins from multiple IPs in short time
        const loginsByUser = {};
        for (const event of events) {
            if (event.eventType === AUDIT_EVENT_TYPES.AUTH.LOGIN_SUCCESS) {
                const userId = event.actorId;
                if (!loginsByUser[userId]) {
                    loginsByUser[userId] = [];
                }
                loginsByUser[userId].push({
                    ip: event.actorIp,
                    timestamp: event.timestamp,
                });
            }
        }

        for (const [userId, logins] of Object.entries(loginsByUser)) {
            const uniqueIps = new Set(logins.map(l => l.ip).filter(Boolean));
            if (uniqueIps.size >= 3) {
                suspicious.push({
                    type: 'multiple_ip_logins',
                    userId,
                    ipCount: uniqueIps.size,
                    severity: 'medium',
                    ips: Array.from(uniqueIps),
                });
            }
        }

        return suspicious;
    }

    /**
     * Get top users by activity
     * @private
     */
    _getTopUsers(events, limit) {
        const userCounts = {};
        for (const event of events) {
            const userId = event.actorId || 'unknown';
            if (!userCounts[userId]) {
                userCounts[userId] = { userId, email: event.actorEmail, count: 0 };
            }
            userCounts[userId].count++;
        }

        return Object.values(userCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Get geographic distribution from events
     * @private
     */
    _getGeographicDistribution(events) {
        const byLocation = {};
        for (const event of events) {
            if (event.location?.country) {
                const country = event.location.country;
                if (!byLocation[country]) {
                    byLocation[country] = 0;
                }
                byLocation[country]++;
            }
        }
        return byLocation;
    }

    /**
     * Create timeline from events
     * @private
     */
    _createTimeline(events) {
        return events
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(e => ({
                timestamp: e.timestamp,
                type: e.eventType,
                description: e.description,
                actor: e.actorEmail,
            }));
    }

    /**
     * Check if change involves high privileges
     * @private
     */
    _isHighPrivilegeChange(event) {
        const highPrivilegeRoles = ['admin', 'super_admin', 'administrator'];
        const changes = event.changes || {};

        // Check if admin role was added
        const afterRoles = changes.after?.roles || [];
        return afterRoles.some(role =>
            highPrivilegeRoles.includes(role.toLowerCase())
        );
    }

    /**
     * Identify security incidents
     * @private
     */
    _identifyIncidents(events) {
        const incidents = [];

        // Group critical events within short timeframes
        const criticalEvents = events.filter(e =>
            e.severity === SEVERITY_LEVELS.CRITICAL
        );

        if (criticalEvents.length > 0) {
            incidents.push({
                type: 'critical_events',
                count: criticalEvents.length,
                events: criticalEvents.slice(0, 10),
            });
        }

        return incidents;
    }

    /**
     * Identify top security threats
     * @private
     */
    _identifyTopThreats(events) {
        const threatTypes = {};
        for (const event of events) {
            const type = event.eventType;
            if (!threatTypes[type]) {
                threatTypes[type] = 0;
            }
            threatTypes[type]++;
        }

        return Object.entries(threatTypes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
    }

    /**
     * Get affected users from security events
     * @private
     */
    _getAffectedUsers(events) {
        const users = new Set();
        for (const event of events) {
            if (event.targetId) users.add(event.targetId);
            if (event.actorId) users.add(event.actorId);
        }
        return Array.from(users);
    }

    /**
     * Generate security recommendations
     * @private
     */
    _generateSecurityRecommendations(events) {
        const recommendations = [];

        const failedLogins = events.filter(e =>
            e.eventType === AUDIT_EVENT_TYPES.AUTH.LOGIN_FAILURE
        );

        if (failedLogins.length > 100) {
            recommendations.push({
                priority: 'high',
                category: 'authentication',
                recommendation: 'Consider implementing stricter rate limiting for login attempts',
                reason: `${failedLogins.length} failed login attempts detected`,
            });
        }

        const criticalCount = events.filter(e =>
            e.severity === SEVERITY_LEVELS.CRITICAL
        ).length;

        if (criticalCount > 0) {
            recommendations.push({
                priority: 'high',
                category: 'security',
                recommendation: 'Review and address critical security events immediately',
                reason: `${criticalCount} critical events detected`,
            });
        }

        return recommendations;
    }

    /**
     * Analyze peak hours
     * @private
     */
    _analyzePeakHours(events) {
        const byHour = Array(24).fill(0);
        for (const event of events) {
            const hour = event.timestamp.getHours();
            byHour[hour]++;
        }

        return byHour.map((count, hour) => ({ hour, count }));
    }

    /**
     * Get top event types
     * @private
     */
    _getTopEventTypes(events, limit) {
        const typeCounts = {};
        for (const event of events) {
            const type = event.eventType;
            if (!typeCounts[type]) {
                typeCounts[type] = 0;
            }
            typeCounts[type]++;
        }

        return Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([type, count]) => ({ type, count }));
    }

    /**
     * Calculate compliance scores
     * @private
     */
    _calculateComplianceScores(reports) {
        const scores = {
            authentication: this._calculateAuthScore(reports.loginReport),
            accessControl: this._calculateAccessScore(reports.permissionReport),
            userManagement: this._calculateUserScore(reports.userReport),
            security: this._calculateSecurityScore(reports.securityReport),
        };

        scores.overall = Math.round(
            (scores.authentication + scores.accessControl +
             scores.userManagement + scores.security) / 4
        );

        return scores;
    }

    _calculateAuthScore(report) {
        const successRate = report.summary?.successRate || 0;
        return Math.min(100, Math.round(successRate));
    }

    _calculateAccessScore(report) {
        // Lower is better for permission changes (less churn)
        const changes = report.summary?.totalChanges || 0;
        return Math.max(0, 100 - changes);
    }

    _calculateUserScore(report) {
        const blocked = report.summary?.usersBlocked || 0;
        return Math.max(0, 100 - blocked * 10);
    }

    _calculateSecurityScore(report) {
        const critical = report.summary?.criticalEvents || 0;
        const errors = report.summary?.errorEvents || 0;
        return Math.max(0, 100 - critical * 20 - errors * 5);
    }

    /**
     * Generate compliance findings
     * @private
     */
    _generateComplianceFindings(reports) {
        const findings = [];

        if (reports.loginReport.summary?.failedAttempts > 100) {
            findings.push({
                severity: 'medium',
                area: 'Authentication',
                finding: 'High number of failed login attempts detected',
                impact: 'Potential security risk from brute force attacks',
            });
        }

        if (reports.securityReport.summary?.criticalEvents > 0) {
            findings.push({
                severity: 'high',
                area: 'Security',
                finding: 'Critical security events detected',
                impact: 'Immediate attention required',
            });
        }

        return findings;
    }

    /**
     * Generate compliance recommendations
     * @private
     */
    _generateComplianceRecommendations(findings) {
        return findings.map(f => ({
            priority: f.severity === 'high' ? 1 : 2,
            recommendation: `Address ${f.area} issue: ${f.finding}`,
            expectedImpact: f.impact,
        }));
    }

    // -------------------------------------------------------------------------
    // Framework Control Methods (Route Compatibility)
    // -------------------------------------------------------------------------

    /**
     * Get control requirements for a compliance framework
     *
     * @param {string} framework - Framework identifier (soc2, hipaa, gdpr, iso27001)
     * @returns {Array|null} Array of control definitions or null if framework not found
     */
    getFrameworkControls(framework) {
        const frameworkControls = {
            soc2: [
                {
                    id: 'CC1.1',
                    category: 'Security',
                    title: 'Control Environment',
                    description: 'The entity demonstrates a commitment to integrity and ethical values.',
                    requirements: ['Code of conduct', 'Ethics training', 'Background checks'],
                    auditActions: ['user.create', 'user.update', 'auth.login.success'],
                },
                {
                    id: 'CC2.1',
                    category: 'Security',
                    title: 'Communication and Information',
                    description: 'The entity obtains or generates relevant information.',
                    requirements: ['Security policies', 'Incident reporting', 'Communication channels'],
                    auditActions: ['compliance.report.generate', 'system.config.change'],
                },
                {
                    id: 'CC3.1',
                    category: 'Security',
                    title: 'Risk Assessment',
                    description: 'The entity specifies objectives with sufficient clarity.',
                    requirements: ['Risk assessments', 'Vulnerability scanning', 'Threat modeling'],
                    auditActions: ['system.security.alert', 'access.permission.denied'],
                },
                {
                    id: 'CC5.1',
                    category: 'Security',
                    title: 'Control Activities',
                    description: 'The entity selects and develops control activities.',
                    requirements: ['Access controls', 'Change management', 'Segregation of duties'],
                    auditActions: ['user.role.assign', 'user.role.remove', 'access.permission.granted'],
                },
                {
                    id: 'CC6.1',
                    category: 'Security',
                    title: 'Logical Access Security',
                    description: 'The entity implements logical access security measures.',
                    requirements: ['Authentication', 'Authorization', 'Access reviews'],
                    auditActions: ['auth.login.success', 'auth.login.failure', 'auth.mfa.success'],
                },
                {
                    id: 'CC7.1',
                    category: 'Security',
                    title: 'System Operations',
                    description: 'The entity detects, prevents, and recovers from incidents.',
                    requirements: ['Monitoring', 'Incident response', 'Recovery procedures'],
                    auditActions: ['system.error', 'system.security.alert'],
                },
            ],
            hipaa: [
                {
                    id: 'HIPAA-164.312(a)(1)',
                    category: 'Technical Safeguards',
                    title: 'Access Control',
                    description: 'Implement technical policies for electronic PHI access.',
                    requirements: ['Unique user identification', 'Emergency access', 'Automatic logoff', 'Encryption'],
                    auditActions: ['auth.login.success', 'auth.session.expired', 'user.create'],
                },
                {
                    id: 'HIPAA-164.312(b)',
                    category: 'Technical Safeguards',
                    title: 'Audit Controls',
                    description: 'Implement mechanisms to record and examine access.',
                    requirements: ['Audit logs', 'Log review', 'Retention policy'],
                    auditActions: ['access.resource', 'access.api', 'compliance.report.download'],
                },
                {
                    id: 'HIPAA-164.312(c)(1)',
                    category: 'Technical Safeguards',
                    title: 'Integrity Controls',
                    description: 'Implement policies to protect ePHI from alteration.',
                    requirements: ['Data validation', 'Error correction', 'Integrity verification'],
                    auditActions: ['user.update', 'system.config.change'],
                },
                {
                    id: 'HIPAA-164.312(d)',
                    category: 'Technical Safeguards',
                    title: 'Person Authentication',
                    description: 'Implement procedures to verify identity.',
                    requirements: ['MFA', 'Strong passwords', 'Biometrics'],
                    auditActions: ['auth.mfa.success', 'auth.mfa.failure', 'auth.password.change'],
                },
            ],
            gdpr: [
                {
                    id: 'GDPR-Art5',
                    category: 'Data Principles',
                    title: 'Principles of Processing',
                    description: 'Lawfulness, fairness, transparency, purpose limitation.',
                    requirements: ['Consent management', 'Processing records', 'Transparency notices'],
                    auditActions: ['compliance.consent.update', 'user.create'],
                },
                {
                    id: 'GDPR-Art15',
                    category: 'Data Subject Rights',
                    title: 'Right of Access',
                    description: 'Data subjects have right to access their data.',
                    requirements: ['Data export', 'Access requests', 'Response tracking'],
                    auditActions: ['compliance.data.export'],
                },
                {
                    id: 'GDPR-Art17',
                    category: 'Data Subject Rights',
                    title: 'Right to Erasure',
                    description: 'Right to have personal data erased.',
                    requirements: ['Deletion procedures', 'Retention policies', 'Third-party notification'],
                    auditActions: ['user.delete'],
                },
                {
                    id: 'GDPR-Art32',
                    category: 'Security',
                    title: 'Security of Processing',
                    description: 'Implement appropriate security measures.',
                    requirements: ['Encryption', 'Access control', 'Regular testing'],
                    auditActions: ['auth.login.success', 'auth.mfa.success', 'system.security.alert'],
                },
                {
                    id: 'GDPR-Art33',
                    category: 'Breach Notification',
                    title: 'Breach Notification to Authority',
                    description: 'Notify supervisory authority within 72 hours.',
                    requirements: ['Breach detection', 'Notification procedures', 'Documentation'],
                    auditActions: ['system.security.alert', 'system.error'],
                },
            ],
            iso27001: [
                {
                    id: 'ISO-A.9.1',
                    category: 'Access Control',
                    title: 'Business Requirements of Access Control',
                    description: 'Access control policy based on business requirements.',
                    requirements: ['Access policy', 'Network access', 'Application access'],
                    auditActions: ['access.permission.granted', 'access.permission.denied'],
                },
                {
                    id: 'ISO-A.9.2',
                    category: 'Access Control',
                    title: 'User Access Management',
                    description: 'Ensure authorized user access and prevent unauthorized access.',
                    requirements: ['User registration', 'Access provisioning', 'Privileged access'],
                    auditActions: ['user.create', 'user.delete', 'user.role.assign'],
                },
                {
                    id: 'ISO-A.9.4',
                    category: 'Access Control',
                    title: 'System and Application Access Control',
                    description: 'Prevent unauthorized access to systems and applications.',
                    requirements: ['Secure logon', 'Password management', 'Access restriction'],
                    auditActions: ['auth.login.success', 'auth.login.failure', 'auth.password.change'],
                },
                {
                    id: 'ISO-A.12.4',
                    category: 'Operations Security',
                    title: 'Logging and Monitoring',
                    description: 'Record events and generate evidence.',
                    requirements: ['Event logging', 'Log protection', 'Administrator logs'],
                    auditActions: ['system.config.change', 'user.role.assign'],
                },
            ],
        };

        return frameworkControls[framework] || null;
    }

    /**
     * Get action mapping for a specific control
     *
     * @param {string} controlId - Control identifier
     * @returns {Object|null} Control action mapping or null if not found
     */
    getControlActionMapping(controlId) {
        // Build a lookup from all frameworks
        const allControls = [
            ...(this.getFrameworkControls('soc2') || []),
            ...(this.getFrameworkControls('hipaa') || []),
            ...(this.getFrameworkControls('gdpr') || []),
            ...(this.getFrameworkControls('iso27001') || []),
        ];

        const control = allControls.find(c => c.id === controlId);

        if (!control) {
            return null;
        }

        return {
            controlId: control.id,
            title: control.title,
            actions: control.auditActions,
            category: control.category,
        };
    }

    /**
     * Calculate audit readiness score for an organization
     *
     * @param {string} organizationId - Organization ID
     * @param {string} framework - Compliance framework
     * @returns {Promise<Object>} Audit readiness assessment
     */
    async calculateAuditReadiness(organizationId, framework = 'soc2') {
        try {
            const controls = this.getFrameworkControls(framework);

            if (!controls) {
                const error = new Error(`Unknown framework: ${framework}`);
                error.statusCode = 400;
                throw error;
            }

            // Get audit logs for the past 90 days
            const endDate = new Date();
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

            const auditEvents = await this._queryAuditLogs({
                startDate,
                endDate,
            });

            // Evaluate each control
            const controlResults = [];
            let totalScore = 0;

            for (const control of controls) {
                const result = this._evaluateControlReadiness(control, auditEvents);
                controlResults.push(result);
                totalScore += result.score;
            }

            const overallScore = controls.length > 0
                ? Math.round(totalScore / controls.length)
                : 0;

            // Generate recommendations
            const recommendations = this._generateAuditRecommendations(controlResults);

            // Identify gaps
            const gaps = controlResults
                .filter(r => r.status === 'gap' || r.status === 'partial')
                .map(r => ({
                    controlId: r.controlId,
                    title: r.title,
                    status: r.status,
                    recommendation: r.recommendation,
                }));

            return {
                framework,
                organizationId,
                assessmentDate: new Date().toISOString(),
                overallScore,
                readinessLevel: this._getReadinessLevel(overallScore),
                controlCount: controls.length,
                passedControls: controlResults.filter(r => r.status === 'passed').length,
                partialControls: controlResults.filter(r => r.status === 'partial').length,
                gapControls: controlResults.filter(r => r.status === 'gap').length,
                controlResults,
                gaps,
                recommendations,
                evidenceCoverage: {
                    period: { start: startDate.toISOString(), end: endDate.toISOString() },
                    totalEvents: auditEvents.length,
                    eventTypes: [...new Set(auditEvents.map(e => e.eventType))].length,
                },
            };
        } catch (error) {
            console.error('[ERROR] ComplianceService.calculateAuditReadiness:', error.message);
            throw this._handleError(error, 'Failed to calculate audit readiness');
        }
    }

    /**
     * Evaluate a single control against audit evidence
     * @private
     */
    _evaluateControlReadiness(control, auditEvents) {
        const relevantEvents = auditEvents.filter(e =>
            control.auditActions.includes(e.eventType)
        );

        const eventCount = relevantEvents.length;
        let status = 'gap';
        let score = 0;

        // Scoring logic based on evidence presence
        if (eventCount >= 10) {
            status = 'passed';
            score = 100;
        } else if (eventCount >= 5) {
            status = 'partial';
            score = 70;
        } else if (eventCount >= 1) {
            status = 'partial';
            score = 40;
        } else {
            status = 'gap';
            score = 0;
        }

        return {
            controlId: control.id,
            category: control.category,
            title: control.title,
            description: control.description,
            requirements: control.requirements,
            status,
            score,
            evidenceCount: eventCount,
            lastEvidence: relevantEvents.length > 0
                ? relevantEvents[0].timestamp
                : null,
            recommendation: status === 'gap'
                ? `Implement controls to generate evidence for ${control.title}`
                : status === 'partial'
                    ? `Increase activity coverage for ${control.title}`
                    : null,
        };
    }

    /**
     * Get readiness level from score
     * @private
     */
    _getReadinessLevel(score) {
        if (score >= 90) return 'audit-ready';
        if (score >= 70) return 'nearly-ready';
        if (score >= 50) return 'in-progress';
        if (score >= 25) return 'early-stage';
        return 'not-started';
    }

    /**
     * Generate audit readiness recommendations
     * @private
     */
    _generateAuditRecommendations(controlResults) {
        const recommendations = [];

        const gaps = controlResults.filter(r => r.status === 'gap');
        const partial = controlResults.filter(r => r.status === 'partial');

        if (gaps.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Evidence Gaps',
                recommendation: `Address ${gaps.length} control gap(s) with no audit evidence`,
                affectedControls: gaps.map(g => g.controlId),
            });
        }

        if (partial.length > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'Evidence Coverage',
                recommendation: `Improve evidence coverage for ${partial.length} partially compliant control(s)`,
                affectedControls: partial.map(p => p.controlId),
            });
        }

        // Category-specific recommendations
        const categoryScores = {};
        for (const result of controlResults) {
            if (!categoryScores[result.category]) {
                categoryScores[result.category] = { total: 0, count: 0 };
            }
            categoryScores[result.category].total += result.score;
            categoryScores[result.category].count++;
        }

        for (const [category, data] of Object.entries(categoryScores)) {
            const avgScore = data.total / data.count;
            if (avgScore < 70) {
                recommendations.push({
                    priority: avgScore < 50 ? 'high' : 'medium',
                    category,
                    recommendation: `Focus on improving ${category} controls (current score: ${Math.round(avgScore)}%)`,
                });
            }
        }

        return recommendations.sort((a, b) =>
            a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0
        );
    }

    /**
     * Flatten data for CSV export
     * @private
     */
    _flattenForCsv(data) {
        if (Array.isArray(data)) {
            return data.map(item => this._flattenObject(item));
        }

        if (data.events && Array.isArray(data.events)) {
            return data.events.map(item => this._flattenObject(item));
        }

        return [this._flattenObject(data)];
    }

    /**
     * Flatten nested object
     * @private
     */
    _flattenObject(obj, prefix = '') {
        const result = {};

        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}_${key}` : key;

            if (value === null || value === undefined) {
                result[newKey] = '';
            } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                Object.assign(result, this._flattenObject(value, newKey));
            } else if (Array.isArray(value)) {
                result[newKey] = value.join('; ');
            } else if (value instanceof Date) {
                result[newKey] = value.toISOString();
            } else {
                result[newKey] = value;
            }
        }

        return result;
    }

    /**
     * Generate unique report ID
     * @private
     */
    _generateReportId() {
        return `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Count records in report data
     * @private
     */
    _countRecords(data) {
        if (Array.isArray(data)) {
            return data.length;
        }
        if (data.events) {
            return data.events.length;
        }
        return 1;
    }

    /**
     * Handle and transform errors
     * @private
     */
    _handleError(error, defaultMessage) {
        if (error.statusCode) {
            return error;
        }

        const newError = new Error(error.message || defaultMessage);
        newError.statusCode = 500;
        newError.originalError = error;
        return newError;
    }
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    ComplianceService,
    REPORT_TYPES,
    COMPLIANCE_FRAMEWORKS,
    EXPORT_FORMATS,
};
