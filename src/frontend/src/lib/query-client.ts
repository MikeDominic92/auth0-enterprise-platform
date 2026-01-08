import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { ApiException } from '@/types';

// =============================================================================
// Error Handler
// =============================================================================

function handleQueryError(error: unknown): void {
  if (error instanceof ApiException) {
    // Log API errors for monitoring
    console.error('[Query Error]', {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      message: error.message,
      requestId: error.requestId,
    });

    // Handle specific error cases
    if (error.isUnauthorized()) {
      // Token expired or invalid - could trigger re-authentication
      console.warn('[Auth] Unauthorized request - token may be expired');
    } else if (error.isRateLimited()) {
      console.warn('[Rate Limit] API rate limit exceeded');
    }
  } else {
    console.error('[Query Error] Unexpected error:', error);
  }
}

function handleMutationError(error: unknown): void {
  if (error instanceof ApiException) {
    console.error('[Mutation Error]', {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      message: error.message,
      requestId: error.requestId,
    });
  } else {
    console.error('[Mutation Error] Unexpected error:', error);
  }
}

// =============================================================================
// Retry Logic
// =============================================================================

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // Don't retry more than 3 times
  if (failureCount >= 3) {
    return false;
  }

  // Don't retry client errors (4xx) except rate limiting
  if (error instanceof ApiException) {
    // Retry rate limited requests
    if (error.isRateLimited()) {
      return true;
    }
    // Don't retry authentication or authorization errors
    if (error.isUnauthorized() || error.isForbidden()) {
      return false;
    }
    // Don't retry validation errors
    if (error.isValidationError()) {
      return false;
    }
    // Don't retry not found errors
    if (error.isNotFound()) {
      return false;
    }
    // Retry server errors
    if (error.isServerError()) {
      return true;
    }
    // Retry network errors (status code 0)
    if (error.statusCode === 0) {
      return true;
    }
    // Don't retry other 4xx errors
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }
  }

  // Default: retry unknown errors
  return true;
}

function getRetryDelay(attemptIndex: number, error: unknown): number {
  // Use exponential backoff with jitter
  const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
  const jitter = Math.random() * 1000;

  // Add extra delay for rate limit errors
  if (error instanceof ApiException && error.isRateLimited()) {
    return baseDelay + 5000 + jitter;
  }

  return baseDelay + jitter;
}

// =============================================================================
// Query Client Factory
// =============================================================================

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleQueryError,
    }),
    mutationCache: new MutationCache({
      onError: handleMutationError,
    }),
    defaultOptions: {
      queries: {
        // Data freshness
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes (garbage collection time, formerly cacheTime)

        // Retry configuration
        retry: shouldRetryQuery,
        retryDelay: getRetryDelay,

        // Refetch behavior
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,

        // Network mode
        networkMode: 'online',
      },
      mutations: {
        // Retry mutations only on network errors
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          if (error instanceof ApiException) {
            return error.statusCode === 0; // Only retry network errors
          }
          return false;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        networkMode: 'online',
      },
    },
  });
}

// =============================================================================
// Singleton Query Client
// =============================================================================

let queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  return queryClient;
}

// =============================================================================
// Query Key Factory
// =============================================================================

export const queryKeys = {
  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.users.lists(), params] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },

  // Teams
  teams: {
    all: ['teams'] as const,
    lists: () => [...queryKeys.teams.all, 'list'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.teams.lists(), params] as const,
    details: () => [...queryKeys.teams.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.teams.details(), id] as const,
    members: (teamId: string) =>
      [...queryKeys.teams.detail(teamId), 'members'] as const,
  },

  // Audit Logs
  auditLogs: {
    all: ['audit-logs'] as const,
    lists: () => [...queryKeys.auditLogs.all, 'list'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.auditLogs.lists(), params] as const,
    details: () => [...queryKeys.auditLogs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.auditLogs.details(), id] as const,
    summary: (days: number) =>
      [...queryKeys.auditLogs.all, 'summary', days] as const,
    securityEvents: (hours: number) =>
      [...queryKeys.auditLogs.all, 'security-events', hours] as const,
  },

  // Compliance
  compliance: {
    all: ['compliance'] as const,
    frameworks: () => [...queryKeys.compliance.all, 'frameworks'] as const,
    framework: (id: string) =>
      [...queryKeys.compliance.frameworks(), id] as const,
    controls: (frameworkId: string) =>
      [...queryKeys.compliance.framework(frameworkId), 'controls'] as const,
    auditReadiness: (frameworkId?: string) =>
      [...queryKeys.compliance.all, 'audit-readiness', frameworkId] as const,
    reports: () => [...queryKeys.compliance.all, 'reports'] as const,
  },
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type QueryKeys = typeof queryKeys;
