# Changelog

All notable changes to the Adlocaite Broadsign Integration will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-05

### Added

#### Core Features
- Initial release of Adlocaite Broadsign Control integration
- VAST 4.0 support for programmatic DOOH advertising
- HTML5-based player for video and image ads
- Broadsign JavaScript API integration (`BroadSignObject`)

#### API Integration
- Adlocaite API client with offer request/response
- Bearer token authentication
- Automatic offer acceptance workflow
- Playout confirmation with tracking data
- Cacheable assets endpoint support

#### Player Features
- HTML5 video playback with event tracking
- Image display with timed duration
- VAST tracking pixel firing (impression, quartiles, completion)
- Automatic playout confirmation after ad completion
- Error handling and graceful fallback

#### Broadsign Integration
- `BroadSignPlay()` lifecycle hook implementation
- Screen ID retrieval via `BroadSignObject.getScreenId()`
- Display Unit and Player ID support
- Broadsign-specific logging integration

#### Caching
- Optional asset pre-caching for offline playback
- Background fetch of cacheable assets
- Cache expiry management
- Browser cache optimization

#### UI/UX
- Responsive design for various screen formats
- Loading screen with spinner
- Fallback content for no-offer scenarios
- Error screen with clear messaging
- Debug panel for development (optional)

#### Configuration
- Flexible configuration system via `config.js`
- Separate config template for version control
- Environment-specific settings (staging/production)
- Debug mode toggle
- Timeout and retry configuration

#### Build & Deployment
- Build scripts for Unix/Linux/macOS (`build.sh`)
- Build scripts for Windows (`build.bat`)
- npm scripts for packaging
- `.x-html-package` format generation
- Git ignore rules for sensitive data

#### Documentation
- Comprehensive README with setup instructions
- API integration guide
- Troubleshooting section
- Configuration reference
- Architecture diagram
- Testing guidelines

### Technical Details

- **Supported VAST Versions**: 2.0, 3.0, 4.0
- **Media Formats**: Video (MP4, WebM), Image (JPEG, PNG, GIF)
- **Browser**: Chromium (Broadsign Control Player)
- **Minimum Broadsign Version**: 15.4+ (Chromium 87+)

### Known Limitations

- Requires network connectivity for initial offer requests
- Screen ID must be available via `BroadSignObject.getScreenId()`
- Cache manager requires periodic API access
- Debug panel not optimized for production use

### Security

- API key stored in separate config file (gitignored)
- Bearer token authentication
- Timeout protection for all API calls
- Rate limiting consideration in API client
- No sensitive data logged in production mode

---

## [Unreleased]

### Planned

- Service Worker for advanced offline support
- Multiple screen resolution optimization
- A/B testing support
- Advanced analytics integration
- Remote configuration management
- Automatic software updates

---

**Note**: This is the initial release. Future versions will be documented here following semantic versioning principles.


