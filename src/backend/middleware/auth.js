/**
 * Authentication Middleware
 *
 * JWT validation and authentication middleware using express-oauth2-jwt-bearer.
 * Provides token validation, user extraction, and error handling.
 *
 * @module backend/middleware/auth
 */

const { auth, requiredScopes, claimCheck } = require('express-oauth2-jwt-bearer');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'https://api.example.com';
const AUTH0_ISSUER = process.env.AUTH0_ISSUER || `https://${process.env.AUTH0_DOMAIN}/`;

// -----------------------------------------------------------------------------
// JWT Validation Middleware
// -----------------------------------------------------------------------------

/**
 * Main JWT validation middleware
 * Validates the access token in the Authorization header
 */
const checkJwt = auth({
    audience: AUTH0_AUDIENCE,
    issuerBaseURL: AUTH0_ISSUER,
    tokenSigningAlg: 'RS256',
});

/**
 * Optional authentication middleware
 * Attempts to validate JWT but allows request to continue if no token present
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without authentication
        req.auth = null;
        return next();
    }

    // Token provided, validate it
    try {
        await new Promise((resolve, reject) => {
            checkJwt(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        next();
    } catch (error) {
        // Invalid token - treat as unauthenticated
        req.auth = null;
        next();
    }
};

// -----------------------------------------------------------------------------
// Scope Validation Middleware
// -----------------------------------------------------------------------------

/**
 * Create middleware to require specific scopes
 *
 * @param {...string} scopes - Required scopes
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/admin', checkJwt, requireScopes('admin:read'), handler);
 */
const requireScopes = (...scopes) => {
    return requiredScopes(scopes.join(' '));
};

/**
 * Create middleware to require any of the specified scopes
 *
 * @param {...string} scopes - Any of these scopes is acceptable
 * @returns {Function} Express middleware
 */
const requireAnyScope = (...scopes) => {
    return (req, res, next) => {
        const tokenScopes = req.auth?.payload?.scope?.split(' ') || [];
        const hasScope = scopes.some(scope => tokenScopes.includes(scope));

        if (!hasScope) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Requires one of the following scopes: ${scopes.join(', ')}`,
                requiredScopes: scopes,
            });
        }

        next();
    };
};

// -----------------------------------------------------------------------------
// Claim Validation Middleware
// -----------------------------------------------------------------------------

/**
 * Validate custom claims in the JWT
 *
 * @param {string} claim - Claim name to check
 * @param {*} expectedValue - Expected value or validation function
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/org/:orgId', checkJwt, validateClaim('org_id', req => req.params.orgId), handler);
 */
const validateClaim = (claim, expectedValue) => {
    return claimCheck((payload) => {
        const claimValue = payload[claim];

        if (typeof expectedValue === 'function') {
            return expectedValue(claimValue);
        }

        return claimValue === expectedValue;
    });
};

/**
 * Validate user has required organization membership
 *
 * @param {string} [orgIdParam='orgId'] - Request parameter containing org ID
 * @returns {Function} Express middleware
 */
const requireOrgMembership = (orgIdParam = 'orgId') => {
    return (req, res, next) => {
        const requestedOrgId = req.params[orgIdParam];
        const userOrgId = req.auth?.payload?.org_id;

        if (!userOrgId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'No organization context in token',
            });
        }

        if (requestedOrgId && userOrgId !== requestedOrgId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Not authorized for this organization',
            });
        }

        next();
    };
};

// -----------------------------------------------------------------------------
// User Extraction Middleware
// -----------------------------------------------------------------------------

/**
 * Extract and attach user information from JWT to request
 * Must be used after checkJwt middleware
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const extractUser = (req, res, next) => {
    if (!req.auth?.payload) {
        return next();
    }

    const payload = req.auth.payload;

    // Extract standard user information
    req.user = {
        id: payload.sub,
        email: payload.email || payload[`${AUTH0_AUDIENCE}/email`],
        name: payload.name || payload[`${AUTH0_AUDIENCE}/name`],
        picture: payload.picture,
        roles: payload[`${AUTH0_AUDIENCE}/roles`] || [],
        permissions: payload.permissions || [],
        orgId: payload.org_id,
        metadata: payload[`${AUTH0_AUDIENCE}/metadata`] || {},
    };

    next();
};

// -----------------------------------------------------------------------------
// Error Handlers
// -----------------------------------------------------------------------------

/**
 * Authentication error handler
 * Transforms auth errors into consistent API responses
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authErrorHandler = (err, req, res, next) => {
    // Check if this is an auth error
    if (err.status === 401 || err.code === 'invalid_token') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
            code: err.code || 'invalid_token',
        });
    }

    if (err.status === 403 || err.code === 'insufficient_scope') {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions',
            code: err.code || 'insufficient_scope',
        });
    }

    // Pass to next error handler
    next(err);
};

/**
 * Global error handler for API
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    console.error('[ERROR]', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });

    // Default error response
    const statusCode = err.statusCode || err.status || 500;
    const response = {
        error: err.name || 'Error',
        message: statusCode === 500
            ? 'Internal server error'
            : err.message,
    };

    // Include additional details in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.details = err.details;
    }

    res.status(statusCode).json(response);
};

/**
 * Not found handler for undefined routes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        path: req.path,
    });
};

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = {
    // Core authentication
    checkJwt,
    optionalAuth,

    // Scope validation
    requireScopes,
    requireAnyScope,

    // Claim validation
    validateClaim,
    requireOrgMembership,

    // User extraction
    extractUser,

    // Error handlers
    authErrorHandler,
    errorHandler,
    notFoundHandler,
};
