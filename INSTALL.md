# Installation Guide

Complete step-by-step installation guide for the Adlocaite Broadsign Integration.

## Prerequisites

### Broadsign Requirements

- **Broadsign Control**: Version 15.4 or higher
- **Player Support**: Chromium browser embedded (version 87+)
- **Operating System**: Windows or Linux

### Development Requirements

- **Git**: For cloning the repository
- **zip** (Unix/Linux/macOS) or **7-Zip** (Windows): For packaging
- **Text Editor**: For configuration editing

### Adlocaite Requirements

- **API Key**: Publisher API key from Adlocaite
- **Screen Registration**: Screens must be registered in Adlocaite platform
- **Network Access**: Internet connectivity for API access

## Installation Steps

### 1. Get the Source Code

**Option A: Clone from Git**

```bash
git clone <repository-url>
cd adlocaite-broadsign
```

**Option B: Download ZIP**

1. Download the latest release
2. Extract to your preferred location
3. Navigate to the extracted folder

### 2. Create Configuration

Copy the example configuration and edit it:

**Unix/Linux/macOS:**
```bash
cp package/js/config.example.js package/js/config.js
nano package/js/config.js  # or use your preferred editor
```

**Windows:**
```cmd
copy package\js\config.example.js package\js\config.js
notepad package\js\config.js
```

### 3. Configure API Settings

Edit `package/js/config.js` and update the following:

```javascript
const ADLOCAITE_CONFIG = {
  // REQUIRED: Your Publisher API Key
  apiKey: 'pub_your_actual_key_here',

  // Environment: staging or production
  apiBaseUrl: 'https://api.adlocaite.com/functions/v1/api',

  // Minimum bid threshold (in cents)
  minBidCents: 100,

  // Enable/disable features as needed
  enableCaching: true,
  vastMode: true,
  fallbackEnabled: true,
  
  // Disable debug mode for production
  debugMode: false
};
```

**Important**: Never commit `config.js` to version control!

### 4. Build the Package

**Unix/Linux/macOS:**
```bash
chmod +x build.sh
./build.sh
```

**Windows:**
```cmd
build.bat
```

**Or using npm:**
```bash
npm run package
```

This creates `adlocaite-broadsign.x-html-package` in the root directory.

### 5. Upload to Broadsign Control

1. **Open Broadsign Control Administrator**
2. **Navigate to Library**
   - Click on the **Library** tab in the top menu
3. **Go to Ad Copies**
   - Click on **Ad Copies** in the left sidebar
4. **Upload Package**
   - Click the **Upload** or **New** button
   - Select `adlocaite-broadsign.x-html-package`
   - Wait for upload to complete
5. **Verify Upload**
   - The package should appear in your Ad Copy library
   - Check the file size and upload time

### 6. Assign to Campaign

1. **Create or Select Campaign**
   - Navigate to **Campaigns** in Broadsign Control
   - Create a new campaign or select existing one
2. **Add Ad Copy**
   - Add the uploaded Adlocaite package to your campaign
   - Set appropriate scheduling and targeting
3. **Assign to Display Units**
   - Select the screens/display units where you want the ads to play
   - Ensure screens are registered in Adlocaite with matching IDs
4. **Activate Campaign**
   - Enable the campaign
   - Set start and end dates

## Verification

### Test the Installation

1. **Enable Debug Mode**
   ```javascript
   // In config.js
   debugMode: true
   ```

2. **Rebuild Package**
   ```bash
   ./build.sh  # or build.bat on Windows
   ```

3. **Re-upload to Broadsign**

4. **Check Player Logs**
   - Open Broadsign Player logs
   - Look for `[Adlocaite]` log entries
   - Verify screen ID detection
   - Check API communication

### Expected Log Output

```
[Adlocaite] Initializing application...
[Adlocaite] Player info: {...}
[Adlocaite] Screen ID: abc-123-def-456
[Adlocaite] Requesting offer...
[Adlocaite] VAST XML received
[Adlocaite] VAST parsed successfully
[Adlocaite] Starting playback...
[Adlocaite] Playout confirmed
```

## Troubleshooting Installation

### Issue: Build fails with "zip not found"

**Solution:**
- **macOS**: `brew install zip`
- **Ubuntu/Debian**: `sudo apt-get install zip`
- **Windows**: Install 7-Zip from https://www.7-zip.org/

### Issue: "config.js not found"

**Solution:**
```bash
cp package/js/config.example.js package/js/config.js
```
Then edit config.js with your API key.

### Issue: "Invalid API key"

**Solution:**
- Verify your API key starts with `pub_`
- Check for extra spaces or line breaks
- Contact Adlocaite support to verify key validity

### Issue: Package upload fails in Broadsign

**Solution:**
- Verify package file size is reasonable (< 50MB)
- Check file extension is `.x-html-package`
- Try re-building the package
- Check Broadsign Control version compatibility

### Issue: Screen ID not detected

**Solution:**
- Ensure running in Broadsign Player (not browser)
- Check if `BroadSignObject` is available
- Verify Broadsign version supports JavaScript variables
- Add manual screen ID fallback in config

## Post-Installation

### Production Checklist

- [ ] API key configured correctly
- [ ] `apiBaseUrl` set to production URL
- [ ] `debugMode` set to `false`
- [ ] Fallback image customized (optional)
- [ ] Package rebuilt and uploaded
- [ ] Test on actual hardware
- [ ] Monitor first few playouts
- [ ] Check playout confirmations in Adlocaite dashboard

### Monitoring

1. **Check Broadsign Player Logs**
   - Regular review for errors
   - Monitor API response times
   - Track playout success rate

2. **Check Adlocaite Dashboard**
   - Verify offer requests
   - Monitor acceptance rate
   - Review playout confirmations

3. **Performance Metrics**
   - Asset loading times
   - Network connectivity
   - Cache hit rates (if enabled)

## Updating

### To Update Configuration

1. Edit `package/js/config.js`
2. Rebuild package: `./build.sh`
3. Re-upload to Broadsign Control
4. No need to modify campaigns

### To Update Code

1. Pull latest changes from Git
2. Rebuild package
3. Re-upload to Broadsign Control
4. Update campaign ad copies if needed

## Support

If you encounter issues during installation:

- **Email**: support@adlocaite.com
- **Documentation**: https://docs.adlocaite.com
- **Include**: 
  - Broadsign Control version
  - Error messages
  - Relevant log entries
  - Configuration (without API key)

## Next Steps

After successful installation:

1. [Read the README](README.md) for usage information
2. [Check the API Documentation](https://docs.adlocaite.com)
3. [Review Best Practices](#) for optimization tips
4. [Join our Community](#) for support and updates


