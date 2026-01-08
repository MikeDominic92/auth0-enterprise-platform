import { apiClient, buildQueryParams } from './client';
import {
  ComplianceFramework,
  ComplianceFrameworkWithControls,
  ComplianceFrameworkType,
  ComplianceControl,
  ControlStatus,
  ComplianceReport,
  AuditReadiness,
  GenerateReportRequest,
  PaginatedResponse,
  PaginationParams,
} from '@/types';

// =============================================================================
// API Endpoints
// =============================================================================

const COMPLIANCE_ENDPOINT = '/api/v1/compliance';

// =============================================================================
// Framework Operations
// =============================================================================

export interface FrameworkFilters extends PaginationParams {
  type?: ComplianceFrameworkType;
  search?: string;
}

/**
 * List all compliance frameworks.
 */
export async function listFrameworks(
  filters?: FrameworkFilters
): Promise<PaginatedResponse<ComplianceFramework>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<ComplianceFramework>>(
    `${COMPLIANCE_ENDPOINT}/frameworks${queryString}`
  );
  return response.data;
}

/**
 * Get a single compliance framework by ID.
 */
export async function getFramework(
  frameworkId: string
): Promise<ComplianceFramework> {
  const response = await apiClient.get<ComplianceFramework>(
    `${COMPLIANCE_ENDPOINT}/frameworks/${frameworkId}`
  );
  return response.data;
}

/**
 * Get a compliance framework by type.
 */
export async function getFrameworkByType(
  type: ComplianceFrameworkType
): Promise<ComplianceFramework> {
  const response = await apiClient.get<ComplianceFramework>(
    `${COMPLIANCE_ENDPOINT}/frameworks/type/${type}`
  );
  return response.data;
}

// =============================================================================
// Control Operations
// =============================================================================

export interface ControlFilters extends PaginationParams {
  status?: ControlStatus;
  category?: string;
  search?: string;
}

/**
 * Get all controls for a framework.
 */
export async function getFrameworkControls(
  frameworkId: string,
  filters?: ControlFilters
): Promise<PaginatedResponse<ComplianceControl>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<ComplianceControl>>(
    `${COMPLIANCE_ENDPOINT}/frameworks/${frameworkId}/controls${queryString}`
  );
  return response.data;
}

/**
 * Get a framework with all its controls.
 */
export async function getFrameworkWithControls(
  frameworkId: string
): Promise<ComplianceFrameworkWithControls> {
  const response = await apiClient.get<ComplianceFrameworkWithControls>(
    `${COMPLIANCE_ENDPOINT}/frameworks/${frameworkId}?include_controls=true`
  );
  return response.data;
}

/**
 * Get a single control by ID.
 */
export async function getControl(controlId: string): Promise<ComplianceControl> {
  const response = await apiClient.get<ComplianceControl>(
    `${COMPLIANCE_ENDPOINT}/controls/${controlId}`
  );
  return response.data;
}

/**
 * Update a control's status.
 */
export async function updateControlStatus(
  controlId: string,
  status: ControlStatus,
  notes?: string,
  evidence?: string[]
): Promise<ComplianceControl> {
  const response = await apiClient.patch<ComplianceControl>(
    `${COMPLIANCE_ENDPOINT}/controls/${controlId}`,
    { status, notes, evidence }
  );
  return response.data;
}

/**
 * Assign a control to a user.
 */
export async function assignControl(
  controlId: string,
  userId: string
): Promise<ComplianceControl> {
  const response = await apiClient.post<ComplianceControl>(
    `${COMPLIANCE_ENDPOINT}/controls/${controlId}/assign`,
    { user_id: userId }
  );
  return response.data;
}

/**
 * Add evidence to a control.
 */
export async function addControlEvidence(
  controlId: string,
  evidence: string[]
): Promise<ComplianceControl> {
  const response = await apiClient.post<ComplianceControl>(
    `${COMPLIANCE_ENDPOINT}/controls/${controlId}/evidence`,
    { evidence }
  );
  return response.data;
}

// =============================================================================
// Report Operations
// =============================================================================

export interface ReportFilters extends PaginationParams {
  framework_id?: string;
  framework_type?: ComplianceFrameworkType;
  start_date?: string;
  end_date?: string;
}

/**
 * Generate a compliance report.
 */
export async function generateReport(
  request: GenerateReportRequest
): Promise<ComplianceReport> {
  const response = await apiClient.post<ComplianceReport>(
    `${COMPLIANCE_ENDPOINT}/reports`,
    request
  );
  return response.data;
}

/**
 * List all compliance reports.
 */
export async function listReports(
  filters?: ReportFilters
): Promise<PaginatedResponse<ComplianceReport>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<ComplianceReport>>(
    `${COMPLIANCE_ENDPOINT}/reports${queryString}`
  );
  return response.data;
}

/**
 * Get a single compliance report by ID.
 */
