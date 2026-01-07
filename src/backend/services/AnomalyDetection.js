/**
 * Anomaly Detection Service
 *
 * Implements risk scoring algorithms and anomaly detection for user behavior,
 * authentication patterns, and security events.
 *
 * @module backend/services/AnomalyDetection
 */

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Risk levels for scoring
 */
const RISK_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

/**
 * Risk score thresholds
 */
const RISK_THRESHOLDS = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90,
};

/**
 * Anomaly types
 */
const ANOMALY_TYPES = {
    // Authentication anomalies
    UNUSUAL_LOGIN_TIME: 'unusual_login_time',
    NEW_DEVICE: 'new_device',
    NEW_LOCATION: 'new_location',
    IMPOSSIBLE_TRAVEL: 'impossible_travel',
    FAILED_LOGIN_SPIKE: 'failed_login_spike',
    CREDENTIAL_STUFFING: 'credential_stuffing',

    // Behavior anomalies
    UNUSUAL_ACTIVITY_VOLUME: 'unusual_activity_volume',
    UNUSUAL_RESOURCE_ACCESS: 'unusual_resource_access',
    PRIVILEGE_ESCALATION: 'privilege_escalation',
    DATA_EXFILTRATION_PATTERN: 'data_exfiltration_pattern',

    // Account anomalies
    DORMANT_ACCOUNT_ACTIVITY: 'dormant_account_activity',
    RAPID_PERMISSION_CHANGES: 'rapid_permission_changes',
    BULK_USER_CREATION: 'bulk_user_creation',
};

/**
 * Default configuration for anomaly detection
 */
const DEFAULT_CONFIG = {
    // Login time analysis
    normalLoginHoursStart: 8,
    normalLoginHoursEnd: 20,
    unusualTimeWeight: 15,

    // Device/location analysis
    newDeviceWeight: 20,
    newLocationWeight: 25,
    impossibleTravelSpeedKmh: 1000, // Impossible if faster than this

    // Failed login thresholds
    failedLoginThreshold: 5,
    failedLoginTimeWindowMinutes: 15,
    failedLoginWeight: 30,

    // Activity volume
    activityVolumeStdDevMultiplier: 2,
    volumeAnomalyWeight: 20,

    // Dormant account threshold (days)
    dormantAccountDays: 90,
    dormantAccountWeight: 35,

    // Time windows
    analysisWindowHours: 24,
    historicalWindowDays: 30,
};

// -----------------------------------------------------------------------------
// Risk Score Calculator
// -----------------------------------------------------------------------------

/**
 * Calculate risk scores for various events and behaviors
 */
class RiskScoreCalculator {
    /**
     * Create calculator instance
     *
     * @param {Object} config - Configuration overrides
     */
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Calculate overall risk score for a user session/activity
     *
     * @param {Object} context - Activity context
     * @returns {Object} Risk assessment result
     */
    calculateSessionRisk(context) {
        const factors = [];
        let totalScore = 0;

        // Time-based risk
        const timeRisk = this._assessTimeRisk(context);
        if (timeRisk.score > 0) {
            factors.push(timeRisk);
            totalScore += timeRisk.score;
        }

        // Device risk
        const deviceRisk = this._assessDeviceRisk(context);
        if (deviceRisk.score > 0) {
            factors.push(deviceRisk);
            totalScore += deviceRisk.score;
        }

        // Location risk
        const locationRisk = this._assessLocationRisk(context);
        if (locationRisk.score > 0) {
            factors.push(locationRisk);
            totalScore += locationRisk.score;
        }

        // Failed login risk
        const failedLoginRisk = this._assessFailedLoginRisk(context);
        if (failedLoginRisk.score > 0) {
            factors.push(failedLoginRisk);
            totalScore += failedLoginRisk.score;
        }

        // Normalize score to 0-100
        const normalizedScore = Math.min(100, totalScore);

        return {
            score: normalizedScore,
            level: this._scoreToLevel(normalizedScore),
            factors,
            timestamp: new Date().toISOString(),
            recommendation: this._getRecommendation(normalizedScore, factors),
        };
    }

