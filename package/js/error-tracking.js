/**
 * Error Tracking with Sentry
 *
 * Lightweight error tracking for Broadsign HTML5 packages.
 * Loads Sentry SDK asynchronously to avoid blocking initialization.
 * Queues errors until SDK is ready.
 */

class ErrorTracking {
  constructor(config) {
    this.config = config;
    this.sentryLoaded = false;
    this.sentryLoading = false;
    this.errorQueue = [];
    this.dsn = "https://7f64059eca4eb192937ece4f41b15f6d@o4510318343159808.ingest.de.sentry.io/4510771750633552";

    // Lazy load Sentry SDK if enabled
    if (this.config.enableErrorTracking) {
      this.initSentry();
    }
  }

  /**
   * Log message if debug mode is enabled
   */
  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Error Tracking]`, message, data || '');
    }
  }

  /**
   * Initialize Sentry SDK (bundled, instant)
   */
  async initSentry() {
    if (this.sentryLoading || this.sentryLoaded) {
      return;
    }

    this.sentryLoading = true;
    this.log('Initializing Sentry SDK...');

    try {
      // Check if Sentry SDK is loaded (should be bundled in package)
      if (!window.Sentry) {
        console.error('[Error Tracking] Sentry SDK not found. Ensure vendor/sentry.min.js is loaded.');
        this.sentryLoading = false;
        return;
      }

      this.log('Sentry SDK found, initializing...');

      window.Sentry.init({
        dsn: this.dsn,
        environment: 'broadsign-package',

        // Release version (from package metadata if available)
        release: this.config.packageVersion || 'unknown',

        // Minimal integrations (no Replay, no Feedback - keep package small)
        integrations: [
          // Breadcrumbs for better debugging context
          window.Sentry.breadcrumbsIntegration({
            console: true,
            dom: true,
            fetch: true,
            history: false,
            sentry: true,
            xhr: true,
          }),
        ],

        // Low sampling for free tier (10% of transactions)
        tracesSampleRate: 0.1,

        // Add Broadsign-specific context to all events
        beforeSend: (event) => {
          // Add Broadsign context
          event.contexts = event.contexts || {};
          event.contexts.broadsign = this.getBroadsignContext();

          // Add screen ID as user context for better grouping
          event.user = event.user || {};
          event.user.id = this.getScreenId();

          // Add tags for filtering in Sentry
          event.tags = event.tags || {};
          event.tags.screen_id = this.getScreenId();
          event.tags.frame_id = this.getFrameId();
          event.tags.broadsign_environment = this.isBroadsignEnvironment() ? 'true' : 'false';

          return event;
        },
      });

      this.sentryLoaded = true;
      this.sentryLoading = false;
      this.log('Sentry initialized successfully');

      // Send queued errors
      if (this.errorQueue.length > 0) {
        this.log(`Sending ${this.errorQueue.length} queued errors...`);
        this.errorQueue.forEach(item => {
          if (item.type === 'error') {
            this.captureError(item.error, item.context);
          } else if (item.type === 'message') {
            this.captureMessage(item.message, item.level, item.context);
          }
        });
        this.errorQueue = [];
      }
    } catch (err) {
      console.error('[Error Tracking] Failed to initialize Sentry:', err);
      this.sentryLoading = false;
    }
  }

  /**
   * Capture exception/error
   */
  captureError(error, context = {}) {
    if (this.sentryLoaded && window.Sentry) {
      window.Sentry.captureException(error, {
        extra: context,
        contexts: {
          broadsign: this.getBroadsignContext(),
        },
      });
      this.log('Error sent to Sentry', { error: error.message, context });
    } else {
      // Queue for later if Sentry not loaded yet
      this.errorQueue.push({ type: 'error', error, context });
      this.log('Error queued (Sentry not ready yet)', { error: error.message, context });
    }
  }

  /**
   * Capture message (info, warning, error)
   */
  captureMessage(message, level = 'info', context = {}) {
    if (this.sentryLoaded && window.Sentry) {
      window.Sentry.captureMessage(message, {
        level,
        extra: context,
        contexts: {
          broadsign: this.getBroadsignContext(),
        },
      });
      this.log(`Message sent to Sentry (${level})`, { message, context });
    } else {
      // Queue for later if Sentry not loaded yet
      this.errorQueue.push({ type: 'message', message, level, context });
      this.log(`Message queued (${level}, Sentry not ready yet)`, { message, context });
    }
  }

  /**
   * Add breadcrumb for debugging context
   */
  addBreadcrumb(category, message, data = {}) {
    if (this.sentryLoaded && window.Sentry) {
      window.Sentry.addBreadcrumb({
        category,
        message,
        data,
        level: 'info',
      });
    }
  }

  /**
   * Get Broadsign-specific context for error reports
   */
  getBroadsignContext() {
    const context = {
      screen_id: this.getScreenId(),
      frame_id: this.getFrameId(),
      display_unit_id: this.getDisplayUnitId(),
      player_id: this.getPlayerId(),
      broadsign_available: this.isBroadsignEnvironment(),
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
    };

    // Add BroadSignObject properties if available
    if (typeof BroadSignObject !== 'undefined' && BroadSignObject !== null) {
      try {
        context.frame_resolution = BroadSignObject.frame_resolution;
        context.display_unit_resolution = BroadSignObject.display_unit_resolution;
        context.campaign_id = BroadSignObject.campaign_id;
      } catch (err) {
        // Ignore errors accessing BroadSignObject properties
      }
    }

    return context;
  }

  /**
   * Get screen ID from app or BroadSignObject
   */
  getScreenId() {
    if (window.app && window.app.screenId) {
      return window.app.screenId;
    }

    if (window.app && window.app.broadsignAdapter) {
      return window.app.broadsignAdapter.getScreenId();
    }

    return 'unknown';
  }

  /**
   * Get frame ID from BroadSignObject
   */
  getFrameId() {
    if (typeof BroadSignObject !== 'undefined' && BroadSignObject !== null) {
      try {
        return BroadSignObject.frame_id || null;
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  /**
   * Get display unit ID from BroadSignObject
   */
  getDisplayUnitId() {
    if (typeof BroadSignObject !== 'undefined' && BroadSignObject !== null) {
      try {
        return BroadSignObject.display_unit_id || null;
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  /**
   * Get player ID from BroadSignObject
   */
  getPlayerId() {
    if (typeof BroadSignObject !== 'undefined' && BroadSignObject !== null) {
      try {
        return BroadSignObject.player_id || null;
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  /**
   * Check if running in Broadsign environment
   */
  isBroadsignEnvironment() {
    return typeof BroadSignObject !== 'undefined' && BroadSignObject !== null;
  }
}

// Make class globally available
if (typeof window !== 'undefined') {
  window.ErrorTracking = ErrorTracking;
}
