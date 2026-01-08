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
  Team,
  TeamWithMembers,
  TeamMember,
  TeamFilters,
  TeamMemberFilters,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
  UpdateTeamMemberRequest,
  TeamMemberRole,
  PaginatedResponse,
  ApiSuccessResponse,
  ApiDeleteResponse,
  ApiException,
} from '@/types';

// =============================================================================
// API Functions
// =============================================================================

async function fetchTeams(params?: TeamFilters): Promise<PaginatedResponse<Team>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<Team>>(`/api/v1/teams${queryString}`);
  return response.data;
}

async function fetchTeam(id: string): Promise<TeamWithMembers> {
  const response = await apiClient.get<ApiSuccessResponse<TeamWithMembers>>(`/api/v1/teams/${id}`);
  return response.data.data;
}

async function fetchTeamMembers(
  teamId: string,
  params?: TeamMemberFilters
): Promise<PaginatedResponse<TeamMember>> {
  const queryString = params ? buildQueryParams(params as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<TeamMember>>(
    `/api/v1/teams/${teamId}/members${queryString}`
  );
  return response.data;
}

async function createTeam(data: CreateTeamRequest): Promise<Team> {
  const response = await apiClient.post<ApiSuccessResponse<Team>>('/api/v1/teams', data);
  return response.data.data;
}

async function updateTeam(id: string, data: UpdateTeamRequest): Promise<Team> {
  const response = await apiClient.patch<ApiSuccessResponse<Team>>(`/api/v1/teams/${id}`, data);
  return response.data.data;
}

async function deleteTeam(id: string): Promise<ApiDeleteResponse> {
  const response = await apiClient.delete<ApiDeleteResponse>(`/api/v1/teams/${id}`);
  return response.data;
}

async function addTeamMember(
  teamId: string,
  data: AddTeamMemberRequest
): Promise<TeamMember> {
  const response = await apiClient.post<ApiSuccessResponse<TeamMember>>(
    `/api/v1/teams/${teamId}/members`,
    data
  );
  return response.data.data;
}

async function updateTeamMember(
  teamId: string,
  userId: string,
  data: UpdateTeamMemberRequest
): Promise<TeamMember> {
  const response = await apiClient.patch<ApiSuccessResponse<TeamMember>>(
    `/api/v1/teams/${teamId}/members/${userId}`,
    data
  );
  return response.data.data;
}

async function removeTeamMember(teamId: string, userId: string): Promise<ApiDeleteResponse> {
  const response = await apiClient.delete<ApiDeleteResponse>(
    `/api/v1/teams/${teamId}/members/${userId}`
  );
  return response.data;
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Hook to fetch paginated list of teams with optional filters.
 */
export function useTeams(
  params?: TeamFilters,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<Team>, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<PaginatedResponse<Team>, ApiException>({
    queryKey: queryKeys.teams.list(params as Record<string, unknown>),
    queryFn: () => fetchTeams(params),
    ...options,
  });
}

/**
 * Hook to fetch a single team by ID (includes members).
 */
export function useTeam(
  id: string,
  options?: Omit<UseQueryOptions<TeamWithMembers, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TeamWithMembers, ApiException>({
    queryKey: queryKeys.teams.detail(id),
    queryFn: () => fetchTeam(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to fetch team members with optional filters and pagination.
 */
export function useTeamMembers(
  teamId: string,
  params?: TeamMemberFilters,
  options?: Omit<
    UseQueryOptions<PaginatedResponse<TeamMember>, ApiException>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<PaginatedResponse<TeamMember>, ApiException>({
    queryKey: [...queryKeys.teams.members(teamId), params] as const,
    queryFn: () => fetchTeamMembers(teamId, params),
    enabled: !!teamId,
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook to create a new team.
 */
export function useCreateTeam(
  options?: Omit<
    UseMutationOptions<Team, ApiException, CreateTeamRequest>,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: Team, variables: CreateTeamRequest) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<Team, ApiException, CreateTeamRequest>({
    mutationFn: createTeam,
    onSuccess: (data, variables) => {
      // Invalidate teams list to refetch with new team
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to update an existing team.
 */
export function useUpdateTeam(
  options?: Omit<
    UseMutationOptions<
      Team,
      ApiException,
      { id: string; data: UpdateTeamRequest }
    >,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: Team, variables: { id: string; data: UpdateTeamRequest }) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<Team, ApiException, { id: string; data: UpdateTeamRequest }>({
    mutationFn: ({ id, data }) => updateTeam(id, data),
    onSuccess: (data, variables) => {
      // Invalidate the team detail (it includes members, so we need to refetch)
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(variables.id) });
      // Invalidate teams list
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to delete a team.
 */
export function useDeleteTeam(
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
    mutationFn: deleteTeam,
    onSuccess: (data, variables) => {
      // Remove team from cache
      queryClient.removeQueries({ queryKey: queryKeys.teams.detail(variables) });
      // Invalidate teams list
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to add a member to a team.
 */
export function useAddMember(
  options?: Omit<
    UseMutationOptions<
      TeamMember,
      ApiException,
      { teamId: string; data: AddTeamMemberRequest }
    >,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: TeamMember, variables: { teamId: string; data: AddTeamMemberRequest }) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<
    TeamMember,
    ApiException,
    { teamId: string; data: AddTeamMemberRequest }
  >({
    mutationFn: ({ teamId, data }) => addTeamMember(teamId, data),
    onSuccess: (data, variables) => {
      // Invalidate team detail (includes members)
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(variables.teamId) });
      // Invalidate team members list
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(variables.teamId) });
      // Invalidate teams list (member count may have changed)
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to update a team member's role.
 */
export function useUpdateMember(
  options?: Omit<
    UseMutationOptions<
      TeamMember,
      ApiException,
      { teamId: string; userId: string; role: TeamMemberRole }
    >,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: TeamMember, variables: { teamId: string; userId: string; role: TeamMemberRole }) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<
    TeamMember,
    ApiException,
    { teamId: string; userId: string; role: TeamMemberRole }
  >({
    mutationFn: ({ teamId, userId, role }) =>
      updateTeamMember(teamId, userId, { role }),
    onSuccess: (data, variables) => {
      // Invalidate team detail
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(variables.teamId) });
      // Invalidate team members list
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(variables.teamId) });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}

/**
 * Hook to remove a member from a team.
 */
export function useRemoveMember(
  options?: Omit<
    UseMutationOptions<
      ApiDeleteResponse,
      ApiException,
      { teamId: string; userId: string }
    >,
    'mutationFn' | 'onSuccess'
  > & {
    onSuccess?: (data: ApiDeleteResponse, variables: { teamId: string; userId: string }) => void;
  }
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restOptions } = options ?? {};

  return useMutation<ApiDeleteResponse, ApiException, { teamId: string; userId: string }>({
    mutationFn: ({ teamId, userId }) => removeTeamMember(teamId, userId),
    onSuccess: (data, variables) => {
      // Invalidate team detail
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(variables.teamId) });
      // Invalidate team members list
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(variables.teamId) });
      // Invalidate teams list (member count may have changed)
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.lists() });
      onSuccess?.(data, variables);
    },
    ...restOptions,
  });
}
