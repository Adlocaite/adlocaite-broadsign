# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Broadsign Control HTML5 Package for integrating programmatic DOOH (Digital Out-of-Home) advertisements via the Adlocaite API. The package runs inside Broadsign Control Players (Chromium v87+ with security patches to v94) and handles offer requests, VAST parsing, media playback, and playout confirmation.

**Package Format**: `.x-html-package` (MIME type: `application/x-html-package`) - a ZIP archive that Broadsign downloads and unzips before playback.

**Official Documentation**: https://docs.broadsign.com/broadsign-control/latest/html5.html

## Build & Package Commands

```bash
# Build the .x-html-package file (macOS/Linux/Unix)
./build.sh

# Build on Windows
build.bat

# Alternative: use npm
npm run package

# Clean build artifacts
npm run clean
```

The build process creates `adlocaite-broadsign.x-html-package` which is a ZIP archive of the `package/` directory.

## Configuration

Configuration is managed through `package/js/config.js` (NOT committed to git):

1. Copy the example: `cp package/js/config.example.js package/js/config.js`
2. Edit `config.js` to set API key and other settings
3. NEVER commit `config.js` - it's in `.gitignore`

Key configuration options in `config.js`:
- `apiKey`: Publisher API key (required, format: `pub_xxxx`)
- `apiBaseUrl`: API endpoint (staging or production)
- `minBidCents`: Minimum bid threshold
- `vastMode`: Enable VAST XML response format
- `debugMode`: Enable console logging

Note: Fallback handling is done via Broadsign's skip signal mechanism (see "Error Handling & Waterfall Skip Signal" section). Configure fallback content in Broadsign's Fallback Bundle, not in this package.

## Architecture

### Module Structure

The codebase follows a modular architecture with separate concerns:

```
package/
├── index.html              # Main application & orchestrator (AdlocaiteApp class)
├── js/
│   ├── config.js          # Configuration (not in git, created from example)
│   ├── config.example.js  # Configuration template
│   ├── broadsign-adapter.js   # BroadsignAdapter class - Broadsign API integration
│   ├── adlocaite-api.js       # AdlocaiteAPIClient class - REST API client
│   ├── vast-parser.js         # VASTParser class - VAST XML parsing
│   └── player.js              # AdlocaitePlayer class - Media playback
└── css/styles.css
```

### Key Classes & Responsibilities

**AdlocaiteApp** (in index.html):
- Main orchestrator that coordinates all modules
- Handles initialization flow and `BroadSignPlay()` lifecycle
- Manages overall application state

**BroadsignAdapter** (broadsign-adapter.js):
- Interfaces with Broadsign Control Player via global `BroadSignObject`
- Provides screen identification: `getScreenId()` reads `BroadSignObject.frame_id` as external ID
- Tracks playback state and duration
- Generates playout tracking data
- Defines global `BroadSignPlay()` function (called by Broadsign when ad copy starts)

**AdlocaiteAPIClient** (adlocaite-api.js):
- Handles all HTTP communication with Adlocaite API
- Methods: `requestOfferByExternalId()`, `acceptOffer()`, `rejectOffer()`, `confirmPlayout()`
- Uses External ID endpoints to support Broadsign frame_id as screen identifier
- Implements retry logic with exponential backoff
- Request timeout handling (default: 10s)
- Bearer token authentication via `Authorization` header

**VASTParser** (vast-parser.js):
- Parses VAST 2.0/3.0/4.0 XML responses
- Extracts MediaFiles, tracking events, click tracking, custom extensions
- Provides `getBestMediaFile()` to select optimal media based on type/bitrate
- Extracts deal_id from VAST Extensions or AdParameters

**AdlocaitePlayer** (player.js):
- Handles video and image playback
- HTML5 `<video>` for video files, `<img>` with timed duration for images
- Fires VAST tracking events (impression, start, quartiles, complete)
- Calls `confirmPlayout()` via API after playback completion

### Execution Flow (Pre-Loading Architecture)

