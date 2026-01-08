/**
 * Database Connection Pool
 *
 * PostgreSQL connection pool using node-postgres (pg).
 * Provides centralized database access for the application.
 *
 * @module backend/db
 */

const { Pool } = require('pg');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Database connection configuration from environment variables
 */
const config = {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    database: process.env.DATABASE_NAME || 'auth0_enterprise',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,

    // Connection pool settings
    min: parseInt(process.env.DATABASE_POOL_MIN, 10) || 2,
    max: parseInt(process.env.DATABASE_POOL_MAX, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT, 10) || 5000,

    // SSL configuration for production
    ssl: process.env.DATABASE_SSL_ENABLED === 'true'
        ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
};

// Use DATABASE_URL if provided (takes precedence)
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: config.ssl,
        min: config.min,
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
    }
    : config;

// -----------------------------------------------------------------------------
// Pool Instance
// -----------------------------------------------------------------------------

const pool = new Pool(poolConfig);

// -----------------------------------------------------------------------------
// Event Handlers
// -----------------------------------------------------------------------------

/**
 * Handle pool errors
 */
pool.on('error', (err, client) => {
    console.error('[ERROR] Unexpected database pool error:', err.message);
});

/**
 * Handle new client connections
 */
pool.on('connect', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('[INFO] New database client connected');
    }
});

/**
 * Handle client removal from pool
 */
pool.on('remove', (client) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('[INFO] Database client removed from pool');
    }
});

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------

/**
 * Test database connection
 *
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time');
        client.release();
        console.log('[INFO] Database connection verified:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('[ERROR] Database connection failed:', error.message);
        return false;
    }
}

/**
 * Get pool statistics
 *
 * @returns {Object} Pool statistics
 */
function getPoolStats() {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
}

// -----------------------------------------------------------------------------
// Graceful Shutdown
// -----------------------------------------------------------------------------

/**
 * Close all pool connections
 *
 * @returns {Promise<void>}
 */
async function closePool() {
    console.log('[INFO] Closing database pool...');
    await pool.end();
    console.log('[INFO] Database pool closed');
}

// Handle process termination
process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});

// -----------------------------------------------------------------------------
// Module Exports
// -----------------------------------------------------------------------------

module.exports = pool;
module.exports.testConnection = testConnection;
module.exports.getPoolStats = getPoolStats;
module.exports.closePool = closePool;
