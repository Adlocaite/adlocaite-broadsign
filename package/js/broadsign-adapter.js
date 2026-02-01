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
  constructor(config, errorTracking = null) {
    this.config = config;
    this.errorTracking = errorTracking;
    this.screenId = null;
    this.displayUnitId = null;
    this.playerId = null;
    this.isPlaying = false;
    this.startTime = null;
    this.getScreenIdCallCount = 0; // Track how many times getScreenId() is called
  }

  /**
   * Log message if debug mode is enabled
   * Also sends breadcrumb to Sentry for monitoring
   */
  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Broadsign Adapter]`, message, data || '');
    }

    // Send breadcrumb to Sentry
    if (this.errorTracking) {
      this.errorTracking.addBreadcrumb('broadsign', message, data || {});
    }
  }

  /**
   * Log error message
   * Also sends breadcrumb to Sentry for monitoring
   */
  error(message, data = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [Broadsign Adapter Error]`, message, data || '');

    // Send breadcrumb to Sentry with error level
    if (this.errorTracking) {
      this.errorTracking.addBreadcrumb('broadsign_error', message, data || {});
    }
  }

  /**
   * Check if running in Broadsign Control Player
   * Verifies that BroadSignObject exists AND has required properties
   * Also checks parent window for test environment support
   *
   * Logs detailed diagnostics to Sentry for troubleshooting
   */
  isBroadsignEnvironment() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      local_broadsignobject_exists: typeof BroadSignObject !== 'undefined',
      local_broadsignobject_is_null: typeof BroadSignObject !== 'undefined' ? BroadSignObject === null : null,
      local_has_frame_id: typeof BroadSignObject !== 'undefined' && BroadSignObject !== null ? BroadSignObject.frame_id !== undefined : false,
      local_has_display_unit_id: typeof BroadSignObject !== 'undefined' && BroadSignObject !== null ? BroadSignObject.display_unit_id !== undefined : false,
      local_has_player_id: typeof BroadSignObject !== 'undefined' && BroadSignObject !== null ? BroadSignObject.player_id !== undefined : false,
    };

    // Check local BroadSignObject
    if (typeof BroadSignObject !== 'undefined' &&
        BroadSignObject !== null &&
        (BroadSignObject.frame_id !== undefined ||
         BroadSignObject.display_unit_id !== undefined ||
         BroadSignObject.player_id !== undefined)) {
      this.log('Broadsign environment detected (local)', diagnostics);
      return true;
    }

    // Check parent window (for test environment where parent sets BroadSignObject)
    try {
      if (typeof parent !== 'undefined' &&
          parent !== window &&
          typeof parent.BroadSignObject !== 'undefined' &&
          parent.BroadSignObject !== null &&
          parent.BroadSignObject.frame_id !== undefined) {
        diagnostics.parent_broadsignobject_exists = true;
        this.log('Broadsign environment detected (parent window)', diagnostics);
        return true;
      } else {
        diagnostics.parent_broadsignobject_exists = false;
      }
    } catch (e) {
      // Cross-origin access denied - ignore
      diagnostics.parent_access_error = e.message;
    }

    this.log('NOT in Broadsign environment', diagnostics);
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
   * Create a detailed snapshot of BroadSignObject for diagnostics
   * Captures all properties and their values/types for Sentry reporting
   */
  createBroadSignObjectSnapshot() {
    const snapshot = {
      timestamp: new Date().toISOString(),
      environment_check: this.isBroadsignEnvironment(),
    };

    const bsObject = this.getBroadSignObject();
    if (bsObject) {
      snapshot.broadsignobject_exists = true;
      snapshot.broadsignobject_is_null = false;

      // Capture all key properties
      const properties = [
        'frame_id',
        'display_unit_id',
        'player_id',
        'frame_resolution',
        'display_unit_resolution',
        'campaign_id',
        'impressions_per_hour',
        'expected_slot_duration_ms'
      ];

      snapshot.properties = {};
      properties.forEach(prop => {
        if (bsObject[prop] !== undefined) {
          snapshot.properties[prop] = {
            value: bsObject[prop],
            type: typeof bsObject[prop],
            is_empty_string: bsObject[prop] === '',
            is_null: bsObject[prop] === null,
          };
        } else {
          snapshot.properties[prop] = { undefined: true };
        }
      });
    } else {
      snapshot.broadsignobject_exists = false;
      snapshot.broadsignobject_is_null = true;
    }

    return snapshot;
  }

  /**
   * Get screen ID from Broadsign
   * Uses BroadSignObject.frame_id as external identifier
   * Falls back to configured fallback or generates a test ID
   *
   * IMPORTANT: Does NOT cache the result - always queries BroadSignObject fresh
   * This ensures we detect if BroadSignObject becomes available later
   *
   * Logs detailed diagnostics to Sentry for troubleshooting
   */
  getScreenId() {
    // Increment call counter and create diagnostics
    this.getScreenIdCallCount++;
    const callContext = {
      call_number: this.getScreenIdCallCount,
      timestamp: new Date().toISOString(),
    };

    this.log(`getScreenId() called (attempt #${this.getScreenIdCallCount})`, callContext);

    // Try to get screen ID from BroadSignObject with fallback chain
    // Hierarchy: frame_id (best for multi-frame) → display_unit_id (physical screen) → player_id (last resort)
    if (this.isBroadsignEnvironment()) {
      try {
        // Use getBroadSignObject() to handle both local and parent window
        const bsObject = this.getBroadSignObject();
        if (bsObject) {
          // Create snapshot for diagnostics
          const snapshot = this.createBroadSignObjectSnapshot();

          // 1. Try frame_id (best for multi-frame setups, requires "Append Frame Id" config)
          if (bsObject.frame_id != null && String(bsObject.frame_id).trim() !== '') {
            const screenId = String(bsObject.frame_id);
            this.log(`Screen ID (frame_id) from BroadSignObject: ${screenId}`, {
              ...callContext,
              source: 'frame_id',
              screen_id: screenId,
              snapshot,
            });
            return screenId;
          }

          // 2. Fallback: display_unit_id (physical screen - always available)
          if (bsObject.display_unit_id != null && String(bsObject.display_unit_id).trim() !== '') {
            const screenId = String(bsObject.display_unit_id);
            this.log(`Screen ID (display_unit_id) from BroadSignObject: ${screenId} (frame_id not available)`, {
              ...callContext,
              source: 'display_unit_id',
              screen_id: screenId,
              snapshot,
            });
            return screenId;
          }

          // 3. Last resort: player_id (hardware - always available)
          if (bsObject.player_id != null && String(bsObject.player_id).trim() !== '') {
            const screenId = String(bsObject.player_id);
            this.log(`Screen ID (player_id) from BroadSignObject: ${screenId} (frame_id and display_unit_id not available)`, {
              ...callContext,
              source: 'player_id',
              screen_id: screenId,
              snapshot,
            });
            return screenId;
          }

          // BroadSignObject exists but all IDs are empty
          this.error('BroadSignObject exists but frame_id, display_unit_id, and player_id are all empty', {
            ...callContext,
            snapshot,
          });
        } else {
          this.error('getBroadSignObject() returned null despite isBroadsignEnvironment() being true', callContext);
        }
      } catch (err) {
        this.error('Failed to get screen ID from BroadSignObject', {
          ...callContext,
          error_message: err.message,
          error_stack: err.stack,
        });
      }
    } else {
      this.log('Not running in Broadsign environment - BroadSignObject not available', callContext);
    }

    // Fallback: Check for URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('screen_id')) {
      const screenId = urlParams.get('screen_id');
      this.log(`Screen ID from URL parameter: ${screenId}`, {
        ...callContext,
        source: 'url_parameter',
        screen_id: screenId,
      });
      return screenId;
    }

    // Fallback: Check localStorage
    const storedScreenId = localStorage.getItem('adlocaite_screen_id');
    if (storedScreenId) {
      this.log(`Screen ID from localStorage: ${storedScreenId}`, {
        ...callContext,
        source: 'localStorage',
        screen_id: storedScreenId,
      });
      return storedScreenId;
    }

    // No screen ID available - return null
    // Application should handle this and either enable demo mode or show error
    this.error('No screen ID available from BroadSignObject, URL, or localStorage', {
      ...callContext,
      snapshot: this.createBroadSignObjectSnapshot(),
    });
    return null;
  }

  /**
   * Get display unit ID from Broadsign
   * Uses BroadSignObject.display_unit_id property (not a method)
   */
  getDisplayUnitId() {
    if (this.displayUnitId) {
      return this.displayUnitId;
    }

    if (this.isBroadsignEnvironment()) {
      try {
        const bsObject = this.getBroadSignObject();
        if (bsObject && bsObject.display_unit_id !== undefined) {
          this.displayUnitId = bsObject.display_unit_id;
          this.log(`Display Unit ID: ${this.displayUnitId}`);
          return this.displayUnitId;
        }
      } catch (err) {
        this.error('Failed to get display_unit_id from BroadSignObject', err);
      }
    }

    return null;
  }

  /**
   * Get player ID from Broadsign
   * Uses BroadSignObject.player_id property (not a method)
   */
  getPlayerId() {
    if (this.playerId) {
      return this.playerId;
    }

    if (this.isBroadsignEnvironment()) {
      try {
        const bsObject = this.getBroadSignObject();
        if (bsObject && bsObject.player_id !== undefined) {
          this.playerId = bsObject.player_id;
          this.log(`Player ID: ${this.playerId}`);
          return this.playerId;
        }
      } catch (err) {
        this.error('Failed to get player_id from BroadSignObject', err);
      }
    }

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
   * Get player information for logging and debugging
   */
  getPlayerInfo() {
    const info = {
      environment: this.isBroadsignEnvironment() ? 'Broadsign Control Player' : 'Browser',
      screenId: this.getScreenId(),
      displayUnitId: this.getDisplayUnitId(),
      playerId: this.getPlayerId(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString()
    };

    this.log('Player Info', info);
    return info;
  }

  /**
   * Initialize Broadsign integration
   * Called when page loads
   */
  initialize() {
    this.log('Initializing Broadsign Adapter');
    
    const playerInfo = this.getPlayerInfo();
    
    if (!this.isBroadsignEnvironment()) {
      this.error('Not running in Broadsign environment! Some features may not work correctly.');
    }

    // Validate screen ID
    const screenId = this.getScreenId();
    if (!screenId || screenId.startsWith('test-screen-')) {
      this.error('Invalid or test screen ID. Configure proper screen identification.');
    }

    return playerInfo;
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
    const playerInfo = this.getPlayerInfo();
    const duration = this.getPlaybackDuration();

    return {
      played_at: this.startTime ? new Date(this.startTime).toISOString() : new Date().toISOString(),
      duration_seconds: Math.round(duration),
      completion_rate: 100, // Will be updated by player if interrupted
      player_version: 'Broadsign Control Player + Adlocaite Integration v1.0.0',
      screen_resolution: playerInfo.screenResolution
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