The package uses Broadsign's off-screen pre-buffering phase to load content BEFORE display:

```
Download/Unzip    Pre-Buffering (OFF-SCREEN)         BroadSignPlay()        Display
      │                      │                              │                   │
      ▼                      ▼                              ▼                   ▼
  [Package]        [DOMContentLoaded]              ["about to display"]   [SICHTBAR]
                   [Pre-loading starts]
                   [SECONDS before display!]
```

**Phase 1: Off-Screen Pre-Buffering (DOMContentLoaded)**
1. Broadsign Player loads HTML package (off-screen)
2. `DOMContentLoaded` → `AdlocaiteApp.initialize()` runs
3. `initialize()` triggers `preloadContent()` automatically:
   - Get screen ID from BroadSignObject (`frame_id`)
   - Request offer from Adlocaite API (with `vast=true`)
   - Parse VAST XML to extract media URL
   - Accept offer to get deal_id (if not in VAST)
   - Pre-load video (`loadedmetadata`) or image
   - Store pre-loaded content for instant playback

**Phase 2: Display (BroadSignPlay)**
4. Broadsign calls global `BroadSignPlay()` when ad copy is about to display
5. `start()` waits for pre-loading to complete (if still running)
6. Play pre-loaded media instantly (already buffered!)
7. Fire VAST tracking events during playback
8. Confirm playout via API with deal_id
9. Clean up and complete

**Key Benefits:**
- **Instant playback**: Content is buffered before display
- **No visible delay**: API requests happen off-screen
- **Fast pre-loading**: Uses `loadedmetadata` event for quick video initialization
- **No loading screen**: Black background prevents visible loading states

**CRITICAL Implementation Notes:**
- `BroadSignPlay()` can fire BEFORE `DOMContentLoaded` - code handles this
- 404 errors are handled gracefully (no throw) to prevent Broadsign auto-skip
- Videos use `muted=true` for Chromium v87+ autoplay compatibility
- Videos use `preload="auto"` for aggressive buffering
- Videos use `loadedmetadata` event (not `canplaythrough`) for faster pre-loading within Broadsign's "several seconds" pre-buffer window
- No loading screen in HTML - black background only to prevent visible loading states

## Important Implementation Details

### Broadsign Integration

**Critical Lifecycle:**
- The package MUST define a global `BroadSignPlay()` function (defined in broadsign-adapter.js:259)
- `BroadSignPlay()` is called by Broadsign **when the ad copy displays**, NOT at page load
- Use `BroadSignPlay()` for: video pre-buffering, controlling start timing, requesting focus

**BroadSignObject API:**

Documentation: https://docs.broadsign.com/broadsign-control/latest/content-variables.html

**Properties (automatic variables injected by Broadsign):**
- `BroadSignObject.frame_id` - Frame ID (used as external_id for Adlocaite API) - represents individual screen
- `BroadSignObject.display_unit_id` - Display Unit ID (logical grouping, can have multiple frames)
- `BroadSignObject.player_id` - Player ID (PC/hardware, can have multiple display units)
- `BroadSignObject.frame_resolution` - Frame resolution (e.g., "1920x1080")
- `BroadSignObject.display_unit_resolution` - Display unit resolution
- Additional properties: campaign_id, impressions_per_hour, expected_slot_duration_ms, etc.

**Methods:**
- `BroadSignObject.requestFocus()` - Enables keyboard input (player withholds focus by default for security)

**IMPORTANT:** BroadSignObject provides PROPERTIES, not getter methods. Access them directly (e.g., `BroadSignObject.frame_id`), NOT as methods (e.g., ~~`BroadSignObject.getFrameId()`~~).

**Environment Constraints:**
- Screen identification only works inside Broadsign Player (Chromium v87+)
- Testing in regular browser will use fallback screen IDs (test-screen-{timestamp})
- Packages are downloaded and unzipped before playback; if timing doesn't allow completion, ad slot is skipped
- HTTP errors (4xx/5xx) from external requests trigger automatic playback skipping

