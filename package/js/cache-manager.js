/**
 * Cache Manager
 * 
 * Handles asset pre-caching for offline playback:
 * - Background fetching of cacheable assets
 * - Browser cache management
 * - Cache expiry tracking
 * - Offline fallback support
 */

class CacheManager {
  constructor(config, apiClient) {
    this.config = config;
    this.apiClient = apiClient;
    
    this.cacheInterval = null;
    this.cachedAssets = new Map();
    this.isRunning = false;
  }

  /**
   * Log message if debug mode is enabled
   */
  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Cache Manager]`, message, data || '');
    }
  }

  /**
   * Log error message
   */
  error(message, data = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [Cache Manager Error]`, message, data || '');
  }

  /**
   * Start cache manager
   */
  start(screenId) {
    if (!this.config.enableCaching) {
      this.log('Caching disabled in config');
      return;
    }

    if (this.isRunning) {
      this.log('Cache manager already running');
      return;
    }

    this.isRunning = true;
    this.screenId = screenId;
    this.log(`Starting cache manager for screen: ${screenId}`);

    // Initial cache update
    this.updateCache();

    // Set up periodic updates
    this.cacheInterval = setInterval(() => {
      this.updateCache();
    }, this.config.cachingInterval);
  }

  /**
   * Stop cache manager
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.log('Stopping cache manager');
    this.isRunning = false;

    if (this.cacheInterval) {
      clearInterval(this.cacheInterval);
      this.cacheInterval = null;
    }
  }

  /**
   * Update cache with latest cacheable assets
   */
  async updateCache() {
    if (!this.screenId) {
      this.error('No screen ID available for caching');
      return;
    }

    this.log('Updating cache...');

    try {
      // Fetch cacheable assets
      const response = await this.apiClient.getCacheableAssets(this.screenId);
      
      if (!response || !response.assets) {
        this.log('No cacheable assets returned');
        return;
      }

      const assets = response.assets;
      this.log(`Found ${assets.length} cacheable assets`);

      // Prefetch each asset
      const prefetchPromises = assets.map(asset => 
        this.prefetchAsset(asset)
      );

      await Promise.allSettled(prefetchPromises);

      // Clean expired assets
      this.cleanExpiredAssets();

      this.log(`Cache update complete. Total cached: ${this.cachedAssets.size}`);

    } catch (err) {
      this.error('Failed to update cache', err);
    }
  }

  /**
   * Prefetch a single asset
   */
  async prefetchAsset(asset) {
    const url = asset.asset_url;
    
    // Check if already cached and not expired
    if (this.cachedAssets.has(url)) {
      const cached = this.cachedAssets.get(url);
      const expiresAt = new Date(asset.cache_expires_at || cached.cache_expires_at);
      
      if (expiresAt > new Date()) {
        this.log(`Asset already cached and valid: ${url}`);
        return;
      }
    }

    this.log(`Prefetching asset: ${url}`);

    try {
      // Use fetch with cache directive
      const response = await fetch(url, {
        method: 'GET',
        cache: 'force-cache',
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Store in memory map
      this.cachedAssets.set(url, {
        url: url,
        asset_id: asset.asset_id,
        cache_expires_at: asset.cache_expires_at,
        cached_at: new Date().toISOString(),
        size: response.headers.get('content-length'),
        type: response.headers.get('content-type')
      });

      this.log(`Asset cached successfully: ${url}`);

    } catch (err) {
      // Provide specific error messages for CORS issues
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        this.error(
          `CORS or network error fetching asset: ${url}. ` +
          `Ensure the asset server includes 'Access-Control-Allow-Origin: *' header. ` +
          `According to Broadsign docs, remote servers MUST include this header.`,
          err
        );
      } else {
        this.error(`Failed to prefetch asset: ${url}`, err);
      }
    }
  }

  /**
   * Clean expired assets from cache
   */
  cleanExpiredAssets() {
    const now = new Date();
    let cleaned = 0;

    for (const [url, asset] of this.cachedAssets.entries()) {
      if (!asset.cache_expires_at) {
        continue;
      }

      const expiresAt = new Date(asset.cache_expires_at);
      if (expiresAt < now) {
        this.log(`Removing expired asset: ${url}`);
        this.cachedAssets.delete(url);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.log(`Cleaned ${cleaned} expired assets`);
    }
  }

  /**
   * Check if asset is cached
   */
  isCached(url) {
    if (!this.cachedAssets.has(url)) {
      return false;
    }

    const asset = this.cachedAssets.get(url);
    if (!asset.cache_expires_at) {
      return true;
    }

    const expiresAt = new Date(asset.cache_expires_at);
    return expiresAt > new Date();
  }

  /**
   * Get cached asset info
   */
  getCachedAsset(url) {
    return this.cachedAssets.get(url) || null;
  }

  /**
   * Get all cached assets
   */
  getAllCachedAssets() {
    return Array.from(this.cachedAssets.values());
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const assets = this.getAllCachedAssets();
    const now = new Date();

    const stats = {
      total: assets.length,
      valid: 0,
      expired: 0,
      totalSize: 0,
      types: {}
    };

    assets.forEach(asset => {
      // Check expiry
      if (asset.cache_expires_at) {
        const expiresAt = new Date(asset.cache_expires_at);
        if (expiresAt > now) {
          stats.valid++;
        } else {
          stats.expired++;
        }
      } else {
        stats.valid++;
      }

      // Sum size
      if (asset.size) {
        stats.totalSize += parseInt(asset.size) || 0;
      }

      // Count types
      if (asset.type) {
        stats.types[asset.type] = (stats.types[asset.type] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Clear all cached assets
   */
  clearCache() {
    this.log('Clearing cache');
    this.cachedAssets.clear();
  }

  /**
   * Preload assets in DOM for faster loading
   * Creates <link rel="prefetch"> elements
   */
  preloadInDOM(urls) {
    this.log(`Preloading ${urls.length} assets in DOM`);

    urls.forEach(url => {
      // Check if already preloaded
      if (document.querySelector(`link[href="${url}"]`)) {
        return;
      }

      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = this.guessResourceType(url);
      
      document.head.appendChild(link);
    });
  }

  /**
   * Guess resource type from URL
   */
  guessResourceType(url) {
    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    
    if (['mp4', 'webm', 'ogg'].includes(ext)) {
      return 'video';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return 'image';
    } else if (['js'].includes(ext)) {
      return 'script';
    } else if (['css'].includes(ext)) {
      return 'style';
    }
    
    return 'fetch';
  }
}

// Make class globally available
if (typeof window !== 'undefined') {
  window.CacheManager = CacheManager;
}




