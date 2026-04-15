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

Additional configuration options (V2):
- `axiomToken`: Axiom ingest-only API token for remote error logging (leave empty to disable)
- `axiomDataset`: Axiom dataset name (default: `broadsign`)
- `packageVersion`: Version string (auto-injected by build.sh)

Note: Publishers should configure a fallback campaign in Broadsign Control that plays when Adlocaite has no ad to serve (skip signal).

## Architecture

### Module Structure

The codebase follows a modular architecture with separate concerns:

```
package/
├── index.html              # Main application & orchestrator (AdlocaiteApp class)
├── js/
│   ├── config.js          # Configuration (not in git, created from example)
│   ├── config.example.js  # Configuration template
│   ├── logger.js              # AdlocaiteLogger class - Console + Axiom logging
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
- Centralized `setPlaybackStatus()` method that atomically: sends WebSocket skip command, logs to Axiom, and updates UI
- Global error handlers (`window.onerror`, `unhandledrejection`) catch uncaught errors and trigger skip

**BroadsignAdapter** (broadsign-adapter.js):
- Interfaces with Broadsign Control Player via global `BroadSignObject`
- Provides screen identification: `getScreenId()` reads `BroadSignObject.frame_id` as external ID
- URL parameter fallback: checks `com.broadsign.suite.bsp.frame_id`
- `isBroadsignEnvironment()` validates BroadSignObject is properly initialized
- `getBroadSignObject()` checks local AND parent window (for test environments)
- Tracks playback state and duration
- Generates playout tracking data
- Defines global `BroadSignPlay()` function which dispatches to `window.onBroadSignReady` handler or `broadsignready` custom event

**AdlocaiteAPIClient** (adlocaite-api.js):
- Handles all HTTP communication with Adlocaite API
- Methods: `requestOfferByExternalId()`, `requestOffer()`, `acceptOffer()`, `rejectOffer()`, `confirmPlayout()`
- Uses External ID endpoints to support Broadsign frame_id as screen identifier
- Implements retry logic with exponential backoff
- Request timeout handling (default: 10s)
- Bearer token authentication via `Authorization` header

**AdlocaiteLogger** (logger.js):
- Centralized logging with Axiom integration for production error reporting
- Buffers events and flushes periodically (10s) or immediately on errors
- Without `axiomToken`: console-only logging (graceful degradation)
- Uses `fetch` with `keepalive: true` for reliable delivery during page unload
- Never blocks playback

**VASTParser** (vast-parser.js):
- Parses VAST 4.0 InLine XML responses (backend always returns InLine, never Wrapper)
- Extracts MediaFiles, tracking events, click tracking, custom extensions
- Provides `getBestMediaFile()` to select optimal media based on type/bitrate
- Extracts OfferId, DealId, BidPriceCents, ExpiresAt from Adlocaite VAST Extensions (supports multiple naming variants)
- Falls back to AdParameters JSON parsing for deal_id/offer_id

**AdlocaitePlayer** (player.js):
- Handles video and image playback
- HTML5 `<video>` for video files, `<img>` with timed duration for images
- `preloadMedia()`, `preloadVideo()`, `preloadImage()` for pre-loading during PREBUFFER
- `playPreloaded()` for instant playback of pre-loaded content
- Fires VAST tracking events (impression, start, quartiles, complete)
- Calls `confirmPlayout()` via API after playback completion

### Execution Flow

The package pre-loads content during Broadsign's off-screen PREBUFFER phase. All BroadSignObject properties (including `frame_id`) are available during PREBUFFER, so pre-loading works reliably.

**Phase 1: Initialization & Pre-Loading (DOMContentLoaded / PREBUFFER)**
1. Broadsign Player loads HTML package (off-screen, PREBUFFER state)
2. `BroadSignObject` is available with all properties as strings
3. `DOMContentLoaded` → `AdlocaiteApp.initialize()` runs
4. `initialize()` gets screen ID via `BroadSignObject.frame_id`
5. `preloadContent()` runs in background:
   - Request offer from Adlocaite API (with `vast=true`)
   - Parse VAST XML, extract OfferId from Extensions
   - Accept offer → get deal_id
   - Pre-load media asset (`canplaythrough` for video)
6. WebSocket `skip_next` command sent if skipping, or content ready for playback

**Phase 2: Display (BroadSignPlay)**
7. Broadsign calls global `BroadSignPlay()` when ad copy is about to display
8. `BroadSignPlay()` dispatches via `window.onBroadSignReady` or `broadsignready` event
9. Handler waits for initialization (30s timeout), then calls `app.start()`
10. Play pre-loaded content immediately (no loading delay)
11. Fire VAST tracking events during playback
12. Confirm playout via API with deal_id

**CRITICAL Implementation Notes:**
- `BroadSignPlay()` can fire BEFORE `DOMContentLoaded` - code handles this via dual handler (function + event)
- `BroadSignPlay()` is idempotent (`window._adlocaiteBroadSignPlayCalled` flag prevents duplicate execution)
- 404 errors are handled gracefully (no throw) to prevent Broadsign auto-skip
- Videos use `muted=true` for Chromium v87+ autoplay compatibility
- Videos use `preload="auto"` for aggressive buffering
- Videos use `canplay` event for pre-loading readiness (streams remaining data during playback)

## Important Implementation Details

### Broadsign Integration

**Critical Lifecycle:**
- The package MUST define a global `BroadSignPlay()` function (defined in broadsign-adapter.js)
- `BroadSignPlay()` is called by Broadsign **when the ad copy displays**, NOT at page load
- The main orchestration is in index.html via `onBroadSignReady` handler and `broadsignready` event listener

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
- **Remote Control must be enabled** in Broadsign Player for WebSocket skip to work

### WebSocket Skip Command (V2)

The package sends WebSocket commands to Broadsign's Remote Control API at `ws://localhost:2326`. This is the **only** reliable skip mechanism — the `document.title` approach is not a real Broadsign feature and does not work.

