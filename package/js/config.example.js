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
   * Enable asset pre-caching
   * When enabled, the player will periodically fetch cacheable assets
   * and store them in browser cache for offline playback
   */
  enableCaching: true,

  /**
   * Caching interval in milliseconds
   * How often to refresh the cache with new assets
   * Default: 300000 (5 minutes)
   */
  cachingInterval: 300000,

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
   * Request timeout in milliseconds
   * How long to wait for API responses before giving up
   */
  requestTimeout: 10000,

  /**
   * Asset loading timeout in milliseconds
   * How long to wait for media assets to load
   */
  assetTimeout: 20000,

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