    /**
     * Assess time-based risk
     * @private
     */
    _assessTimeRisk(context) {
        const { timestamp, userTimezone } = context;
        const hour = timestamp ? new Date(timestamp).getHours() : new Date().getHours();

        const { normalLoginHoursStart, normalLoginHoursEnd, unusualTimeWeight } = this.config;

        const isUnusualTime = hour < normalLoginHoursStart || hour > normalLoginHoursEnd;

        return {
            type: ANOMALY_TYPES.UNUSUAL_LOGIN_TIME,
            score: isUnusualTime ? unusualTimeWeight : 0,
            details: {
                loginHour: hour,
                normalRange: `${normalLoginHoursStart}:00 - ${normalLoginHoursEnd}:00`,
                isUnusual: isUnusualTime,
                timezone: userTimezone || 'UTC',
            },
        };
    }

    /**
     * Assess device-based risk
     * @private
     */
    _assessDeviceRisk(context) {
        const { deviceId, knownDevices = [], userAgent } = context;

        const isNewDevice = deviceId && !knownDevices.includes(deviceId);

        return {
            type: ANOMALY_TYPES.NEW_DEVICE,
            score: isNewDevice ? this.config.newDeviceWeight : 0,
            details: {
                deviceId,
                userAgent,
                isNewDevice,
                knownDeviceCount: knownDevices.length,
            },
        };
    }

    /**
     * Assess location-based risk
     * @private
     */
    _assessLocationRisk(context) {
        const { location, previousLocation, timeSinceLastLogin } = context;

        let score = 0;
        const details = {
            currentLocation: location,
            previousLocation,
            isNewLocation: false,
            impossibleTravel: false,
        };

        if (!location) {
            return { type: ANOMALY_TYPES.NEW_LOCATION, score: 0, details };
        }

        // Check if new location
        if (previousLocation && location.country !== previousLocation.country) {
            details.isNewLocation = true;
            score += this.config.newLocationWeight;
        }

        // Check for impossible travel
        if (previousLocation && timeSinceLastLogin) {
            const distance = this._calculateDistance(
                previousLocation.latitude, previousLocation.longitude,
                location.latitude, location.longitude
            );
            const hours = timeSinceLastLogin / (1000 * 60 * 60);
            const speedKmh = distance / hours;

            if (speedKmh > this.config.impossibleTravelSpeedKmh) {
                details.impossibleTravel = true;
                details.calculatedSpeed = Math.round(speedKmh);
                details.distance = Math.round(distance);
                score += 40; // Impossible travel is high risk
            }
        }

        return {
            type: details.impossibleTravel ? ANOMALY_TYPES.IMPOSSIBLE_TRAVEL : ANOMALY_TYPES.NEW_LOCATION,
            score,
            details,
        };
    }

    /**
     * Assess failed login risk
     * @private
     */
    _assessFailedLoginRisk(context) {
        const { recentFailedLogins = 0, failedLoginWindow } = context;
        const { failedLoginThreshold, failedLoginWeight } = this.config;

        const isAboveThreshold = recentFailedLogins >= failedLoginThreshold;

        return {
            type: ANOMALY_TYPES.FAILED_LOGIN_SPIKE,
            score: isAboveThreshold ? failedLoginWeight : 0,
            details: {
                recentFailedLogins,
                threshold: failedLoginThreshold,
                windowMinutes: failedLoginWindow || this.config.failedLoginTimeWindowMinutes,
                isAboveThreshold,
            },
        };
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     * @private
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) {
            return 0;
        }

