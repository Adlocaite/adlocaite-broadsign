/**
 * Media Player
 * 
 * Handles playback of video and image ads including:
 * - HTML5 video playback with event tracking
 * - Image display with timed duration
 * - VAST tracking pixel firing
 * - Error handling and fallback
 * - Playout confirmation
 */

class AdlocaitePlayer {
  constructor(config, apiClient, broadsignAdapter, vastParser) {
    this.config = config;
    this.apiClient = apiClient;
    this.broadsignAdapter = broadsignAdapter;
    this.vastParser = vastParser;
    
    this.currentMediaFile = null;
    this.currentDealId = null;
    this.videoElement = null;
    this.imageElement = null;
    this.containerElement = null;
    
    this.isPlaying = false;
    this.startTime = null;
    this.duration = 0;
    this.completionRate = 0;
    
    this.trackingFired = {
      impression: false,
      start: false,
      firstQuartile: false,
      midpoint: false,
      thirdQuartile: false,
      complete: false
    };
  }

  /**
   * Log message if debug mode is enabled
   */
  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Adlocaite Player]`, message, data || '');
    }
  }

  /**
   * Log error message
   */
  error(message, data = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [Adlocaite Player Error]`, message, data || '');
  }

  /**
   * Initialize player with container element
   */
  initialize(containerId) {
    this.containerElement = document.getElementById(containerId);
    if (!this.containerElement) {
      throw new Error(`Container element not found: ${containerId}`);
    }

    this.log('Player initialized');
  }

  /**
   * Play media from VAST data
   */
  async playFromVAST(vastData, dealId) {
    this.log('Playing from VAST data');
    
    this.currentDealId = dealId;
    const mediaFile = this.vastParser.getBestMediaFile();
    
    if (!mediaFile) {
      throw new Error('No suitable media file found in VAST');
    }

    this.currentMediaFile = mediaFile;
    this.duration = vastData.creative?.duration || 0;

    // Fire impression tracking
    await this.fireTrackingEvent('impression');

    // Play based on media type
    if (this.vastParser.isVideo(mediaFile)) {
      await this.playVideo(mediaFile);
    } else if (this.vastParser.isImage(mediaFile)) {
      await this.playImage(mediaFile);
    } else {
      throw new Error(`Unsupported media type: ${mediaFile.type}`);
    }
  }

  /**
   * Play video using HTML5 video element
   */
  async playVideo(mediaFile) {
    this.log('Playing video', mediaFile);

    return new Promise((resolve, reject) => {
      // Create video element
      this.videoElement = document.createElement('video');
      this.videoElement.id = 'adlocaite-video';
      this.videoElement.src = mediaFile.url;
      this.videoElement.autoplay = true;
      this.videoElement.muted = false;
      
      // Set dimensions
      if (mediaFile.width && mediaFile.height) {
        this.videoElement.width = mediaFile.width;
        this.videoElement.height = mediaFile.height;
      }

      // Add to container
      this.containerElement.innerHTML = '';
      this.containerElement.appendChild(this.videoElement);

      // Timeout for loading
      const loadTimeout = setTimeout(() => {
        this.error('Video loading timeout');
        reject(new Error('Video loading timeout'));
      }, this.config.assetTimeout);

      // Event listeners
      this.videoElement.addEventListener('loadedmetadata', () => {
        clearTimeout(loadTimeout);
        this.duration = this.videoElement.duration;
        this.log(`Video loaded. Duration: ${this.duration}s`);
      });

      this.videoElement.addEventListener('play', () => {
        this.isPlaying = true;
        this.startTime = Date.now();
        this.broadsignAdapter.startPlayback();
        this.fireTrackingEvent('start');
        this.log('Video playback started');
      });

      this.videoElement.addEventListener('timeupdate', () => {
        this.handleVideoProgress();
      });

      this.videoElement.addEventListener('ended', async () => {
        this.log('Video playback ended');
        this.completionRate = 100;
        await this.fireTrackingEvent('complete');
        await this.confirmPlayout();
        this.cleanup();
        resolve();
      });

      this.videoElement.addEventListener('error', (e) => {
        clearTimeout(loadTimeout);
        this.error('Video playback error', e);
        this.cleanup();
        reject(new Error(`Video error: ${e.message || 'Unknown error'}`));
      });

      // Start loading
      this.videoElement.load();
    });
  }

  /**
   * Play image with timed duration
   */
  async playImage(mediaFile) {
    this.log('Playing image', mediaFile);

    return new Promise((resolve, reject) => {
      // Create image element
      this.imageElement = document.createElement('img');
      this.imageElement.id = 'adlocaite-image';
      this.imageElement.src = mediaFile.url;
      
      // Set dimensions
      if (mediaFile.width && mediaFile.height) {
        this.imageElement.width = mediaFile.width;
        this.imageElement.height = mediaFile.height;
      }

      // Add to container
      this.containerElement.innerHTML = '';
      this.containerElement.appendChild(this.imageElement);

      // Timeout for loading
      const loadTimeout = setTimeout(() => {
        this.error('Image loading timeout');
        reject(new Error('Image loading timeout'));
      }, this.config.assetTimeout);

      // On load
      this.imageElement.addEventListener('load', async () => {
        clearTimeout(loadTimeout);
        this.log('Image loaded');
        
        this.isPlaying = true;
        this.startTime = Date.now();
        this.broadsignAdapter.startPlayback();
        
        await this.fireTrackingEvent('start');
        
        // Use duration from VAST or default to 15 seconds
        const displayDuration = (this.duration || 15) * 1000;
        this.log(`Displaying image for ${displayDuration}ms`);
        
        // Simulate progress events for image
        this.simulateImageProgress(displayDuration);
        
        // Wait for duration
        setTimeout(async () => {
          this.completionRate = 100;
          await this.fireTrackingEvent('complete');
          await this.confirmPlayout();
          this.cleanup();
          resolve();
        }, displayDuration);
      });

      // On error
      this.imageElement.addEventListener('error', (e) => {
        clearTimeout(loadTimeout);
        this.error('Image loading error', e);
        this.cleanup();
        reject(new Error('Failed to load image'));
      });
    });
  }

  /**
   * Handle video progress and fire quartile tracking events
   */
  handleVideoProgress() {
    if (!this.videoElement || !this.duration) return;

    const currentTime = this.videoElement.currentTime;
    const progress = (currentTime / this.duration) * 100;
    this.completionRate = Math.floor(progress);

    // Fire quartile events
    if (progress >= 25 && !this.trackingFired.firstQuartile) {
      this.fireTrackingEvent('firstQuartile');
    } else if (progress >= 50 && !this.trackingFired.midpoint) {
      this.fireTrackingEvent('midpoint');
    } else if (progress >= 75 && !this.trackingFired.thirdQuartile) {
      this.fireTrackingEvent('thirdQuartile');
    }
  }

  /**
   * Simulate progress events for image display
   */
  simulateImageProgress(totalDuration) {
    const fireAt = (percent, eventName) => {
      setTimeout(() => {
        this.completionRate = percent;
        this.fireTrackingEvent(eventName);
      }, (totalDuration * percent) / 100);
    };

    fireAt(25, 'firstQuartile');
    fireAt(50, 'midpoint');
    fireAt(75, 'thirdQuartile');
  }

  /**
   * Fire VAST tracking event
   */
  async fireTrackingEvent(eventName) {
    if (this.trackingFired[eventName]) {
      return; // Already fired
    }

    this.trackingFired[eventName] = true;
    
    const urls = this.vastParser.getTrackingUrls(eventName);
    if (!urls || urls.length === 0) {
      this.log(`No tracking URLs for event: ${eventName}`);
      return;
    }

    this.log(`Firing tracking event: ${eventName}`, urls);

    // Fire all tracking pixels
    const promises = urls.map(url => this.fireTrackingPixel(url));
    
    try {
      await Promise.all(promises);
      this.log(`Tracking event fired successfully: ${eventName}`);
    } catch (err) {
      this.error(`Failed to fire tracking event: ${eventName}`, err);
      // Don't throw - tracking failures shouldn't stop playback
    }
  }

  /**
   * Fire a single tracking pixel
   */
  async fireTrackingPixel(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.log(`Tracking pixel fired: ${url}`);
        resolve();
      };
      img.onerror = () => {
        this.error(`Tracking pixel failed: ${url}`);
        resolve(); // Resolve anyway to not block other pixels
      };
      
      // Set timeout
      setTimeout(() => {
        this.log(`Tracking pixel timeout: ${url}`);
        resolve();
      }, 5000);
      
      img.src = url;
    });
  }

  /**
   * Confirm playout with Adlocaite API
   */
  async confirmPlayout() {
    if (!this.currentDealId) {
      this.log('No deal ID - skipping playout confirmation');
      return;
    }

    this.log(`Confirming playout for deal: ${this.currentDealId}`);

    try {
      const playoutData = this.broadsignAdapter.getPlayoutTrackingData();
      playoutData.completion_rate = this.completionRate;

      const response = await this.apiClient.confirmPlayout(
        this.currentDealId,
        playoutData
      );

      this.log('Playout confirmed successfully', response);
    } catch (err) {
      this.error('Failed to confirm playout', err);
      // Don't throw - playout confirmation failures shouldn't stop player
    }
  }

  /**
   * Show fallback content
   */
  showFallback(message = 'No ads available') {
    this.log('Showing fallback', message);
    
    this.containerElement.innerHTML = `
      <div class="adlocaite-fallback">
        <img src="assets/fallback.jpg" alt="Fallback content" class="fallback-image" />
        <div class="fallback-message">${message}</div>
      </div>
    `;
  }

  /**
   * Cleanup player resources
   */
  cleanup() {
    this.log('Cleaning up player');
    
    this.isPlaying = false;
    this.broadsignAdapter.endPlayback();
    
    // Remove video element
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.remove();
      this.videoElement = null;
    }

    // Remove image element
    if (this.imageElement) {
      this.imageElement.src = '';
      this.imageElement.remove();
      this.imageElement = null;
    }

    // Reset tracking
    this.trackingFired = {
      impression: false,
      start: false,
      firstQuartile: false,
      midpoint: false,
      thirdQuartile: false,
      complete: false
    };
  }

  /**
   * Stop playback
   */
  stop() {
    this.log('Stopping playback');
    this.cleanup();
  }
}

// Make class globally available
if (typeof window !== 'undefined') {
  window.AdlocaitePlayer = AdlocaitePlayer;
}


