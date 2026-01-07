/**
 * Compliance Report Routes
 * Enterprise B2B SaaS Authorization Platform
 *
 * Handles compliance report generation for SOC2, HIPAA, GDPR
 */

const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permissions');
const ComplianceService = require('../services/ComplianceService');
const pool = require('../db');

/**
 * GET /api/compliance/reports
 * List all compliance reports
 * Required permission: compliance:read
 */
router.get('/reports', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      framework,
      status
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT *
      FROM compliance_reports
      WHERE organization_id = $1
    `;
    const params = [req.user.org_id];
    let paramIndex = 2;

    if (framework) {
      query += ` AND framework = $${paramIndex}`;
      params.push(framework);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM compliance_reports WHERE organization_id = $1',
      [req.user.org_id]
    );

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
 * GET /api/compliance/reports/:id
 * Get single compliance report with full details
 * Required permission: compliance:read
 */
router.get('/reports/:id', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT *
      FROM compliance_reports
      WHERE id = $1 AND organization_id = $2
    `, [id, req.user.org_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Compliance report not found'
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
 * POST /api/compliance/reports/generate
 * Generate a new compliance report
 * Required permission: compliance:generate
 */
router.post('/reports/generate', requirePermission('compliance:generate'), async (req, res, next) => {
  try {
    const {
      framework,
      period_start,
      period_end,
      include_evidence = true
    } = req.body;

    const validFrameworks = ['soc2', 'hipaa', 'gdpr', 'iso27001'];
    if (!validFrameworks.includes(framework)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FRAMEWORK',
          message: `Framework must be one of: ${validFrameworks.join(', ')}`
        }
      });
    }

    if (!period_start || !period_end) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERIOD',
          message: 'period_start and period_end are required'
        }
      });
    }

    // Create report record with pending status
    const reportResult = await pool.query(`
      INSERT INTO compliance_reports (
        organization_id,
        framework,
        period_start,
        period_end,
        status,
        generated_by
      ) VALUES ($1, $2, $3, $4, 'generating', $5)
      RETURNING *
    `, [req.user.org_id, framework, period_start, period_end, req.user.sub]);

    const report = reportResult.rows[0];

    // Generate report asynchronously
    ComplianceService.generateReport({
      reportId: report.id,
      organizationId: req.user.org_id,
      framework,
      periodStart: new Date(period_start),
      periodEnd: new Date(period_end),
      includeEvidence: include_evidence
    }).catch(error => {
      console.error('Report generation failed:', error);
      pool.query(
        'UPDATE compliance_reports SET status = $1, findings = $2 WHERE id = $3',
        ['failed', { error: error.message }, report.id]
      );
    });

    res.status(202).json({
      success: true,
      data: report,
      message: 'Report generation started. Check status for completion.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/dashboard
 * Get compliance dashboard overview
 * Required permission: compliance:read
 */
router.get('/dashboard', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const organizationId = req.user.org_id;

    // Get latest reports per framework
    const latestReports = await pool.query(`
      SELECT DISTINCT ON (framework) *
      FROM compliance_reports
      WHERE organization_id = $1 AND status = 'completed'
      ORDER BY framework, created_at DESC
    `, [organizationId]);

    // Calculate compliance scores
    const scores = {};
    for (const report of latestReports.rows) {
      const findings = report.findings || {};
      const controlResults = findings.control_results || [];
      const passed = controlResults.filter(c => c.status === 'passed').length;
      const total = controlResults.length;
      scores[report.framework] = total > 0 ? Math.round((passed / total) * 100) : null;
    }

    // Get pending issues count
    const pendingIssues = await pool.query(`
      SELECT COUNT(*) as count
      FROM compliance_reports cr,
           jsonb_array_elements(cr.findings->'control_results') as control
      WHERE cr.organization_id = $1
        AND control->>'status' = 'failed'
        AND (control->>'remediated')::boolean IS NOT TRUE
    `, [organizationId]);

    // Get upcoming deadlines (from findings)
    const upcomingDeadlines = await pool.query(`
      SELECT
        framework,
        control->>'control_id' as control_id,
        control->>'title' as title,
        control->>'deadline' as deadline
      FROM compliance_reports cr,
           jsonb_array_elements(cr.findings->'control_results') as control
      WHERE cr.organization_id = $1
        AND control->>'deadline' IS NOT NULL
        AND (control->>'deadline')::date >= CURRENT_DATE
        AND (control->>'deadline')::date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY (control->>'deadline')::date ASC
      LIMIT 10
    `, [organizationId]);

    res.json({
      success: true,
      data: {
        scores,
        latestReports: latestReports.rows.map(r => ({
          id: r.id,
          framework: r.framework,
          period_start: r.period_start,
          period_end: r.period_end,
          created_at: r.created_at
        })),
        pendingIssues: parseInt(pendingIssues.rows[0].count),
        upcomingDeadlines: upcomingDeadlines.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/controls/:framework
 * Get control requirements for a framework
 * Required permission: compliance:read
 */
router.get('/controls/:framework', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const { framework } = req.params;

    const controls = ComplianceService.getFrameworkControls(framework);

    if (!controls) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FRAMEWORK_NOT_FOUND',
          message: 'Compliance framework not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        framework,
        controls
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/evidence
 * List compliance evidence items
 * Required permission: compliance:read
 */
router.get('/evidence', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const { control_id, framework } = req.query;

    // Evidence is derived from audit logs
    let query = `
      SELECT
        al.id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.created_at,
        al.details,
        u.email as actor_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = $1
    `;
    const params = [req.user.org_id];
    let paramIndex = 2;

    // Map control IDs to relevant actions
    if (control_id) {
      const controlActionMap = ComplianceService.getControlActionMapping(control_id);
      if (controlActionMap && controlActionMap.actions) {
        query += ` AND al.action = ANY($${paramIndex})`;
        params.push(controlActionMap.actions);
        paramIndex++;
      }
    }

    query += ' ORDER BY al.created_at DESC LIMIT 100';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/compliance/issues/:id/remediate
 * Mark a compliance issue as remediated
 * Required permission: compliance:update
 */
router.post('/issues/:id/remediate', requirePermission('compliance:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, evidence_url } = req.body;

    // This would update the specific finding in the report
    // For demo, we'll update the report's findings JSONB
    const result = await pool.query(`
      UPDATE compliance_reports
      SET findings = jsonb_set(
        findings,
        '{remediation_log}',
        COALESCE(findings->'remediation_log', '[]'::jsonb) || $3::jsonb
      ),
      updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `, [
      id,
      req.user.org_id,
      JSON.stringify({
        issue_id: id,
        remediated_by: req.user.sub,
        remediated_at: new Date().toISOString(),
        notes,
        evidence_url
      })
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Compliance report not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Issue marked as remediated'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/audit-readiness
 * Get audit readiness score and recommendations
 * Required permission: compliance:read
 */
router.get('/audit-readiness', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const { framework = 'soc2' } = req.query;

    const readiness = await ComplianceService.calculateAuditReadiness(
      req.user.org_id,
      framework
    );

    res.json({
      success: true,
      data: readiness
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/reports/:id/download
 * Download compliance report as PDF
 * Required permission: compliance:export
 */
router.get('/reports/:id/download', requirePermission('compliance:export'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const result = await pool.query(`
      SELECT *
      FROM compliance_reports
      WHERE id = $1 AND organization_id = $2
    `, [id, req.user.org_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REPORT_NOT_FOUND',
          message: 'Compliance report not found'
        }
      });
    }

    const report = result.rows[0];

    // Log the download
    await pool.query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, resource_type, resource_id, details
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      req.user.org_id,
      req.user.sub,
      'compliance.report_downloaded',
      'compliance_report',
      id,
      { format, framework: report.framework }
    ]);

    if (format === 'pdf') {
      // In production, generate actual PDF
      return res.status(501).json({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'PDF generation not implemented in demo'
        }
      });
    }

    // Return JSON report
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=compliance-report-${report.framework}-${id}.json`);
    res.json({
      report_id: report.id,
      framework: report.framework,
      organization_id: report.organization_id,
      period: {
        start: report.period_start,
        end: report.period_end
      },
      generated_at: report.created_at,
      status: report.status,
      findings: report.findings
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/compliance/frameworks
 * Get list of supported compliance frameworks
 * Required permission: compliance:read
 */
router.get('/frameworks', requirePermission('compliance:read'), async (req, res, next) => {
  try {
    const frameworks = [
      {
        id: 'soc2',
        name: 'SOC 2 Type II',
        description: 'Service Organization Control 2 - Trust Service Criteria',
        categories: ['Security', 'Availability', 'Processing Integrity', 'Confidentiality', 'Privacy']
      },
      {
        id: 'hipaa',
        name: 'HIPAA',
        description: 'Health Insurance Portability and Accountability Act',
        categories: ['Administrative Safeguards', 'Physical Safeguards', 'Technical Safeguards']
      },
      {
        id: 'gdpr',
        name: 'GDPR',
        description: 'General Data Protection Regulation',
        categories: ['Lawfulness', 'Purpose Limitation', 'Data Minimization', 'Accuracy', 'Storage Limitation', 'Security', 'Accountability']
      },
      {
        id: 'iso27001',
        name: 'ISO 27001',
        description: 'Information Security Management System',
        categories: ['Information Security Policies', 'Asset Management', 'Access Control', 'Cryptography', 'Operations Security']
      }
    ];

    res.json({
      success: true,
      data: frameworks
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
