/**
 * Auth0 Post-Registration Action: User Onboarding and Provisioning
 *
 * This action executes after a new user successfully registers to perform:
 * - Organization assignment based on email domain or signup context
 * - Default role assignment based on organization policies
 * - Welcome notification trigger to external systems
 * - Initial audit log entry for compliance tracking
 *
 * Dependencies (configure in Auth0 Action secrets):
 * - AUDIT_LOG_ENDPOINT: URL for audit log service
 * - AUDIT_LOG_API_KEY: API key for audit service authentication
 * - NOTIFICATION_SERVICE_URL: URL for notification/email service
 * - NOTIFICATION_API_KEY: API key for notification service
 * - PROVISIONING_API_URL: URL for user provisioning service
 * - PROVISIONING_API_KEY: API key for provisioning service
 * - DEFAULT_ORG_ID: Default organization ID for users without domain mapping
 *
 * @param {Event} event - Auth0 event object containing user and context
 * @param {API} api - Auth0 API object for modifying user data
 */
exports.onExecutePostUserRegistration = async (event, api) => {
  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------
  const CONFIG = {
    // Default organization for users without domain mapping
    DEFAULT_ORG_ID: event.secrets.DEFAULT_ORG_ID || 'org_default',

    // Email domain to organization mapping
    // In production, this would typically come from a database or external service
    DOMAIN_ORG_MAPPING: {
      'acme.com': { org_id: 'org_acme', org_name: 'Acme Corporation', tier: 'enterprise' },
      'techstartup.io': { org_id: 'org_techstartup', org_name: 'Tech Startup Inc', tier: 'professional' },
      'university.edu': { org_id: 'org_university', org_name: 'State University', tier: 'education' }
    },

    // Default roles by organization tier
    DEFAULT_ROLES_BY_TIER: {
      enterprise: ['user', 'analytics_viewer'],
      professional: ['user'],
      education: ['user', 'student'],
      free: ['user']
    },

    // Roles that should trigger additional provisioning
    ROLES_REQUIRING_PROVISIONING: ['admin', 'developer', 'api_user'],

    // Welcome email template identifiers
    WELCOME_TEMPLATES: {
      enterprise: 'welcome_enterprise_v2',
      professional: 'welcome_professional_v2',
      education: 'welcome_education_v2',
      free: 'welcome_free_v2'
    }
  };

  // ---------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // ---------------------------------------------------------------------------

  /**
   * Extract email domain from user's email address
   */
  function getEmailDomain(email) {
    if (!email || typeof email !== 'string') return null;
    const parts = email.toLowerCase().split('@');
    return parts.length === 2 ? parts[1] : null;
  }

  /**
   * Determine organization based on email domain or default
   */
  function determineOrganization(email) {
    const domain = getEmailDomain(email);

    if (domain && CONFIG.DOMAIN_ORG_MAPPING[domain]) {
      return CONFIG.DOMAIN_ORG_MAPPING[domain];
    }

    // Return default organization for unrecognized domains
    return {
      org_id: CONFIG.DEFAULT_ORG_ID,
      org_name: 'Default Organization',
      tier: 'free'
    };
  }

  /**
   * Get default roles based on organization tier and any signup context
   */
  function determineDefaultRoles(organization, signupContext) {
    const tierRoles = CONFIG.DEFAULT_ROLES_BY_TIER[organization.tier] || ['user'];

    // Check if signup included any special role requests
    // This would typically be validated against invitation tokens
    const requestedRoles = signupContext?.requested_roles || [];

    // Only allow pre-approved roles from invitations
    const validRequestedRoles = requestedRoles.filter(role => {
      // In production, validate against invitation token or admin approval
      return signupContext?.invitation_token &&
             signupContext?.approved_roles?.includes(role);
    });

    // Combine tier defaults with any valid requested roles
    const allRoles = [...new Set([...tierRoles, ...validRequestedRoles])];

    return allRoles;
  }

  /**
   * Send welcome notification to new user via external notification service
   */
  async function sendWelcomeNotification(user, organization) {
    const endpoint = event.secrets.NOTIFICATION_SERVICE_URL;
    const apiKey = event.secrets.NOTIFICATION_API_KEY;

    if (!endpoint) {
      console.log('[NOTIFICATION] No notification service configured, skipping welcome email');
      return { success: false, reason: 'not_configured' };
    }

    const templateId = CONFIG.WELCOME_TEMPLATES[organization.tier] || CONFIG.WELCOME_TEMPLATES.free;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Request-Source': 'auth0-post-registration'
        },
        body: JSON.stringify({
          type: 'email',
          template_id: templateId,
          recipient: {
            email: user.email,
            name: user.name || user.given_name || user.email.split('@')[0]
          },
          data: {
            user_id: user.user_id,
            organization_name: organization.org_name,
            organization_tier: organization.tier,
            signup_timestamp: new Date().toISOString(),
            // Links for onboarding
            dashboard_url: `https://app.yourcompany.com/dashboard`,
            profile_setup_url: `https://app.yourcompany.com/profile/setup`,
            documentation_url: `https://docs.yourcompany.com/getting-started`,
            support_url: `https://support.yourcompany.com`
          },
          // Schedule delivery options
          send_at: 'immediate',
          priority: 'high'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[NOTIFICATION] Failed to send welcome email:', response.status, errorText);
        return { success: false, reason: 'api_error', status: response.status };
      }

      const result = await response.json();
      console.log('[NOTIFICATION] Welcome email queued:', result.message_id);
      return { success: true, message_id: result.message_id };

    } catch (error) {
      console.error('[NOTIFICATION] Error sending welcome email:', error.message);
      return { success: false, reason: 'exception', error: error.message };
    }
  }

  /**
   * Provision user in external systems (SCIM, directory services, etc.)
   */
  async function provisionUser(user, organization, roles) {
    const endpoint = event.secrets.PROVISIONING_API_URL;
    const apiKey = event.secrets.PROVISIONING_API_KEY;

    if (!endpoint) {
      console.log('[PROVISIONING] No provisioning service configured');
      return { success: false, reason: 'not_configured' };
    }

    // Only provision if user has roles that require external provisioning
    const requiresProvisioning = roles.some(role =>
      CONFIG.ROLES_REQUIRING_PROVISIONING.includes(role)
    );

    if (!requiresProvisioning) {
      console.log('[PROVISIONING] User does not require external provisioning');
      return { success: true, reason: 'not_required' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Request-Source': 'auth0-post-registration'
        },
        body: JSON.stringify({
          action: 'create_user',
          user: {
            external_id: user.user_id,
            email: user.email,
            name: user.name,
            given_name: user.given_name,
            family_name: user.family_name
          },
          organization: {
            id: organization.org_id,
            name: organization.org_name
          },
          roles: roles,
          metadata: {
            source: 'auth0_registration',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PROVISIONING] Failed to provision user:', response.status, errorText);
        return { success: false, reason: 'api_error', status: response.status };
      }

      const result = await response.json();
      console.log('[PROVISIONING] User provisioned:', result.provisioning_id);
      return { success: true, provisioning_id: result.provisioning_id };

    } catch (error) {
      console.error('[PROVISIONING] Error provisioning user:', error.message);
      return { success: false, reason: 'exception', error: error.message };
    }
  }

  /**
   * Send audit log entry to external logging service
   */
  async function sendAuditLog(logEntry) {
    const endpoint = event.secrets.AUDIT_LOG_ENDPOINT;
    const apiKey = event.secrets.AUDIT_LOG_API_KEY;

    if (!endpoint) {
      console.log('[AUDIT] No endpoint configured, logging to console:', JSON.stringify(logEntry));
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Audit-Source': 'auth0-post-registration'
        },
        body: JSON.stringify({
          ...logEntry,
          timestamp: new Date().toISOString(),
          source: 'auth0_post_registration_action',
          version: '1.0.0'
        })
      });

      if (!response.ok) {
        console.error('[AUDIT] Failed to send audit log:', response.status);
      }
    } catch (error) {
      console.error('[AUDIT] Error sending audit log:', error.message);
    }
  }

  // ---------------------------------------------------------------------------
  // MAIN EXECUTION
  // ---------------------------------------------------------------------------

  try {
    console.log('[SIGNUP] Processing new registration for:', event.user.email);

    // Step 1: Determine organization assignment
    const organization = determineOrganization(event.user.email);
    console.log('[ORG] Assigned to organization:', organization.org_name, '(', organization.org_id, ')');

    // Step 2: Determine default roles
    const signupContext = event.request?.query || {};
    const roles = determineDefaultRoles(organization, signupContext);
    console.log('[ROLES] Assigned roles:', roles.join(', '));

    // Step 3: Set user metadata
    // Organization metadata
    api.user.setAppMetadata('org_id', organization.org_id);
    api.user.setAppMetadata('org_name', organization.org_name);
    api.user.setAppMetadata('org_tier', organization.tier);

    // Role metadata
    api.user.setAppMetadata('roles', roles);

    // Signup tracking metadata
    api.user.setAppMetadata('signup_timestamp', new Date().toISOString());
    api.user.setAppMetadata('signup_ip', event.request?.ip);
    api.user.setAppMetadata('signup_user_agent', event.request?.user_agent);
    api.user.setAppMetadata('signup_country', event.request?.geoip?.countryCode);
    api.user.setAppMetadata('onboarding_completed', false);

    // Account status
    api.user.setAppMetadata('account_status', 'active');
    api.user.setAppMetadata('email_verified_at', event.user.email_verified ? new Date().toISOString() : null);

    // Step 4: Set user metadata (public, visible to user)
    api.user.setUserMetadata('display_name', event.user.name || event.user.email.split('@')[0]);
    api.user.setUserMetadata('timezone', 'UTC'); // Default, user can update
    api.user.setUserMetadata('locale', 'en-US'); // Default, user can update
    api.user.setUserMetadata('notification_preferences', {
      email_marketing: false,
      email_product_updates: true,
      email_security_alerts: true
    });

    // Step 5: Send welcome notification (async, don't block)
    const notificationResult = await sendWelcomeNotification(event.user, organization);

    // Step 6: Provision user in external systems if needed
    const provisioningResult = await provisionUser(event.user, organization, roles);

    // Step 7: Send comprehensive audit log for compliance
    await sendAuditLog({
      event_type: 'user_registration',
      user_id: event.user.user_id,
      email: event.user.email,
      name: event.user.name,

      // Organization assignment
      organization: {
        id: organization.org_id,
        name: organization.org_name,
        tier: organization.tier
      },

      // Role assignment
      roles_assigned: roles,

      // Signup context
      signup_context: {
        ip_address: event.request?.ip,
        country: event.request?.geoip?.countryCode,
        city: event.request?.geoip?.cityName,
        user_agent: event.request?.user_agent,
        connection: event.connection?.name,
        client_id: event.client?.client_id,
        client_name: event.client?.name
      },

      // Processing results
      processing_results: {
        notification: notificationResult,
        provisioning: provisioningResult
      },

      // Identity provider information
      identity: {
        provider: event.connection?.strategy,
        connection: event.connection?.name,
        is_social: ['google-oauth2', 'facebook', 'linkedin', 'github'].includes(event.connection?.strategy)
      }
    });

    console.log('[SIGNUP] Successfully processed registration for:', event.user.email);
    console.log('[SIGNUP] Org:', organization.org_id, '| Roles:', roles.join(', '));

  } catch (error) {
    // Log error but don't fail registration
    // User account is already created at this point
    console.error('[ERROR] Post-registration action failed:', error.message);

    // Set error flag in user metadata for later remediation
    try {
      api.user.setAppMetadata('registration_error', {
        timestamp: new Date().toISOString(),
        error: error.message
      });
    } catch (metaError) {
      console.error('[ERROR] Failed to set error metadata:', metaError.message);
    }

    // Attempt to send error audit log
    try {
      await sendAuditLog({
        event_type: 'registration_error',
        user_id: event.user?.user_id,
        email: event.user?.email,
        error: error.message,
        stack: error.stack
      });
    } catch (auditError) {
      console.error('[ERROR] Failed to log registration error:', auditError.message);
    }
  }
};
