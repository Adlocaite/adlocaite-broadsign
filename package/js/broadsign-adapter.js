/**
 * Broadsign Adapter
 * 
 * Handles integration with Broadsign Control Player including:
 * - BroadSignPlay() lifecycle hook
 * - Screen identification via BroadSignObject
 * - Player state management
 * - Broadsign-specific logging
 */

class BroadsignAdapter {
  constructor(config) {
    this.config = config;
    this.screenId = null;
    this.isPlaying = false;
    this.startTime = null;
  }

  /**
   * Log message if debug mode is enabled
   */
  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Broadsign Adapter]`, message, data || '');
    }
  }

  /**
   * Log error message
   */
  error(message, data = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [Broadsign Adapter Error]`, message, data || '');
  }

  /**
   * Check if running in Broadsign Control Player
   * Verifies that BroadSignObject exists AND has required properties
   * Also checks parent window for test environment support
   */
  isBroadsignEnvironment() {
    // Check local BroadSignObject
    if (typeof BroadSignObject !== 'undefined' &&
        BroadSignObject !== null &&
        (BroadSignObject.frame_id !== undefined ||
         BroadSignObject.display_unit_id !== undefined ||
         BroadSignObject.player_id !== undefined)) {
      return true;
    }

    // Check parent window (for test environment where parent sets BroadSignObject)
    try {
      if (typeof parent !== 'undefined' &&
          parent !== window &&
          typeof parent.BroadSignObject !== 'undefined' &&
          parent.BroadSignObject !== null &&
          parent.BroadSignObject.frame_id !== undefined) {
        return true;
      }
    } catch (e) {
      // Cross-origin access denied - ignore
    }

    return false;
  }

  /**
   * Get BroadSignObject from local or parent window
   */
  getBroadSignObject() {
    // Check local first
    if (typeof BroadSignObject !== 'undefined' && BroadSignObject !== null) {
      return BroadSignObject;
    }

    // Check parent window (for test environment)
    try {
      if (typeof parent !== 'undefined' &&
          parent !== window &&
          typeof parent.BroadSignObject !== 'undefined' &&
          parent.BroadSignObject !== null) {
        return parent.BroadSignObject;
      }
    } catch (e) {
      // Cross-origin access denied - ignore
    }

    return null;
  }

  /**
   * Get screen ID from Broadsign
   * Uses BroadSignObject.frame_id as external identifier
   * Falls back to Broadsign URL params or generic screen_id param
   */
  getScreenId() {
    if (this.screenId) {
      return this.screenId;
    }

    // Try to get frame ID from BroadSignObject (as external_id for API)
    if (this.isBroadsignEnvironment()) {
      try {
        // Use getBroadSignObject() to handle both local and parent window
        const bsObject = this.getBroadSignObject();
        if (bsObject) {
          this.screenId = bsObject.frame_id;

          // Validate that we got a valid screen ID
          if (!this.screenId || this.screenId === '') {
            this.error('BroadSignObject.frame_id is empty or undefined');
          } else {
            this.log(`Screen ID (frame_id) from BroadSignObject: ${this.screenId}`);
            return this.screenId;
          }
        }
      } catch (err) {
        this.error('Failed to get frame_id from BroadSignObject', err);
      }
    } else {
      this.log('Not running in Broadsign environment - BroadSignObject not available');
    }

    // Fallback: Check for Broadsign's URL parameter (passed in source URL)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('com.broadsign.suite.bsp.frame_id')) {
      this.screenId = urlParams.get('com.broadsign.suite.bsp.frame_id');
      this.log(`Screen ID from Broadsign URL parameter: ${this.screenId}`);
      return this.screenId;
    }

    // Fallback: Check for generic URL parameter (manual testing)
    if (urlParams.has('screen_id')) {
      this.screenId = urlParams.get('screen_id');
      this.log(`Screen ID from URL parameter: ${this.screenId}`);
      return this.screenId;
    }

    // No screen ID available
    this.error('No screen ID available from BroadSignObject or URL parameters');
    return null;
  }

  /**
   * Request focus for keyboard input
   * Call this when HTML page needs keyboard interaction
   */
  requestFocus() {
    if (this.isBroadsignEnvironment()) {
      try {
        if (typeof BroadSignObject.requestFocus === 'function') {
          BroadSignObject.requestFocus();
          this.log('Focus requested from Broadsign Player');
        }
      } catch (err) {
        this.error('Failed to request focus', err);
      }
    }
  }

  /**
   * Initialize Broadsign integration
   * Called when page loads
   */
  initialize() {
    this.log('Initializing Broadsign Adapter');

    if (this.isBroadsignEnvironment()) {
      this.log('BroadSignObject:', this.getBroadSignObject());
    } else {
      this.log('Not in Broadsign environment — checking URL parameters for frame_id');
    }
  }

  /**
   * Mark playback as started
   */
  startPlayback() {
    this.isPlaying = true;
    this.startTime = Date.now();
    this.log('Playback started');
  }

  /**
   * Mark playback as ended
   * Returns playback duration in seconds
   */
  endPlayback() {
    this.isPlaying = false;
    const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    this.log(`Playback ended. Duration: ${duration}s`);
    return duration;
  }

  /**
   * Get playback duration so far (in seconds)
   */
  getPlaybackDuration() {
    if (!this.startTime) {
      return 0;
    }
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Check if playback is currently active
   */
  isPlaybackActive() {
    return this.isPlaying;
  }

  /**
   * Reset adapter state
   */
  reset() {
    this.isPlaying = false;
    this.startTime = null;
    this.log('Adapter reset');
  }

  /**
   * Get playout tracking data for API submission
   */
  getPlayoutTrackingData() {
    const bsObject = this.getBroadSignObject();
    const duration = this.getPlaybackDuration();

    return {
      played_at: this.startTime ? new Date(this.startTime).toISOString() : new Date().toISOString(),
      duration_seconds: Math.round(duration),
      completion_rate: 100,
      player_version: `Broadsign Control Player + Adlocaite Integration v${this.config.packageVersion || '2.0.0'}`,
      screen_resolution: bsObject?.frame_resolution || `${window.innerWidth}x${window.innerHeight}`
    };
  }
}

// Global BroadSignPlay function - called by Broadsign when ad copy is shown
function BroadSignPlay() {
  console.log('[Adlocaite] BroadSignPlay() called by Broadsign Player');

  // Make idempotent: prevent duplicate calls
  // According to Broadsign best practices, this function should be safe to call multiple times
  if (window._adlocaiteBroadSignPlayCalled) {
    console.warn('[Adlocaite] BroadSignPlay() already called, ignoring duplicate');
    return;
  }
  window._adlocaiteBroadSignPlayCalled = true;

  // Signal to the application that Broadsign is ready
  if (typeof window.onBroadSignReady === 'function') {
    window.onBroadSignReady();
  } else {
    // If handler not registered yet, dispatch custom event
    window.dispatchEvent(new CustomEvent('broadsignready'));
  }
}

// Make adapter available globally
if (typeof window !== 'undefined') {
  window.BroadsignAdapter = BroadsignAdapter;
  window.BroadSignPlay = BroadSignPlay;
}


