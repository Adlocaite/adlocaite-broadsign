# Broadsign Integration Test Suite

This directory contains all testing infrastructure for the Broadsign-Adlocaite integration package.

## Manual Testing

### Quick Start

```bash
# From project root:
npm run test:serve

# Or directly:
node test/server.js
```

Then open http://127.0.0.1:8000/test/ in your browser.

### Test Interface

The test interface allows you to:
- **Mock BroadSignObject** with custom frame_id, display_unit_id, and player_id
- **Test with or without URL parameters** (simulates different scenarios)
- **View real-time logs** from the package
- **Manually trigger** BroadSignPlay() lifecycle

### Configuration Options

- **frame_id**: The screen identifier (default: `842292831`)
- **display_unit_id**: Display unit identifier (default: `12345`)
- **player_id**: Player identifier (default: `67890`)
- **Use URL Parameter**: Pass screen_id via query string instead of BroadSignObject
- **Min Bid**: Minimum bid threshold in cents

## Test Scenarios

### Scenario 1: Normal Broadsign Player Simulation
1. Keep default settings (frame_id: `842292831`)
2. Click "Load Package"
3. Click "Trigger Play"
4. Expected: Package requests offer, plays content

### Scenario 2: URL Parameter Mode
1. Check "Use URL Parameter"
2. Click "Load Package"
3. Click "Trigger Play"
4. Expected: Same as Scenario 1, but screen_id comes from URL

### Scenario 3: Invalid Screen ID
1. Change frame_id to something not registered (e.g., `invalid-123`)
2. Click "Load Package"
3. Click "Trigger Play"
4. Expected: 404 or 422 error, graceful fallback

### Scenario 4: No Screen ID Available
1. Clear frame_id field
2. Uncheck "Use URL Parameter"
3. Click "Load Package"
4. Click "Trigger Play"
5. Expected: Clear error message about missing screen ID

## Automated Testing (CI/CD)

**Coming soon:** Automated tests using Playwright will be added for CI/CD integration.

```bash
# Future command:
npm run test:e2e
```

## Files

- `index.html` - Manual test interface
- `server.js` - Simple HTTP server for local testing
- `README.md` - This file

## Troubleshooting

### CORS Errors
If you see CORS errors, make sure you're using the test server (`npm run test:serve`) instead of opening files directly with `file://` protocol.

### Package Not Loading
- Check that the package was built: `./build.sh`
- Verify `adlocaite-broadsign.x-html-package` exists in project root
- Check browser console for errors

### API Errors
- Verify `package/js/config.js` exists and has valid API key
- Check network tab in browser dev tools
- Ensure screen with matching external_id exists in backend
