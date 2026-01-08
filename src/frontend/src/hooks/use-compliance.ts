import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { apiClient, buildQueryParams } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-client';
import type {
  ComplianceFramework,
  ComplianceFrameworkWithControls,
  ComplianceControl,
  ComplianceReport,
  AuditReadiness,
  GenerateReportRequest,
  PaginatedResponse,
  PaginationParams,
  ApiSuccessResponse,
  ApiException,
} from '@/types';

// =============================================================================
// API Functions
// =============================================================================

async function fetchFrameworks(
  params?: PaginationParams
): Promise<PaginatedResponse<ComplianceFramework>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<ComplianceFramework>>(
    `/api/v1/compliance/frameworks${queryString}`
  );
  return response.data;
}

async function fetchFramework(id: string): Promise<ComplianceFrameworkWithControls> {
  const response = await apiClient.get<ApiSuccessResponse<ComplianceFrameworkWithControls>>(
    `/api/v1/compliance/frameworks/${id}`
  );
  return response.data.data;
}

async function fetchFrameworkControls(
  frameworkId: string,
  params?: PaginationParams
): Promise<PaginatedResponse<ComplianceControl>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<ComplianceControl>>(
    `/api/v1/compliance/frameworks/${frameworkId}/controls${queryString}`
  );
  return response.data;
}

async function generateReport(data: GenerateReportRequest): Promise<ComplianceReport> {
  const response = await apiClient.post<ApiSuccessResponse<ComplianceReport>>(
    '/api/v1/compliance/reports',
    data
  );
  return response.data.data;
}

async function fetchAuditReadiness(frameworkId?: string): Promise<AuditReadiness> {
  const url = frameworkId
    ? `/api/v1/compliance/audit-readiness?framework_id=${frameworkId}`
    : '/api/v1/compliance/audit-readiness';
  const response = await apiClient.get<ApiSuccessResponse<AuditReadiness>>(url);
  return response.data.data;
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to fetch all compliance frameworks.
 */
export function useFrameworks(
  params?: PaginationParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<ComplianceFramework>, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<PaginatedResponse<ComplianceFramework>, ApiException>({
    queryKey: [...queryKeys.compliance.frameworks(), params] as const,
    queryFn: () => fetchFrameworks(params),
    // Compliance frameworks change infrequently
    staleTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

/**
 * Hook to fetch a single compliance framework with all controls.
 */
export function useFramework(
  id: string,
  options?: Omit<
    UseQueryOptions<ComplianceFrameworkWithControls, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<ComplianceFrameworkWithControls, ApiException>({
    queryKey: queryKeys.compliance.framework(id),
    queryFn: () => fetchFramework(id),
    enabled: !!id,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
}

/**
 * Hook to fetch controls for a specific compliance framework.
 * Use this when you need paginated controls separate from the framework.
 */
export function useFrameworkControls(
  frameworkId: string,
  params?: PaginationParams,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<ComplianceControl>, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<PaginatedResponse<ComplianceControl>, ApiException>({
    queryKey: [...queryKeys.compliance.controls(frameworkId), params] as const,
    queryFn: () => fetchFrameworkControls(frameworkId, params),
    enabled: !!frameworkId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    ...options,
  });
}

/**
 * Hook to fetch audit readiness status.
 * Can be filtered to a specific framework or get overall readiness.
 */
export function useAuditReadiness(
  frameworkId?: string,
  options?: Omit<
    UseQueryOptions<AuditReadiness, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<AuditReadiness, ApiException>({
    queryKey: queryKeys.compliance.auditReadiness(frameworkId),
    queryFn: () => fetchAuditReadiness(frameworkId),
    // Audit readiness may change with control updates
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook to generate a compliance report.
 */
export function useGenerateReport(
  options?: Omit<
    UseMutationOptions<ComplianceReport, ApiException, GenerateReportRequest>,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: ComplianceReport, variables: GenerateReportRequest) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<ComplianceReport, ApiException, GenerateReportRequest>({
    mutationFn: generateReport,
    onSuccess: (data, variables) => {
      // Invalidate reports list if we have one cached
      queryClient.invalidateQueries({ queryKey: queryKeys.compliance.reports() });
      // Invalidate audit readiness as it may reference new report data
      queryClient.invalidateQueries({
        queryKey: queryKeys.compliance.auditReadiness(variables.framework_id),
      });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

// =============================================================================
// Derived Hooks
// =============================================================================

/**
 * Hook to get compliance score for a specific framework.
 * Derives the score from the framework data.
 */
export function useComplianceScore(frameworkId: string) {
  const { data: framework, ...rest } = useFramework(frameworkId);

  const score = framework
    ? {
        percentage: framework.compliance_percentage,
        compliant: framework.compliant_controls,
        nonCompliant: framework.non_compliant_controls,
        partial: framework.partial_controls,
        notAssessed: framework.not_assessed_controls,
        total: framework.total_controls,
      }
    : null;

  return {
    data: score,
    framework,
    ...rest,
  };
}

/**
 * Hook to get overall compliance health across all frameworks.
 */
export function useOverallComplianceHealth(
  options?: Omit<
    UseQueryOptions<PaginatedResponse<ComplianceFramework>, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  const { data: frameworks, ...rest } = useFrameworks(undefined, options);

  const health = frameworks?.data
    ? {
        averageCompliance:
          frameworks.data.reduce((sum, f) => sum + f.compliance_percentage, 0) /
          frameworks.data.length,
        frameworkCount: frameworks.data.length,
        atRisk: frameworks.data.filter((f) => f.compliance_percentage < 70).length,
        compliant: frameworks.data.filter((f) => f.compliance_percentage >= 90).length,
        frameworks: frameworks.data.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          percentage: f.compliance_percentage,
          status:
            f.compliance_percentage >= 90
              ? 'compliant'
              : f.compliance_percentage >= 70
              ? 'warning'
              : 'critical',
        })),
      }
    : null;

  return {
    data: health,
    ...rest,
  };
}
