// =============================================================================
// User Types
// =============================================================================

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'member' | 'viewer';

export type UserStatus = 'active' | 'inactive' | 'blocked' | 'pending';

export interface User {
  id: string;
  auth0_id: string;
  email: string;
  name: string;
  picture?: string;
  roles: UserRole[];
  status: UserStatus;
  email_verified: boolean;
  last_login?: string;
  login_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password?: string;
  roles?: UserRole[];
  metadata?: Record<string, unknown>;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  picture?: string;
  metadata?: Record<string, unknown>;
}

export interface AssignRoleRequest {
  role: UserRole;
}

// =============================================================================
// Team Types
// =============================================================================

export type TeamType = 'department' | 'project' | 'cross_functional' | 'temporary';

export type TeamStatus = 'active' | 'inactive' | 'archived';

export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: TeamMemberRole;
  user: Pick<User, 'id' | 'email' | 'name' | 'picture'>;
  joined_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  type: TeamType;
  status: TeamStatus;
  owner_id: string;
  owner?: Pick<User, 'id' | 'email' | 'name' | 'picture'>;
  member_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  type: TeamType;
  metadata?: Record<string, unknown>;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  type?: TeamType;
  status?: TeamStatus;
  metadata?: Record<string, unknown>;
}

export interface AddTeamMemberRequest {
  user_id: string;
  role: TeamMemberRole;
}

export interface UpdateTeamMemberRequest {
  role: TeamMemberRole;
}

// =============================================================================
// Audit Types
// =============================================================================

export type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.blocked'
  | 'user.unblocked'
  | 'user.role_assigned'
  | 'user.role_removed'
  | 'user.password_changed'
  | 'user.mfa_enabled'
  | 'user.mfa_disabled'
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'team.member_added'
  | 'team.member_removed'
  | 'team.member_role_updated'
  | 'compliance.report_generated'
  | 'compliance.control_updated'
  | 'security.suspicious_activity'
  | 'security.brute_force_detected'
  | 'security.unauthorized_access'
  | 'api.rate_limit_exceeded'
  | 'system.error'
  | 'system.config_changed';

export type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  severity: AuditSeverity;
  actor_id?: string;
  actor_email?: string;
  actor_name?: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  ip_address?: string;
  user_agent?: string;
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
  details?: Record<string, unknown>;
  success: boolean;
  error_message?: string;
  created_at: string;
}

export interface AuditSummary {
  total_events: number;
  events_by_type: Record<AuditEventType, number>;
  events_by_severity: Record<AuditSeverity, number>;
  top_actors: Array<{
    actor_id: string;
    actor_email: string;
    event_count: number;
  }>;
  security_events_count: number;
  failed_events_count: number;
  period_start: string;
  period_end: string;
}

export interface SecurityEvent extends AuditLog {
  risk_score: number;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export interface AuditLogFilters {
  event_type?: AuditEventType;
  severity?: AuditSeverity;
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  success?: boolean;
  start_date?: string;
  end_date?: string;
}

// =============================================================================
// Compliance Types
// =============================================================================

export type ComplianceFrameworkType = 'SOC2' | 'GDPR' | 'HIPAA' | 'ISO27001' | 'PCI_DSS' | 'CCPA';

export type ControlStatus = 'compliant' | 'non_compliant' | 'partial' | 'not_applicable' | 'not_assessed';

export interface ComplianceControl {
  id: string;
  framework_id: string;
  control_id: string;
  name: string;
  description: string;
  category: string;
  status: ControlStatus;
  evidence?: string[];
  notes?: string;
  last_assessed?: string;
  next_assessment?: string;
  assigned_to?: string;
}

export interface ComplianceFramework {
  id: string;
  type: ComplianceFrameworkType;
  name: string;
  version: string;
  description?: string;
  total_controls: number;
  compliant_controls: number;
  non_compliant_controls: number;
  partial_controls: number;
  not_assessed_controls: number;
  compliance_percentage: number;
  last_assessment?: string;
  next_assessment?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceFrameworkWithControls extends ComplianceFramework {
  controls: ComplianceControl[];
}

export interface ComplianceReport {
  id: string;
  framework_id: string;
  framework_type: ComplianceFrameworkType;
  framework_name: string;
  generated_at: string;
  generated_by: string;
  period_start: string;
  period_end: string;
  overall_status: ControlStatus;
  compliance_percentage: number;
  summary: {
    total_controls: number;
    compliant: number;
    non_compliant: number;
    partial: number;
    not_applicable: number;
    not_assessed: number;
  };
  findings: Array<{
    control_id: string;
    control_name: string;
    status: ControlStatus;
    finding: string;
    recommendation?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  recommendations: string[];
  download_url?: string;
}

export interface AuditReadiness {
  overall_score: number;
  framework_scores: Record<ComplianceFrameworkType, number>;
  critical_gaps: Array<{
    framework: ComplianceFrameworkType;
    control_id: string;
    control_name: string;
    gap_description: string;
    remediation_steps: string[];
  }>;
  upcoming_assessments: Array<{
    framework: ComplianceFrameworkType;
    scheduled_date: string;
    days_until: number;
  }>;
  recent_changes: Array<{
    control_id: string;
    control_name: string;
    previous_status: ControlStatus;
    new_status: ControlStatus;
    changed_at: string;
  }>;
}

export interface GenerateReportRequest {
  framework_id: string;
  period_start: string;
  period_end: string;
  include_evidence?: boolean;
  format?: 'pdf' | 'json' | 'csv';
}

// =============================================================================
// Pagination Types
// =============================================================================

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// =============================================================================
// API Error Types
// =============================================================================

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiError {
  status_code: number;
  error_code: string;
  message: string;
  details?: ApiErrorDetail[];
  request_id?: string;
  timestamp: string;
}

export class ApiException extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: ApiErrorDetail[];
  public readonly requestId?: string;
  public readonly timestamp: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiException';
    this.statusCode = error.status_code;
    this.errorCode = error.error_code;
    this.details = error.details;
    this.requestId = error.request_id;
    this.timestamp = error.timestamp;
  }

  public isNotFound(): boolean {
    return this.statusCode === 404;
  }

  public isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  public isForbidden(): boolean {
    return this.statusCode === 403;
  }

  public isValidationError(): boolean {
    return this.statusCode === 422;
  }

  public isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  public isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface ApiDeleteResponse {
  success: boolean;
  message: string;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface UserFilters extends PaginationParams {
  status?: UserStatus;
  role?: UserRole;
  email?: string;
  search?: string;
}

export interface TeamFilters extends PaginationParams {
  type?: TeamType;
  status?: TeamStatus;
  search?: string;
}

export interface TeamMemberFilters extends PaginationParams {
  role?: TeamMemberRole;
  search?: string;
}

export interface AuditLogParams extends PaginationParams, AuditLogFilters {}
