/**
 * VAST Parser
 * 
 * Parses VAST XML (Video Ad Serving Template) and extracts:
 * - MediaFile URLs (video/image assets)
 * - Tracking events (impression, start, complete, etc.)
 * - Deal ID from custom extensions
 * - Ad metadata (duration, dimensions, etc.)
 * 
 * Supports VAST 2.0, 3.0, and 4.0
 */

class VASTParser {
  constructor(config) {
    this.config = config;
    this.xmlDoc = null;
    this.parsedData = null;
  }

  /**
   * Log message if debug mode is enabled
   */
  log(message, data = null) {
    if (this.config.debugMode) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [VAST Parser]`, message, data || '');
    }
  }

  /**
   * Log error message
   */
  error(message, data = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [VAST Parser Error]`, message, data || '');
  }

  /**
   * Parse VAST XML string
   * 
   * @param {string} xmlString - VAST XML content
   * @returns {object} Parsed VAST data
   */
  parse(xmlString) {
    this.log('Parsing VAST XML');
    
    try {
      // Parse XML string
      const parser = new DOMParser();
      this.xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parsing errors
      const parserError = this.xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error(`XML parsing error: ${parserError.textContent}`);
      }

      // Extract VAST data
      this.parsedData = {
        version: this.getVASTVersion(),
        ad: this.parseAd(),
        creative: this.parseCreative(),
        mediaFiles: this.parseMediaFiles(),
        trackingEvents: this.parseTrackingEvents(),
        clickTracking: this.parseClickTracking(),
        customExtensions: this.parseCustomExtensions()
      };

      this.log('VAST parsed successfully', this.parsedData);
      return this.parsedData;

    } catch (err) {
      this.error('Failed to parse VAST XML', err);
      throw err;
    }
  }

  /**
   * Get VAST version from XML
   */
  getVASTVersion() {
    const vastElement = this.xmlDoc.querySelector('VAST');
    return vastElement ? vastElement.getAttribute('version') : 'unknown';
  }

  /**
   * Parse Ad element
   */
  parseAd() {
    const adElement = this.xmlDoc.querySelector('Ad');
    if (!adElement) {
      this.error('No Ad element found in VAST');
      return null;
    }

    return {
      id: adElement.getAttribute('id'),
      sequence: adElement.getAttribute('sequence'),
      adSystem: this.getTextContent('AdSystem'),
      adTitle: this.getTextContent('AdTitle'),
      description: this.getTextContent('Description'),
      advertiser: this.getTextContent('Advertiser'),
      pricing: this.getTextContent('Pricing')
    };
  }

  /**
   * Parse Creative element (Linear, NonLinear, or CompanionAds)
   */
  parseCreative() {
    // Try Linear creative first (video ads)
    const linear = this.xmlDoc.querySelector('Linear');
    if (linear) {
      return {
        type: 'Linear',
        duration: this.parseDuration(this.getTextContent('Duration', linear)),
        skipOffset: linear.getAttribute('skipoffset'),
        adParameters: this.getTextContent('AdParameters', linear)
      };
    }

    // Try NonLinear creative (overlay/banner ads)
    const nonLinear = this.xmlDoc.querySelector('NonLinear');
    if (nonLinear) {
      return {
        type: 'NonLinear',
        width: nonLinear.getAttribute('width'),
        height: nonLinear.getAttribute('height'),
        expandedWidth: nonLinear.getAttribute('expandedWidth'),
        expandedHeight: nonLinear.getAttribute('expandedHeight'),
        scalable: nonLinear.getAttribute('scalable') === 'true',
        maintainAspectRatio: nonLinear.getAttribute('maintainAspectRatio') === 'true'
      };
    }

    return null;
  }

  /**
   * Parse MediaFile elements
   */
  parseMediaFiles() {
    const mediaFiles = [];
    const mediaFileElements = this.xmlDoc.querySelectorAll('MediaFile');

    mediaFileElements.forEach(element => {
      mediaFiles.push({
        url: element.textContent.trim(),
        delivery: element.getAttribute('delivery'),
        type: element.getAttribute('type'),
        width: parseInt(element.getAttribute('width')) || null,
        height: parseInt(element.getAttribute('height')) || null,
        codec: element.getAttribute('codec'),
        bitrate: parseInt(element.getAttribute('bitrate')) || null,
        scalable: element.getAttribute('scalable') === 'true',
        maintainAspectRatio: element.getAttribute('maintainAspectRatio') === 'true',
        apiFramework: element.getAttribute('apiFramework')
      });
    });

    // Sort by priority (prefer progressive delivery, higher bitrate)
    mediaFiles.sort((a, b) => {
      // Prefer progressive over streaming
      if (a.delivery === 'progressive' && b.delivery !== 'progressive') return -1;
      if (b.delivery === 'progressive' && a.delivery !== 'progressive') return 1;
      
      // Prefer higher bitrate
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

    this.log(`Found ${mediaFiles.length} media files`, mediaFiles);
    return mediaFiles;
  }

  /**
   * Parse tracking events
   */
  parseTrackingEvents() {
    const events = {};
    const trackingElements = this.xmlDoc.querySelectorAll('Tracking');

    trackingElements.forEach(element => {
      const event = element.getAttribute('event');
      const url = element.textContent.trim();

      if (!events[event]) {
        events[event] = [];
      }
      events[event].push(url);
    });

    // Also check for Impression tracking
    const impressionElements = this.xmlDoc.querySelectorAll('Impression');
    if (impressionElements.length > 0) {
      events.impression = [];
      impressionElements.forEach(element => {
        events.impression.push(element.textContent.trim());
      });
    }

    this.log('Tracking events', events);
    return events;
  }

  /**
   * Parse click tracking URLs
   */
  parseClickTracking() {
    const clickTracking = {
      clickThrough: [],
      clickTracking: []
    };

    // VideoClicks > ClickThrough
    const clickThroughElements = this.xmlDoc.querySelectorAll('ClickThrough');
    clickThroughElements.forEach(element => {
      clickTracking.clickThrough.push(element.textContent.trim());
    });

    // VideoClicks > ClickTracking
    const clickTrackingElements = this.xmlDoc.querySelectorAll('ClickTracking');
    clickTrackingElements.forEach(element => {
      clickTracking.clickTracking.push(element.textContent.trim());
    });

    return clickTracking;
  }

  /**
   * Parse custom extensions (including Adlocaite-specific data)
   */
  parseCustomExtensions() {
    const extensions = {
      dealId: null,
      offerId: null,
      billingId: null,
      campaignId: null,
      adlocaiteData: {}
    };

    // Look for Extensions element
    const extensionsElement = this.xmlDoc.querySelector('Extensions');
    if (!extensionsElement) {
      return extensions;
    }

    // Parse all Extension elements
    const extensionElements = extensionsElement.querySelectorAll('Extension');
    extensionElements.forEach(element => {
      const type = element.getAttribute('type');
      
      // Check for Adlocaite-specific extensions
      if (type === 'adlocaite' || element.querySelector('[data-adlocaite]')) {
        // Look for deal_id
        const dealIdElement = element.querySelector('DealId, deal_id, [data-deal-id]');
        if (dealIdElement) {
          extensions.dealId = dealIdElement.textContent.trim() || dealIdElement.getAttribute('data-deal-id');
        }

        // Look for offer_id
        const offerIdElement = element.querySelector('OfferId, offer_id, [data-offer-id]');
        if (offerIdElement) {
          extensions.offerId = offerIdElement.textContent.trim() || offerIdElement.getAttribute('data-offer-id');
        }

        // Look for billing_id
        const billingIdElement = element.querySelector('BillingId, billing_id, [data-billing-id]');
        if (billingIdElement) {
          extensions.billingId = billingIdElement.textContent.trim() || billingIdElement.getAttribute('data-billing-id');
        }

        // Look for campaign_id
        const campaignIdElement = element.querySelector('CampaignId, campaign_id, [data-campaign-id]');
        if (campaignIdElement) {
          extensions.campaignId = campaignIdElement.textContent.trim() || campaignIdElement.getAttribute('data-campaign-id');
        }

        // Store entire extension content
        extensions.adlocaiteData = {
          xml: element.innerHTML,
          attributes: this.getElementAttributes(element)
        };
      }
    });

    // Alternative: Look in AdParameters
    const adParameters = this.xmlDoc.querySelector('AdParameters');
    if (adParameters) {
      try {
        const paramsText = adParameters.textContent.trim();
        if (paramsText.startsWith('{')) {
          const params = JSON.parse(paramsText);
          extensions.dealId = extensions.dealId || params.deal_id || params.dealId;
          extensions.offerId = extensions.offerId || params.offer_id || params.offerId;
          extensions.billingId = extensions.billingId || params.billing_id || params.billingId;
        }
      } catch (e) {
        this.log('AdParameters is not JSON', adParameters.textContent);
      }
    }

    this.log('Custom extensions', extensions);
    return extensions;
  }

  /**
   * Get best media file for playback
   * Prioritizes based on type and quality
   */
  getBestMediaFile(preferredTypes = ['video/mp4', 'image/jpeg', 'image/png']) {
    if (!this.parsedData || !this.parsedData.mediaFiles) {
      return null;
    }

    // First, try to find preferred types
    for (const type of preferredTypes) {
      const match = this.parsedData.mediaFiles.find(mf => mf.type === type);
      if (match) {
        this.log('Best media file selected', match);
        return match;
      }
    }

    // Fallback to first available
    const fallback = this.parsedData.mediaFiles[0];
    this.log('Using fallback media file', fallback);
    return fallback;
  }

  /**
   * Check if media file is video
   */
  isVideo(mediaFile) {
    return mediaFile && mediaFile.type && mediaFile.type.startsWith('video/');
  }

  /**
   * Check if media file is image
   */
  isImage(mediaFile) {
    return mediaFile && mediaFile.type && mediaFile.type.startsWith('image/');
  }

  /**
   * Get deal ID for playout confirmation
   */
  getDealId() {
    return this.parsedData?.customExtensions?.dealId || null;
  }

  /**
   * Get tracking URLs for specific event
   */
  getTrackingUrls(eventName) {
    if (!this.parsedData || !this.parsedData.trackingEvents) {
      return [];
    }
    return this.parsedData.trackingEvents[eventName] || [];
  }

  /**
   * Helper: Get text content of element
   */
  getTextContent(tagName, parent = null) {
    const element = (parent || this.xmlDoc).querySelector(tagName);
    return element ? element.textContent.trim() : null;
  }

  /**
   * Helper: Get all attributes of an element
   */
  getElementAttributes(element) {
    const attrs = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  /**
   * Helper: Parse duration string (HH:MM:SS or HH:MM:SS.mmm)
   */
  parseDuration(durationString) {
    if (!durationString) return 0;

    const parts = durationString.split(':');
    if (parts.length !== 3) return 0;

    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Get parsed data
   */
  getParsedData() {
    return this.parsedData;
  }
}

// Make class globally available
if (typeof window !== 'undefined') {
  window.VASTParser = VASTParser;
}




