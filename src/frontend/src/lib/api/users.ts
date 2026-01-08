import { apiClient, buildQueryParams } from './client';
import {
  User,
  UserRole,
  CreateUserRequest,
  UpdateUserRequest,
  AssignRoleRequest,
  PaginatedResponse,
  UserFilters,
  ApiDeleteResponse,
  ApiSuccessResponse,
} from '@/types';

// =============================================================================
// API Endpoints
// =============================================================================

const USERS_ENDPOINT = '/api/v1/users';

// =============================================================================
// User CRUD Operations
// =============================================================================

/**
 * List all users with optional filtering and pagination.
 */
export async function listUsers(
  filters?: UserFilters
): Promise<PaginatedResponse<User>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<User>>(
    `${USERS_ENDPOINT}${queryString}`
  );
  return response.data;
}

/**
 * Get a single user by ID.
 */
export async function getUser(userId: string): Promise<User> {
  const response = await apiClient.get<User>(`${USERS_ENDPOINT}/${userId}`);
  return response.data;
}

/**
 * Get a user by their Auth0 ID.
 */
export async function getUserByAuth0Id(auth0Id: string): Promise<User> {
  const response = await apiClient.get<User>(
    `${USERS_ENDPOINT}/auth0/${encodeURIComponent(auth0Id)}`
  );
  return response.data;
}

/**
 * Get the currently authenticated user's profile.
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>(`${USERS_ENDPOINT}/me`);
  return response.data;
}

/**
 * Create a new user.
 */
export async function createUser(data: CreateUserRequest): Promise<User> {
  const response = await apiClient.post<User>(USERS_ENDPOINT, data);
  return response.data;
}

/**
 * Update an existing user.
 */
export async function updateUser(
  userId: string,
  data: UpdateUserRequest
): Promise<User> {
  const response = await apiClient.patch<User>(
    `${USERS_ENDPOINT}/${userId}`,
    data
  );
  return response.data;
}

/**
 * Delete a user.
 */
export async function deleteUser(userId: string): Promise<ApiDeleteResponse> {
  const response = await apiClient.delete<ApiDeleteResponse>(
    `${USERS_ENDPOINT}/${userId}`
  );
  return response.data;
}

// =============================================================================
// Role Management
// =============================================================================

/**
 * Assign a role to a user.
 */
export async function assignRole(
  userId: string,
  data: AssignRoleRequest
): Promise<User> {
  const response = await apiClient.post<User>(
    `${USERS_ENDPOINT}/${userId}/roles`,
    data
  );
  return response.data;
}

/**
 * Remove a role from a user.
 */
export async function removeRole(userId: string, role: UserRole): Promise<User> {
  const response = await apiClient.delete<User>(
    `${USERS_ENDPOINT}/${userId}/roles/${role}`
  );
  return response.data;
}

/**
 * Get all roles assigned to a user.
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const response = await apiClient.get<UserRole[]>(
    `${USERS_ENDPOINT}/${userId}/roles`
  );
  return response.data;
}

// =============================================================================
// User Status Management
// =============================================================================

/**
 * Block a user account.
 */
export async function blockUser(
  userId: string,
  reason?: string
): Promise<User> {
  const response = await apiClient.post<User>(
    `${USERS_ENDPOINT}/${userId}/block`,
    { reason }
  );
  return response.data;
}

/**
 * Unblock a user account.
 */
export async function unblockUser(userId: string): Promise<User> {
  const response = await apiClient.post<User>(
    `${USERS_ENDPOINT}/${userId}/unblock`
  );
  return response.data;
}

// =============================================================================
// User Actions
// =============================================================================

/**
 * Send a password reset email to a user.
 */
export async function sendPasswordReset(
  userId: string
): Promise<ApiSuccessResponse<void>> {
  const response = await apiClient.post<ApiSuccessResponse<void>>(
    `${USERS_ENDPOINT}/${userId}/password-reset`
  );
  return response.data;
}

/**
 * Send an email verification to a user.
 */
export async function sendEmailVerification(
  userId: string
): Promise<ApiSuccessResponse<void>> {
  const response = await apiClient.post<ApiSuccessResponse<void>>(
    `${USERS_ENDPOINT}/${userId}/verify-email`
  );
  return response.data;
}

/**
 * Resync user data from Auth0.
 */
export async function resyncUserFromAuth0(userId: string): Promise<User> {
  const response = await apiClient.post<User>(
    `${USERS_ENDPOINT}/${userId}/resync`
  );
  return response.data;
}

// =============================================================================
// Bulk Operations
// =============================================================================

/**
 * Bulk update user statuses.
 */
export async function bulkUpdateStatus(
  userIds: string[],
  status: 'active' | 'inactive' | 'blocked'
): Promise<ApiSuccessResponse<{ updated_count: number }>> {
  const response = await apiClient.post<ApiSuccessResponse<{ updated_count: number }>>(
    `${USERS_ENDPOINT}/bulk/status`,
    { user_ids: userIds, status }
  );
  return response.data;
}

/**
 * Bulk assign roles to users.
 */
export async function bulkAssignRole(
  userIds: string[],
  role: UserRole
): Promise<ApiSuccessResponse<{ updated_count: number }>> {
  const response = await apiClient.post<ApiSuccessResponse<{ updated_count: number }>>(
    `${USERS_ENDPOINT}/bulk/roles`,
    { user_ids: userIds, role }
  );
  return response.data;
}

// =============================================================================
// Export all functions
// =============================================================================

export const usersApi = {
  // CRUD
  list: listUsers,
  get: getUser,
  getByAuth0Id: getUserByAuth0Id,
  getCurrent: getCurrentUser,
  create: createUser,
  update: updateUser,
  delete: deleteUser,

  // Roles
  assignRole,
  removeRole,
  getRoles: getUserRoles,

  // Status
  block: blockUser,
  unblock: unblockUser,

  // Actions
  sendPasswordReset,
  sendEmailVerification,
  resync: resyncUserFromAuth0,

  // Bulk
  bulkUpdateStatus,
  bulkAssignRole,
};

export default usersApi;