### API Flow

The typical API flow is:
1. `GET /offers/request/external-id/{externalId}?vast=true&min_bid_cents=X` → Returns VAST XML or JSON with `vast_xml`
   - `externalId` is the `frame_id` from BroadSignObject
   - External ID endpoint accepts any string (not just UUIDs)
   - Alternative UUID endpoint: `GET /offers/request/{screenId}` (requires UUID format)
2. If needed: `POST /offers/response/{offerId}` with `{action: "accept", accepted_price_cents: X}` → Returns `deal_id`
3. After playback: `POST /playout/confirm/{dealId}` with tracking data

**Screen Identification:**
- Broadsign provides `frame_id` as a property in BroadSignObject
- This `frame_id` is sent as `external_id` to the Adlocaite API
- In the Adlocaite backend, screens must have their `external_id` field set to match the Broadsign `frame_id`
- Example: If Broadsign frame_id = "842292831", create a screen in Adlocaite with external_id = "842292831"

**CORS Requirements:**
- Remote servers (including Adlocaite API) must include `Access-Control-Allow-Origin: *` header
- Custom authentication headers recommended for security (we use `Authorization: Bearer {apiKey}`)

**Caching:**
- Leverages Chromium's built-in caching mechanism for offline resilience
- CacheManager pre-caches assets based on `cachingInterval` config

### VAST Handling

- VAST XML can contain deal_id in `<Extensions>` → look for `<DealId>`, `<deal_id>`, or in `<AdParameters>` as JSON
- MediaFiles are sorted by: progressive delivery first, then by bitrate (highest first)
- Tracking events: impression (fired before playback), start, firstQuartile, midpoint, thirdQuartile, complete
- Tracking pixels are fired via Image() objects with 5s timeout

### Error Handling & Waterfall Skip Signal

**Skip Signal Mechanism (for Programmatic Waterfall):**

The package uses Broadsign's `<title>` tag mechanism to signal skip status:

| Title Value | Meaning |
|-------------|---------|
| `wait` | Still loading (initial state) |
| `ready` | Content loaded, ready to play |
| `skip` | Skip to next item in waterfall |
| `skip:reason` | Skip with reason (e.g., `skip:no offers available`) |

Broadsign checks the title 1 second after page load (max 2 seconds). If `skip`, Broadsign moves to the next item in the programmatic waterfall (e.g., another SSP or fallback bundle).

**When Skip is Signaled:**
- `skip:no offers available` - API returned 404 (no offers)
- `skip:api error` - API returned an error
- `skip:no screen id` - No screen ID available
- `skip:init failed` - Initialization failed
- `skip:preload failed` - Pre-loading failed

**Implementation:**
```javascript
// Set status via setPlaybackStatus() method
app.setPlaybackStatus('ready');           // Content ready
app.setPlaybackStatus('skip', 'reason');  // Skip with reason
```

**Fallback Behavior:**
- Skip signal is the ONLY mechanism - no in-package fallback
- Fallback bundle must be configured in Broadsign Control
- When skip is signaled, Broadsign moves to next waterfall item or shows fallback bundle

**Error Handling:**
- API retries (3x with exponential backoff) on 5xx errors and network failures
- Tracking failures don't stop playback (logged but not thrown)
- Playout confirmation failures are logged but don't throw errors

## Testing & Debugging

Enable debug mode in config.js:
```javascript
debugMode: true
```

This will:
- Show debug panel in UI with console logs
- Enable verbose logging from all modules
- Log format: `[timestamp] [Module Name] message`

Expected log sequence:
```
[Adlocaite] Initializing application...
[Broadsign Adapter] Initializing Broadsign Adapter
[Adlocaite] Application initialized successfully
[Adlocaite] BroadSignPlay() called by Broadsign Player
[Broadsign Adapter] Screen ID: abc-123
[Adlocaite API] Requesting offer for screen: abc-123
[VAST Parser] Parsing VAST XML
[Adlocaite Player] Playing video
[Adlocaite Player] Firing tracking event: impression
[Adlocaite API] Confirming playout for deal: deal_xyz
```