**Format:**
```json
{"rc": {"version": "1", "id": "<unique>", "action": "skip_next", "frame_id": "<frame_id>"}}
```

**Behavior:**
- Fire-and-forget: errors are logged but never block playback
- Only fires once per skip event (guarded by `_skipSent` flag)
- Requires **Remote Control to be enabled** in Broadsign Control Player settings

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

### VAST Handling

- VAST XML can contain deal_id in `<Extensions>` → look for `<DealId>`, `<deal_id>`, or in `<AdParameters>` as JSON
- Extension extraction supports multiple naming variants (CamelCase and snake_case)
- MediaFiles are sorted by: progressive delivery first, then by bitrate (highest first)
- Tracking events: impression (fired before playback), start, firstQuartile, midpoint, thirdQuartile, complete
- Tracking pixels are fired via Image() objects with 5s timeout

### Error Handling & Waterfall Skip Signal

**Skip Signal Mechanism (for Programmatic Waterfall):**

The package uses WebSocket commands to Broadsign's Remote Control API (`ws://localhost:2326`). The `_skipSent` flag ensures skip commands are only sent once.

**Important:** The `document.title` skip mechanism (setting title to "skip") is **not a real Broadsign feature** and does not work. WebSocket is the only reliable skip mechanism. Remote Control must be enabled on the player.

**Command:**
- **`skip_next`**: Sent during PREBUFFER (before `BroadSignPlay()`) — skips the ad copy before it becomes visible
- Fast fail (2s timeout + 1 retry) ensures the skip fires within the PREBUFFER window

**When Skip is Signaled:**
- `no offers available` - API returned 404 (no offers)
- `api error` - API returned an error
- `no screen id` - No screen ID available
- `init failed` - Initialization failed
- `preload failed` - Pre-loading failed

**Global Error Handlers:**
- `window.onerror` catches synchronous errors → triggers skip
- `window.addEventListener('unhandledrejection')` catches promise rejections → triggers skip

**Fallback Behavior:**
- Skip signal is the ONLY mechanism - no in-package fallback
- Fallback bundle must be configured in Broadsign Control
- When skip is signaled, Broadsign moves to next waterfall item or shows fallback bundle

**Error Handling:**
- API: one immediate retry on network failure, then skip (no exponential backoff — PREBUFFER window is too short)
- Tracking failures don't stop playback (logged but not thrown)
- Playout confirmation failures are logged but don't throw errors

## Testing & Debugging

### Test Server

A local test server simulates the Broadsign environment:

```bash
npm run test:serve
# Open http://127.0.0.1:8000/test/
```

The test server (`test/server.js`) provides:
- `/package-sim` endpoint that serves `package/index.html` with a mock `BroadSignObject` injected
- PREBUFFER simulation: BroadSignObject is injected BEFORE package scripts load
- Query parameters for all BroadSignObject properties (e.g., `?frame_id=test-screen-1`)

### Debug Mode

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
- Use the test server (`npm run test:serve`) for local development with PREBUFFER simulation
- For real-environment testing, upload to Broadsign
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
- Module files are loaded in order: config → logger → api → adapter → vast → player
- Global classes are exposed via `window.ClassName` for cross-module access
- Build scripts zip the entire `package/` directory - avoid adding unnecessary files

## V2 Changes Summary

### What changed from V1 to V2:

1. **Pre-Loading during PREBUFFER** — Content is loaded off-screen before `BroadSignPlay()`, eliminating visible loading delay
2. **WebSocket Skip Signal** — `skip_next` command via Broadsign Remote Control API (`ws://localhost:2326`) for immediate, reliable skipping. Requires Remote Control to be enabled.
3. **Axiom Remote Logging** — Centralized error/warning logging to Axiom for production monitoring (optional, graceful degradation without token)
4. **Centralized Skip Handler** — `setPlaybackStatus()` atomically handles WebSocket skip + Axiom logging + UI update
5. **Global Error Handlers** — `window.onerror` and `unhandledrejection` catch uncaught errors and trigger skip
6. **Removed CacheManager** — `cache-manager.js` removed; pre-loading replaces the need for background caching
7. **Removed unnecessary getters** — `getDisplayUnitId()` and `getPlayerId()` removed; `getPlayerInfo()` reads BroadSignObject properties directly
8. **Dual BroadSignPlay handler** — `window.onBroadSignReady` (function) + `broadsignready` (custom event) for robust lifecycle handling
9. **Test Server** — `test/server.js` with PREBUFFER simulation for local development
10. **`frame_id` confirmed as correct ID** — No fallback chain needed; `display_unit_id` is a different concept (entire display, not screen surface)