        const R = 6371; // Earth's radius in km
        const dLat = this._toRad(lat2 - lat1);
        const dLon = this._toRad(lon2 - lon1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Convert degrees to radians
     * @private
     */
    _toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert numeric score to risk level
     * @private
     */
    _scoreToLevel(score) {
        if (score >= RISK_THRESHOLDS.CRITICAL) return RISK_LEVELS.CRITICAL;
        if (score >= RISK_THRESHOLDS.HIGH) return RISK_LEVELS.HIGH;
        if (score >= RISK_THRESHOLDS.MEDIUM) return RISK_LEVELS.MEDIUM;
        return RISK_LEVELS.LOW;
    }

    /**
     * Get recommendation based on risk assessment
     * @private
     */
    _getRecommendation(score, factors) {
        if (score >= RISK_THRESHOLDS.CRITICAL) {
            return {
                action: 'block',
                message: 'Block access and require identity verification',
                requiresMfa: true,
                notifyAdmin: true,
            };
        }

        if (score >= RISK_THRESHOLDS.HIGH) {
            return {
                action: 'challenge',
                message: 'Require additional authentication factor',
                requiresMfa: true,
                notifyAdmin: true,
            };
        }

        if (score >= RISK_THRESHOLDS.MEDIUM) {
            return {
                action: 'monitor',
                message: 'Allow access but monitor activity closely',
                requiresMfa: false,
                notifyAdmin: false,
            };
        }

        return {
            action: 'allow',
            message: 'Normal risk level, allow access',
            requiresMfa: false,
            notifyAdmin: false,
        };
    }
}

// -----------------------------------------------------------------------------
// Anomaly Detection Service
// -----------------------------------------------------------------------------

/**
 * Service for detecting anomalies in user behavior and security events
 */
class AnomalyDetectionService {
    /**
     * Create service instance
     *
     * @param {Object} options - Service options
     * @param {Object} options.db - Database connection
     * @param {Object} options.auditLogRepository - Audit log repository
     * @param {Object} options.config - Configuration overrides
     */
    constructor(options = {}) {
        this.db = options.db;
        this.auditLogRepository = options.auditLogRepository;
        this.config = { ...DEFAULT_CONFIG, ...options.config };
        this.riskCalculator = new RiskScoreCalculator(this.config);

        // In-memory cache for user baselines (would use Redis in production)
        this.userBaselines = new Map();
    }

    // -------------------------------------------------------------------------
    // Real-time Analysis
    // -------------------------------------------------------------------------

    /**
     * Analyze a login event in real-time
     *
     * @param {Object} loginEvent - Login event data
     * @returns {Promise<Object>} Risk assessment
     */
    async analyzeLogin(loginEvent) {
        const { userId, ip, userAgent, timestamp, success } = loginEvent;

        // Get user's baseline and history
        const baseline = await this._getUserBaseline(userId);
        const recentActivity = await this._getRecentActivity(userId);

        // Build context for risk calculation
        const context = {
            userId,
            timestamp: timestamp || new Date(),
            deviceId: this._generateDeviceFingerprint(userAgent),
            userAgent,
            knownDevices: baseline.knownDevices || [],
            location: await this._getLocationFromIp(ip),
            previousLocation: baseline.lastLocation,
            timeSinceLastLogin: baseline.lastLogin
                ? Date.now() - new Date(baseline.lastLogin).getTime()
                : null,
            recentFailedLogins: recentActivity.failedLogins,
        };

        // Calculate risk score
        const riskAssessment = this.riskCalculator.calculateSessionRisk(context);

        // Update baseline with new data
        await this._updateUserBaseline(userId, {
            lastLogin: timestamp,
            lastLocation: context.location,
            lastDevice: context.deviceId,
            loginSuccess: success,
        });

        // Log anomalies if detected
        if (riskAssessment.level !== RISK_LEVELS.LOW) {
            await this._logAnomaly(userId, 'login', riskAssessment);
        }

        return riskAssessment;
    }

    /**
     * Analyze user activity patterns
     *
     * @param {string} userId - User ID
     * @param {string} activityType - Type of activity
     * @param {Object} activityData - Activity details
     * @returns {Promise<Object>} Anomaly assessment
     */
    async analyzeActivity(userId, activityType, activityData) {
        const baseline = await this._getUserBaseline(userId);
        const anomalies = [];

        // Check activity volume
        const volumeAnomaly = this._checkVolumeAnomaly(
            activityType,
            baseline.activityCounts?.[activityType] || 0,
            baseline.activityBaseline?.[activityType] || { mean: 0, stdDev: 10 }
        );

        if (volumeAnomaly) {
            anomalies.push(volumeAnomaly);
        }

        // Check for unusual resource access
        if (activityData.resourceId) {
            const resourceAnomaly = this._checkResourceAccessAnomaly(
                activityData.resourceId,
                baseline.accessedResources || []
            );

            if (resourceAnomaly) {
                anomalies.push(resourceAnomaly);
            }
        }

        // Check for privilege escalation patterns
        if (activityType === 'permission_change') {
            const privEscalation = this._checkPrivilegeEscalation(activityData);
            if (privEscalation) {
                anomalies.push(privEscalation);
            }
        }

        // Calculate overall risk
        const totalScore = anomalies.reduce((sum, a) => sum + a.score, 0);

        return {
            userId,
            activityType,
            timestamp: new Date().toISOString(),
            anomalies,
            riskScore: Math.min(100, totalScore),
            riskLevel: this.riskCalculator._scoreToLevel(totalScore),
        };
    }

