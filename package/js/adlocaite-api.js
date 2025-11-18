/**
 * Adlocaite API Client
 * 
 * Handles all communication with the Adlocaite API including:
 * - Offer requests
 * - Offer responses (accept/reject)
 * - Playout confirmation
 * - Cacheable assets retrieval
 */

class AdlocaiteAPIClient {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
    this.requestTimeout = config.requestTimeout || 10000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Log message if debug mode is enabled
   */
  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Adlocaite API]`, message, data || '');
    }
  }

  /**
   * Log error message
   */
  error(message, data = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [Adlocaite API Error]`, message, data || '');
  }

  /**
   * Make HTTP request with timeout and retry logic
   */
  async makeRequest(url, options = {}, retryCount = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      this.log(`Making request to: ${url}`, options);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });

      clearTimeout(timeoutId);

      this.log(`Response status: ${response.status}`);

      // Handle different status codes
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else if (contentType && contentType.includes('text/xml')) {
          return await response.text();
        } else {
          return await response.text();
        }
      }

      // Handle non-OK responses
      const errorData = {
        status: response.status,
        statusText: response.statusText
      };

      try {
        const errorBody = await response.json();
        errorData.body = errorBody;
      } catch (e) {
        errorData.body = await response.text();
      }

      // CRITICAL: Handle 404 gracefully to prevent Broadsign auto-skip
      // According to Broadsign docs: "HTTP errors (4xx/5xx) trigger automatic playback skipping"
      // We return a special object instead of throwing to allow fallback content
      if (response.status === 404) {
        this.log('No offers available (404) - returning gracefully');
        return {
          noOffersAvailable: true,
          status: 404,
          message: 'No offers available for this screen'
        };
      }

      // Retry on 5xx errors
      if (response.status >= 500 && retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        this.log(`Retrying after ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }

      // For other 4xx errors, log but don't throw (prevents Broadsign auto-skip)
      if (response.status >= 400 && response.status < 500) {
        this.error(`Client error ${response.status}: ${response.statusText}`, errorData);
        return {
          error: true,
          status: response.status,
          message: `Client error: ${response.statusText}`,
          data: errorData
        };
      }

      // 5xx errors after retries exhausted
      throw new Error(`API request failed: ${JSON.stringify(errorData)}`);

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        this.error('Request timeout');
        throw new Error('Request timeout');
      }

      // Retry on network errors
      if (retryCount < this.maxRetries && err.message.includes('fetch')) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        this.log(`Retrying after network error: ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retryCount + 1);
      }

      this.error('Request failed', err);
      throw err;
    }
  }

  /**
   * Request an offer for a screen
   * 
   * @param {string} screenId - Screen UUID or external ID
   * @param {object} options - Request options
   * @param {number} options.minBidCents - Minimum bid in cents
   * @param {boolean} options.vast - Request VAST XML format
   * @param {boolean} options.demo - Demo mode
   * @returns {Promise<object|string>} Offer data (JSON) or VAST XML (string)
   */
  async requestOffer(screenId, options = {}) {
    const params = new URLSearchParams();
    
    const minBidCents = options.minBidCents || this.config.minBidCents;
    if (minBidCents) {
      params.append('min_bid_cents', minBidCents);
    }

    if (options.vast !== undefined ? options.vast : this.config.vastMode) {
      params.append('vast', 'true');
    }

    if (options.demo) {
      params.append('demo', 'true');
    }

    const url = `${this.baseUrl}/offers/request/${screenId}?${params.toString()}`;
    
    this.log(`Requesting offer for screen: ${screenId}`);
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET'
      });

      this.log('Offer received', response);
      return response;
    } catch (err) {
      this.error(`Failed to request offer for screen ${screenId}`, err);
      throw err;
    }
  }

  /**
   * Request offer using external screen ID
   * 
   * @param {string} externalId - External screen identifier
   * @param {object} options - Request options
   * @returns {Promise<object|string>} Offer data (JSON) or VAST XML (string)
   */
  async requestOfferByExternalId(externalId, options = {}) {
    const params = new URLSearchParams();
    
    const minBidCents = options.minBidCents || this.config.minBidCents;
    if (minBidCents) {
      params.append('min_bid_cents', minBidCents);
    }

    if (options.vast !== undefined ? options.vast : this.config.vastMode) {
      params.append('vast', 'true');
    }

    if (options.demo) {
      params.append('demo', 'true');
    }

    const url = `${this.baseUrl}/offers/request/external-id/${externalId}?${params.toString()}`;
    
    this.log(`Requesting offer for external ID: ${externalId}`);
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET'
      });

      this.log('Offer received', response);
      return response;
    } catch (err) {
      this.error(`Failed to request offer for external ID ${externalId}`, err);
      throw err;
    }
  }

  /**
   * Accept or reject an offer
   * 
   * @param {string} offerId - Offer ID
   * @param {object} responseData - Response data
   * @param {string} responseData.action - 'accept' or 'reject'
   * @param {number} responseData.accepted_price_cents - Price if accepting
   * @param {string} responseData.rejection_reason - Reason if rejecting
   * @returns {Promise<object>} Response confirmation
   */
  async respondToOffer(offerId, responseData) {
    const url = `${this.baseUrl}/offers/response/${offerId}`;
    
    this.log(`Responding to offer: ${offerId}`, responseData);
    
    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(responseData)
      });

      this.log('Offer response confirmed', response);
      return response;
    } catch (err) {
      this.error(`Failed to respond to offer ${offerId}`, err);
      throw err;
    }
  }

  /**
   * Accept an offer (convenience method)
   * 
   * @param {string} offerId - Offer ID
   * @param {number} acceptedPriceCents - Accepted price in cents
   * @returns {Promise<object>} Response with deal_id
   */
  async acceptOffer(offerId, acceptedPriceCents) {
    return this.respondToOffer(offerId, {
      action: 'accept',
      accepted_price_cents: acceptedPriceCents
    });
  }

  /**
   * Reject an offer (convenience method)
   * 
   * @param {string} offerId - Offer ID
   * @param {string} rejectionReason - Reason for rejection
   * @returns {Promise<object>} Rejection confirmation
   */
  async rejectOffer(offerId, rejectionReason = 'Not suitable') {
    return this.respondToOffer(offerId, {
      action: 'reject',
      rejection_reason: rejectionReason
    });
  }

  /**
   * Confirm playout of an ad
   * 
   * @param {string} dealId - Deal ID from accepted offer
   * @param {object} playoutData - Optional playout tracking data
   * @param {string} playoutData.played_at - ISO 8601 timestamp
   * @param {number} playoutData.duration_seconds - Actual duration
   * @param {number} playoutData.completion_rate - Completion percentage (0-100)
   * @param {string} playoutData.player_version - Player version
   * @param {string} playoutData.screen_resolution - Screen resolution
   * @returns {Promise<object>} Playout confirmation
   */
  async confirmPlayout(dealId, playoutData = {}) {
    const url = `${this.baseUrl}/playout/confirm/${dealId}`;
    
    this.log(`Confirming playout for deal: ${dealId}`, playoutData);
    
    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(playoutData)
      });

      this.log('Playout confirmed', response);
      return response;
    } catch (err) {
      this.error(`Failed to confirm playout for deal ${dealId}`, err);
      throw err;
    }
  }

  /**
   * Get cacheable assets for a screen
   * 
   * @param {string} screenId - Screen UUID
   * @param {object} options - Request options
   * @param {number} options.minBidCents - Minimum bid filter
   * @returns {Promise<object>} Cacheable assets list
   */
  async getCacheableAssets(screenId, options = {}) {
    const params = new URLSearchParams();
    
    const minBidCents = options.minBidCents || this.config.minBidCents;
    if (minBidCents) {
      params.append('min_bid_cents', minBidCents);
    }

    const url = `${this.baseUrl}/screens/${screenId}/cacheable-assets?${params.toString()}`;
    
    this.log(`Requesting cacheable assets for screen: ${screenId}`);
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET'
      });

      this.log('Cacheable assets received', response);
      return response;
    } catch (err) {
      this.error(`Failed to get cacheable assets for screen ${screenId}`, err);
      throw err;
    }
  }

  /**
   * Get cacheable assets using external screen ID
   * 
   * @param {string} externalId - External screen identifier
   * @param {object} options - Request options
   * @returns {Promise<object>} Cacheable assets list
   */
  async getCacheableAssetsByExternalId(externalId, options = {}) {
    const params = new URLSearchParams();
    
    const minBidCents = options.minBidCents || this.config.minBidCents;
    if (minBidCents) {
      params.append('min_bid_cents', minBidCents);
    }

    const url = `${this.baseUrl}/screens/external-id/${externalId}/cacheable-assets?${params.toString()}`;
    
    this.log(`Requesting cacheable assets for external ID: ${externalId}`);
    
    try {
      const response = await this.makeRequest(url, {
        method: 'GET'
      });

      this.log('Cacheable assets received', response);
      return response;
    } catch (err) {
      this.error(`Failed to get cacheable assets for external ID ${externalId}`, err);
      throw err;
    }
  }
}

// Make class globally available
if (typeof window !== 'undefined') {
  window.AdlocaiteAPIClient = AdlocaiteAPIClient;
}