## Development Guidelines

### When modifying API integration:
- All API calls go through `AdlocaiteAPIClient` class
- Always use Bearer token authentication
- Respect timeout settings from config
- API errors should be logged with full context

### When modifying playback:
- Video/image logic is in `AdlocaitePlayer` class
- Always fire VAST tracking events at correct points
- Clean up media elements properly to avoid memory leaks
- Confirm playout even if tracking events fail

### When adding features:
- Follow the modular pattern - create new classes in separate files
- Add configuration to `config.example.js` with comments
- Update the main orchestrator in `index.html` if needed
- Maintain the BroadSignPlay() lifecycle compatibility

### When debugging Broadsign issues:
- `BroadSignObject` is ONLY available inside Broadsign Control Player (Chromium v87+)
- Don't test with browser navigation - upload to Broadsign for real testing
- Check Broadsign Player logs (Chromium console) for output
- Fallback screen IDs (starting with "test-") indicate non-Broadsign environment
- Remember: `BroadSignPlay()` fires when ad displays, NOT at DOMContentLoaded
- If keyboard interaction is needed, call `BroadSignObject.requestFocus()` inside `BroadSignPlay()`

### Network & CORS:
- All external API calls require `Access-Control-Allow-Origin: *` header from server
- HTTP 4xx/5xx errors from external servers will cause Broadsign to skip playback automatically
- Use Bearer token authentication for API security (already implemented in AdlocaiteAPIClient)

## File Modification Notes

- `index.html`: Contains main orchestration logic in inline `<script>` - keep it clean and delegate to modules
- Module files are loaded in order: config → api → adapter → vast → player
- Global classes are exposed via `window.ClassName` for cross-module access
- Build scripts zip the entire `package/` directory - avoid adding unnecessary files

## Critical Fixes Applied

### 2025-01-07 - Initial Fixes
The following critical issues have been fixed in the codebase:

1. **Initialization Race Condition** (index.html:247-261)
   - `BroadSignPlay()` now waits for initialization to complete
   - Prevents "Cannot start - not initialized" errors

2. **HTTP 404 Graceful Handling** (adlocaite-api.js:88-117)
   - 404 errors return `{noOffersAvailable: true}` instead of throwing
   - Prevents Broadsign auto-skip, allows fallback content to display
   - All 4xx errors handled gracefully to prevent auto-skip

3. **Video Autoplay Fix** (player.js:114-115)
   - Videos now use `muted: true` + `playsInline: true`
   - Required for Chromium v87+ autoplay policies

4. **BroadSignObject Validation** (broadsign-adapter.js:43-46)
   - `isBroadsignEnvironment()` now verifies object is fully initialized
   - Checks for null and property availability

5. **BroadSignPlay() Idempotency** (broadsign-adapter.js:271-277)
   - Prevents duplicate execution if called multiple times
   - Follows Broadsign best practices

### 2025-01-20 - BroadSignObject API Correction

**Root Cause:** The code was using non-existent `getScreenId()`, `getDisplayUnitId()`, and `getPlayerId()` methods. BroadSignObject provides PROPERTIES, not methods.

**Impact:**
- `getScreenId()` always failed → fallback to `test-screen-{timestamp}` IDs
- Non-UUID screen IDs sent to UUID-only API endpoint
- Backend returned 500 errors instead of 404 for unknown screens
- Broadsign auto-skip on 500 errors

**Fixes Applied:**

6. **BroadSignObject Property Access** (broadsign-adapter.js:54-77)
   - Changed from `BroadSignObject.getScreenId()` to `BroadSignObject.frame_id`
   - Changed from method calls to direct property access
   - `frame_id` represents individual screen/frame in Broadsign

7. **External ID API Endpoints** (index.html:184)
   - Switched from `/offers/request/{screenId}` to `/offers/request/external-id/{externalId}`
   - External ID endpoints accept any string (not just UUIDs)
   - Allows Broadsign `frame_id` to be used directly as screen identifier

