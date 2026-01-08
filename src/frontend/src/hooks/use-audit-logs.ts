import {
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient, buildQueryParams } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-client';
import type {
  AuditLog,
  AuditSummary,
  SecurityEvent,
  AuditLogParams,
  PaginatedResponse,
  ApiSuccessResponse,
  ApiException,
} from '@/types';

// =============================================================================
// API Functions
// =============================================================================

async function fetchAuditLogs(
  params?: AuditLogParams
): Promise<PaginatedResponse<AuditLog>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<AuditLog>>(
    `/api/v1/audit-logs${queryString}`
  );
  return response.data;
}

async function fetchAuditLog(id: string): Promise<AuditLog> {
  const response = await apiClient.get<ApiSuccessResponse<AuditLog>>(
    `/api/v1/audit-logs/${id}`
  );
  return response.data.data;
}

async function fetchAuditSummary(days: number): Promise<AuditSummary> {
  const response = await apiClient.get<ApiSuccessResponse<AuditSummary>>(
    `/api/v1/audit-logs/summary?days=${days}`
  );
  return response.data.data;
}

async function fetchSecurityEvents(hours: number): Promise<SecurityEvent[]> {
  const response = await apiClient.get<ApiSuccessResponse<SecurityEvent[]>>(
    `/api/v1/audit-logs/security-events?hours=${hours}`
  );
  return response.data.data;
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to fetch paginated list of audit logs with optional filters.
 */
export function useAuditLogs(
  params?: AuditLogParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<AuditLog>, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<PaginatedResponse<AuditLog>, ApiException>({
    queryKey: queryKeys.auditLogs.list(params as Record<string, unknown>),
    queryFn: () => fetchAuditLogs(params),
    ...options,
  });
}

/**
 * Hook to fetch a single audit log entry by ID.
 */
export function useAuditLog(
  id: string,
  options?: Omit<UseQueryOptions<AuditLog, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery<AuditLog, ApiException>({
    queryKey: queryKeys.auditLogs.detail(id),
    queryFn: () => fetchAuditLog(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to fetch audit summary for a specified number of days.
 * Provides aggregated statistics like events by type, severity, top actors, etc.
 */
export function useAuditSummary(
  days: number = 7,
  options?: Omit<UseQueryOptions<AuditSummary, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery<AuditSummary, ApiException>({
    queryKey: queryKeys.auditLogs.summary(days),
    queryFn: () => fetchAuditSummary(days),
    // Summary data changes less frequently, use longer stale time
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch security events from the last specified hours.
 * Returns events with security-related severity (suspicious activity, unauthorized access, etc.)
 */
export function useSecurityEvents(
  hours: number = 24,
  options?: Omit<
    UseQueryOptions<SecurityEvent[], ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<SecurityEvent[], ApiException>({
    queryKey: queryKeys.auditLogs.securityEvents(hours),
    queryFn: () => fetchSecurityEvents(hours),
    // Security events should be fresher
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes for real-time monitoring
    ...options,
  });
}

// =============================================================================
// Filter Helper Types
// =============================================================================

export interface AuditLogFilterOptions {
  eventTypes: AuditLogParams['event_type'][];
  severities: AuditLogParams['severity'][];
  dateRange?: {
    start: string;
    end: string;
  };
  actorId?: string;
  targetType?: string;
  targetId?: string;
  success?: boolean;
}

/**
 * Helper function to build audit log filter params from filter options.
 */
export function buildAuditLogFilters(
  options: AuditLogFilterOptions,
  pagination?: Pick<AuditLogParams, 'page' | 'page_size' | 'sort_by' | 'sort_order'>
): AuditLogParams {
  const params: AuditLogParams = {
    ...pagination,
  };

  // Only set single event type (API may support comma-separated values)
  if (options.eventTypes.length === 1) {
    params.event_type = options.eventTypes[0];
  }

  // Only set single severity
  if (options.severities.length === 1) {
    params.severity = options.severities[0];
  }

  if (options.dateRange) {
    params.start_date = options.dateRange.start;
    params.end_date = options.dateRange.end;
  }

  if (options.actorId) {
    params.actor_id = options.actorId;
  }

  if (options.targetType) {
    params.target_type = options.targetType;
  }

  if (options.targetId) {
    params.target_id = options.targetId;
  }

  if (options.success !== undefined) {
    params.success = options.success;
  }

  return params;
}
