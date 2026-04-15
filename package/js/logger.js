/**
 * Adlocaite Logger
 *
 * Centralized logging with Axiom integration for production error reporting.
 * - Buffers events and flushes periodically or immediately on errors
 * - Without axiomToken: console-only logging (graceful degradation)
 * - Never blocks playback — all Axiom calls are fire-and-forget
 */

class AdlocaiteLogger {
  constructor(config) {
    this.config = config;
    this.buffer = [];
    this.flushInterval = null;
    this.screenId = null;
    this.axiomEnabled = !!(config.axiomToken && config.axiomDataset);

    if (this.axiomEnabled) {
      this._startFlushTimer();
    }
  }

  /**
   * Set screen context for all subsequent log events
   */
  initialize(screenId) {
    this.screenId = screenId;
  }

  // ── Public logging methods ──────────────────────────────────

  info(module, message, data = null) {
    this._emit('info', module, message, data);
  }

  warn(module, message, data = null) {
    this._emit('warn', module, message, data);
  }

  error(module, message, data = null) {
    this._emit('error', module, message, data);

    // Errors flush immediately
    if (this.axiomEnabled) {
      this._flush();
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────

  destroy() {
    this._stopFlushTimer();

    if (this.buffer.length > 0 && this.axiomEnabled) {
      // Use sendBeacon for reliable delivery during page unload
      this._flushBeacon();
    }
  }

  // ── Internal ────────────────────────────────────────────────

  _emit(level, module, message, data) {
    const timestamp = new Date().toISOString();

    // Console output (info only in debug mode, warn/error always)
    if (level === 'info' && this.config.debugMode) {
      console.log(`[${timestamp}] [${module}]`, message, data || '');
    } else if (level === 'warn') {
      console.warn(`[${timestamp}] [${module}]`, message, data || '');
    } else if (level === 'error') {
      console.error(`[${timestamp}] [${module}]`, message, data || '');
    }

    // Buffer for Axiom (only warn + error, or all in debug mode)
    if (this.axiomEnabled && (level !== 'info' || this.config.debugMode)) {
      this.buffer.push({
        _time: timestamp,
        level,
        module,
        message,
        data: data || undefined,
        screen_id: this.screenId || undefined,
        package_version: this.config.packageVersion || undefined,
        user_agent: navigator.userAgent,
      });
    }
  }

  _startFlushTimer() {
    this.flushInterval = setInterval(() => this._flush(), 10000);
  }

  _stopFlushTimer() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  _flush() {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0);
    const url = `https://api.axiom.co/v1/datasets/${this.config.axiomDataset}/ingest`;

    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.axiomToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(events),
    }).catch(() => {
      // Logging must never break playback
    });
  }

  _flushBeacon() {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0);
    const url = `https://api.axiom.co/v1/datasets/${this.config.axiomDataset}/ingest`;

    // Use fetch with keepalive (sendBeacon can't set Auth headers)
    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Authorization': `Bearer ${this.config.axiomToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(events),
    }).catch(() => {});
  }
}

// Make class globally available
if (typeof window !== 'undefined') {
  window.AdlocaiteLogger = AdlocaiteLogger;
}