    /**
     * Detect credential stuffing attacks
     *
     * @param {Array} loginEvents - Recent login events
     * @returns {Object} Detection result
     */
    detectCredentialStuffing(loginEvents) {
        // Group by IP
        const byIp = {};
        for (const event of loginEvents) {
            if (!byIp[event.ip]) {
                byIp[event.ip] = { success: 0, failure: 0, users: new Set() };
            }
            if (event.success) {
                byIp[event.ip].success++;
            } else {
                byIp[event.ip].failure++;
            }
            byIp[event.ip].users.add(event.userId || event.email);
        }

        // Detect suspicious patterns
        const suspiciousIps = [];
        for (const [ip, stats] of Object.entries(byIp)) {
            const userCount = stats.users.size;
            const failureRate = stats.failure / (stats.success + stats.failure);

            // Multiple users from same IP with high failure rate
            if (userCount > 5 && failureRate > 0.8) {
                suspiciousIps.push({
                    ip,
                    userCount,
                    failureRate: Math.round(failureRate * 100),
                    totalAttempts: stats.success + stats.failure,
                    confidence: 'high',
                });
            } else if (userCount > 3 && failureRate > 0.6) {
                suspiciousIps.push({
                    ip,
                    userCount,
                    failureRate: Math.round(failureRate * 100),
                    totalAttempts: stats.success + stats.failure,
                    confidence: 'medium',
                });
            }
        }

        return {
            detected: suspiciousIps.length > 0,
            type: ANOMALY_TYPES.CREDENTIAL_STUFFING,
            suspiciousIps,
            totalEventsAnalyzed: loginEvents.length,
            analysisTimestamp: new Date().toISOString(),
        };
    }

    /**
     * Detect data exfiltration patterns
     *
     * @param {string} userId - User ID
     * @param {Array} dataAccessEvents - Recent data access events
     * @returns {Object} Detection result
     */
    detectDataExfiltration(userId, dataAccessEvents) {
        const baseline = this.userBaselines.get(userId) || {};
        const normalVolume = baseline.dataAccessVolume || { mean: 10, stdDev: 5 };

        // Calculate current access volume
        const currentVolume = dataAccessEvents.length;
        const zScore = (currentVolume - normalVolume.mean) / normalVolume.stdDev;

        // Check for bulk downloads
        const bulkDownloads = dataAccessEvents.filter(e =>
            e.action === 'download' || e.action === 'export'
        ).length;

        // Check for access to sensitive data
        const sensitiveAccess = dataAccessEvents.filter(e =>
            e.sensitivity === 'high' || e.sensitivity === 'confidential'
        ).length;

        const isAnomaly = zScore > 3 || bulkDownloads > 10 || sensitiveAccess > 5;

        return {
            detected: isAnomaly,
            type: ANOMALY_TYPES.DATA_EXFILTRATION_PATTERN,
            userId,
            metrics: {
                currentVolume,
                normalMean: normalVolume.mean,
                zScore: Math.round(zScore * 100) / 100,
                bulkDownloads,
                sensitiveAccessCount: sensitiveAccess,
            },
            riskScore: isAnomaly ? Math.min(100, Math.abs(zScore) * 20 + bulkDownloads * 5) : 0,
            timestamp: new Date().toISOString(),
        };
    }

    // -------------------------------------------------------------------------
    // Batch Analysis
    // -------------------------------------------------------------------------

