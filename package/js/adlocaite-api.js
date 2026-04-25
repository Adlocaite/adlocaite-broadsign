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
  /**
   * Make HTTP request with timeout and retry logic
   *
   * @param {string} url
   * @param {object} options - fetch options
   * @param {number} retryCount - current retry attempt (internal)
   * @param {object} retryOpts - override timeout/retry behaviour per call
   * @param {number} retryOpts.timeout - request timeout in ms
   * @param {number} retryOpts.maxRetries - max retry attempts
   * @param {number} retryOpts.retryDelay - delay before retry in ms
   * @param {number} retryOpts.retryTimeout - timeout for retry attempts (defaults to retryOpts.timeout)
   */
  async makeRequest(url, options = {}, retryCount = 0, retryOpts = {}) {
    const maxRetries = retryOpts.maxRetries ?? this.maxRetries;
    const retryDelay = retryOpts.retryDelay ?? this.retryDelay;
    // On retry attempts, use retryTimeout if provided (warm server needs less time)
    const timeout = (retryCount > 0 && retryOpts.retryTimeout)
      ? retryOpts.retryTimeout
      : (retryOpts.timeout ?? this.requestTimeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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
      if (response.status >= 500 && retryCount < maxRetries) {
        this.log(`Retrying after ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.makeRequest(url, options, retryCount + 1, retryOpts);
      }

      // For other 4xx errors, log but don't throw (prevents Broadsign auto-skip)
      if (response.status >= 400 && response.status < 500) {
        const apiMessage = (errorData.body && typeof errorData.body === 'object')
          ? (errorData.body.error || errorData.body.message || `HTTP ${response.status}`)
          : `HTTP ${response.status}`;
        this.error(`API error ${response.status}: ${apiMessage}`, errorData);
        return {
          error: true,
          status: response.status,
          message: apiMessage,
          errorCode: errorData.body?.error_code || null,
          data: errorData
        };
      }

      // 5xx errors after retries exhausted
      // CRITICAL: Check if this is a "screen not found" or "no offers" error
      // These should be treated gracefully like 404 instead of throwing
      if (errorData.body && typeof errorData.body === 'object') {
        const errorMessage = errorData.body.error || errorData.body.message || '';
        if (errorMessage.toLowerCase().includes('screen') ||
            errorMessage.toLowerCase().includes('not found') ||
            errorMessage.toLowerCase().includes('no offer') ||
            errorMessage.toLowerCase().includes('unknown')) {
          this.log('500 error appears to be "no offers/screen not found" - handling gracefully');
          return {
            noOffersAvailable: true,
            status: response.status,
            message: errorMessage || 'No offers available'
          };
        }
      }

      // Other 5xx errors - throw to trigger fallback
      throw new Error(`API request failed: ${JSON.stringify(errorData)}`);

    } catch (err) {
      clearTimeout(timeoutId);

      // Retry on timeout AND network errors (single retry, no backoff)
      if (retryCount < maxRetries && (err.name === 'AbortError' || err instanceof TypeError || err.name === 'TypeError')) {
        this.log(`Retrying after ${err.name === 'AbortError' ? 'timeout' : 'network error'}: ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.makeRequest(url, options, retryCount + 1, retryOpts);
      }

      if (err.name === 'AbortError') {
        this.error('Request timeout');
        throw new Error('Request timeout');
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
   * @param {number} options.minBidCents - Minimum bid in cents (supports sub-cent decimals)
   * @param {boolean} options.vast - Request VAST XML format
   * @param {boolean} options.demo - Demo mode
   * @returns {Promise<object|string>} Offer data (JSON) or VAST XML (string)
   */
  async requestOffer(screenId, options = {}) {
    const params = new URLSearchParams();
    
    const minBidCents = options.minBidCents ?? this.config.minBidCents ?? 0;
    params.append('min_bid_cents', minBidCents);

    if (options.vast !== undefined ? options.vast : this.config.vastMode) {
      params.append('vast', 'true');
    }

    if (options.demo) {
      params.append('demo', 'true');
    }

    const url = `${this.baseUrl}/offers/request/${screenId}?${params.toString()}`;

    this.log(`Requesting offer for screen: ${screenId}`);

    // Offer requests use aggressive timeouts to fit within PREBUFFER window
    // Cold start scenario: 2s timeout → 250ms wait → retry succeeds
    const offerRetryOpts = { timeout: 2000, maxRetries: 1, retryDelay: 250, retryTimeout: 1000 };

    try {
      const response = await this.makeRequest(url, {
        method: 'GET'
      }, 0, offerRetryOpts);

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
    
    const minBidCents = options.minBidCents ?? this.config.minBidCents ?? 0;
    params.append('min_bid_cents', minBidCents);

    if (options.vast !== undefined ? options.vast : this.config.vastMode) {
      params.append('vast', 'true');
    }

    if (options.demo) {
      params.append('demo', 'true');
    }

    const url = `${this.baseUrl}/offers/request/external-id/${externalId}?${params.toString()}`;

    this.log(`Requesting offer for external ID: ${externalId}`);

    // Offer requests use aggressive timeouts to fit within PREBUFFER window
    // Cold start scenario: 2s timeout → 250ms wait → retry succeeds
    const offerRetryOpts = { timeout: 2000, maxRetries: 1, retryDelay: 250, retryTimeout: 1000 };

    try {
      const response = await this.makeRequest(url, {
        method: 'GET'
      }, 0, offerRetryOpts);

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
   * @param {number} responseData.accepted_price_cents - Price if accepting (supports sub-cent decimals)
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
   * @param {number} acceptedPriceCents - Accepted price in cents (supports sub-cent decimals)
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

}

// Make class globally available
if (typeof window !== 'undefined') {
  window.AdlocaiteAPIClient = AdlocaiteAPIClient;
}






