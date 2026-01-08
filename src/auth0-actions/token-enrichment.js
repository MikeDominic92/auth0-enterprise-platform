/**
 * Auth0 Post-Login Action: Token Enrichment
 *
 * This action executes after successful authentication to enrich tokens with:
 * - User's team memberships from external database
 * - Permissions based on teams and roles (RBAC)
 * - Custom claims: teams, permissions, org_id, department
 * - Geographic restrictions for compliance
 * - Risk score for downstream authorization decisions
 *
 * Dependencies (configure in Auth0 Action secrets):
 * - DATABASE_API_URL: URL for user/team database API
 * - DATABASE_API_KEY: API key for database access
 * - PERMISSIONS_SERVICE_URL: URL for permissions/RBAC service
 * - PERMISSIONS_API_KEY: API key for permissions service
 * - ALLOWED_COUNTRIES: Comma-separated list of allowed country codes
 * - RESTRICTED_DATA_COUNTRIES: Countries that cannot access restricted data
 *
 * Token Namespace: https://yourapp.com/ (customize for your domain)
 *
 * @param {Event} event - Auth0 event object containing user and context
 * @param {API} api - Auth0 API object for modifying tokens
 */
exports.onExecutePostLogin = async (event, api) => {
  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------
  /**
   * Validate token namespace format
   * Must be a valid URL to prevent claim collisions
   */
  function validateNamespace(namespace) {
    if (!namespace) return false;
    try {
      const url = new URL(namespace);
      return url.protocol === 'https:' && namespace.endsWith('/');
    } catch {
      return false;
    }
  }

  const CONFIG = {
    // Token namespace from secrets - MUST be a valid HTTPS URL you control
    // This prevents collision with standard claims
    NAMESPACE: validateNamespace(event.secrets.TOKEN_NAMESPACE)
      ? event.secrets.TOKEN_NAMESPACE
      : 'https://yourapp.com/',

    // Geographic restrictions
    // Leave empty or null to allow all countries
    ALLOWED_COUNTRIES: event.secrets.ALLOWED_COUNTRIES?.split(',').map(c => c.trim()) || null,

    // Countries with data access restrictions (GDPR, data sovereignty, etc.)
    RESTRICTED_DATA_COUNTRIES: event.secrets.RESTRICTED_DATA_COUNTRIES?.split(',').map(c => c.trim()) || [],

    // Cache TTL for external API responses (milliseconds)
    CACHE_TTL_MS: 300000, // 5 minutes

    // Maximum number of teams to include in token (prevent token bloat)
    MAX_TEAMS_IN_TOKEN: 50,

    // Maximum number of permissions to include in token
    MAX_PERMISSIONS_IN_TOKEN: parseInt(event.secrets.MAX_PERMISSIONS_IN_TOKEN) || 100,

    // Risk score thresholds for token claims
    RISK_SCORE_HIGH: parseInt(event.secrets.RISK_SCORE_HIGH) || 70,
    RISK_SCORE_MEDIUM: parseInt(event.secrets.RISK_SCORE_MEDIUM) || 40,

    // Request timeout for external API calls (milliseconds)
    REQUEST_TIMEOUT_MS: parseInt(event.secrets.REQUEST_TIMEOUT_MS) || 5000,

    // Scope-to-claims mapping - only include claims if scope is present
    // Format in secrets: scope:claim1,claim2;scope2:claim3,claim4
    SCOPE_CLAIM_MAPPING: parseScopeClaimMapping(event.secrets.SCOPE_CLAIM_MAPPING),

    // Flag to indicate when permissions are truncated
    TRUNCATION_WARNING_ENABLED: event.secrets.TRUNCATION_WARNING_ENABLED !== 'false'
  };

  /**
   * Parse scope-to-claims mapping from secrets
   * Format: scope:claim1,claim2;scope2:claim3,claim4
   */
  function parseScopeClaimMapping(mappingString) {
    if (!mappingString) {
      // Default scope-claim mapping
      return {
        'openid': ['sub'],
        'profile': ['name', 'nickname', 'picture'],
        'email': ['email', 'email_verified'],
        'org': ['org_id', 'org_name', 'org_tier'],
        'teams': ['teams', 'team_ids'],
        'permissions': ['permissions', 'roles'],
        'department': ['department', 'department_id'],
        'risk': ['risk_score', 'risk_level']
      };
    }
    const mapping = {};
    mappingString.split(';').forEach(entry => {
      const [scope, claims] = entry.trim().split(':');
      if (scope && claims) {
        mapping[scope.trim()] = claims.split(',').map(c => c.trim());
      }
    });
    return mapping;
  }

  /**
   * Filter claims based on requested scopes
   * Only include claims that the client has permission to access
   */
  function filterClaimsByScope(claims, requestedScopes) {
    if (!requestedScopes || requestedScopes.length === 0) {
      return claims; // No filtering if no scopes specified
    }

    const allowedClaims = new Set();
    requestedScopes.forEach(scope => {
      const scopeClaims = CONFIG.SCOPE_CLAIM_MAPPING[scope] || [];
      scopeClaims.forEach(claim => allowedClaims.add(claim));
    });

    // Always allow certain base claims
    ['org_id', 'roles'].forEach(c => allowedClaims.add(c));

    const filteredClaims = {};
    Object.keys(claims).forEach(key => {
      if (allowedClaims.has(key)) {
        filteredClaims[key] = claims[key];
      }
    });

    return filteredClaims;
  }

  // ---------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // ---------------------------------------------------------------------------

  /**
   * Fetch user's team memberships from external database/API
   * Returns array of team objects with id, name, and role within team
   */
  async function fetchUserTeams(userId, orgId) {
    const endpoint = event.secrets.DATABASE_API_URL;
    const apiKey = event.secrets.DATABASE_API_KEY;

    if (!endpoint) {
      console.log('[TEAMS] No database API configured, using metadata');
      // Fallback to app_metadata if no external service
      return event.user.app_metadata?.teams || [];
    }

    try {
      const response = await fetch(`${endpoint}/users/${userId}/teams?org_id=${orgId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Request-Source': 'auth0-token-enrichment',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[TEAMS] Failed to fetch teams:', response.status);
        return event.user.app_metadata?.teams || [];
      }

      const data = await response.json();

      // Validate and sanitize team data
      const teams = (data.teams || []).map(team => ({
        id: team.id,
        name: team.name,
        role: team.role || 'member',
        // Include hierarchy information if available
        parent_team_id: team.parent_team_id || null,
        // Team-specific permissions
        team_permissions: team.permissions || []
      }));

      console.log('[TEAMS] Fetched', teams.length, 'teams for user');
      return teams.slice(0, CONFIG.MAX_TEAMS_IN_TOKEN);

    } catch (error) {
      console.error('[TEAMS] Error fetching teams:', error.message);
      return event.user.app_metadata?.teams || [];
    }
  }

  /**
   * Fetch permissions based on user's roles and team memberships
   * Implements role-based access control (RBAC) with team-level overrides
   */
  async function fetchPermissions(userId, orgId, roles, teams) {
    const endpoint = event.secrets.PERMISSIONS_SERVICE_URL;
    const apiKey = event.secrets.PERMISSIONS_API_KEY;

    if (!endpoint) {
      console.log('[PERMISSIONS] No permissions service configured, using defaults');
      return buildDefaultPermissions(roles, teams);
    }

    try {
      const response = await fetch(`${endpoint}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Request-Source': 'auth0-token-enrichment',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          org_id: orgId,
          roles: roles,
          team_ids: teams.map(t => t.id),
          // Include context for conditional permissions
          context: {
            ip_address: event.request?.ip,
            country: event.request?.geoip?.countryCode,
            time: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        console.error('[PERMISSIONS] Failed to resolve permissions:', response.status);
        return buildDefaultPermissions(roles, teams);
      }

      const data = await response.json();

      // Flatten and deduplicate permissions
      const permissions = [...new Set(data.permissions || [])];

      console.log('[PERMISSIONS] Resolved', permissions.length, 'permissions');
      return permissions.slice(0, CONFIG.MAX_PERMISSIONS_IN_TOKEN);

    } catch (error) {
      console.error('[PERMISSIONS] Error resolving permissions:', error.message);
      return buildDefaultPermissions(roles, teams);
    }
  }

  /**
   * Build default permissions based on roles and teams when external service unavailable
   * This is a fallback - production should use the permissions service
   */
  function buildDefaultPermissions(roles, teams) {
    const permissions = new Set();

    // Role-based default permissions
    const rolePermissionMap = {
      admin: [
        'read:users', 'write:users', 'delete:users',
        'read:teams', 'write:teams', 'delete:teams',
        'read:settings', 'write:settings',
        'read:reports', 'write:reports',
        'read:audit_logs'
      ],
      manager: [
        'read:users', 'write:users',
        'read:teams', 'write:teams',
        'read:reports', 'write:reports'
      ],
      developer: [
        'read:api', 'write:api',
        'read:logs', 'read:metrics',
        'write:deployments'
      ],
      analyst: [
        'read:reports', 'read:analytics',
        'export:data', 'read:dashboards'
      ],
      user: [
        'read:profile', 'write:profile',
        'read:notifications'
      ]
    };

    // Add permissions for each role
    roles.forEach(role => {
      const rolePerms = rolePermissionMap[role] || rolePermissionMap.user;
      rolePerms.forEach(perm => permissions.add(perm));
    });

    // Add team-specific permissions
    teams.forEach(team => {
      // Team leads get additional permissions
      if (team.role === 'lead' || team.role === 'owner') {
        permissions.add(`team:${team.id}:manage`);
        permissions.add(`team:${team.id}:invite`);
      }
      // All team members get base team permissions
      permissions.add(`team:${team.id}:read`);
      permissions.add(`team:${team.id}:write`);

      // Include any team-specific permissions
      (team.team_permissions || []).forEach(perm => permissions.add(perm));
    });

    return Array.from(permissions);
  }

  /**
   * Fetch user's department and organizational hierarchy
   */
  async function fetchDepartmentInfo(userId, orgId) {
    const endpoint = event.secrets.DATABASE_API_URL;
    const apiKey = event.secrets.DATABASE_API_KEY;

    if (!endpoint) {
      console.log('[DEPARTMENT] No database API configured, using metadata');
      return {
        department_id: event.user.app_metadata?.department_id || null,
        department_name: event.user.app_metadata?.department_name || null,
        manager_id: event.user.app_metadata?.manager_id || null,
        cost_center: event.user.app_metadata?.cost_center || null
      };
    }

    try {
      const response = await fetch(`${endpoint}/users/${userId}/department?org_id=${orgId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.log('[DEPARTMENT] Failed to fetch department info:', response.status);
        return null;
      }

      const data = await response.json();
      return {
        department_id: data.department_id,
        department_name: data.department_name,
        manager_id: data.manager_id,
        cost_center: data.cost_center,
        division: data.division,
        location: data.location
      };

    } catch (error) {
      console.error('[DEPARTMENT] Error fetching department:', error.message);
      return null;
    }
  }

  /**
   * Evaluate geographic restrictions
   * Returns restriction flags based on user's current location
   */
  function evaluateGeoRestrictions(countryCode) {
    const restrictions = {
      is_allowed_country: true,
      restricted_data_access: false,
      geo_block_reason: null
    };

    // Check if country is in allowed list (if list is configured)
    if (CONFIG.ALLOWED_COUNTRIES && CONFIG.ALLOWED_COUNTRIES.length > 0) {
      if (!CONFIG.ALLOWED_COUNTRIES.includes(countryCode)) {
        restrictions.is_allowed_country = false;
        restrictions.geo_block_reason = 'country_not_allowed';
      }
    }

    // Check if country has restricted data access
    if (CONFIG.RESTRICTED_DATA_COUNTRIES.includes(countryCode)) {
      restrictions.restricted_data_access = true;
    }

    return restrictions;
  }

  /**
   * Calculate risk level for token (simplified version)
   * Full risk assessment should be in on-login.js
   */
  function calculateTokenRiskLevel(event) {
    let riskScore = event.user.app_metadata?.last_risk_score || 0;
    let riskLevel = 'low';

    // Adjust based on current context
    const isNewDevice = !event.user.app_metadata?.known_devices?.includes(event.request?.ip);
    const isNewCountry = event.request?.geoip?.countryCode !== event.user.app_metadata?.last_login_country;

    if (isNewDevice) riskScore += 10;
    if (isNewCountry) riskScore += 15;

    // Determine risk level
    if (riskScore >= CONFIG.RISK_SCORE_HIGH) {
      riskLevel = 'high';
    } else if (riskScore >= CONFIG.RISK_SCORE_MEDIUM) {
      riskLevel = 'medium';
    }

    return {
      score: Math.min(riskScore, 100),
      level: riskLevel
    };
  }

  // ---------------------------------------------------------------------------
  // MAIN EXECUTION
  // ---------------------------------------------------------------------------

  try {
    console.log('[TOKEN] Enriching token for user:', event.user.user_id);

    // Get organization ID from user metadata
    const orgId = event.user.app_metadata?.org_id || 'default';
    const roles = event.user.app_metadata?.roles || ['user'];

    // Step 1: Evaluate geographic restrictions first
    // If blocked, we should deny access rather than enrich the token
    const countryCode = event.request?.geoip?.countryCode;
    const geoRestrictions = evaluateGeoRestrictions(countryCode);

    if (!geoRestrictions.is_allowed_country) {
      console.log('[GEO] Access denied - country not allowed:', countryCode);
      api.access.deny('Access denied from your current location. Please contact support.');
      return;
    }

    // Step 2: Fetch external data in parallel for efficiency
    const [teams, departmentInfo] = await Promise.all([
      fetchUserTeams(event.user.user_id, orgId),
      fetchDepartmentInfo(event.user.user_id, orgId)
    ]);

    // Step 3: Resolve permissions based on roles and teams
    let permissions = await fetchPermissions(event.user.user_id, orgId, roles, teams);

    // Check if permissions were truncated
    const permissionsTruncated = permissions.length >= CONFIG.MAX_PERMISSIONS_IN_TOKEN;

    // Step 4: Calculate risk level for token
    const risk = calculateTokenRiskLevel(event);

    // Step 5: Build custom claims for ID token
    // ID Token is for the client application
    const idTokenClaims = {
      // Organization context
      org_id: orgId,
      org_name: event.user.app_metadata?.org_name,
      org_tier: event.user.app_metadata?.org_tier,

      // User's roles (array)
      roles: roles,

      // Team memberships (simplified for ID token)
      teams: teams.map(t => ({
        id: t.id,
        name: t.name,
        role: t.role
      })),

      // Department information
      department: departmentInfo ? {
        id: departmentInfo.department_id,
        name: departmentInfo.department_name,
        cost_center: departmentInfo.cost_center
      } : null,

      // Risk information for UI decisions
      risk_level: risk.level,

      // Geographic context
      geo: {
        country: countryCode,
        restricted_data: geoRestrictions.restricted_data_access
      }
    };

    // Step 6: Build custom claims for Access Token
    // Access Token is for API authorization
    const accessTokenClaims = {
      // Organization context (needed for API authorization)
      org_id: orgId,
      org_tier: event.user.app_metadata?.org_tier,

      // Resolved permissions (for API authorization)
      permissions: permissions,

      // Roles (for coarse-grained authorization)
      roles: roles,

      // Team IDs (for resource filtering)
      team_ids: teams.map(t => t.id),

      // Department ID (for data filtering)
      department_id: departmentInfo?.department_id,

      // Risk score (for conditional access policies)
      risk_score: risk.score,
      risk_level: risk.level,

      // Geographic restrictions flag
      restricted_data_access: geoRestrictions.restricted_data_access,

      // Session metadata for audit
      session: {
        ip: event.request?.ip,
        country: countryCode,
        mfa_completed: event.authentication?.methods?.some(m => m.name === 'mfa') || false
      },

      // Truncation warning flag (when permissions exceed limit)
      permissions_truncated: CONFIG.TRUNCATION_WARNING_ENABLED && permissionsTruncated
    };

    // Step 6.5: Filter claims based on requested scopes
    const requestedScopes = event.request?.query?.scope?.split(' ') ||
                           event.transaction?.requested_scopes || [];
    const filteredIdTokenClaims = filterClaimsByScope(idTokenClaims, requestedScopes);
    const filteredAccessTokenClaims = filterClaimsByScope(accessTokenClaims, requestedScopes);

    // Step 7: Set ID token claims (scope-filtered)
    Object.entries(filteredIdTokenClaims).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        api.idToken.setCustomClaim(`${CONFIG.NAMESPACE}${key}`, value);
      }
    });

    // Step 8: Set Access token claims (scope-filtered)
    Object.entries(filteredAccessTokenClaims).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        api.accessToken.setCustomClaim(`${CONFIG.NAMESPACE}${key}`, value);
      }
    });

    // Step 9: Set standard claims if not already set
    // These are useful for downstream services
    if (!event.user.name && (event.user.given_name || event.user.family_name)) {
      api.idToken.setCustomClaim('name',
        `${event.user.given_name || ''} ${event.user.family_name || ''}`.trim()
      );
    }

    // Step 10: Log enrichment summary
    console.log('[TOKEN] Enrichment complete:', {
      org_id: orgId,
      roles_count: roles.length,
      teams_count: teams.length,
      permissions_count: permissions.length,
      risk_level: risk.level,
      restricted_data: geoRestrictions.restricted_data_access
    });

  } catch (error) {
    // Log error but allow authentication to proceed
    // Token will just have fewer custom claims
    console.error('[ERROR] Token enrichment failed:', error.message);

    // Set minimal claims so downstream doesn't break
    try {
      const orgId = event.user.app_metadata?.org_id || 'default';
      const roles = event.user.app_metadata?.roles || ['user'];

      api.idToken.setCustomClaim(`${CONFIG.NAMESPACE}org_id`, orgId);
      api.idToken.setCustomClaim(`${CONFIG.NAMESPACE}roles`, roles);
      api.accessToken.setCustomClaim(`${CONFIG.NAMESPACE}org_id`, orgId);
      api.accessToken.setCustomClaim(`${CONFIG.NAMESPACE}roles`, roles);
      api.accessToken.setCustomClaim(`${CONFIG.NAMESPACE}permissions`, ['read:profile']);

      // Flag that enrichment was partial
      api.idToken.setCustomClaim(`${CONFIG.NAMESPACE}enrichment_partial`, true);
      api.accessToken.setCustomClaim(`${CONFIG.NAMESPACE}enrichment_partial`, true);
    } catch (fallbackError) {
      console.error('[ERROR] Fallback claim setting failed:', fallbackError.message);
    }
  }
};

/**
 * Utility: Validate and sanitize permission strings
 * Prevents injection of malicious permission values
 */
function sanitizePermission(permission) {
  if (typeof permission !== 'string') return null;

  // Only allow alphanumeric, colons, and underscores
  const sanitized = permission.replace(/[^a-zA-Z0-9:_-]/g, '');

  // Max length check
  if (sanitized.length > 100) return null;

  return sanitized;
}

/**
 * Utility: Validate team ID format
 */
function isValidTeamId(teamId) {
  if (typeof teamId !== 'string') return false;

  // Team IDs should be alphanumeric with optional dashes/underscores
  return /^[a-zA-Z0-9_-]{1,50}$/.test(teamId);
}