    /**
     * Analyze all users for dormant account activity
     *
     * @returns {Promise<Array>} Dormant accounts with recent activity
     */
    async detectDormantAccountActivity() {
        const results = [];

        // This would query all users and their recent activity
        // Simplified implementation for demonstration
        for (const [userId, baseline] of this.userBaselines) {
            const daysSinceLastLogin = baseline.lastLogin
                ? (Date.now() - new Date(baseline.lastLogin).getTime()) / (1000 * 60 * 60 * 24)
                : Infinity;

            const wasDormant = daysSinceLastLogin > this.config.dormantAccountDays;

            if (wasDormant && baseline.recentActivity) {
                results.push({
                    userId,
                    type: ANOMALY_TYPES.DORMANT_ACCOUNT_ACTIVITY,
                    daysSinceLastLogin: Math.round(daysSinceLastLogin),
                    dormantThreshold: this.config.dormantAccountDays,
                    riskScore: this.config.dormantAccountWeight,
                });
            }
        }

        return results;
    }

    /**
     * Detect bulk user creation (potential account stuffing)
     *
     * @param {Array} userCreationEvents - Recent user creation events
     * @param {number} timeWindowMinutes - Time window to analyze
     * @returns {Object} Detection result
     */
    detectBulkUserCreation(userCreationEvents, timeWindowMinutes = 60) {
        // Group by creator/source
        const byCreator = {};
        const windowStart = Date.now() - timeWindowMinutes * 60 * 1000;

        const recentEvents = userCreationEvents.filter(e =>
            new Date(e.timestamp).getTime() > windowStart
        );

        for (const event of recentEvents) {
            const creator = event.createdBy || 'system';
            if (!byCreator[creator]) {
                byCreator[creator] = [];
            }
            byCreator[creator].push(event);
        }

        // Check for suspicious bulk creation
        const suspicious = [];
        for (const [creator, events] of Object.entries(byCreator)) {
            if (events.length > 10) {
                suspicious.push({
                    creator,
                    count: events.length,
                    timeWindowMinutes,
                    firstCreation: events[0].timestamp,
                    lastCreation: events[events.length - 1].timestamp,
                });
            }
        }

        return {
            detected: suspicious.length > 0,
            type: ANOMALY_TYPES.BULK_USER_CREATION,
            suspicious,
            totalCreationsInWindow: recentEvents.length,
            analysisTimestamp: new Date().toISOString(),
        };
    }

    // -------------------------------------------------------------------------
    // Baseline Management
    // -------------------------------------------------------------------------

    /**
     * Get or create user baseline
     * @private
     */
    async _getUserBaseline(userId) {
        if (this.userBaselines.has(userId)) {
            return this.userBaselines.get(userId);
        }

        // In production, this would query the database
        const baseline = {
            userId,
            lastLogin: null,
            lastLocation: null,
            knownDevices: [],
            activityBaseline: {},
            activityCounts: {},
            accessedResources: [],
            dataAccessVolume: { mean: 10, stdDev: 5 },
        };

        this.userBaselines.set(userId, baseline);
        return baseline;
    }

    /**
     * Update user baseline with new data
     * @private
     */
    async _updateUserBaseline(userId, updates) {
        const baseline = await this._getUserBaseline(userId);

        // Update basic fields
        if (updates.lastLogin) baseline.lastLogin = updates.lastLogin;
        if (updates.lastLocation) baseline.lastLocation = updates.lastLocation;

        // Add device to known devices
        if (updates.lastDevice && !baseline.knownDevices.includes(updates.lastDevice)) {
            baseline.knownDevices.push(updates.lastDevice);
            // Keep only last 10 devices
            if (baseline.knownDevices.length > 10) {
                baseline.knownDevices.shift();
            }
        }

        // Mark recent activity
        baseline.recentActivity = true;

        this.userBaselines.set(userId, baseline);

        // In production, persist to database
        return baseline;
    }

