#!/bin/bash
#
# Test Script for Adlocaite Broadsign Integration
# Builds package and runs basic smoke tests
#

set -e  # Exit on error

echo "🧪 Adlocaite Broadsign Test Suite"
echo ""

# Check if required files exist
echo "📋 Checking prerequisites..."

required_files=(
  "package/index.html"
  "package/js/config.example.js"
  "package/js/logger.js"
  "package/js/adlocaite-api.js"
  "package/js/broadsign-adapter.js"
  "package/js/vast-parser.js"
  "package/js/player.js"
  "package/css/styles.css"
  "build.sh"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ ERROR: Required file missing: $file"
    exit 1
  fi
done

echo "  ✅ All required files present"

# Check for config.js (should not be committed)
echo ""
echo "🔍 Checking for sensitive files..."

if git ls-files | grep -q "package/js/config.js"; then
  echo "❌ ERROR: config.js is tracked by git!"
  echo "This file contains sensitive API keys and should not be committed."
  echo ""
  echo "To fix:"
  echo "  git rm --cached package/js/config.js"
  echo "  git commit -m 'Remove config.js from git'"
  exit 1
fi

echo "  ✅ No sensitive files tracked"

# Build package
echo ""
echo "📦 Building package..."

if ! ./build.sh > /dev/null 2>&1; then
  echo "❌ ERROR: Build failed"
  echo ""
  echo "Run './build.sh' to see detailed errors"
  exit 1
fi

echo "  ✅ Build successful"

# Check if package was created
if [ ! -f "adlocaite-broadsign.x-html-package" ]; then
  echo "❌ ERROR: Package file not created"
  exit 1
fi

# Check package size (should be reasonable)
package_size=$(du -k "adlocaite-broadsign.x-html-package" | cut -f1)
if [ "$package_size" -lt 10 ]; then
  echo "❌ ERROR: Package size too small ($package_size KB)"
  echo "Package may be corrupted or incomplete"
  exit 1
fi

if [ "$package_size" -gt 5000 ]; then
  echo "⚠️  WARNING: Package size unusually large ($package_size KB)"
  echo "Consider checking for unnecessary files"
fi

echo "  ✅ Package created (${package_size}KB)"

# Test server check (optional - only if server is running)
echo ""
echo "🌐 Testing local server..."

# Start test server in background
if [ -f "test/server.js" ]; then
  echo "  → Starting test server..."
  node test/server.js > /dev/null 2>&1 &
  SERVER_PID=$!

  # Wait for server to start
  sleep 2

  # Test if server is responding
  if curl -s http://127.0.0.1:8000/test/ > /dev/null 2>&1; then
    echo "  ✅ Test server responding"
  else
    echo "  ⚠️  WARNING: Test server not responding"
  fi

  # Kill test server
  kill $SERVER_PID 2>/dev/null || true
else
  echo "  ⚠️  Test server not found (test/server.js)"
fi

# Summary
echo ""
echo "✅ All tests passed!"
echo ""
echo "Test summary:"
echo "  - Required files: ✅"
echo "  - Sensitive files check: ✅"
echo "  - Build: ✅"
echo "  - Package validation: ✅"
echo ""

exit 0
