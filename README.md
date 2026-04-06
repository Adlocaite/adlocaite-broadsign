# Adlocaite Broadsign Integration

Official Broadsign Control HTML5 package for integrating programmatic DOOH (Digital Out-of-Home) advertisements via the Adlocaite API.

## How It Works

When Broadsign plays an ad slot assigned to this package:

1. **Pre-Loading (PREBUFFER)** — Broadsign loads the HTML package off-screen. During this phase, `BroadSignObject.frame_id` is already available. The package immediately requests an offer from the Adlocaite API, parses the VAST response, accepts the offer, and pre-loads the media asset.
2. **Skip Signal** — If no ad is available, the package sends a `skip_next` WebSocket command to the Broadsign Remote Control API (`ws://localhost:2326`). Broadsign then moves to the next item in the programmatic waterfall. If `BroadSignPlay()` has already fired, a `stop` command is sent instead to end the current playback.
3. **BroadSignPlay()** — Broadsign calls `BroadSignPlay()` when the ad slot becomes visible. Pre-loaded content plays instantly with no loading delay.
4. **Playback & Tracking** — The media plays, VAST tracking events are fired at the correct quartiles, and playout is confirmed via the API.

## Requirements

- Broadsign Control 15.4+ (Chromium 87+)
- **Remote Control enabled** in Broadsign Control Player settings (required for WebSocket skip signaling)
- Adlocaite Publisher API Key
- Registered screens in Adlocaite with `external_id` matching the Broadsign `frame_id`
- A fallback campaign in Broadsign for when no programmatic ad is available

> **Important:** The WebSocket skip mechanism requires Broadsign's Remote Control API to be enabled on the player. Without it, there is **no reliable skip mechanism** and the player may show black screens when no ad is available. See [Broadsign Remote Control documentation](https://docs.broadsign.com/broadsign-control/latest/en/skip-next-command-action.html) for setup instructions.

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
| `apiKey` | Publisher API key (required, format: `pub_xxxx`) | — |
| `apiBaseUrl` | API endpoint (staging/production) | Production |
| `minBidCents` | Minimum bid price in cents | `100` |
| `vastMode` | Enable VAST XML responses | `true` |
| `debugMode` | Enable detailed console logging | `false` |
| `requestTimeout` | API request timeout in ms | `10000` |
| `assetTimeout` | Media asset loading timeout in ms | `20000` |
| `maxRetries` | Number of API retry attempts | `3` |
| `retryDelay` | Initial retry delay in ms (exponential backoff) | `1000` |
| `axiomToken` | Axiom ingest-only API token for remote error logging (optional) | `''` |
| `axiomDataset` | Axiom dataset name | `'broadsign'` |
| `packageVersion` | Version string (auto-injected by build) | `'2.0.0'` |

## Screen Registration

Screens must be registered in Adlocaite with an `external_id` matching the Broadsign `frame_id`. The `frame_id` represents an individual screen surface (a display unit can have multiple frames, e.g., front/back of a totem).

1. Find your Broadsign `frame_id` in the Broadsign Control interface or player debug logs
2. Create or update the screen in the Adlocaite dashboard with a matching `external_id`
3. Example: Broadsign `frame_id` = `"842292831"` → Adlocaite `external_id` = `"842292831"`

See: [docs.adlocaite.com](https://docs.adlocaite.com)

## Skip Signal & Waterfall

The package uses WebSocket commands to Broadsign's Remote Control API at `ws://localhost:2326` to signal skip. This is the **only** reliable skip mechanism — Remote Control must be enabled on the player.

- **During PREBUFFER** (before `BroadSignPlay()`): sends `skip_next` to prevent the ad copy from being shown
- **After `BroadSignPlay()`** (already visible): sends `stop` to end the current playback immediately

**Skip reasons:**
- `no offers available` — API returned no offers (404)
- `api error` — API returned an error
- `no screen id` — No screen ID available
- `init failed` — Initialization failed
- `preload failed` — Pre-loading failed

Publishers must always configure a fallback campaign in Broadsign Control. Without Remote Control enabled, there is no reliable skip mechanism.

## Remote Logging (Axiom)

When `axiomToken` is configured, the package sends error and warning events to Axiom for production monitoring. Events are buffered and flushed periodically (every 10s) or immediately on errors. Without a token, logging is console-only.

Each event includes: timestamp, log level, module name, message, screen ID, package version, and user agent.

## Testing

```bash
npm run test:serve
# Open http://127.0.0.1:8000/test/
```

The test server at `test/server.js` provides a PREBUFFER simulation endpoint (`/package-sim`) that injects a mock `BroadSignObject` with configurable properties, allowing local testing without a Broadsign Player.

## Troubleshooting

**No screen ID available**
- Must run inside Broadsign Player
- Verify `frame_id` is set in Broadsign

**404 — No offers available**
- Check screen is registered with matching `external_id`
- Verify campaign is active in Adlocaite

**401 — Invalid API key**
- Check API key in `config.js`
- Verify key format starts with `pub_`

**CORS errors**
- Asset servers require `Access-Control-Allow-Origin: *` header

**Skip not working / black screen**
- Ensure **Remote Control is enabled** in Broadsign Control Player settings
- Ensure a fallback campaign is configured in Broadsign Control
- Check debug logs (`debugMode: true`) for API errors

Enable debug logging for detailed diagnostics:
```javascript
debugMode: true
```

## Contributing

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
- **Broadsign Skip Next Command**: [docs.broadsign.com](https://docs.broadsign.com/broadsign-control/latest/en/skip-next-command-action.html)

## Not a Publisher Yet?

Request access at [adlocaite.com](https://adlocaite.com)

## License

MIT
