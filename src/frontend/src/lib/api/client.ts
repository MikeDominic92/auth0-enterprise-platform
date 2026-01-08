import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { ApiError, ApiException } from '@/types';

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// =============================================================================
// Logger
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

const isDevelopment = process.env.NODE_ENV === 'development';

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!isDevelopment && level === 'debug') {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  const prefix = `[API ${level.toUpperCase()}]`;

  switch (level) {
    case 'debug':
      console.debug(prefix, message, data || '');
      break;
    case 'info':
      console.info(prefix, message, data || '');
      break;
    case 'warn':
      console.warn(prefix, message, data || '');
      break;
    case 'error':
      console.error(prefix, message, data || '');
      break;
  }
}

// =============================================================================
// Token Management
// =============================================================================

let accessTokenProvider: (() => Promise<string | null>) | null = null;

/**
 * Set the access token provider function.
 * This should be called during app initialization to provide
 * a function that retrieves the Auth0 access token.
 */
export function setAccessTokenProvider(provider: () => Promise<string | null>): void {
  accessTokenProvider = provider;
}

/**
 * Get the current access token.
 */
async function getAccessToken(): Promise<string | null> {
  if (!accessTokenProvider) {
    log('warn', 'Access token provider not set');
    return null;
  }

  try {
    return await accessTokenProvider();
  } catch (error) {
    log('error', 'Failed to get access token', { error: String(error) });
    return null;
  }
}

// =============================================================================
// Axios Instance
// =============================================================================

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// =============================================================================
// Request Interceptor
// =============================================================================

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const requestId = generateRequestId();
    config.headers['X-Request-ID'] = requestId;

    // Inject access token
    const token = await getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Log request
    log('debug', 'Request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      requestId,
      hasToken: !!token,
    });

    return config;
  },
  (error: AxiosError) => {
    log('error', 'Request interceptor error', { error: error.message });
    return Promise.reject(error);
  }
);

// =============================================================================
// Response Interceptor
// =============================================================================

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const requestId = response.config.headers['X-Request-ID'];

    log('debug', 'Response', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      requestId,
    });

    return response;
  },
  (error: AxiosError<ApiError>) => {
    const requestId = error.config?.headers?.['X-Request-ID'];

    if (error.response) {
      // Server responded with error status
      const apiError = error.response.data;

      log('error', 'API Error', {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: error.response.status,
        errorCode: apiError?.error_code,
        message: apiError?.message,
        requestId,
      });

      // Create standardized API error
      const standardizedError: ApiError = {
        status_code: error.response.status,
        error_code: apiError?.error_code || 'UNKNOWN_ERROR',
        message: apiError?.message || error.message || 'An unknown error occurred',
        details: apiError?.details,
        request_id: requestId as string,
        timestamp: new Date().toISOString(),
      };

      throw new ApiException(standardizedError);
    } else if (error.request) {
      // Request made but no response received
      log('error', 'Network Error', {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        message: 'No response received from server',
        requestId,
      });

      const networkError: ApiError = {
        status_code: 0,
        error_code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your internet connection.',
        request_id: requestId as string,
        timestamp: new Date().toISOString(),
      };

      throw new ApiException(networkError);
    } else {
      // Error in request setup
      log('error', 'Request Setup Error', {
        message: error.message,
        requestId,
      });

      const setupError: ApiError = {
        status_code: 0,
        error_code: 'REQUEST_ERROR',
        message: error.message || 'Failed to make request',
        request_id: requestId as string,
        timestamp: new Date().toISOString(),
      };

      throw new ApiException(setupError);
    }
  }
);

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique request ID for tracking.
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Build query string from params object, filtering out undefined values.
 */
export function buildQueryParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// =============================================================================
// Export
// =============================================================================

export { apiClient };
export default apiClient;
