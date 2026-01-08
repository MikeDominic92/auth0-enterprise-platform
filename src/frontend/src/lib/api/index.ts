// =============================================================================
// API Client
// =============================================================================

export { apiClient, setAccessTokenProvider, buildQueryParams } from './client';

// =============================================================================
// API Modules
// =============================================================================

export { usersApi } from './users';
export { teamsApi } from './teams';
export { auditApi } from './audit';
export { complianceApi } from './compliance';

// =============================================================================
// Individual Function Exports
// =============================================================================

// Users
export {
  listUsers,
  getUser,
  getUserByAuth0Id,
  getCurrentUser,
  createUser,
  updateUser,
  deleteUser,
  assignRole,
  removeRole,
  getUserRoles,
  blockUser,
  unblockUser,
  sendPasswordReset,
  sendEmailVerification,
  resyncUserFromAuth0,
  bulkUpdateStatus,
  bulkAssignRole,
} from './users';

// Teams
export {
  listTeams,
  getTeam,
  getTeamWithMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  archiveTeam,
  restoreTeam,
  listMembers,
  getMember,
  addMember,
  removeMember,
  updateMemberRole,
  getUserTeams,
  getOwnedTeams,
  checkMembership,
  bulkAddMembers,
  bulkRemoveMembers,
  transferOwnership,
} from './teams';

// Audit
export {
  listAuditLogs,
  getAuditLog,
  getUserAuditLogs,
  getResourceAuditLogs,
  getAuditSummary,
  getAuditSummaryForPeriod,
  getEventCountsByType,
  getEventCountsBySeverity,
  getSecurityEvents,
  getSecurityEvent,
  resolveSecurityEvent,
  getSecurityStats,
  exportAuditLogs,
  getRecentActivity,
  getActivityTimeline,
} from './audit';

// Compliance
export {
  listFrameworks,
  getFramework,
  getFrameworkByType,
  getFrameworkControls,
  getFrameworkWithControls,
  getControl,
  updateControlStatus,
  assignControl,
  addControlEvidence,
  generateReport,
  listReports,
  getReport,
  downloadReport,
  deleteReport,
  getAuditReadiness,
  getFrameworkAuditReadiness,
  getDashboardStats,
  getComplianceTrend,
} from './compliance';
