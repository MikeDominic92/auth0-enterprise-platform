/**
 * User Management Routes
 * Enterprise B2B SaaS Authorization Platform
 *
 * Handles user CRUD operations with Auth0 Management API integration
 */

const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/permissions');
const UserService = require('../services/UserService');

/**
 * GET /api/users
 * List all users with pagination and filtering
 * Required permission: users:read
 */
router.get('/', requirePermission('users:read'), async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      organization_id
    } = req.query;

    // Enforce organization scope for non-super-admins
    const orgId = req.user.permissions.includes('system:admin')
      ? organization_id
      : req.user.org_id;

    const result = await UserService.listUsers({
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      search,
      role,
      status,
      organizationId: orgId
    });

    res.json({
      success: true,
      data: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id
 * Get single user by ID
 * Required permission: users:read
 */
router.get('/:id', requirePermission('users:read'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await UserService.getUserById(id, {
      includeTeams: true,
      includeRoles: true,
      includeAuditSummary: true
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Verify organization access
    if (!req.user.permissions.includes('system:admin') &&
        user.organization_id !== req.user.org_id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Cannot access users from other organizations'
        }
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * Create new user (invites via Auth0)
 * Required permission: users:create
 */
router.post('/', requirePermission('users:create'), async (req, res, next) => {
  try {
    const {
      email,
      name,
      role_ids,
      team_ids,
      send_invite = true,
      metadata = {}
    } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Valid email address is required'
        }
      });
    }

    // Use requester's org unless system admin
    const organizationId = req.user.permissions.includes('system:admin')
      ? req.body.organization_id || req.user.org_id
      : req.user.org_id;

    const user = await UserService.createUser({
      email,
      name,
      organizationId,
      roleIds: role_ids,
      teamIds: team_ids,
      sendInvite: send_invite,
      metadata,
      createdBy: req.user.sub
    });

    res.status(201).json({
      success: true,
      data: user,
      message: send_invite ? 'User invited successfully' : 'User created successfully'
    });
  } catch (error) {
    if (error.code === 'USER_EXISTS') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists'
        }
      });
    }
    next(error);
  }
});

/**
 * PATCH /api/users/:id
 * Update user details
 * Required permission: users:update
 */
router.patch('/:id', requirePermission('users:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields without proper permissions
    const sensitiveFields = ['auth0_id', 'organization_id', 'created_at'];
    const attemptedSensitiveUpdates = Object.keys(updates).filter(
      key => sensitiveFields.includes(key)
    );

    if (attemptedSensitiveUpdates.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UPDATE',
          message: `Cannot update protected fields: ${attemptedSensitiveUpdates.join(', ')}`
        }
      });
    }

    const user = await UserService.updateUser(id, {
      ...updates,
      updatedBy: req.user.sub
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/users/:id
 * Deactivate or delete user
 * Required permission: users:delete
 */
router.delete('/:id', requirePermission('users:delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard_delete = false } = req.query;

    // Prevent self-deletion
    if (id === req.user.sub) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_DELETE_FORBIDDEN',
          message: 'Cannot delete your own account'
        }
      });
    }

    if (hard_delete && !req.user.permissions.includes('system:admin')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'HARD_DELETE_FORBIDDEN',
          message: 'Only system administrators can permanently delete users'
        }
      });
    }

    await UserService.deleteUser(id, {
      hardDelete: hard_delete === 'true',
      deletedBy: req.user.sub
    });

    res.json({
      success: true,
      message: hard_delete ? 'User permanently deleted' : 'User deactivated'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users/:id/roles
 * Assign roles to user
 * Required permission: users:update, roles:assign
 */
router.post('/:id/roles',
  requirePermission(['users:update', 'roles:assign']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role_ids } = req.body;

      if (!Array.isArray(role_ids) || role_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLES',
            message: 'role_ids must be a non-empty array'
          }
        });
      }

      const result = await UserService.assignRoles(id, role_ids, {
        assignedBy: req.user.sub
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/users/:id/roles/:roleId
 * Remove role from user
 * Required permission: users:update, roles:assign
 */
router.delete('/:id/roles/:roleId',
  requirePermission(['users:update', 'roles:assign']),
  async (req, res, next) => {
    try {
      const { id, roleId } = req.params;

      await UserService.removeRole(id, roleId, {
        removedBy: req.user.sub
      });

      res.json({
        success: true,
        message: 'Role removed from user'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/:id/mfa/reset
 * Reset user MFA enrollment
 * Required permission: users:update, mfa:manage
 */
router.post('/:id/mfa/reset',
  requirePermission(['users:update', 'mfa:manage']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await UserService.resetMFA(id, {
        resetBy: req.user.sub
      });

      res.json({
        success: true,
        message: 'MFA reset successfully. User will be prompted to re-enroll.'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/:id/password/reset
 * Trigger password reset email
 * Required permission: users:update
 */
router.post('/:id/password/reset',
  requirePermission('users:update'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await UserService.sendPasswordReset(id, {
        initiatedBy: req.user.sub
      });

      res.json({
        success: true,
        message: 'Password reset email sent'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/:id/sessions
 * List active sessions for user
 * Required permission: users:read, sessions:read
 */
router.get('/:id/sessions',
  requirePermission(['users:read', 'sessions:read']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const sessions = await UserService.getActiveSessions(id);

      res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/users/:id/sessions
 * Revoke all sessions for user
 * Required permission: users:update, sessions:revoke
 */
router.delete('/:id/sessions',
  requirePermission(['users:update', 'sessions:revoke']),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await UserService.revokeAllSessions(id, {
        revokedBy: req.user.sub
      });

      res.json({
        success: true,
        message: 'All sessions revoked'
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