8. **500 Error Graceful Handling** (adlocaite-api.js:119-138)
   - 500 errors with "screen not found" messages now handled gracefully
   - Returns `{noOffersAvailable: true}` instead of throwing
   - Prevents Broadsign auto-skip when screen is not registered

**Configuration Required:**
- In Adlocaite backend, set screen `external_id` field to match Broadsign `frame_id`
- Example: Broadsign frame_id = "842292831" → Adlocaite screen external_id = "842292831"

### 2025-01-27 - Pre-Loading Architecture for Instant Playback

**Root Cause:** Visible delay when ad slot became visible because API requests, VAST parsing, and video loading all happened AFTER `BroadSignPlay()` was called (when the slot was already visible).

**Solution:** Leverage Broadsign's off-screen pre-buffering phase (between DOMContentLoaded and BroadSignPlay) to load content BEFORE display.

**Fixes Applied:**

10. **Pre-Loading in initialize()** (index.html:160-273)
    - Added `preloadContent()` method that runs during off-screen buffering
    - API request, VAST parsing, and media loading happen BEFORE display
    - Pre-loaded content stored in `preloadedContent` object
    - `start()` now just plays the already-loaded content

11. **Video Pre-Loading with Proper Buffering** (player.js:76-196)
    - Added `preloadMedia()`, `preloadVideo()`, `preloadImage()` methods
    - Videos use `preload="auto"` for aggressive buffering
    - Initially used `canplaythrough` event for full buffering
    - `autoplay=false` during pre-load, controlled start in `playPreloaded()`

12. **Instant Playback Methods** (player.js:198-322)
    - Added `playPreloaded()`, `playPreloadedVideo()`, `playPreloadedImage()`
    - Video/image element already created and buffered
    - Just append to DOM and call `play()` - instant start

13. **Simplified start() Method** (index.html:275-335)
    - No longer makes API requests or loads media
    - Waits for `preloadPromise` if still running
    - Plays pre-loaded content immediately

**Timeline Improvement:**
```
BEFORE:
BroadSignPlay() → API (2s) → VAST parse → Video load (3s) → Play
                 ◄────────── 5+ seconds visible delay ──────────►

AFTER:
DOMContentLoaded → API → VAST → Video load → BroadSignPlay() → Play instantly!
◄──────── happens off-screen ────────►       ◄── no delay ──►
```

### 2025-01-18 - Loading Screen Optimization

**Root Cause:** Customers reported seeing loading screen on displays. Investigation revealed:
- Broadsign pre-buffers HTML pages "several seconds before" display (off-screen)
- Loading screen was hardcoded in HTML and visible when page became visible
- `canplaythrough` event took too long (2-15s) to resolve
- Loading screen only removed at `playPreloaded()`, not when `ready` signal was set

**Solution:** Remove visible loading states and optimize pre-loading timing.

**Fixes Applied:**

14. **Loading Screen Removal** (index.html:13-16)
    - Removed hardcoded loading screen HTML
    - Black background by default (no visible loading state)
    - Content appears when ready, no intermediate spinner

15. **Faster Video Pre-Loading** (player.js:96-166)
    - Changed from `canplaythrough` to `loadedmetadata` event
    - Reduces pre-load time from 2-15s to typically <1s
    - Video starts playback immediately, continues buffering if needed
    - Better fit for Broadsign's "several seconds" pre-buffer window

16. **Reduced Timeouts** (config.example.js:72)
    - Asset timeout reduced from 20s to 5s
    - Fits within typical pre-buffer window
    - Faster skip on slow networks instead of visible loading

**Impact:**
- No visible loading states for end users
- Faster content readiness signal to Broadsign
- Better alignment with Broadsign's pre-buffering architecture

### 2025-01-27 - Programmatic Waterfall Skip Signal

**Feature:** Signal to Broadsign when no content is available, allowing automatic skip to next item in waterfall (e.g., another SSP).

