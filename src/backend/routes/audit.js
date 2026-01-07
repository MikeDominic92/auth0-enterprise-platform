/**
 * Audit Log Routes
 * Enterprise B2B SaaS Authorization Platform
 *
 * Handles audit trail retrieval and compliance reporting
 */

const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permissions');
const pool = require('../db');

/**
 * GET /api/audit
 * List audit logs with filtering and pagination
 * Required permission: audit:read
 */
router.get('/', requirePermission('audit:read'), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      user_id,
      resource_type,
      resource_id,
      start_date,
      end_date,
      ip_address,
      risk_level
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const organizationId = req.user.org_id;

    let query = `
      SELECT
        al.id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.user_agent,
        al.risk_score,
        al.created_at,
        u.email as user_email,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = $1
    `;

    const params = [organizationId];
    let paramIndex = 2;

    // Apply filters
    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (resource_type) {
      query += ` AND al.resource_type = $${paramIndex}`;
      params.push(resource_type);
      paramIndex++;
    }

    if (resource_id) {
      query += ` AND al.resource_id = $${paramIndex}`;
      params.push(resource_id);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND al.created_at >= $${paramIndex}`;
      params.push(new Date(start_date));
      paramIndex++;
    }

    if (end_date) {
      query += ` AND al.created_at <= $${paramIndex}`;
      params.push(new Date(end_date));
      paramIndex++;
    }

    if (ip_address) {
      query += ` AND al.ip_address = $${paramIndex}`;
      params.push(ip_address);
      paramIndex++;
    }

    if (risk_level) {
      const riskThresholds = {
        low: [0, 30],
        medium: [31, 60],
        high: [61, 80],
        critical: [81, 100]
      };
      const threshold = riskThresholds[risk_level];
      if (threshold) {
        query += ` AND al.risk_score BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(threshold[0], threshold[1]);
        paramIndex += 2;
      }
    }

    // Get total count for pagination
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);

    // Add ordering and pagination
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Math.min(parseInt(limit), 100), offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/:id
 * Get single audit log entry with full details
 * Required permission: audit:read
 */
