import { apiClient, buildQueryParams } from './client';
import {
  AuditLog,
  AuditSummary,
  SecurityEvent,
  AuditLogParams,
  AuditSeverity,
  AuditEventType,
  PaginatedResponse,
  PaginationParams,
} from '@/types';

// =============================================================================
// API Endpoints
// =============================================================================

const AUDIT_ENDPOINT = '/api/v1/audit';

// =============================================================================
// Audit Log Operations
// =============================================================================

/**
 * List audit logs with optional filtering and pagination.
 */
export async function listAuditLogs(
  params?: AuditLogParams
): Promise<PaginatedResponse<AuditLog>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<AuditLog>>(
    `${AUDIT_ENDPOINT}/logs${queryString}`
  );
  return response.data;
}

/**
 * Get a single audit log entry by ID.
 */
export async function getAuditLog(logId: string): Promise<AuditLog> {
  const response = await apiClient.get<AuditLog>(
    `${AUDIT_ENDPOINT}/logs/${logId}`
  );
  return response.data;
}

/**
 * Get audit logs for a specific user.
 */
export async function getUserAuditLogs(
  userId: string,
  params?: PaginationParams
): Promise<PaginatedResponse<AuditLog>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<AuditLog>>(
    `${AUDIT_ENDPOINT}/users/${userId}/logs${queryString}`
  );
  return response.data;
}

/**
 * Get audit logs for a specific resource.
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  params?: PaginationParams
): Promise<PaginatedResponse<AuditLog>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<AuditLog>>(
    `${AUDIT_ENDPOINT}/resources/${resourceType}/${resourceId}/logs${queryString}`
  );
  return response.data;
}

// =============================================================================
// Audit Summary Operations
// =============================================================================

/**
 * Get audit summary statistics.
 */
export async function getAuditSummary(
  startDate?: string,
  endDate?: string
): Promise<AuditSummary> {
  const params: Record<string, unknown> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const queryString = buildQueryParams(params);
  const response = await apiClient.get<AuditSummary>(
    `${AUDIT_ENDPOINT}/summary${queryString}`
  );
  return response.data;
}

/**
 * Get audit summary for a specific time period.
 */
export async function getAuditSummaryForPeriod(
  period: 'day' | 'week' | 'month' | 'quarter' | 'year'
): Promise<AuditSummary> {
  const response = await apiClient.get<AuditSummary>(
    `${AUDIT_ENDPOINT}/summary/${period}`
  );
  return response.data;
}

/**
 * Get event counts grouped by type.
 */
export async function getEventCountsByType(
  startDate?: string,
  endDate?: string
): Promise<Record<AuditEventType, number>> {
  const params: Record<string, unknown> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const queryString = buildQueryParams(params);
  const response = await apiClient.get<Record<AuditEventType, number>>(
    `${AUDIT_ENDPOINT}/events/by-type${queryString}`
  );
  return response.data;
}

/**
 * Get event counts grouped by severity.
 */
export async function getEventCountsBySeverity(
  startDate?: string,
  endDate?: string
): Promise<Record<AuditSeverity, number>> {
  const params: Record<string, unknown> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const queryString = buildQueryParams(params);
  const response = await apiClient.get<Record<AuditSeverity, number>>(
    `${AUDIT_ENDPOINT}/events/by-severity${queryString}`
  );
  return response.data;
}

// =============================================================================
// Security Events
// =============================================================================

export interface SecurityEventFilters extends PaginationParams {
  severity?: AuditSeverity;
  is_resolved?: boolean;
  min_risk_score?: number;
  start_date?: string;
  end_date?: string;
}

/**
 * Get security events (suspicious activities, unauthorized access, etc.).
 */
export async function getSecurityEvents(
  filters?: SecurityEventFilters
): Promise<PaginatedResponse<SecurityEvent>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<SecurityEvent>>(
    `${AUDIT_ENDPOINT}/security/events${queryString}`
  );
  return response.data;
}

/**
 * Get a single security event by ID.
 */
export async function getSecurityEvent(eventId: string): Promise<SecurityEvent> {
  const response = await apiClient.get<SecurityEvent>(
    `${AUDIT_ENDPOINT}/security/events/${eventId}`
  );
  return response.data;
}

/**
 * Mark a security event as resolved.
 */
export async function resolveSecurityEvent(
  eventId: string,
  notes?: string
): Promise<SecurityEvent> {
  const response = await apiClient.post<SecurityEvent>(
    `${AUDIT_ENDPOINT}/security/events/${eventId}/resolve`,
    { resolution_notes: notes }
  );
  return response.data;
}

/**
 * Get security event statistics.
 */
export async function getSecurityStats(
  startDate?: string,
  endDate?: string
): Promise<{
  total_events: number;
  unresolved_count: number;
  high_risk_count: number;
  events_by_type: Record<AuditEventType, number>;
  average_risk_score: number;
  top_affected_users: Array<{
    user_id: string;
    user_email: string;
    event_count: number;
  }>;
}> {
  const params: Record<string, unknown> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const queryString = buildQueryParams(params);
  const response = await apiClient.get<{
    total_events: number;
    unresolved_count: number;
    high_risk_count: number;
    events_by_type: Record<AuditEventType, number>;
    average_risk_score: number;
    top_affected_users: Array<{
      user_id: string;
      user_email: string;
      event_count: number;
    }>;
  }>(`${AUDIT_ENDPOINT}/security/stats${queryString}`);
  return response.data;
}

// =============================================================================
// Export Operations
// =============================================================================

/**
 * Export audit logs to a file.
 */
export async function exportAuditLogs(
  format: 'csv' | 'json' | 'pdf',
  filters?: AuditLogParams
): Promise<{ download_url: string; expires_at: string }> {
  const params = { ...filters, format };
  const response = await apiClient.post<{ download_url: string; expires_at: string }>(
    `${AUDIT_ENDPOINT}/export`,
    params
  );
  return response.data;
}

// =============================================================================
// Real-time / Recent Activity
// =============================================================================

/**
 * Get recent activity (last N events).
 */
export async function getRecentActivity(
  limit: number = 10
): Promise<AuditLog[]> {
  const response = await apiClient.get<AuditLog[]>(
    `${AUDIT_ENDPOINT}/recent?limit=${limit}`
  );
  return response.data;
}

/**
 * Get activity timeline for a specific date range.
 */
export async function getActivityTimeline(
  startDate: string,
  endDate: string,
  granularity: 'hour' | 'day' | 'week' = 'day'
): Promise<Array<{ timestamp: string; count: number }>> {
  const params = { start_date: startDate, end_date: endDate, granularity };
  const queryString = buildQueryParams(params);
  const response = await apiClient.get<Array<{ timestamp: string; count: number }>>(
    `${AUDIT_ENDPOINT}/timeline${queryString}`
  );
  return response.data;
}

// =============================================================================
// Export all functions
// =============================================================================

export const auditApi = {
  // Logs
  list: listAuditLogs,
  get: getAuditLog,
  getUserLogs: getUserAuditLogs,
  getResourceLogs: getResourceAuditLogs,

  // Summary
  getSummary: getAuditSummary,
  getSummaryForPeriod: getAuditSummaryForPeriod,
  getEventCountsByType,
  getEventCountsBySeverity,

  // Security
  getSecurityEvents,
  getSecurityEvent,
  resolveSecurityEvent,
  getSecurityStats,

  // Export
  export: exportAuditLogs,

  // Activity
  getRecentActivity,
  getActivityTimeline,
};

export default auditApi;
