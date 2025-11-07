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
- `enableCaching`: Enable asset pre-caching

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
├── css/styles.css
└── assets/fallback.jpg
```

### Key Classes & Responsibilities

**AdlocaiteApp** (in index.html):
- Main orchestrator that coordinates all modules
- Handles initialization flow and `BroadSignPlay()` lifecycle
- Manages overall application state

**BroadsignAdapter** (broadsign-adapter.js):
- Interfaces with Broadsign Control Player via global `BroadSignObject`
- Provides screen identification: `getScreenId()`, `getDisplayUnitId()`, `getPlayerId()`
- Tracks playback state and duration
- Generates playout tracking data
- Defines global `BroadSignPlay()` function (called by Broadsign when ad copy starts)

**AdlocaiteAPIClient** (adlocaite-api.js):
- Handles all HTTP communication with Adlocaite API
- Methods: `requestOffer()`, `acceptOffer()`, `rejectOffer()`, `confirmPlayout()`, `getCacheableAssets()`
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
- Manages fallback content display

**CacheManager** (cache-manager.js):
- Pre-caches assets for offline playback
- Periodic refresh based on `cachingInterval` config

### Execution Flow

1. Broadsign Player loads HTML package
2. `DOMContentLoaded` → `AdlocaiteApp.initialize()` starts (non-blocking)
3. **Broadsign calls global `BroadSignPlay()` → waits for init if needed → triggers `AdlocaiteApp.start()`**
   - **CRITICAL**: `BroadSignPlay()` can fire BEFORE `DOMContentLoaded`
   - Code now handles this race condition by waiting for initialization
4. Get screen ID from BroadSignObject
5. Request offer from Adlocaite API (with `vast=true`)
   - **CRITICAL**: 404 errors are handled gracefully (no throw) to prevent Broadsign auto-skip
6. Parse VAST XML to extract media URL and tracking events
7. Accept offer to get deal_id (if not in VAST)
8. Play media (video or image)
   - **CRITICAL**: Videos use `muted=true` for Chromium v87+ autoplay compatibility
9. Fire VAST tracking events during playback
10. Confirm playout via API with deal_id
11. Clean up and complete

## Important Implementation Details

### Broadsign Integration

**Critical Lifecycle:**
- The package MUST define a global `BroadSignPlay()` function (defined in broadsign-adapter.js:259)
- `BroadSignPlay()` is called by Broadsign **when the ad copy displays**, NOT at page load
- Use `BroadSignPlay()` for: video pre-buffering, controlling start timing, requesting focus

**BroadSignObject API:**
- `BroadSignObject.getScreenId()` - Returns screen identifier (only available in Broadsign Player)
- `BroadSignObject.getDisplayUnitId()` - Returns display unit identifier
- `BroadSignObject.getPlayerId()` - Returns player identifier
- `BroadSignObject.requestFocus()` - Enables keyboard input (player withholds focus by default for security)

**Environment Constraints:**
- Screen identification only works inside Broadsign Player (Chromium v87+)
- Testing in regular browser will use fallback screen IDs (test-screen-{timestamp})
- Packages are downloaded and unzipped before playback; if timing doesn't allow completion, ad slot is skipped
- HTTP errors (4xx/5xx) from external requests trigger automatic playback skipping

### API Flow

The typical API flow is:
1. `GET /offers/request/{screenId}?vast=true&min_bid_cents=X` → Returns VAST XML or JSON with `vast_xml`
2. If needed: `POST /offers/response/{offerId}` with `{action: "accept", accepted_price_cents: X}` → Returns `deal_id`
3. After playback: `POST /playout/confirm/{dealId}` with tracking data

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

### Error Handling

- If offer request fails (404), show fallback if `fallbackEnabled: true`
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
- Module files are loaded in order: config → api → adapter → vast → player → cache
- Global classes are exposed via `window.ClassName` for cross-module access
- Build scripts zip the entire `package/` directory - avoid adding unnecessary files

## Critical Fixes Applied (2025-01-07)

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
   - Checks for null and function availability

5. **CORS Error Messages** (cache-manager.js:167-177)
   - Better error messages when CORS headers are missing
   - References Broadsign requirement for `Access-Control-Allow-Origin: *`

6. **BroadSignPlay() Idempotency** (broadsign-adapter.js:271-277)
   - Prevents duplicate execution if called multiple times
   - Follows Broadsign best practices
