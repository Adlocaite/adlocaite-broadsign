# Changelog

All notable changes to the Adlocaite Broadsign Integration will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial setup

## [1.0.0] - 2025-01-20

### Added
- Broadsign Control Player integration via `BroadSignObject`
- VAST 4.0 support with complete tracking (impression, quartiles, completion)
- Video and image ad playback with HTML5 player
- Adlocaite API integration (offer request, acceptance, playout confirmation)
- Screen identification via `frame_id` property
- External ID API endpoint support for any screen identifier format
- Asset pre-caching for offline playback
- Fallback content display when no offers available
- Debug mode with detailed console logging
- Configurable timeouts and retry logic
- Brutalist Design System test interface
- Local test server for development
- Build scripts for Unix/Linux/macOS and Windows
- Comprehensive documentation (README, test guides)

### Fixed
- Initialization race condition between `DOMContentLoaded` and `BroadSignPlay()`
- HTTP 404 errors now handled gracefully (no Broadsign auto-skip)
- Video autoplay compatibility with Chromium v87+ (muted + playsInline)
- BroadSignObject validation and environment detection
- VAST XML field name (`vast` not `vast_xml`)
- Enhanced error messages with full URL and context for debugging

### Security
- API keys excluded from version control via `.gitignore`
- Bearer token authentication for all API requests
- Timeout protection on all network requests
- Git hooks to prevent accidental API key commits

## [0.1.0] - 2025-01-07

### Added
- Initial proof of concept
- Basic VAST parsing
- Broadsign adapter prototype

---

[Unreleased]: https://github.com/adlocaite/adlocaite-broadsign/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/adlocaite/adlocaite-broadsign/releases/tag/v1.0.0
[0.1.0]: https://github.com/adlocaite/adlocaite-broadsign/releases/tag/v0.1.0
