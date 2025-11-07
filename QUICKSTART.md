# Quickstart Guide

Get up and running with Adlocaite Broadsign Integration in 5 minutes.

## 🚀 Quick Setup

### 1. Configure (2 minutes)

```bash
# Copy config template
cp package/js/config.example.js package/js/config.js

# Edit and add your API key
nano package/js/config.js  # or use any editor
```

**Update these values:**
```javascript
apiKey: 'pub_your_key_here',  // Your actual API key
apiBaseUrl: 'https://api.adlocaite.com/functions/v1/api',  // Production URL
debugMode: false  // Set to true for testing
```

### 2. Build (30 seconds)

```bash
# Unix/Linux/macOS
./build.sh

# Windows
build.bat

# Or using npm
npm run package
```

### 3. Upload to Broadsign (2 minutes)

1. Open **Broadsign Control Administrator**
2. Go to **Library > Ad Copies**
3. Click **Upload**
4. Select `adlocaite-broadsign.x-html-package`
5. Assign to your campaign

### 4. Test (1 minute)

Enable debug mode to see logs:
```javascript
debugMode: true
```

Rebuild and check Broadsign Player logs for:
```
[Adlocaite] Screen ID: ...
[Adlocaite] Requesting offer...
[Adlocaite] VAST parsed successfully
```

## ✅ That's It!

Your screens are now connected to Adlocaite programmatic DOOH!

## 📋 Checklist

- [ ] API key configured
- [ ] Package built successfully
- [ ] Uploaded to Broadsign Control
- [ ] Assigned to campaign
- [ ] Test playout verified

## 🔧 Common Issues

**No offers received (404)?**
- Verify screen is registered in Adlocaite
- Check `minBidCents` setting

**API error (401)?**
- Verify API key is correct
- Ensure key starts with `pub_`

**Screen ID not found?**
- Must run in Broadsign Player (not browser)
- Check Broadsign version supports JavaScript variables

## 📚 Next Steps

- [Full Installation Guide](INSTALL.md)
- [Complete Documentation](README.md)
- [API Reference](https://docs.adlocaite.com)

## 💬 Support

**Email**: support@adlocaite.com  
**Docs**: https://docs.adlocaite.com