router.get('/:id', requirePermission('audit:read'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        al.*,
        u.email as user_email,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1 AND al.organization_id = $2
    `, [id, req.user.org_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AUDIT_LOG_NOT_FOUND',
          message: 'Audit log entry not found'
        }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/actions/list
 * Get list of all unique action types
 * Required permission: audit:read
 */
router.get('/actions/list', requirePermission('audit:read'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT action, COUNT(*) as count
      FROM audit_logs
      WHERE organization_id = $1
      GROUP BY action
      ORDER BY count DESC
    `, [req.user.org_id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/summary
 * Get audit log summary statistics
 * Required permission: audit:read
 */
router.get('/summary/stats', requirePermission('audit:read'), async (req, res, next) => {
  try {
    const { period = '7d' } = req.query;

    const periodMap = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days'
    };

    const interval = periodMap[period] || '7 days';

    // Get various statistics
    const [
      totalEvents,
      eventsByAction,
      eventsByRisk,
      uniqueUsers,
      hourlyDistribution
    ] = await Promise.all([
      // Total events
      pool.query(`
        SELECT COUNT(*) as total
        FROM audit_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - INTERVAL '${interval}'
      `, [req.user.org_id]),

      // Events by action category
      pool.query(`
        SELECT
          SPLIT_PART(action, '.', 1) as category,
          COUNT(*) as count
        FROM audit_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY SPLIT_PART(action, '.', 1)
        ORDER BY count DESC
        LIMIT 10
      `, [req.user.org_id]),

      // Events by risk level
      pool.query(`
        SELECT
          CASE
            WHEN risk_score <= 30 THEN 'low'
            WHEN risk_score <= 60 THEN 'medium'
            WHEN risk_score <= 80 THEN 'high'
            ELSE 'critical'
          END as risk_level,
          COUNT(*) as count
        FROM audit_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY risk_level
        ORDER BY
          CASE risk_level
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END
      `, [req.user.org_id]),

      // Unique active users
      pool.query(`
        SELECT COUNT(DISTINCT user_id) as unique_users
        FROM audit_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - INTERVAL '${interval}'
      `, [req.user.org_id]),

      // Hourly distribution
      pool.query(`
        SELECT
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM audit_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY hour
        ORDER BY hour
      `, [req.user.org_id])
    ]);

    res.json({
      success: true,
      data: {
        period,
        totalEvents: parseInt(totalEvents.rows[0].total),
        eventsByCategory: eventsByAction.rows,
        eventsByRisk: eventsByRisk.rows,
        uniqueActiveUsers: parseInt(uniqueUsers.rows[0].unique_users),
        hourlyDistribution: hourlyDistribution.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/user/:userId
 * Get audit trail for specific user
 * Required permission: audit:read
 */
router.get('/user/:userId', requirePermission('audit:read'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await pool.query(`
      SELECT
        al.*
      FROM audit_logs al
      WHERE al.organization_id = $1
        AND al.user_id = $2
      ORDER BY al.created_at DESC
      LIMIT $3 OFFSET $4
    `, [req.user.org_id, userId, parseInt(limit), offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*)
      FROM audit_logs
      WHERE organization_id = $1 AND user_id = $2
    `, [req.user.org_id, userId]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/resource/:type/:id
 * Get audit trail for specific resource
 * Required permission: audit:read
 */
router.get('/resource/:type/:id', requirePermission('audit:read'), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await pool.query(`
      SELECT
        al.*,
        u.email as user_email,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = $1
        AND al.resource_type = $2
        AND al.resource_id = $3
      ORDER BY al.created_at DESC
      LIMIT $4 OFFSET $5
    `, [req.user.org_id, type, id, parseInt(limit), offset]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/audit/export
 * Export audit logs to CSV/JSON
 * Required permission: audit:export
 */
router.post('/export', requirePermission('audit:export'), async (req, res, next) => {
  try {
    const {
      format = 'json',
      start_date,
      end_date,
      actions,
      include_details = true
    } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'start_date and end_date are required'
        }
      });
    }

    // Limit export to 90 days
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);

    if (daysDiff > 90) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DATE_RANGE_TOO_LARGE',
          message: 'Export date range cannot exceed 90 days'
        }
      });
    }

    let query = `
      SELECT
        al.id,
        al.action,
        al.resource_type,
        al.resource_id,
        ${include_details ? 'al.details,' : ''}
        al.ip_address,
        al.user_agent,
        al.risk_score,
        al.created_at,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = $1
        AND al.created_at >= $2
        AND al.created_at <= $3
    `;

    const params = [req.user.org_id, startDate, endDate];

    if (actions && Array.isArray(actions) && actions.length > 0) {
      query += ` AND al.action = ANY($4)`;
      params.push(actions);
    }

    query += ' ORDER BY al.created_at DESC';

    const result = await pool.query(query, params);

    // Log the export action
    await pool.query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, resource_type, details
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      req.user.org_id,
      req.user.sub,
      'audit.exported',
      'audit_log',
      {
        format,
        record_count: result.rows.length,
        date_range: { start: start_date, end: end_date }
      }
    ]);

    if (format === 'csv') {
      const headers = Object.keys(result.rows[0] || {});
      const csv = [
        headers.join(','),
        ...result.rows.map(row =>
          headers.map(h => {
            const val = row[h];
            if (val === null) return '';
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-export-${Date.now()}.csv`);
      return res.send(csv);
    }

    // Default to JSON
    res.json({
      success: true,
      data: {
        export_date: new Date().toISOString(),
        date_range: { start: start_date, end: end_date },
        record_count: result.rows.length,
        records: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/alerts
 * Get high-risk audit events that need attention
 * Required permission: audit:read
 */
router.get('/alerts/high-risk', requirePermission('audit:read'), async (req, res, next) => {
  try {
    const { acknowledged = 'false' } = req.query;

    const result = await pool.query(`
      SELECT
        al.*,
        u.email as user_email,
        u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = $1
        AND al.risk_score >= 70
        AND (al.details->>'acknowledged')::boolean IS NOT TRUE
      ORDER BY al.risk_score DESC, al.created_at DESC
      LIMIT 100
    `, [req.user.org_id]);

    res.json({
      success: true,
      data: result.rows,
      summary: {
        total_alerts: result.rows.length,
        critical: result.rows.filter(r => r.risk_score >= 81).length,
        high: result.rows.filter(r => r.risk_score >= 61 && r.risk_score < 81).length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/audit/:id/acknowledge
 * Acknowledge a high-risk audit event
 * Required permission: audit:update
 */
router.patch('/:id/acknowledge', requirePermission('audit:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await pool.query(`
      UPDATE audit_logs
      SET details = details || $3
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `, [
      id,
      req.user.org_id,
      JSON.stringify({
        acknowledged: true,
        acknowledged_by: req.user.sub,
        acknowledged_at: new Date().toISOString(),
        acknowledgement_notes: notes
      })
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AUDIT_LOG_NOT_FOUND',
          message: 'Audit log entry not found'
        }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
