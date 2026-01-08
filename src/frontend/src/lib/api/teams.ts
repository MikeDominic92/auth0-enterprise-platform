import { apiClient, buildQueryParams } from './client';
import {
  Team,
  TeamWithMembers,
  TeamMember,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
  UpdateTeamMemberRequest,
  PaginatedResponse,
  TeamFilters,
  TeamMemberFilters,
  ApiDeleteResponse,
} from '@/types';

// =============================================================================
// API Endpoints
// =============================================================================

const TEAMS_ENDPOINT = '/api/v1/teams';

// =============================================================================
// Team CRUD Operations
// =============================================================================

/**
 * List all teams with optional filtering and pagination.
 */
export async function listTeams(
  filters?: TeamFilters
): Promise<PaginatedResponse<Team>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<Team>>(
    `${TEAMS_ENDPOINT}${queryString}`
  );
  return response.data;
}

/**
 * Get a single team by ID.
 */
export async function getTeam(teamId: string): Promise<Team> {
  const response = await apiClient.get<Team>(`${TEAMS_ENDPOINT}/${teamId}`);
  return response.data;
}

/**
 * Get a team with all its members.
 */
export async function getTeamWithMembers(teamId: string): Promise<TeamWithMembers> {
  const response = await apiClient.get<TeamWithMembers>(
    `${TEAMS_ENDPOINT}/${teamId}?include_members=true`
  );
  return response.data;
}

/**
 * Create a new team.
 */
export async function createTeam(data: CreateTeamRequest): Promise<Team> {
  const response = await apiClient.post<Team>(TEAMS_ENDPOINT, data);
  return response.data;
}

/**
 * Update an existing team.
 */
export async function updateTeam(
  teamId: string,
  data: UpdateTeamRequest
): Promise<Team> {
  const response = await apiClient.patch<Team>(
    `${TEAMS_ENDPOINT}/${teamId}`,
    data
  );
  return response.data;
}

/**
 * Delete a team.
 */
export async function deleteTeam(teamId: string): Promise<ApiDeleteResponse> {
  const response = await apiClient.delete<ApiDeleteResponse>(
    `${TEAMS_ENDPOINT}/${teamId}`
  );
  return response.data;
}

/**
 * Archive a team (soft delete).
 */
export async function archiveTeam(teamId: string): Promise<Team> {
  const response = await apiClient.post<Team>(
    `${TEAMS_ENDPOINT}/${teamId}/archive`
  );
  return response.data;
}

/**
 * Restore an archived team.
 */
export async function restoreTeam(teamId: string): Promise<Team> {
  const response = await apiClient.post<Team>(
    `${TEAMS_ENDPOINT}/${teamId}/restore`
  );
  return response.data;
}

// =============================================================================
// Team Member Operations
// =============================================================================

/**
 * List all members of a team.
 */
export async function listMembers(
  teamId: string,
  filters?: TeamMemberFilters
): Promise<PaginatedResponse<TeamMember>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<TeamMember>>(
    `${TEAMS_ENDPOINT}/${teamId}/members${queryString}`
  );
  return response.data;
}

/**
 * Get a specific team member.
 */
export async function getMember(
  teamId: string,
  memberId: string
): Promise<TeamMember> {
  const response = await apiClient.get<TeamMember>(
    `${TEAMS_ENDPOINT}/${teamId}/members/${memberId}`
  );
  return response.data;
}

/**
 * Add a member to a team.
 */
export async function addMember(
  teamId: string,
  data: AddTeamMemberRequest
): Promise<TeamMember> {
  const response = await apiClient.post<TeamMember>(
    `${TEAMS_ENDPOINT}/${teamId}/members`,
    data
  );
  return response.data;
}

/**
 * Remove a member from a team.
 */
export async function removeMember(
  teamId: string,
  memberId: string
): Promise<ApiDeleteResponse> {
  const response = await apiClient.delete<ApiDeleteResponse>(
    `${TEAMS_ENDPOINT}/${teamId}/members/${memberId}`
  );
  return response.data;
}

/**
 * Update a team member's role.
 */
export async function updateMemberRole(
  teamId: string,
  memberId: string,
  data: UpdateTeamMemberRequest
): Promise<TeamMember> {
  const response = await apiClient.patch<TeamMember>(
    `${TEAMS_ENDPOINT}/${teamId}/members/${memberId}`,
    data
  );
  return response.data;
}

// =============================================================================
// Team Queries
// =============================================================================

/**
 * Get teams that a user belongs to.
 */
export async function getUserTeams(
  userId: string,
  filters?: TeamFilters
): Promise<PaginatedResponse<Team>> {
  const queryString = filters ? buildQueryParams(filters as Record<string, unknown>) : '';
  const response = await apiClient.get<PaginatedResponse<Team>>(
    `/api/v1/users/${userId}/teams${queryString}`
  );
  return response.data;
}

/**
 * Get teams owned by a user.
 */
export async function getOwnedTeams(
  userId: string,
  filters?: TeamFilters
): Promise<PaginatedResponse<Team>> {
  const params = { ...filters, owner_id: userId };
  const queryString = buildQueryParams(params as Record<string, unknown>);
  const response = await apiClient.get<PaginatedResponse<Team>>(
    `${TEAMS_ENDPOINT}${queryString}`
  );
  return response.data;
}

/**
 * Check if a user is a member of a team.
 */
export async function checkMembership(
  teamId: string,
  userId: string
): Promise<{ is_member: boolean; role?: string }> {
  const response = await apiClient.get<{ is_member: boolean; role?: string }>(
    `${TEAMS_ENDPOINT}/${teamId}/members/${userId}/check`
  );
  return response.data;
}

// =============================================================================
// Bulk Operations
// =============================================================================

/**
 * Add multiple members to a team.
 */
export async function bulkAddMembers(
  teamId: string,
  members: AddTeamMemberRequest[]
): Promise<{ added_count: number; members: TeamMember[] }> {
  const response = await apiClient.post<{ added_count: number; members: TeamMember[] }>(
    `${TEAMS_ENDPOINT}/${teamId}/members/bulk`,
    { members }
  );
  return response.data;
}

/**
 * Remove multiple members from a team.
 */
export async function bulkRemoveMembers(
  teamId: string,
  memberIds: string[]
): Promise<{ removed_count: number }> {
  const response = await apiClient.delete<{ removed_count: number }>(
    `${TEAMS_ENDPOINT}/${teamId}/members/bulk`,
    { data: { member_ids: memberIds } }
  );
  return response.data;
}

// =============================================================================
// Transfer Ownership
// =============================================================================

/**
 * Transfer team ownership to another member.
 */
export async function transferOwnership(
  teamId: string,
  newOwnerId: string
): Promise<Team> {
  const response = await apiClient.post<Team>(
    `${TEAMS_ENDPOINT}/${teamId}/transfer-ownership`,
    { new_owner_id: newOwnerId }
  );
  return response.data;
}

// =============================================================================
// Export all functions
// =============================================================================

export const teamsApi = {
  // CRUD
  list: listTeams,
  get: getTeam,
  getWithMembers: getTeamWithMembers,
  create: createTeam,
  update: updateTeam,
  delete: deleteTeam,
  archive: archiveTeam,
  restore: restoreTeam,

  // Members
  listMembers,
  getMember,
  addMember,
  removeMember,
  updateMemberRole,

  // Queries
  getUserTeams,
  getOwnedTeams,
  checkMembership,

  // Bulk
  bulkAddMembers,
  bulkRemoveMembers,

  // Ownership
  transferOwnership,
};

export default teamsApi;