**Implementation:**

14. **Title-Based Skip Signaling** (index.html)
    - Initial `<title>wait</title>` signals "still loading"
    - `setPlaybackStatus('ready')` when content is pre-loaded
    - `setPlaybackStatus('skip', 'reason')` on errors
    - Broadsign checks title 1 second after page load

15. **Skip Signal Points:**
    - `preloadContent()`: Sets `skip:no offers available` or `skip:api error`
    - `start()`: Sets `skip:no screen id` if screen ID missing
    - `_performInitialization()`: Sets `skip:init failed` on init errors
    - Error handlers: Ensure skip is set if not already

**Waterfall Behavior:**
```
Position 1: Our HTML package → no offers → skip:no offers
Position 2: Other SSP → handles request
Position 3: Fallback bundle → plays if all SSPs fail
```

**Documentation Reference:**
https://docs.broadsign.com/broadsign-ayuda/skipping-html-based-spots.html

### 2025-12-28 - CacheManager Removal

**Root Cause:** The CacheManager implementation was based on a flawed assumption about the Broadsign HTML5 package lifecycle.

**The Problem:**

The CacheManager used `setInterval()` to periodically refresh cached assets every 5 minutes:

```javascript
this.cacheInterval = setInterval(() => {
  this.updateCache();
}, 300000); // 5 minutes
```

**However, the actual Broadsign lifecycle is:**
```
Ad Copy Playback Start → HTML Page Load (new instance)
                      → DOMContentLoaded
                      → CacheManager.start() + setInterval(5 min)
                      → Pre-Loading (~2-10 seconds)
                      → BroadSignPlay() → Display (~30-120 seconds)
                      → Ad Ends → Page Unloaded
                                → setInterval destroyed (NEVER fired!)
```

**Key Issues:**

1. **setInterval never fires**: Ad copies typically run for 30-120 seconds, but `setInterval` was set to 5 minutes. The page is unloaded before the interval ever triggers.

2. **Unnecessary API calls on every playback**: Each new page instance called `GET /cacheable-assets` on initialization, even though the interval logic never ran.

3. **JavaScript state doesn't persist**: The `cachedAssets` Map is destroyed when the page unloads. No state persists between ad copy displays.

4. **Browser HTTP cache already works**: Chromium's built-in HTTP cache automatically persists between page loads, making the CacheManager redundant.

**How Browser Caching Actually Works:**

```
First Ad Display (09:00):
  → Request offer → video.mp4 URL
  → Browser downloads and caches video.mp4 (via HTTP Cache-Control headers)
  → Page unloads

Second Ad Display (09:10):
  → New page instance (fresh JavaScript state)
  → Request offer → SAME video.mp4 URL
  → Browser: "I have this in cache!" → 304 Not Modified
  → Instant load from cache, no download needed
```

**This happens automatically without any CacheManager code!**

**Decision: Complete Removal**

17. **Removed CacheManager module** (2025-12-28)
    - Deleted `cache-manager.js` file entirely
    - Removed CacheManager instantiation from `index.html`
    - Removed `enableCaching` and `cachingInterval` from config
    - Removed `/cacheable-assets` API endpoint calls

**Why This Is Better:**

- ✅ **Simpler architecture**: Less code to maintain, fewer failure points
- ✅ **Better performance**: No unnecessary API calls on every playback
- ✅ **Browser cache works automatically**: Chromium handles caching natively
- ✅ **Offline resilience maintained**: Browser HTTP cache persists between loads
- ✅ **Reduced API load**: No periodic cache refresh requests

**For Publishers:**

Asset caching still works perfectly through standard browser mechanisms:
- Ensure CDN assets have proper `Cache-Control` headers
- Videos/images are automatically cached by Chromium
- Cache persists across page reloads (between ad displays)
- No special configuration needed

### 2026-01-22 - Screen ID Fallback Chain

