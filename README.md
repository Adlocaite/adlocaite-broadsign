# Adlocaite Broadsign Integration

Official Broadsign Control HTML5 package for integrating programmatic DOOH (Digital Out-of-Home) advertisements via the Adlocaite API.

## How It Works (V1)

When Broadsign plays an ad slot assigned to this package, the following happens:

1. **Page Load** — Broadsign loads the HTML package and runs initialization (configuration, module setup)
2. **BroadSignPlay()** — Broadsign calls `BroadSignPlay()` when the ad slot is displayed. Only at this point is `BroadSignObject.frame_id` available to identify the screen.
3. **Content Loading** — The package requests an offer from the Adlocaite API, parses the VAST response, and loads the media asset (video or image).
4. **Playback** — The media plays, VAST tracking events are fired, and playout is confirmed via the API.

### Known Issues

- **Visible loading delay** ([#3](https://github.com/Adlocaite/adlocaite-broadsign/issues/3)): Since the screen ID is only available at playout time, content must be loaded while the slot is already visible. This can cause a brief black screen or loading delay.
- **Skip signal not effective** ([#4](https://github.com/Adlocaite/adlocaite-broadsign/issues/4)): The `<title>` skip signal is set during/after playout start, but Broadsign only checks the title within the first 1-2 seconds after page load — before `BroadSignPlay()` fires. This means Broadsign cannot skip to a waterfall fallback automatically.
- **Fallback campaign required**: Because the skip signal doesn't work in time, publishers must configure a separate fallback campaign in Broadsign Control that plays when Adlocaite has no ad to serve. Without this, empty ad slots may show a black screen.

## Roadmap: Version 2 (WIP)

V2 will address the limitations above:

- **Content Pre-Loading** — Load content during Broadsign's off-screen pre-buffering phase (before `BroadSignPlay()`), enabling instant playback with no visible delay.
- **Asset Pre-Caching** — Background cache manager that periodically fetches upcoming ad assets and stores them in the browser cache, reducing load times and providing resilience against temporary network issues.
- **Skip Signal Support** — Signal "skip" before Broadsign's check window, enabling automatic waterfall fallback without a dedicated fallback campaign.
- **Screen ID Fallback Chain** — Fall back to `display_unit_id` or `player_id` when `frame_id` is not configured.

## Requirements

- Broadsign Control 15.4+ (Chromium 87+)
- Adlocaite Publisher API Key
- Registered screens with `external_id` matching the Broadsign screen identifier (typically `frame_id`)
- A fallback campaign in Broadsign for when no programmatic ad is available

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/adlocaite/adlocaite-broadsign.git
cd adlocaite-broadsign
```

### 2. Configure
```bash
cp package/js/config.example.js package/js/config.js
# Edit config.js with your API key and settings
```

### 3. Build
```bash
./build.sh          # Unix/Linux/macOS
# or
build.bat           # Windows
```

### 4. Deploy
Upload `adlocaite-broadsign.x-html-package` to Broadsign Control and assign to your campaign.

## Configuration

Edit `package/js/config.js`:

| Option | Description | Default |
|--------|-------------|---------|
| `apiKey` | Publisher API key (required) | - |
| `apiBaseUrl` | API endpoint (staging/production) | Staging |
| `vastMode` | Enable VAST XML | `true` |
| `debugMode` | Enable detailed logging | `false` |

## Screen Registration

Screens must be registered in Adlocaite with an `external_id` matching the Broadsign screen identifier. In most setups this is the `frame_id`, but it can also be the `display_unit_id` depending on your Broadsign configuration.

Check your Broadsign Player debug logs to see which ID is being used, and set the matching `external_id` in the Adlocaite dashboard.

See: [docs.adlocaite.com](https://docs.adlocaite.com)

## Testing

```bash
npm run test:serve
# Open http://127.0.0.1:8000/test/
```

## Troubleshooting

**No screen ID available**
- Must run in Broadsign Player
- Verify `frame_id` is set by Broadsign

**404 - No offers available**
- Check screen is registered with matching `external_id`
- Verify campaign is active in Adlocaite

**401 - Invalid API key**
- Check API key in `config.js`
- Verify key format starts with `pub_`

**CORS errors**
- Asset servers require `Access-Control-Allow-Origin: *` header

**Black screen / no ad playing**
- Ensure a fallback campaign is configured in Broadsign Control
- Check debug logs for API errors

Enable debug logging for details:
```javascript
debugMode: true
```

## Contributing

We welcome contributions! Here's how to get started:

### Development Workflow

1. **Fork the repository** on GitHub
2. **Create a feature branch** from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and test locally
4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
5. **Push to your fork**:
   ```bash
   git push -u origin feature/your-feature-name
   ```
6. **Create a Pull Request** to the `dev` branch

### Testing Your Changes

```bash
# Build the package
./build.sh

# Start test server
npm run test:serve

# Open test interface
# http://127.0.0.1:8000/test/
```

### Code Standards

- All comments and documentation in English
- Test your changes before committing
- Never commit `package/js/config.js` (use `config.example.js`)
- Follow existing code style and structure
- Update documentation if adding features

### Branch Protection

- Direct pushes to `main` and `dev` are blocked
- All changes must go through Pull Requests
- Git hooks will run automatically to prevent sensitive data commits

## Resources

- **Dashboard**: [app.adlocaite.com](https://app.adlocaite.com)
- **Documentation**: [docs.adlocaite.com](https://docs.adlocaite.com)
- **Website**: [adlocaite.com](https://adlocaite.com)
- **Broadsign Docs**: [docs.broadsign.com](https://docs.broadsign.com/broadsign-control/latest/html5.html)

## Not a Publisher Yet?

Request access at [adlocaite.com](https://adlocaite.com)

## License

MIT
