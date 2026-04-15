/**
 * Media Player
 *
 * Handles playback of pre-loaded video and image ads:
 * - Pre-loading during PREBUFFER phase (before BroadSignPlay)
 * - Instant playback of pre-loaded content
 * - VAST tracking pixel firing
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

  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Adlocaite Player]`, message, data || '');
    }
  }

  error(message, data = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [Adlocaite Player Error]`, message, data || '');
  }

  initialize(containerId) {
    this.containerElement = document.getElementById(containerId);
    if (!this.containerElement) {
      throw new Error(`Container element not found: ${containerId}`);
    }

    this.preloadedVideoElement = null;
    this.preloadedImageElement = null;
    this.preloadedMediaFile = null;
    this.isMediaPreloaded = false;

    this.log('Player initialized');
  }

  // ── Pre-loading (PREBUFFER phase) ─────────────────────────

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
   * Swap loading spinner with pre-loaded media element.
   * Called during PREBUFFER (off-screen) so the first frame
   * is already visible when BroadSignPlay() makes the page appear.
   */
  showPreloadedMedia() {
    if (!this.containerElement) return;
    this.containerElement.innerHTML = '';
    if (this.preloadedVideoElement) {
      this.containerElement.appendChild(this.preloadedVideoElement);
    } else if (this.preloadedImageElement) {
      this.containerElement.appendChild(this.preloadedImageElement);
    }
  }

  async preloadVideo(mediaFile) {
    this.log('Pre-loading video:', mediaFile.url);

    return new Promise((resolve, reject) => {
      this.preloadedVideoElement = document.createElement('video');
      this.preloadedVideoElement.id = 'adlocaite-video';
      this.preloadedVideoElement.preload = 'auto';
      this.preloadedVideoElement.muted = true;
      this.preloadedVideoElement.playsInline = true;
      this.preloadedVideoElement.autoplay = false;

      if (mediaFile.width && mediaFile.height) {
        this.preloadedVideoElement.width = mediaFile.width;
        this.preloadedVideoElement.height = mediaFile.height;
      }

      const loadTimeout = setTimeout(() => {
        cleanup();
        this.error('Video pre-load timeout');
        reject(new Error('Video pre-load timeout'));
      }, this.config.assetTimeout || 15000);

      const cleanup = () => {
        clearTimeout(loadTimeout);
        this.preloadedVideoElement.removeEventListener('canplay', onCanPlay);
        this.preloadedVideoElement.removeEventListener('error', onError);
      };

      const onCanPlay = () => {
        cleanup();
        this.duration = this.preloadedVideoElement.duration;
        this.log(`Video pre-loaded. Duration: ${this.duration}s, ready to play (streaming)`);
        resolve();
      };

      const onError = () => {
        cleanup();
        const videoError = this.preloadedVideoElement.error;
        this.error(`Video pre-load error: ${mediaFile.url}`, {
          code: videoError?.code, message: videoError?.message
        });
        reject(new Error(`Video pre-load error: ${videoError?.message || 'unknown'}`));
      };

      this.preloadedVideoElement.addEventListener('canplay', onCanPlay);
      this.preloadedVideoElement.addEventListener('error', onError);

      this.preloadedVideoElement.src = mediaFile.url;
      this.preloadedVideoElement.load();
    });
  }

  async preloadImage(mediaFile) {
    this.log('Pre-loading image:', mediaFile.url);

    return new Promise((resolve, reject) => {
      this.preloadedImageElement = document.createElement('img');
      this.preloadedImageElement.id = 'adlocaite-image';

      if (mediaFile.width && mediaFile.height) {
        this.preloadedImageElement.width = mediaFile.width;
        this.preloadedImageElement.height = mediaFile.height;
      }

      const loadTimeout = setTimeout(() => {
        cleanup();
        this.error('Image pre-load timeout');
        reject(new Error('Image pre-load timeout'));
      }, this.config.assetTimeout || 15000);

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

      const onError = () => {
        cleanup();
        this.error(`Image pre-load error: ${mediaFile.url}`);
        reject(new Error(`Image pre-load error: ${mediaFile.url}`));
      };

      this.preloadedImageElement.addEventListener('load', onLoad);
      this.preloadedImageElement.addEventListener('error', onError);

      this.preloadedImageElement.src = mediaFile.url;
    });
  }

  // ── Playback (BroadSignPlay phase) ────────────────────────

  async playPreloaded(vastData, dealId) {
    this.log('Playing pre-loaded media');

    if (!this.isMediaPreloaded || !this.preloadedMediaFile) {
      throw new Error('No pre-loaded media available');
    }

    this.currentDealId = dealId;
    this.currentMediaFile = this.preloadedMediaFile;
    this.duration = vastData.creative?.duration || this.duration || 0;

    await this.fireTrackingEvent('impression');

    if (this.vastParser.isVideo(this.preloadedMediaFile)) {
      await this.playPreloadedVideo();
    } else if (this.vastParser.isImage(this.preloadedMediaFile)) {
      await this.playPreloadedImage();
    }
  }

  async playPreloadedVideo() {
    this.log('Starting pre-loaded video playback');

    if (!this.preloadedVideoElement) {
      throw new Error('No pre-loaded video element');
    }

    return new Promise((resolve, reject) => {
      this.videoElement = this.preloadedVideoElement;

      // Only manipulate DOM if video isn't already in the container
      // (showPreloadedMedia() may have placed it during PREBUFFER)
      if (this.videoElement.parentNode !== this.containerElement) {
        this.containerElement.innerHTML = '';
        this.containerElement.appendChild(this.videoElement);
      }

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

      this.videoElement.addEventListener('error', () => {
        // Use local ref — this.videoElement may be null after cleanup
        const videoError = this.videoElement?.error;
        this.error('Video playback error', {
          code: videoError?.code, message: videoError?.message
        });
        this.cleanup();
        reject(new Error(`Video playback error: ${videoError?.message || 'unknown'}`));
      }, { once: true });

      this.videoElement.play().catch(err => {
        this.error('Failed to start video playback:', err);
        reject(err);
      });
    });
  }

  async playPreloadedImage() {
    this.log('Starting pre-loaded image display');

    if (!this.preloadedImageElement) {
      throw new Error('No pre-loaded image element');
    }

    return new Promise((resolve) => {
      this.imageElement = this.preloadedImageElement;

      // Only manipulate DOM if image isn't already in the container
      if (this.imageElement.parentNode !== this.containerElement) {
        this.containerElement.innerHTML = '';
        this.containerElement.appendChild(this.imageElement);
      }

      this.isPlaying = true;
      this.startTime = Date.now();
      this.broadsignAdapter.startPlayback();

      this.fireTrackingEvent('start');
      this.log('Image display started (instant)');

      // Use duration from VAST or default to 10 seconds (standard slot)
      const displayDuration = (this.duration || 10) * 1000;
      this.log(`Displaying image for ${displayDuration}ms`);

      this.simulateImageProgress(displayDuration);

      setTimeout(async () => {
        this.completionRate = 100;
        await this.fireTrackingEvent('complete');
        await this.confirmPlayout();
        this.cleanup();
        resolve();
      }, displayDuration);
    });
  }

  // ── Tracking ──────────────────────────────────────────────

  handleVideoProgress() {
    if (!this.videoElement || !this.duration || this.duration <= 0) {
      return;
    }

    const currentTime = this.videoElement.currentTime;
    const progress = (currentTime / this.duration) * 100;
    this.completionRate = Math.floor(progress);

    if (progress >= 25 && !this.trackingFired.firstQuartile) {
      this.fireTrackingEvent('firstQuartile');
    } else if (progress >= 50 && !this.trackingFired.midpoint) {
      this.fireTrackingEvent('midpoint');
    } else if (progress >= 75 && !this.trackingFired.thirdQuartile) {
      this.fireTrackingEvent('thirdQuartile');
    }
  }

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

  async fireTrackingEvent(eventName) {
    if (this.trackingFired[eventName]) return;

    this.trackingFired[eventName] = true;

    const urls = this.vastParser.getTrackingUrls(eventName);
    if (!urls || urls.length === 0) {
      this.log(`No tracking URLs for event: ${eventName}`);
      return;
    }

    this.log(`Firing tracking event: ${eventName}`, urls);

    try {
      await Promise.all(urls.map(url => this.fireTrackingPixel(url)));
      this.log(`Tracking event fired successfully: ${eventName}`);
    } catch (err) {
      this.error(`Failed to fire tracking event: ${eventName}`, err);
    }
  }

  async fireTrackingPixel(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Don't block on tracking failures
      setTimeout(() => resolve(), 5000);
      img.src = url;
    });
  }

  // ── Playout confirmation ──────────────────────────────────

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
    }
  }

  // ── Cleanup ───────────────────────────────────────────────

  cleanup() {
    this.log('Cleaning up player');

    this.isPlaying = false;
    this.broadsignAdapter.endPlayback();

    if (this.videoElement) {
      // Remove error listener before clearing src (setting src='' fires an error event)
      this.videoElement.onerror = null;
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
      this.videoElement.remove();
      this.videoElement = null;
    }

    if (this.preloadedVideoElement && this.preloadedVideoElement !== this.videoElement) {
      this.preloadedVideoElement.onerror = null;
      this.preloadedVideoElement.pause();
      this.preloadedVideoElement.removeAttribute('src');
      this.preloadedVideoElement.load();
      this.preloadedVideoElement.remove();
    }
    this.preloadedVideoElement = null;

    if (this.imageElement) {
      this.imageElement.src = '';
      this.imageElement.remove();
      this.imageElement = null;
    }

    if (this.preloadedImageElement && this.preloadedImageElement !== this.imageElement) {
      this.preloadedImageElement.src = '';
      this.preloadedImageElement.remove();
    }
    this.preloadedImageElement = null;

    this.preloadedMediaFile = null;
    this.isMediaPreloaded = false;

    this.trackingFired = {
      impression: false,
      start: false,
      firstQuartile: false,
      midpoint: false,
      thirdQuartile: false,
      complete: false
    };
  }

  stop() {
    this.log('Stopping playback');
    this.cleanup();
  }
}

if (typeof window !== 'undefined') {
  window.AdlocaitePlayer = AdlocaitePlayer;
}
