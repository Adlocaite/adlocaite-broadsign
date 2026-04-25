# Changelog

All notable changes to the Adlocaite Broadsign Integration will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Sub-cent pricing: `min_bid_cents`, `accepted_price_cents` and `bid_price_cents` are passed through as decimals so prices like `0.5` cents survive round-trip without rounding (#25)
- Strict Accept: pre-load only proceeds to playback if `POST /offers/response/{offerId}` returned a `deal_id`. Any 4xx (e.g. `OFFER_NOT_FOUND`, `PRICE_VALIDATION_FAILED`), thrown error, or missing `offer_id` triggers a `skip_next` WebSocket command instead of silently serving inventory without a deal. Backend `error_code` is forwarded to Axiom (#26)
- New skip reason: `accept failed`

### Changed
- Default API URL in config.example.js changed from staging to production
- Console logging in AdlocaiteApp now respects `debugMode` config setting
- Playout reporting is now exclusively via VAST tracking pixels (`impression`, `start`, quartiles, `complete`); no separate confirm API call

### Removed
- `POST /playout/confirm/{dealId}` calls. The endpoint was deprecated in the backend (sunset 2026-06-01) and only re-fired the same `complete` tracking pixel the player already emits. Removed `confirmPlayout()` from `adlocaite-api.js` and `player.js`, `getPlayoutTrackingData()` from `broadsign-adapter.js`, and the supporting `currentDealId` / `completionRate` state (#27)

### Fixed
- XSS vulnerability in `showError()` and `setupDebugLogging()` (innerHTML replaced with textContent)

### Security
- Added `.env` patterns to `.gitignore`

## [1.0.0] - 2025-11-20

### Added
- Broadsign Control Player integration via `BroadSignObject`
- VAST 2.0/3.0/4.0 support with complete tracking (impression, quartiles, completion)
- Video and image ad playback with HTML5 player
- Adlocaite API integration (offer request, acceptance, playout confirmation)
- Screen identification via `frame_id` property
- External ID API endpoint support for any screen identifier format
- Asset pre-caching via CacheManager
- Pre-loading architecture (content loading before display when screen ID available)
- Programmatic waterfall skip signaling via `<title>` tag
- Debug mode with in-page console panel
- Configurable timeouts and retry logic with exponential backoff
- Test interface for local development
- Build scripts for Unix/Linux/macOS and Windows

### Fixed
- Initialization race condition between `DOMContentLoaded` and `BroadSignPlay()`
- HTTP 404 errors now handled gracefully (no Broadsign auto-skip)
- HTTP 500 "screen not found" errors handled gracefully
- Video autoplay compatibility with Chromium v87+ (muted + playsInline)
- BroadSignObject validation and environment detection
- BroadSignPlay() idempotency (prevents duplicate execution)

### Security
- API keys excluded from version control via `.gitignore`
- Bearer token authentication for all API requests
- Timeout protection on all network requests
- Git hooks to prevent accidental API key commits

---

[Unreleased]: https://github.com/Adlocaite/adlocaite-broadsign/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Adlocaite/adlocaite-broadsign/releases/tag/v1.0.0
