/**
 * Auth0 Post-Login Action: Risk Assessment and Security Controls
 *
 * This action executes after successful authentication to perform:
 * - Risk assessment based on multiple signals (IP, location, time, device)
 * - Anomaly detection comparing current login to user's historical patterns
 * - Conditional MFA enforcement for suspicious or high-risk logins
 * - Comprehensive audit logging for security monitoring and compliance
 *
 * Dependencies (configure in Auth0 Action secrets):
 * - AUDIT_LOG_ENDPOINT: URL for audit log service
 * - AUDIT_LOG_API_KEY: API key for audit service authentication
 * - MAXMIND_LICENSE_KEY: (Optional) For enhanced geolocation
 * - RISK_THRESHOLD_MFA: Score threshold to trigger MFA (default: 50)
 * - RISK_THRESHOLD_BLOCK: Score threshold to block login (default: 80)
 *
 * @param {Event} event - Auth0 event object containing user and context
 * @param {API} api - Auth0 API object for modifying the authentication flow
 */
exports.onExecutePostLogin = async (event, api) => {
  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------
  const CONFIG = {
    // Risk score thresholds (0-100 scale)
    RISK_THRESHOLD_MFA: parseInt(event.secrets.RISK_THRESHOLD_MFA) || 50,
    RISK_THRESHOLD_BLOCK: parseInt(event.secrets.RISK_THRESHOLD_BLOCK) || 80,

    // Business hours definition (UTC)
    BUSINESS_HOURS_START: 6,  // 6 AM UTC
    BUSINESS_HOURS_END: 22,   // 10 PM UTC

    // Suspicious countries list (ISO 3166-1 alpha-2 codes)
    // Customize based on your organization's requirements
    HIGH_RISK_COUNTRIES: ['KP', 'IR', 'SY', 'CU'],

    // Maximum allowed failed attempts before considering high risk
    MAX_FAILED_ATTEMPTS: 5,

    // Time window for velocity checks (milliseconds)
    VELOCITY_WINDOW_MS: 300000, // 5 minutes
  };

  // ---------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // ---------------------------------------------------------------------------

  /**
   * Calculate risk score based on multiple factors
   * Returns a score from 0 (safe) to 100 (very risky)
   */
  function calculateRiskScore(event) {
    let score = 0;
    const factors = [];

    // [FACTOR 1] New device detection
    // First-time device usage is inherently riskier
    if (!event.authentication?.methods?.some(m => m.name === 'mfa')) {
      const isNewDevice = event.user.app_metadata?.known_devices?.indexOf(
        event.request.geoip?.ip
      ) === -1;

      if (isNewDevice || !event.user.app_metadata?.known_devices) {
        score += 15;
        factors.push({ factor: 'new_device', weight: 15 });
      }
    }

    // [FACTOR 2] Geographic anomaly detection
    // Compare current location with user's typical login locations
    const currentCountry = event.request.geoip?.countryCode;
    const lastCountry = event.user.app_metadata?.last_login_country;

    if (currentCountry && lastCountry && currentCountry !== lastCountry) {
      // Different country - check if it's a known location for this user
      const knownCountries = event.user.app_metadata?.known_countries || [];
      if (!knownCountries.includes(currentCountry)) {
        score += 25;
        factors.push({ factor: 'new_country', weight: 25 });
      } else {
        score += 10;
        factors.push({ factor: 'different_known_country', weight: 10 });
      }
    }

    // [FACTOR 3] High-risk country check
    if (CONFIG.HIGH_RISK_COUNTRIES.includes(currentCountry)) {
      score += 30;
      factors.push({ factor: 'high_risk_country', weight: 30, country: currentCountry });
    }

    // [FACTOR 4] Impossible travel detection
    // If user logged in from a distant location too quickly
    const lastLoginTime = event.user.app_metadata?.last_login_time;
    const lastLoginCity = event.user.app_metadata?.last_login_city;
    const currentCity = event.request.geoip?.cityName;

    if (lastLoginTime && lastLoginCity && currentCity !== lastLoginCity) {
      const timeSinceLastLogin = Date.now() - new Date(lastLoginTime).getTime();
      const hoursSinceLastLogin = timeSinceLastLogin / (1000 * 60 * 60);

      // If different city within 1 hour, likely impossible travel
      if (hoursSinceLastLogin < 1) {
        score += 35;
        factors.push({
          factor: 'impossible_travel',
          weight: 35,
          from: lastLoginCity,
          to: currentCity,
          hours: hoursSinceLastLogin.toFixed(2)
        });
      }
    }

    // [FACTOR 5] Time-based anomaly
    // Logins outside business hours may indicate compromised credentials
    const currentHour = new Date().getUTCHours();
    const isBusinessHours = currentHour >= CONFIG.BUSINESS_HOURS_START &&
                            currentHour < CONFIG.BUSINESS_HOURS_END;

    if (!isBusinessHours) {
      // Check if user typically logs in at this time
      const typicalLoginHours = event.user.app_metadata?.typical_login_hours || [];
      if (!typicalLoginHours.includes(currentHour)) {
        score += 10;
        factors.push({ factor: 'unusual_time', weight: 10, hour: currentHour });
      }
    }

    // [FACTOR 6] Failed authentication attempts
    // High number of recent failures suggests brute force or credential stuffing
    const failedAttempts = event.stats?.logins_count === 0 ? 0 :
      (event.user.app_metadata?.recent_failed_attempts || 0);

    if (failedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
      score += 20;
      factors.push({ factor: 'high_failed_attempts', weight: 20, count: failedAttempts });
    } else if (failedAttempts > 0) {
      score += failedAttempts * 3;
      factors.push({ factor: 'failed_attempts', weight: failedAttempts * 3, count: failedAttempts });
    }

    // [FACTOR 7] IP reputation check
    // Check if IP is from known VPN, proxy, or suspicious ranges
    const ipType = event.request.geoip?.ip_type;
    if (ipType === 'vpn' || ipType === 'proxy' || ipType === 'tor') {
      score += 15;
      factors.push({ factor: 'anonymous_ip', weight: 15, type: ipType });
    }

    // [FACTOR 8] Login velocity check
    // Multiple successful logins in short period is suspicious
    const recentLogins = event.user.app_metadata?.recent_login_timestamps || [];
    const recentLoginsInWindow = recentLogins.filter(
      ts => Date.now() - new Date(ts).getTime() < CONFIG.VELOCITY_WINDOW_MS
    );

    if (recentLoginsInWindow.length > 3) {
      score += 15;
      factors.push({ factor: 'high_velocity', weight: 15, count: recentLoginsInWindow.length });
    }

    // Ensure score doesn't exceed 100
    return {
      score: Math.min(score, 100),
      factors
    };
  }

  /**
   * Send audit log entry to external logging service
   * Logs are critical for security monitoring and compliance
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
          'X-Audit-Source': 'auth0-post-login'
        },
        body: JSON.stringify({
          ...logEntry,
          timestamp: new Date().toISOString(),
          source: 'auth0_post_login_action',
          version: '1.0.0'
        })
      });

      if (!response.ok) {
        console.error('[AUDIT] Failed to send audit log:', response.status);
      }
    } catch (error) {
      // Log error but don't fail the authentication
      // Audit logging should never block legitimate logins
      console.error('[AUDIT] Error sending audit log:', error.message);
    }
  }

  /**
   * Detect anomalies by comparing current login with historical patterns
   */
  function detectAnomalies(event) {
    const anomalies = [];
    const userMetadata = event.user.app_metadata || {};

    // [ANOMALY 1] User agent change
    const currentUA = event.request.user_agent;
    const knownUserAgents = userMetadata.known_user_agents || [];
    if (currentUA && !knownUserAgents.some(ua => ua.includes(currentUA.substring(0, 50)))) {
      anomalies.push({
        type: 'new_user_agent',
        severity: 'low',
        details: { user_agent: currentUA.substring(0, 100) }
      });
    }

    // [ANOMALY 2] IP address range change
    const currentIP = event.request.ip;
    const knownIPRanges = userMetadata.known_ip_ranges || [];
    const currentIPPrefix = currentIP?.split('.').slice(0, 2).join('.');
    if (currentIPPrefix && !knownIPRanges.includes(currentIPPrefix)) {
      anomalies.push({
        type: 'new_ip_range',
        severity: 'medium',
        details: { ip_prefix: currentIPPrefix }
      });
    }

    // [ANOMALY 3] Authentication method change
    const currentAuthMethod = event.authentication?.methods?.[0]?.name;
    const preferredAuthMethod = userMetadata.preferred_auth_method;
    if (preferredAuthMethod && currentAuthMethod !== preferredAuthMethod) {
      anomalies.push({
        type: 'auth_method_change',
        severity: 'low',
        details: {
          expected: preferredAuthMethod,
          actual: currentAuthMethod
        }
      });
    }

    // [ANOMALY 4] Login frequency anomaly
    const avgDailyLogins = userMetadata.avg_daily_logins || 2;
    const todayLogins = userMetadata.today_login_count || 0;
    if (todayLogins > avgDailyLogins * 3) {
      anomalies.push({
        type: 'unusual_login_frequency',
        severity: 'medium',
        details: {
          expected_avg: avgDailyLogins,
          today_count: todayLogins
        }
      });
    }

    return anomalies;
  }

  // ---------------------------------------------------------------------------
  // MAIN EXECUTION
  // ---------------------------------------------------------------------------

  try {
    console.log('[LOGIN] Processing login for user:', event.user.user_id);

    // Step 1: Calculate risk score
    const riskAssessment = calculateRiskScore(event);
    console.log('[RISK] Score:', riskAssessment.score, 'Factors:', JSON.stringify(riskAssessment.factors));

    // Step 2: Detect anomalies
    const anomalies = detectAnomalies(event);
    if (anomalies.length > 0) {
      console.log('[ANOMALY] Detected:', JSON.stringify(anomalies));
    }

    // Step 3: Determine action based on risk score
    let action = 'allow';
    let mfaRequired = false;

    if (riskAssessment.score >= CONFIG.RISK_THRESHOLD_BLOCK) {
      // High risk - block the login
      action = 'block';
      console.log('[SECURITY] Blocking high-risk login attempt');

      // Send security alert audit log
      await sendAuditLog({
        event_type: 'login_blocked',
        user_id: event.user.user_id,
        email: event.user.email,
        risk_score: riskAssessment.score,
        risk_factors: riskAssessment.factors,
        anomalies: anomalies,
        ip_address: event.request.ip,
        country: event.request.geoip?.countryCode,
        city: event.request.geoip?.cityName,
        user_agent: event.request.user_agent
      });

      // Deny access with user-friendly message
      api.access.deny('Login blocked due to suspicious activity. Please contact support.');
      return;
    }

    if (riskAssessment.score >= CONFIG.RISK_THRESHOLD_MFA) {
      // Medium risk - require MFA step-up
      action = 'mfa_required';
      mfaRequired = true;
      console.log('[SECURITY] Triggering MFA for elevated risk login');

      // Check if user has MFA enrolled
      const hasMFA = event.user.multifactor?.length > 0;

      if (hasMFA) {
        // Trigger MFA challenge
        api.authentication.challengeWithAny([
          { type: 'otp' },
          { type: 'push-notification' }
        ]);
      } else {
        // User doesn't have MFA - for high-risk scenarios, force enrollment
        // This should be configured based on your security policy
        api.authentication.enrollWithAny([
          { type: 'otp' }
        ]);
      }
    }

    // Step 4: Add risk metadata to ID token for downstream consumption
    api.idToken.setCustomClaim('https://yourapp.com/risk_score', riskAssessment.score);
    api.idToken.setCustomClaim('https://yourapp.com/risk_factors', riskAssessment.factors.map(f => f.factor));

    // Step 5: Update user metadata for future risk assessments
    // Store current login context for future anomaly detection
    api.user.setAppMetadata('last_login_time', new Date().toISOString());
    api.user.setAppMetadata('last_login_country', event.request.geoip?.countryCode);
    api.user.setAppMetadata('last_login_city', event.request.geoip?.cityName);
    api.user.setAppMetadata('last_login_ip', event.request.ip);

    // Update known locations (maintain list of up to 10 countries)
    const knownCountries = event.user.app_metadata?.known_countries || [];
    const currentCountry = event.request.geoip?.countryCode;
    if (currentCountry && !knownCountries.includes(currentCountry)) {
      const updatedCountries = [...knownCountries, currentCountry].slice(-10);
      api.user.setAppMetadata('known_countries', updatedCountries);
    }

    // Update known IP ranges
    const knownIPRanges = event.user.app_metadata?.known_ip_ranges || [];
    const currentIPPrefix = event.request.ip?.split('.').slice(0, 2).join('.');
    if (currentIPPrefix && !knownIPRanges.includes(currentIPPrefix)) {
      const updatedIPRanges = [...knownIPRanges, currentIPPrefix].slice(-20);
      api.user.setAppMetadata('known_ip_ranges', updatedIPRanges);
    }

    // Step 6: Send success audit log
    await sendAuditLog({
      event_type: 'login_success',
      user_id: event.user.user_id,
      email: event.user.email,
      action: action,
      risk_score: riskAssessment.score,
      risk_factors: riskAssessment.factors,
      anomalies: anomalies,
      mfa_triggered: mfaRequired,
      ip_address: event.request.ip,
      country: event.request.geoip?.countryCode,
      city: event.request.geoip?.cityName,
      user_agent: event.request.user_agent,
      connection: event.connection?.name,
      client_id: event.client?.client_id,
      client_name: event.client?.name
    });

    console.log('[LOGIN] Completed processing. Action:', action, 'Risk Score:', riskAssessment.score);

  } catch (error) {
    // Critical: Never fail authentication due to our custom logic errors
    // Log the error for debugging but allow the login to proceed
    console.error('[ERROR] Post-login action failed:', error.message);

    // Send error audit log for monitoring
    try {
      await sendAuditLog({
        event_type: 'action_error',
        user_id: event.user?.user_id,
        error: error.message,
        stack: error.stack
      });
    } catch (auditError) {
      console.error('[ERROR] Failed to log error:', auditError.message);
    }
  }
};

/**
 * onContinuePostLogin - Handles continuation after MFA challenge
 * This function executes when the user completes an MFA challenge triggered above
 */
exports.onContinuePostLogin = async (event, api) => {
  console.log('[MFA] User completed MFA challenge');

  // Log successful MFA completion
  const endpoint = event.secrets.AUDIT_LOG_ENDPOINT;
  if (endpoint) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${event.secrets.AUDIT_LOG_API_KEY}`
        },
        body: JSON.stringify({
          event_type: 'mfa_completed',
          user_id: event.user.user_id,
          email: event.user.email,
          timestamp: new Date().toISOString(),
          ip_address: event.request.ip
        })
      });
    } catch (error) {
      console.error('[ERROR] Failed to log MFA completion:', error.message);
    }
  }

  // Update user metadata to record successful MFA
  api.user.setAppMetadata('last_mfa_success', new Date().toISOString());
};
