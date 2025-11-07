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
    this.displayUnitId = null;
    this.playerId = null;
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
   * Verifies that BroadSignObject exists AND is fully initialized
   */
  isBroadsignEnvironment() {
    return typeof BroadSignObject !== 'undefined' &&
           BroadSignObject !== null &&
           typeof BroadSignObject.getScreenId === 'function';
  }

  /**
   * Get screen ID from Broadsign
   * Uses BroadSignObject.getScreenId() if available
   * Falls back to configured fallback or generates a test ID
   */
  getScreenId() {
    if (this.screenId) {
      return this.screenId;
    }

    // Try to get screen ID from BroadSignObject
    if (this.isBroadsignEnvironment()) {
      try {
        this.screenId = BroadSignObject.getScreenId();

        // Validate that we got a valid screen ID
        if (!this.screenId || this.screenId === '') {
          this.error('BroadSignObject.getScreenId() returned empty value');
        } else {
          this.log(`Screen ID from BroadSignObject: ${this.screenId}`);
          return this.screenId;
        }
      } catch (err) {
        this.error('Failed to get screen ID from BroadSignObject', err);
      }
    } else {
      this.log('Not running in Broadsign environment - BroadSignObject not available');
    }

    // Fallback: Check for URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('screen_id')) {
      this.screenId = urlParams.get('screen_id');
      this.log(`Screen ID from URL parameter: ${this.screenId}`);
      return this.screenId;
    }

    // Fallback: Check localStorage
    const storedScreenId = localStorage.getItem('adlocaite_screen_id');
    if (storedScreenId) {
      this.screenId = storedScreenId;
      this.log(`Screen ID from localStorage: ${this.screenId}`);
      return this.screenId;
    }

    // Final fallback: Generate test ID for development
    this.screenId = `test-screen-${Date.now()}`;
    this.error(`No screen ID available, using fallback: ${this.screenId}`);
    return this.screenId;
  }

  /**
   * Get display unit ID from Broadsign
   */
  getDisplayUnitId() {
    if (this.displayUnitId) {
      return this.displayUnitId;
    }

    if (this.isBroadsignEnvironment()) {
      try {
        if (typeof BroadSignObject.getDisplayUnitId === 'function') {
          this.displayUnitId = BroadSignObject.getDisplayUnitId();
          this.log(`Display Unit ID: ${this.displayUnitId}`);
          return this.displayUnitId;
        }
      } catch (err) {
        this.log('getDisplayUnitId not available', err);
      }
    }

    return null;
  }

  /**
   * Get player ID from Broadsign
   */
  getPlayerId() {
    if (this.playerId) {
      return this.playerId;
    }

    if (this.isBroadsignEnvironment()) {
      try {
        if (typeof BroadSignObject.getPlayerId === 'function') {
          this.playerId = BroadSignObject.getPlayerId();
          this.log(`Player ID: ${this.playerId}`);
          return this.playerId;
        }
      } catch (err) {
        this.log('getPlayerId not available', err);
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


