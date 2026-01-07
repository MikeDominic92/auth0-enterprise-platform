/**
 * Team Management Routes
 * Enterprise B2B SaaS Authorization Platform
 *
 * Handles team CRUD and membership operations
 */

const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permissions');
const pool = require('../db');

/**
 * GET /api/teams
 * List all teams for the organization
 * Required permission: teams:read
 */
router.get('/', requirePermission('teams:read'), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      include_members = false
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const organizationId = req.user.org_id;

    let query = `
      SELECT
        t.id,
        t.name,
        t.description,
        t.settings,
        t.created_at,
        t.updated_at,
        COUNT(tm.user_id) as member_count
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE t.organization_id = $1
    `;

    const params = [organizationId];
    let paramIndex = 2;

    if (search) {
      query += ` AND (t.name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY t.id ORDER BY t.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM teams WHERE organization_id = $1',
      [organizationId]
    );

    // Optionally include members
    let teams = result.rows;
    if (include_members === 'true') {
      const teamIds = teams.map(t => t.id);
      if (teamIds.length > 0) {
        const membersResult = await pool.query(`
          SELECT
            tm.team_id,
            tm.user_id,
            tm.role as team_role,
            u.email,
            u.name
          FROM team_members tm
          JOIN users u ON tm.user_id = u.id
          WHERE tm.team_id = ANY($1)
        `, [teamIds]);

        const membersByTeam = membersResult.rows.reduce((acc, member) => {
          if (!acc[member.team_id]) acc[member.team_id] = [];
          acc[member.team_id].push(member);
          return acc;
        }, {});

        teams = teams.map(team => ({
          ...team,
          members: membersByTeam[team.id] || []
        }));
      }
    }

    res.json({
      success: true,
      data: teams,
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
 * GET /api/teams/:id
 * Get single team with members
 * Required permission: teams:read
 */
router.get('/:id', requirePermission('teams:read'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const teamResult = await pool.query(`
      SELECT
        t.*,
        o.name as organization_name
      FROM teams t
      JOIN organizations o ON t.organization_id = o.id
      WHERE t.id = $1 AND t.organization_id = $2
    `, [id, req.user.org_id]);

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found'
        }
      });
    }

    const membersResult = await pool.query(`
      SELECT
        tm.user_id,
        tm.role as team_role,
        tm.joined_at,
        u.email,
        u.name,
        u.status
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1
      ORDER BY tm.role DESC, u.name ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...teamResult.rows[0],
        members: membersResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams
 * Create new team
 * Required permission: teams:create
 */
router.post('/', requirePermission('teams:create'), async (req, res, next) => {
  try {
    const {
      name,
      description,
      settings = {},
      initial_members = []
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NAME',
          message: 'Team name is required'
        }
      });
    }

    // Check for duplicate name in organization
    const existingTeam = await pool.query(
      'SELECT id FROM teams WHERE organization_id = $1 AND LOWER(name) = LOWER($2)',
      [req.user.org_id, name.trim()]
    );

    if (existingTeam.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'TEAM_EXISTS',
          message: 'A team with this name already exists'
        }
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create team
      const teamResult = await client.query(`
        INSERT INTO teams (organization_id, name, description, settings)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [req.user.org_id, name.trim(), description, settings]);

      const team = teamResult.rows[0];

      // Add initial members
      if (initial_members.length > 0) {
        const memberValues = initial_members.map((m, i) =>
          `($1, $${i * 2 + 2}, $${i * 2 + 3})`
        ).join(', ');

        const memberParams = [team.id];
        initial_members.forEach(m => {
          memberParams.push(m.user_id, m.role || 'member');
        });

        await client.query(`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES ${memberValues}
        `, memberParams);
      }

      // Log audit event
      await client.query(`
        INSERT INTO audit_logs (
          organization_id, user_id, action, resource_type, resource_id, details
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        req.user.org_id,
        req.user.sub,
        'team.created',
        'team',
        team.id,
        { name: team.name, initial_member_count: initial_members.length }
      ]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: team
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/teams/:id
 * Update team details
 * Required permission: teams:update
 */
router.patch('/:id', requirePermission('teams:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, settings } = req.body;

    // Verify team exists and belongs to org
    const existingTeam = await pool.query(
      'SELECT * FROM teams WHERE id = $1 AND organization_id = $2',
      [id, req.user.org_id]
    );

    if (existingTeam.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found'
        }
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [id];
    let paramIndex = 2;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }
    if (settings !== undefined) {
      updates.push(`settings = settings || $${paramIndex}`);
      params.push(settings);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'No valid fields to update'
        }
      });
    }

    updates.push('updated_at = NOW()');

    const result = await pool.query(`
      UPDATE teams SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `, params);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/teams/:id
 * Delete team
 * Required permission: teams:delete
 */
router.delete('/:id', requirePermission('teams:delete'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM teams WHERE id = $1 AND organization_id = $2 RETURNING id, name',
      [id, req.user.org_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found'
        }
      });
    }

    // Log audit event
    await pool.query(`
      INSERT INTO audit_logs (
        organization_id, user_id, action, resource_type, resource_id, details
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      req.user.org_id,
      req.user.sub,
      'team.deleted',
      'team',
      id,
      { name: result.rows[0].name }
    ]);

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams/:id/members
 * Add member to team
 * Required permission: teams:update
 */
router.post('/:id/members', requirePermission('teams:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id, role = 'member' } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'user_id is required'
        }
      });
    }

    // Verify team belongs to org
    const team = await pool.query(
      'SELECT id FROM teams WHERE id = $1 AND organization_id = $2',
      [id, req.user.org_id]
    );

    if (team.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found'
        }
      });
    }

    // Verify user belongs to same org
    const user = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
      [user_id, req.user.org_id]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER',
          message: 'User not found or not in organization'
        }
      });
    }

    // Add member (upsert)
    await pool.query(`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, user_id)
      DO UPDATE SET role = $3, joined_at = NOW()
    `, [id, user_id, role]);

    res.status(201).json({
      success: true,
      message: 'Member added to team'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/teams/:id/members/:userId
 * Remove member from team
 * Required permission: teams:update
 */
router.delete('/:id/members/:userId', requirePermission('teams:update'), async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const result = await pool.query(`
      DELETE FROM team_members tm
      USING teams t
      WHERE tm.team_id = $1
        AND tm.user_id = $2
        AND t.id = tm.team_id
        AND t.organization_id = $3
      RETURNING tm.user_id
    `, [id, userId, req.user.org_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Team member not found'
        }
      });
    }

    res.json({
      success: true,
      message: 'Member removed from team'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/teams/:id/members/:userId
 * Update member role in team
 * Required permission: teams:update
 */
router.patch('/:id/members/:userId', requirePermission('teams:update'), async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'role is required'
        }
      });
    }

    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: `Role must be one of: ${validRoles.join(', ')}`
        }
      });
    }

    const result = await pool.query(`
      UPDATE team_members tm
      SET role = $3
      FROM teams t
      WHERE tm.team_id = $1
        AND tm.user_id = $2
        AND t.id = tm.team_id
        AND t.organization_id = $4
      RETURNING tm.*
    `, [id, userId, role, req.user.org_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MEMBER_NOT_FOUND',
          message: 'Team member not found'
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
