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

Note: In V1, the skip signal mechanism has a timing limitation (see "Known Issues"). Publishers should configure a fallback campaign in Broadsign Control that plays when Adlocaite has no ad to serve.

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
│   ├── player.js              # AdlocaitePlayer class - Media playback
│   └── cache-manager.js       # CacheManager class - Asset pre-caching
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

### Execution Flow

The package attempts to pre-load content during Broadsign's off-screen pre-buffering phase, but in V1 this typically falls back to loading at display time because `frame_id` is not reliably available before `BroadSignPlay()`.

**Phase 1: Initialization (DOMContentLoaded)**
1. Broadsign Player loads HTML package (off-screen)
2. `DOMContentLoaded` → `AdlocaiteApp.initialize()` runs
3. `initialize()` attempts to get screen ID via `BroadSignObject.frame_id`
4. If screen ID is available: starts `preloadContent()` in background
5. If screen ID is NOT available (typical in V1): pre-loading is skipped

**Phase 2: Display (BroadSignPlay)**
6. Broadsign calls global `BroadSignPlay()` when ad copy is about to display
7. If pre-loading was skipped: `start()` gets screen ID now and loads content
   - Request offer from Adlocaite API (with `vast=true`)
   - Parse VAST XML to extract media URL
   - Accept offer to get deal_id (if not in VAST)
   - Load and play video (`canplaythrough`) or image
8. If pre-loading succeeded: play pre-loaded content immediately
9. Fire VAST tracking events during playback
10. Confirm playout via API with deal_id

**Known V1 Limitation:** In most Broadsign setups, `frame_id` is not available during the pre-buffering phase, so content loads at display time. This can cause a brief visible loading delay. See "Known Issues" section below.

**CRITICAL Implementation Notes:**
- `BroadSignPlay()` can fire BEFORE `DOMContentLoaded` - code handles this
- 404 errors are handled gracefully (no throw) to prevent Broadsign auto-skip
- Videos use `muted=true` for Chromium v87+ autoplay compatibility
- Videos use `preload="auto"` for aggressive buffering
- Videos use `canplaythrough` event for pre-loading readiness
- A loading screen (spinner) is shown in the HTML while content loads

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
- Module files are loaded in order: config → api → adapter → vast → player → cache-manager
- Global classes are exposed via `window.ClassName` for cross-module access
- Build scripts zip the entire `package/` directory - avoid adding unnecessary files

## Fixes Applied in V1

### Initial Fixes (2025-01-07)

1. **Initialization Race Condition** (index.html)
   - `BroadSignPlay()` now waits for initialization to complete
   - Prevents "Cannot start - not initialized" errors

2. **HTTP 404 Graceful Handling** (adlocaite-api.js)
   - 404 errors return `{noOffersAvailable: true}` instead of throwing
   - Prevents Broadsign auto-skip, allows fallback content to display
   - All 4xx errors handled gracefully to prevent auto-skip

3. **Video Autoplay Fix** (player.js)
   - Videos now use `muted: true` + `playsInline: true`
   - Required for Chromium v87+ autoplay policies

4. **BroadSignObject Validation** (broadsign-adapter.js)
   - `isBroadsignEnvironment()` verifies object is fully initialized
   - Checks for null and property availability

5. **BroadSignPlay() Idempotency** (broadsign-adapter.js)
   - Prevents duplicate execution if called multiple times
   - Follows Broadsign best practices

### BroadSignObject API Correction (2025-01-20)

6. **BroadSignObject Property Access** (broadsign-adapter.js)
   - `getScreenId()` uses `BroadSignObject.frame_id` (direct property access)
   - `frame_id` represents individual screen/frame in Broadsign
   - **Note:** `getDisplayUnitId()` and `getPlayerId()` still check for non-existent methods — they silently return null. This is a known issue for V2.

7. **External ID API Endpoints** (adlocaite-api.js)
   - Uses `/offers/request/external-id/{externalId}` endpoint
   - External ID endpoints accept any string (not just UUIDs)
   - Allows Broadsign `frame_id` to be used directly as screen identifier

8. **500 Error Graceful Handling** (adlocaite-api.js)
   - 500 errors with "screen not found" messages handled gracefully
   - Returns `{noOffersAvailable: true}` instead of throwing
   - Prevents Broadsign auto-skip when screen is not registered

### Pre-Loading Architecture (2025-01-27)

The pre-loading code structure was added to load content during Broadsign's off-screen pre-buffering phase. However, in V1 this has a **known limitation**: `frame_id` is typically not available until `BroadSignPlay()` fires, so pre-loading is skipped and content loads at display time instead.

9. **Pre-Loading in initialize()** (index.html)
    - `preloadContent()` method runs during off-screen buffering (if screen ID available)
    - Falls back to loading at `BroadSignPlay()` time when screen ID is not available

10. **Video Pre-Loading** (player.js)
    - `preloadMedia()`, `preloadVideo()`, `preloadImage()` methods
    - Videos use `preload="auto"` and `canplaythrough` event
    - `playPreloaded()` for instant playback of pre-loaded content

### Skip Signal Mechanism

The package uses Broadsign's `<title>` tag to signal skip status. The code sets skip signals at various error points (no offers, API error, no screen ID, init failed). However, in V1 there is a **known timing limitation** — see "Known Issues" below.

## Known Issues (V1)

### 1. Pre-Loading Timing
`BroadSignObject.frame_id` is typically not available during the off-screen pre-buffering phase (before `BroadSignPlay()`). This means content loads at display time, causing a brief visible loading delay. The loading screen (spinner) is shown during this time.

### 2. Skip Signal Timing
Broadsign checks the `<title>` skip signal at T+1s and T+2s after page load. In V1, the skip decision often happens after `BroadSignPlay()` fires (later than T+2s), so Broadsign does not act on it. Publishers must configure a fallback campaign in Broadsign Control.

### 3. getDisplayUnitId() / getPlayerId() Use Wrong API
`broadsign-adapter.js` methods `getDisplayUnitId()` and `getPlayerId()` check for non-existent `BroadSignObject.getDisplayUnitId()` / `BroadSignObject.getPlayerId()` methods instead of accessing properties directly. They silently return null.

### 4. Screen ID Has No Fallback Chain
V1 only checks `frame_id` for screen identification. If `frame_id` is not configured in Broadsign ("Append Frame Id" option), the package has no fallback to `display_unit_id` or `player_id`.
