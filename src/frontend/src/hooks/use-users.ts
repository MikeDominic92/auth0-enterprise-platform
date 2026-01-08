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
  User,
  UserFilters,
  CreateUserRequest,
  UpdateUserRequest,
  AssignRoleRequest,
  UserRole,
  PaginatedResponse,
  ApiSuccessResponse,
  ApiDeleteResponse,
  ApiException,
} from '@/types';

// =============================================================================
// API Functions
// =============================================================================

async function fetchUsers(params?: UserFilters): Promise<PaginatedResponse<User>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<User>>(`/api/v1/users${queryString}`);
  return response.data;
}

async function fetchUser(id: string): Promise<User> {
  const response = await apiClient.get<ApiSuccessResponse<User>>(`/api/v1/users/${id}`);
  return response.data.data;
}

async function createUser(data: CreateUserRequest): Promise<User> {
  const response = await apiClient.post<ApiSuccessResponse<User>>('/api/v1/users', data);
  return response.data.data;
}

async function updateUser(id: string, data: UpdateUserRequest): Promise<User> {
  const response = await apiClient.patch<ApiSuccessResponse<User>>(`/api/v1/users/${id}`, data);
  return response.data.data;
}

async function deleteUser(id: string): Promise<ApiDeleteResponse> {
  const response = await apiClient.delete<ApiDeleteResponse>(`/api/v1/users/${id}`);
  return response.data;
}

async function assignRole(userId: string, role: UserRole): Promise<User> {
  const data: AssignRoleRequest = { role };
  const response = await apiClient.post<ApiSuccessResponse<User>>(
    `/api/v1/users/${userId}/roles`,
    data
  );
  return response.data.data;
}

async function removeRole(userId: string, role: UserRole): Promise<User> {
  const response = await apiClient.delete<ApiSuccessResponse<User>>(
    `/api/v1/users/${userId}/roles/${role}`
  );
  return response.data.data;
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to fetch paginated list of users with optional filters.
 */
export function useUsers(
  params?: UserFilters,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<User>, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<PaginatedResponse<User>, ApiException>({
    queryKey: queryKeys.users.list(params as Record<string, unknown>),
    queryFn: () => fetchUsers(params),
    ...options,
  });
}

/**
 * Hook to fetch a single user by ID.
 */
export function useUser(
  id: string,
  options?: Omit<UseQueryOptions<User, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery<User, ApiException>({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => fetchUser(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook to create a new user.
 */
export function useCreateUser(
  options?: Omit<
    UseMutationOptions<User, ApiException, CreateUserRequest>,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: User, variables: CreateUserRequest) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<User, ApiException, CreateUserRequest>({
    mutationFn: createUser,
    onSuccess: (data, variables) => {
      // Invalidate users list to refetch with new user
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to update an existing user.
 */
export function useUpdateUser(
  options?: Omit<
    UseMutationOptions<
      User,
      ApiException,
      { id: string; data: UpdateUserRequest }
    >,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: User, variables: { id: string; data: UpdateUserRequest }) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<User, ApiException, { id: string; data: UpdateUserRequest }>({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: (data, variables) => {
      // Update the user in cache
      queryClient.setQueryData(queryKeys.users.detail(variables.id), data);
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to delete a user.
 */
export function useDeleteUser(
  options?: Omit<
    UseMutationOptions<ApiDeleteResponse, ApiException, string>,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: ApiDeleteResponse, variables: string) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<ApiDeleteResponse, ApiException, string>({
    mutationFn: deleteUser,
    onSuccess: (data, variables) => {
      // Remove user from cache
      queryClient.removeQueries({ queryKey: queryKeys.users.detail(variables) });
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to assign a role to a user.
 */
export function useAssignRole(
  options?: Omit<
    UseMutationOptions<User, ApiException, { userId: string; role: UserRole }>,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: User, variables: { userId: string; role: UserRole }) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<User, ApiException, { userId: string; role: UserRole }>({
    mutationFn: ({ userId, role }) => assignRole(userId, role),
    onSuccess: (data, variables) => {
      // Update user in cache
      queryClient.setQueryData(queryKeys.users.detail(variables.userId), data);
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to remove a role from a user.
 */
export function useRemoveRole(
  options?: Omit<
    UseMutationOptions<User, ApiException, { userId: string; role: UserRole }>,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: User, variables: { userId: string; role: UserRole }) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<User, ApiException, { userId: string; role: UserRole }>({
    mutationFn: ({ userId, role }) => removeRole(userId, role),
    onSuccess: (data, variables) => {
      // Update user in cache
      queryClient.setQueryData(queryKeys.users.detail(variables.userId), data);
      // Invalidate users list
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}