    /**
     * Build activity baseline from historical data
     *
     * @param {string} userId - User ID
     * @param {Array} historicalEvents - Historical activity events
     * @returns {Object} Computed baseline
     */
    buildActivityBaseline(userId, historicalEvents) {
        const activityCounts = {};
        const dailyCounts = {};

        // Group events by type and day
        for (const event of historicalEvents) {
            const type = event.type || event.eventType;
            const day = new Date(event.timestamp).toISOString().split('T')[0];

            if (!activityCounts[type]) {
                activityCounts[type] = [];
            }
            if (!dailyCounts[day]) {
                dailyCounts[day] = {};
            }
            if (!dailyCounts[day][type]) {
                dailyCounts[day][type] = 0;
            }

            dailyCounts[day][type]++;
        }

        // Calculate mean and stdDev for each activity type
        const activityBaseline = {};
        for (const [day, types] of Object.entries(dailyCounts)) {
            for (const [type, count] of Object.entries(types)) {
                if (!activityBaseline[type]) {
                    activityBaseline[type] = { values: [] };
                }
                activityBaseline[type].values.push(count);
            }
        }

        // Compute statistics
        for (const type of Object.keys(activityBaseline)) {
            const values = activityBaseline[type].values;
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            activityBaseline[type] = { mean, stdDev: stdDev || 1 };
        }

        return {
            userId,
            computedAt: new Date().toISOString(),
            daysAnalyzed: Object.keys(dailyCounts).length,
            activityBaseline,
        };
    }

    // -------------------------------------------------------------------------
    // Helper Methods
    // -------------------------------------------------------------------------

    /**
     * Get recent activity for a user
     * @private
     */
    async _getRecentActivity(userId) {
        // In production, query audit logs
        return {
            failedLogins: 0,
            totalLogins: 0,
            lastActivity: null,
        };
    }

    /**
     * Generate device fingerprint from user agent
     * @private
     */
    _generateDeviceFingerprint(userAgent) {
        if (!userAgent) return null;

        // Simple hash of user agent (in production, use more sophisticated fingerprinting)
        let hash = 0;
        for (let i = 0; i < userAgent.length; i++) {
            const char = userAgent.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `DEV-${Math.abs(hash).toString(16)}`;
    }

    /**
     * Get location from IP address
     * @private
     */
    async _getLocationFromIp(ip) {
        // In production, use a geolocation service
        return {
            ip,
            country: 'Unknown',
            city: 'Unknown',
            latitude: null,
            longitude: null,
        };
    }

    /**
     * Check for volume anomaly
     * @private
     */
    _checkVolumeAnomaly(activityType, currentCount, baseline) {
        const zScore = (currentCount - baseline.mean) / baseline.stdDev;

        if (Math.abs(zScore) > this.config.activityVolumeStdDevMultiplier) {
            return {
                type: ANOMALY_TYPES.UNUSUAL_ACTIVITY_VOLUME,
                score: this.config.volumeAnomalyWeight,
                details: {
                    activityType,
                    currentCount,
                    expectedMean: baseline.mean,
                    zScore: Math.round(zScore * 100) / 100,
                },
            };
        }

        return null;
    }

    /**
     * Check for unusual resource access
     * @private
     */
    _checkResourceAccessAnomaly(resourceId, accessedResources) {
        const isNew = !accessedResources.includes(resourceId);

        if (isNew) {
            return {
                type: ANOMALY_TYPES.UNUSUAL_RESOURCE_ACCESS,
                score: 10,
                details: {
                    resourceId,
                    isFirstAccess: true,
                },
            };
        }

        return null;
    }

    /**
     * Check for privilege escalation
     * @private
     */
    _checkPrivilegeEscalation(activityData) {
        const highPrivilegeRoles = ['admin', 'super_admin', 'root'];
        const newRoles = activityData.newRoles || [];

        const escalated = newRoles.some(role =>
            highPrivilegeRoles.includes(role.toLowerCase())
        );

        if (escalated) {
            return {
                type: ANOMALY_TYPES.PRIVILEGE_ESCALATION,
                score: 40,
                details: {
                    newRoles,
                    isHighPrivilege: true,
                },
            };
        }

        return null;
    }

    /**
     * Log detected anomaly
     * @private
     */
    async _logAnomaly(userId, context, assessment) {
        console.log('[ANOMALY]', {
            userId,
            context,
            riskLevel: assessment.level,
            riskScore: assessment.score,
            factors: assessment.factors.map(f => f.type),
            timestamp: new Date().toISOString(),
        });

        // In production, would persist to database and potentially trigger alerts
    }
}

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    AnomalyDetectionService,
    RiskScoreCalculator,
    RISK_LEVELS,
    RISK_THRESHOLDS,
    ANOMALY_TYPES,
    DEFAULT_CONFIG,
};
