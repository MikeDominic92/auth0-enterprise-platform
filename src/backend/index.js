/**
 * Express Server Entry Point
 *
 * Main application server with middleware configuration, route mounting,
 * error handling, and graceful shutdown support.
 *
 * @module backend/index
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Route imports
const usersRouter = require('./routes/users');
const teamsRouter = require('./routes/teams');
const auditRouter = require('./routes/audit');
const complianceRouter = require('./routes/compliance');

// Middleware imports
const { errorHandler, notFoundHandler } = require('./middleware/auth');

// Configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express application
const app = express();

// -----------------------------------------------------------------------------
// Security Middleware
// -----------------------------------------------------------------------------

// Helmet sets various HTTP headers for security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',')
        : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // Limit each IP
    message: {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: 15 * 60, // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// -----------------------------------------------------------------------------
// Request Processing Middleware
// -----------------------------------------------------------------------------

// Parse JSON request bodies
app.use(express.json({
    limit: '10mb',
    strict: true,
}));

// Parse URL-encoded request bodies
app.use(express.urlencoded({
    extended: true,
    limit: '10mb',
}));

// Compress responses
app.use(compression({
    level: 6,
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
}));

// -----------------------------------------------------------------------------
// Logging Middleware
// -----------------------------------------------------------------------------

// Request logging format based on environment
const logFormat = NODE_ENV === 'production'
    ? 'combined'
    : 'dev';

app.use(morgan(logFormat, {
    skip: (req, res) => {
        // Skip health check logging in production
        if (NODE_ENV === 'production' && req.url === '/health') {
            return true;
        }
        return false;
    },
}));

// -----------------------------------------------------------------------------
// Health Check Endpoints
// -----------------------------------------------------------------------------

// Basic health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Detailed health check for monitoring systems
app.get('/health/detailed', async (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        checks: {
            server: 'ok',
            // Add additional health checks here (database, cache, etc.)
        },
    };

    res.status(200).json(healthStatus);
});

// -----------------------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------------------

// Mount route handlers
app.use('/api/users', usersRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/compliance', complianceRouter);

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Auth0 Enterprise Platform API',
        version: '1.0.0',
        documentation: '/api/docs',
        endpoints: {
            users: '/api/users',
            teams: '/api/teams',
            audit: '/api/audit',
            compliance: '/api/compliance',
        },
    });
});

// -----------------------------------------------------------------------------
// Error Handling
// -----------------------------------------------------------------------------

// Handle 404 - Not Found
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// -----------------------------------------------------------------------------
// Server Initialization
// -----------------------------------------------------------------------------

let server;

/**
 * Start the Express server
 * @returns {Promise<http.Server>} The HTTP server instance
 */
async function startServer() {
    return new Promise((resolve, reject) => {
        server = app.listen(PORT, () => {
            console.log(`[INFO] Server started successfully`);
            console.log(`[INFO] Environment: ${NODE_ENV}`);
            console.log(`[INFO] Port: ${PORT}`);
            console.log(`[INFO] Health check: http://localhost:${PORT}/health`);
            resolve(server);
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`[ERROR] Port ${PORT} is already in use`);
            } else {
                console.error(`[ERROR] Server error: ${error.message}`);
            }
            reject(error);
        });
    });
}

/**
 * Gracefully shutdown the server
 * @returns {Promise<void>}
 */
async function shutdown() {
    console.log('\n[INFO] Shutdown signal received');

    if (server) {
        return new Promise((resolve) => {
            server.close(() => {
                console.log('[INFO] Server closed gracefully');
                resolve();
            });

            // Force close after timeout
            setTimeout(() => {
                console.log('[WARN] Forcing server shutdown');
                resolve();
            }, 10000);
        });
    }
}

// Handle process termination signals
process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[ERROR] Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server if this is the main module
if (require.main === module) {
    startServer().catch((error) => {
        console.error('[ERROR] Failed to start server:', error);
        process.exit(1);
    });
}

// Export for testing
module.exports = { app, startServer, shutdown };
