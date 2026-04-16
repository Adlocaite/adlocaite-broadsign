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
  apiBaseUrl: 'https://api.adlocaite.com/functions/v1/api',

  /**
   * Minimum bid price in cents (supports sub-cent decimals)
   * Only offers with bids >= this value will be accepted
   * Examples: 100 = 1.00 EUR, 0.5 = 0.005 EUR
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
   * When enabled, logs detailed information to console and shows debug panel
   * Disable in production
   */
  debugMode: false,

  /**
   * Axiom logging - ingest-only API token
   * Leave empty to disable remote error logging
   * Get from Axiom dashboard > Settings > API Tokens (ingest-only permission)
   */
  axiomToken: '',

  /**
   * Axiom dataset name
   * Error events are sent to this dataset for monitoring
   */
  axiomDataset: 'broadsign',

  /**
   * Package version (auto-injected by build.sh from package.json)
   */
  packageVersion: '2.0.0'
};

// Make config globally available
if (typeof window !== 'undefined') {
  window.ADLOCAITE_CONFIG = ADLOCAITE_CONFIG;
}