**Root Cause:** AWK reported "No screen ID available from BroadSignObject" error. Investigation revealed that `BroadSignObject.frame_id` requires explicit configuration in Broadsign Control Player ("Append Frame Id" option in Products → HTML settings). Without this configuration, `frame_id` is empty/undefined.

**Impact:**
- Code only checked `frame_id`, no fallbacks
- `frame_id` empty → getScreenId() returned null
- Application set skip signal → no playback

**Broadsign ID Hierarchy:**
```
Display Unit (physical screen - display_unit_id)
  └── Player (hardware - player_id)
      └── Frame (content area - frame_id, requires config)
```

**Solution:** Implement fallback chain using always-available properties.

**Fixes Applied:**

17. **Screen ID Fallback Chain** (broadsign-adapter.js:99-161)
    - Changed from single `frame_id` check to fallback chain
    - Priority: `frame_id` → `display_unit_id` → `player_id`
    - All fallbacks log which ID was used for debugging
    - Works without "Append Frame Id" configuration

**Code Change:**
```javascript
// BEFORE (only frame_id, no fallback):
this.screenId = bsObject.frame_id;
if (!this.screenId || this.screenId === '') {
  this.error('BroadSignObject.frame_id is empty or undefined');
  // Falls through to URL/localStorage, likely returns null
}

// AFTER (fallback chain):
// 1. Try frame_id (best for multi-frame setups)
if (bsObject.frame_id && bsObject.frame_id !== '') {
  this.screenId = bsObject.frame_id;
  return this.screenId;
}

// 2. Fallback: display_unit_id (physical screen - always available)
if (bsObject.display_unit_id && bsObject.display_unit_id !== '') {
  this.screenId = bsObject.display_unit_id;
  this.log('Using display_unit_id (frame_id not available)');
  return this.screenId;
}

// 3. Last resort: player_id (hardware - always available)
if (bsObject.player_id && bsObject.player_id !== '') {
  this.screenId = bsObject.player_id;
  this.log('Using player_id as fallback');
  return this.screenId;
}
```

**Why This Works:**
- `display_unit_id` and `player_id` are always available (no config required)
- For single-frame setups (1 frame = whole screen), `display_unit_id` is ideal
- For multi-frame setups with "Append Frame Id" enabled, `frame_id` is still preferred
- Backend external_id mapping works with any of these IDs

**Configuration Notes:**
- **Optional:** Enable "Append Frame Id" in Broadsign (Products → HTML) for frame-level tracking
- **Backend:** Set Adlocaite screen `external_id` to match the ID used (check debug logs)
- **Recommended Player Version:** 15.8.x+ (fixes frame_id issues in multi-frame setups)

18. **Skip Signal Timing Fix** (index.html:187-191)
    - Fixed race condition where skip signal was set too late
    - Now sets skip immediately when no screen ID available
    - Previously: Skip set in `start()` (BroadSignPlay) - after Broadsign skip check
    - Now: Skip set in `_performInitialization()` - before Broadsign skip check (T+1s, T+2s)
    - Prevents black screen when screen ID not available

**The Timing Bug:**
```
BEFORE (Bug - Black Screen):
T+0.0s: Page Load → getScreenId() → null
        → Only warning logged, no skip signal
        → Title stays "wait"
T+1.0s: Broadsign Skip Check #1 → "wait" → "still loading"
T+2.0s: Broadsign Skip Check #2 → "wait" → "still loading"
        → Broadsign displays slot!
T+3.0s: BroadSignPlay() → setPlaybackStatus('skip') → TOO LATE!
        → User sees: BLACK SCREEN

AFTER (Fixed - Proper Skip):
T+0.0s: Page Load → getScreenId() → null
        → setPlaybackStatus('skip', 'no screen id') IMMEDIATELY!
        → Title becomes "skip:no screen id"
T+1.0s: Broadsign Skip Check #1 → "skip" → Skip to next!
        → Fallback bundle or next waterfall item displays ✓
```

**Critical:** Broadsign only checks skip signal at T+1s and T+2s after page load. Setting skip signal after this window causes black screen instead of proper fallback.
