/**
 * Adlocaite Broadsign Integration - Configuration Template
 * 
 * Copy this file to config.js and fill in your actual values.
 * DO NOT commit config.js to version control!
 * 
 * To create your config:
 * cp config.example.js config.js
 */

const ADLOCAITE_CONFIG = {
  /**
   * Publisher API Key (required)
   * Get this from your Adlocaite dashboard or onboarding team
   * Format: pub_xxxxxxxxxxxxxxxxxxxx
   */
  apiKey: 'pub_xxxx',

  /**
   * API Base URL
   * Production: 'https://api.adlocaite.com/functions/v1/api'
   * Staging: 'https://staging.api.adlocaite.com/functions/v1/api'
   */
  apiBaseUrl: 'https://staging.api.adlocaite.com/functions/v1/api',

  /**
   * Minimum bid price in cents
   * Only offers with bids >= this value will be accepted
   * Example: 100 = €1.00 minimum bid
   */
  minBidCents: 100,

  /**
   * VAST mode
   * When true, requests will include vast=true parameter to receive VAST XML
   * VAST provides automatic tracking and better player compatibility
   */
  vastMode: true,

  /**
   * Debug mode
   * When enabled, logs detailed information to console
   * Disable in production for better performance
   */
  debugMode: false,

  /**
   * Error Tracking (Sentry)
   * When enabled, sends errors and exceptions to Sentry for monitoring
   * Helps identify issues in production without affecting performance
   * Recommended: true for production, false for local development
   */
  enableErrorTracking: true,

  /**
   * Package version (for Sentry release tracking)
   * Automatically set by build process, or leave as 'unknown'
   */
  packageVersion: 'unknown',

  /**
   * Request timeout in milliseconds
   * How long to wait for API responses before giving up
   */
  requestTimeout: 10000,

  /**
   * Asset loading timeout in milliseconds
   * How long to wait for media assets to load
   * Reduced to 5s to fit within Broadsign's "several seconds" pre-buffer window
   */
  assetTimeout: 5000,

  /**
   * Maximum lifecycle duration in milliseconds
   * Total time allowed for offer request, acceptance, and playout
   */
  maxLifecycleDuration: 60000,

  /**
   * Retry configuration
   * Number of times to retry failed API requests
   */
  maxRetries: 3,

  /**
   * Retry delay in milliseconds
   * Initial delay before first retry (exponential backoff applied)
   */
  retryDelay: 1000
};

// Make config globally available
if (typeof window !== 'undefined') {
  window.ADLOCAITE_CONFIG = ADLOCAITE_CONFIG;
}


