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

    // Pre-loaded media state
    this.preloadedVideoElement = null;
    this.preloadedImageElement = null;
    this.preloadedMediaFile = null;
    this.isMediaPreloaded = false;

    this.log('Player initialized');
  }

  /**
   * Pre-load media asset for instant playback
   * Called during off-screen buffering phase, BEFORE BroadSignPlay()
   */
  async preloadMedia(mediaFile) {
    this.log('Pre-loading media:', mediaFile.url);
    this.preloadedMediaFile = mediaFile;

    if (this.vastParser.isVideo(mediaFile)) {
      await this.preloadVideo(mediaFile);
    } else if (this.vastParser.isImage(mediaFile)) {
      await this.preloadImage(mediaFile);
    } else {
      throw new Error(`Unsupported media type: ${mediaFile.type}`);
    }

    this.isMediaPreloaded = true;
    this.log('Media pre-loaded successfully');
  }

  /**
   * Pre-load video with proper buffering
   * Uses canplaythrough event to ensure enough is buffered
   */
  async preloadVideo(mediaFile) {
    this.log('Pre-loading video:', mediaFile.url);

    return new Promise((resolve, reject) => {
      // Create video element for pre-loading
      this.preloadedVideoElement = document.createElement('video');
      this.preloadedVideoElement.id = 'adlocaite-video';

      // CRITICAL: Set preload="auto" for aggressive buffering
      this.preloadedVideoElement.preload = 'auto';

      // CRITICAL: muted=true required for Chromium v87+ autoplay
      this.preloadedVideoElement.muted = true;
      this.preloadedVideoElement.playsInline = true;

      // Do NOT set autoplay - we control when it plays
      this.preloadedVideoElement.autoplay = false;

      // Set dimensions
      if (mediaFile.width && mediaFile.height) {
        this.preloadedVideoElement.width = mediaFile.width;
        this.preloadedVideoElement.height = mediaFile.height;
      }

      // Timeout for pre-loading
      const loadTimeout = setTimeout(() => {
        cleanup();
        this.error('Video pre-load timeout');
        reject(new Error('Video pre-load timeout'));
      }, this.config.assetTimeout);

      // Cleanup function to remove all listeners
      const cleanup = () => {
        clearTimeout(loadTimeout);
        this.preloadedVideoElement.removeEventListener('canplaythrough', onCanPlayThrough);
        this.preloadedVideoElement.removeEventListener('error', onError);
      };

      // CRITICAL: Use canplaythrough instead of loadedmetadata
      // canplaythrough = browser estimates it can play through without buffering
      const onCanPlayThrough = () => {
        cleanup();
        this.duration = this.preloadedVideoElement.duration;
        this.log(`Video pre-loaded. Duration: ${this.duration}s, buffered and ready`);
        resolve();
      };

      const onError = (e) => {
        cleanup();
        const videoError = this.preloadedVideoElement.error;
        this.error(`Video pre-load error: ${mediaFile.url}`, {
          code: videoError?.code,
          message: videoError?.message
        });
        reject(new Error(`Video pre-load error: ${videoError?.message || 'unknown'}`));
      };

      this.preloadedVideoElement.addEventListener('canplaythrough', onCanPlayThrough);
      this.preloadedVideoElement.addEventListener('error', onError);

      // Start loading
      this.preloadedVideoElement.src = mediaFile.url;
      this.preloadedVideoElement.load();
    });
  }

  /**
   * Pre-load image
   */
  async preloadImage(mediaFile) {
    this.log('Pre-loading image:', mediaFile.url);

    return new Promise((resolve, reject) => {
      this.preloadedImageElement = document.createElement('img');
      this.preloadedImageElement.id = 'adlocaite-image';

      // Set dimensions
      if (mediaFile.width && mediaFile.height) {
        this.preloadedImageElement.width = mediaFile.width;
        this.preloadedImageElement.height = mediaFile.height;
      }

      // Timeout
      const loadTimeout = setTimeout(() => {
        cleanup();
        this.error('Image pre-load timeout');
        reject(new Error('Image pre-load timeout'));
      }, this.config.assetTimeout);

      // Cleanup function to remove all listeners
      const cleanup = () => {
        clearTimeout(loadTimeout);
        this.preloadedImageElement.removeEventListener('load', onLoad);
        this.preloadedImageElement.removeEventListener('error', onError);
      };

      const onLoad = () => {
        cleanup();
        this.log('Image pre-loaded successfully');
        resolve();
      };

      const onError = (e) => {
        cleanup();
        this.error(`Image pre-load error: ${mediaFile.url}`);
        reject(new Error(`Image pre-load error: ${mediaFile.url}`));
      };

      this.preloadedImageElement.addEventListener('load', onLoad);
      this.preloadedImageElement.addEventListener('error', onError);

      // Start loading
      this.preloadedImageElement.src = mediaFile.url;
    });
  }

  /**
   * Play pre-loaded media instantly
   * Called when BroadSignPlay() is triggered
   */
  async playPreloaded(vastData, dealId) {
    this.log('Playing pre-loaded media');

    if (!this.isMediaPreloaded || !this.preloadedMediaFile) {
      throw new Error('No pre-loaded media available');
    }

    this.currentDealId = dealId;
    this.currentMediaFile = this.preloadedMediaFile;
    this.duration = vastData.creative?.duration || this.duration || 0;

    // Fire impression tracking
    await this.fireTrackingEvent('impression');

    // Play based on media type
    if (this.vastParser.isVideo(this.preloadedMediaFile)) {
      await this.playPreloadedVideo();
    } else if (this.vastParser.isImage(this.preloadedMediaFile)) {
      await this.playPreloadedImage();
    }
  }

  /**
   * Play pre-loaded video instantly
   */
  async playPreloadedVideo() {
    this.log('Starting pre-loaded video playback');

    if (!this.preloadedVideoElement) {
      throw new Error('No pre-loaded video element');
    }

    return new Promise((resolve, reject) => {
      this.videoElement = this.preloadedVideoElement;

      // Add to container (video is already buffered)
      this.containerElement.innerHTML = '';
      this.containerElement.appendChild(this.videoElement);

      // Set up playback event listeners
      this.videoElement.addEventListener('play', () => {
        this.isPlaying = true;
        this.startTime = Date.now();
        this.broadsignAdapter.startPlayback();
        this.fireTrackingEvent('start');
        this.log('Video playback started (instant)');
      }, { once: true });

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
      }, { once: true });

      this.videoElement.addEventListener('error', (e) => {
        const videoError = this.videoElement.error;
        this.error('Video playback error', {
          code: videoError?.code,
          message: videoError?.message
        });
        this.cleanup();
        reject(new Error(`Video playback error: ${videoError?.message || 'unknown'}`));
      }, { once: true });

      // Start playback immediately - video is already buffered!
      this.videoElement.play().catch(err => {
        this.error('Failed to start video playback:', err);
        reject(err);
      });
    });
  }

  /**
   * Play pre-loaded image instantly
   */
  async playPreloadedImage() {
    this.log('Starting pre-loaded image display');

    if (!this.preloadedImageElement) {
      throw new Error('No pre-loaded image element');
    }

    return new Promise((resolve) => {
      this.imageElement = this.preloadedImageElement;

      // Add to container (image is already loaded)
      this.containerElement.innerHTML = '';
      this.containerElement.appendChild(this.imageElement);

      // Mark as playing
      this.isPlaying = true;
      this.startTime = Date.now();
      this.broadsignAdapter.startPlayback();

      this.fireTrackingEvent('start');
      this.log('Image display started (instant)');

      // Use duration from VAST or default to 15 seconds
      const displayDuration = (this.duration || 15) * 1000;
      this.log(`Displaying image for ${displayDuration}ms`);

      // Simulate progress events
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

      // CRITICAL: Chromium v87+ requires muted=true for autoplay to work
      // According to Chromium autoplay policies, videos with audio cannot autoplay unmuted
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;  // Required for embedded/mobile contexts

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
        this.cleanup();
        reject(new Error('Video loading timeout'));
      }, this.config.assetTimeout);

      // Helper to clear timeout safely
      const clearLoadTimeout = () => {
        if (loadTimeout) {
          clearTimeout(loadTimeout);
        }
      };

      // Event listeners
      this.videoElement.addEventListener('loadedmetadata', () => {
        clearLoadTimeout();
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
        clearLoadTimeout();
        this.log('Video playback ended');
        this.completionRate = 100;
        await this.fireTrackingEvent('complete');
        await this.confirmPlayout();
        this.cleanup();
        resolve();
      });

      this.videoElement.addEventListener('error', (e) => {
        clearLoadTimeout();
        const videoError = this.videoElement.error;
        const errorDetails = {
          url: mediaFile.url,
          type: mediaFile.type,
          code: videoError ? videoError.code : 'unknown',
          message: videoError ? videoError.message : 'unknown'
        };
        this.error(`Video playback error: ${mediaFile.url}`, errorDetails);
        this.cleanup();
        reject(new Error(`Video error: ${errorDetails.message} (code: ${errorDetails.code})`));
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
    this.log(`Image URL: ${mediaFile.url}`);

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
        this.cleanup();
        reject(new Error('Image loading timeout'));
      }, this.config.assetTimeout);

      // Helper to clear timeout safely
      const clearLoadTimeout = () => {
        if (loadTimeout) {
          clearTimeout(loadTimeout);
        }
      };

      // On load
      this.imageElement.addEventListener('load', async () => {
        clearLoadTimeout();
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
        clearLoadTimeout();
        this.error(`Image loading error: ${mediaFile.url}`, {
          url: mediaFile.url,
          type: mediaFile.type,
          event: e
        });
        this.cleanup();
        reject(new Error(`Failed to load image: ${mediaFile.url}`));
      });
    });
  }

  /**
   * Handle video progress and fire quartile tracking events
   */
  handleVideoProgress() {
    // Guard against invalid duration (0, negative, or undefined)
    if (!this.videoElement || !this.duration || this.duration <= 0) {
      return;
    }

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

    // Remove pre-loaded video element (if different from videoElement)
    if (this.preloadedVideoElement && this.preloadedVideoElement !== this.videoElement) {
      this.preloadedVideoElement.pause();
      this.preloadedVideoElement.src = '';
      this.preloadedVideoElement.remove();
    }
    this.preloadedVideoElement = null;

    // Remove image element
    if (this.imageElement) {
      this.imageElement.src = '';
      this.imageElement.remove();
      this.imageElement = null;
    }

    // Remove pre-loaded image element (if different from imageElement)
    if (this.preloadedImageElement && this.preloadedImageElement !== this.imageElement) {
      this.preloadedImageElement.src = '';
      this.preloadedImageElement.remove();
    }
    this.preloadedImageElement = null;

    // Reset pre-load state
    this.preloadedMediaFile = null;
    this.isMediaPreloaded = false;

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






