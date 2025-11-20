# Adlocaite Broadsign Integration

Official Broadsign Control HTML5 package for programmatic DOOH advertising.

## Requirements
- Broadsign Control 15.4+ (Chromium 87+)
- Adlocaite Publisher API Key
- Registered screens with `external_id` matching Broadsign `frame_id`

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
| `debugMode` | Enable detailed logging | `true` |
| `fallbackEnabled` | Show fallback on no offers | `true` |
| `enableCaching` | Asset pre-caching | `true` |

## Screen Registration

Screens must be registered in Adlocaite with `external_id` matching Broadsign `frame_id`.

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