export async function getReport(reportId: string): Promise<ComplianceReport> {
  const response = await apiClient.get<ComplianceReport>(
    `${COMPLIANCE_ENDPOINT}/reports/${reportId}`
  );
  return response.data;
}

/**
 * Download a compliance report.
 */
export async function downloadReport(
  reportId: string,
  format: 'pdf' | 'json' | 'csv' = 'pdf'
): Promise<{ download_url: string; expires_at: string }> {
  const response = await apiClient.get<{ download_url: string; expires_at: string }>(
    `${COMPLIANCE_ENDPOINT}/reports/${reportId}/download?format=${format}`
  );
  return response.data;
}

/**
 * Delete a compliance report.
 */
export async function deleteReport(
  reportId: string
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `${COMPLIANCE_ENDPOINT}/reports/${reportId}`
  );
  return response.data;
}

// =============================================================================
// Audit Readiness
// =============================================================================

/**
 * Get overall audit readiness assessment.
 */
export async function getAuditReadiness(): Promise<AuditReadiness> {
  const response = await apiClient.get<AuditReadiness>(
    `${COMPLIANCE_ENDPOINT}/audit-readiness`
  );
  return response.data;
}

/**
 * Get audit readiness for a specific framework.
 */
export async function getFrameworkAuditReadiness(
  frameworkId: string
): Promise<{
  framework: ComplianceFramework;
  score: number;
  gaps: Array<{
    control_id: string;
    control_name: string;
    gap_description: string;
    remediation_steps: string[];
  }>;
  recommendations: string[];
}> {
  const response = await apiClient.get<{
    framework: ComplianceFramework;
    score: number;
    gaps: Array<{
      control_id: string;
      control_name: string;
      gap_description: string;
      remediation_steps: string[];
    }>;
    recommendations: string[];
  }>(`${COMPLIANCE_ENDPOINT}/frameworks/${frameworkId}/audit-readiness`);
  return response.data;
}

// =============================================================================
// Dashboard / Statistics
// =============================================================================

/**
 * Get compliance dashboard statistics.
 */
export async function getDashboardStats(): Promise<{
  overall_compliance_percentage: number;
  frameworks_summary: Array<{
    framework_id: string;
    framework_type: ComplianceFrameworkType;
    framework_name: string;
    compliance_percentage: number;
    total_controls: number;
    compliant_controls: number;
  }>;
  recent_changes: Array<{
    control_id: string;
    control_name: string;
    framework_type: ComplianceFrameworkType;
    previous_status: ControlStatus;
    new_status: ControlStatus;
    changed_at: string;
  }>;
  upcoming_assessments: Array<{
    framework_id: string;
    framework_type: ComplianceFrameworkType;
    scheduled_date: string;
  }>;
}> {
  const response = await apiClient.get<{
    overall_compliance_percentage: number;
    frameworks_summary: Array<{
      framework_id: string;
      framework_type: ComplianceFrameworkType;
      framework_name: string;
      compliance_percentage: number;
      total_controls: number;
      compliant_controls: number;
    }>;
    recent_changes: Array<{
      control_id: string;
      control_name: string;
      framework_type: ComplianceFrameworkType;
      previous_status: ControlStatus;
      new_status: ControlStatus;
      changed_at: string;
    }>;
    upcoming_assessments: Array<{
      framework_id: string;
      framework_type: ComplianceFrameworkType;
      scheduled_date: string;
    }>;
  }>(`${COMPLIANCE_ENDPOINT}/dashboard`);
  return response.data;
}

/**
 * Get compliance trend over time.
 */
export async function getComplianceTrend(
  frameworkId?: string,
  startDate?: string,
  endDate?: string,
  granularity: 'day' | 'week' | 'month' = 'week'
): Promise<Array<{
  date: string;
  compliance_percentage: number;
  compliant_controls: number;
  total_controls: number;
}>> {
  const params: Record<string, unknown> = { granularity };
  if (frameworkId) params.framework_id = frameworkId;
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const queryString = buildQueryParams(params);
  const response = await apiClient.get<Array<{
    date: string;
    compliance_percentage: number;
    compliant_controls: number;
    total_controls: number;
  }>>(`${COMPLIANCE_ENDPOINT}/trend${queryString}`);
  return response.data;
}

// =============================================================================
// Export all functions
// =============================================================================

export const complianceApi = {
  // Frameworks
  listFrameworks,
  getFramework,
  getFrameworkByType,

  // Controls
  getFrameworkControls,
  getFrameworkWithControls,
  getControl,
  updateControlStatus,
  assignControl,
  addControlEvidence,

  // Reports
  generateReport,
  listReports,
  getReport,
  downloadReport,
  deleteReport,

  // Audit Readiness
  getAuditReadiness,
  getFrameworkAuditReadiness,

  // Dashboard
  getDashboardStats,
  getComplianceTrend,
};

export default complianceApi;
