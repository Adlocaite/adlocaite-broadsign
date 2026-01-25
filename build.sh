#!/bin/bash

# Adlocaite Broadsign Integration - Build Script
# Creates .x-html-package file for Broadsign Control

set -e

echo "🚀 Building Adlocaite Broadsign Integration Package..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if config.js exists
if [ ! -f "package/js/config.js" ]; then
  echo -e "${RED}❌ Error: config.js not found!${NC}"
  echo ""
  echo "Please create config.js from the template:"
  echo "  cp package/js/config.example.js package/js/config.js"
  echo ""
  echo "Then edit config.js and add your API key."
  exit 1
fi

# Check if API key is configured (only check the actual apiKey line, not comments)
if grep "^\s*apiKey:" "package/js/config.js" | grep -q "pub_xxxx"; then
  echo -e "${YELLOW}⚠️  Warning: API key not configured in config.js${NC}"
  echo "Make sure to update your API key before deploying to production."
  echo ""
fi

# Clean previous build
if [ -f "adlocaite-broadsign.x-html-package" ]; then
  echo "🧹 Cleaning previous build..."
  rm -f adlocaite-broadsign.x-html-package
fi

# Create package
echo "📦 Creating package..."
cd package

# Check if zip command exists
if ! command -v zip &> /dev/null; then
  echo -e "${RED}❌ Error: zip command not found!${NC}"
  echo "Please install zip utility:"
  echo "  macOS: brew install zip"
  echo "  Ubuntu/Debian: sudo apt-get install zip"
  exit 1
fi

# Create the zip file
zip -r ../adlocaite-broadsign.x-html-package \
  index.html \
  js/*.js \
  js/vendor/*.js \
  css/*.css \
  -x "*.DS_Store" \
  -x "*/__pycache__/*" \
  -x "*/node_modules/*"

cd ..

# Check if package was created successfully
if [ -f "adlocaite-broadsign.x-html-package" ]; then
  SIZE=$(du -h adlocaite-broadsign.x-html-package | cut -f1)
  echo ""
  echo -e "${GREEN}✅ Package created successfully!${NC}"
  echo ""
  echo "📋 Package details:"
  echo "  File: adlocaite-broadsign.x-html-package"
  echo "  Size: $SIZE"
  echo ""
  echo "📤 Next steps:"
  echo "  1. Open Broadsign Control Administrator"
  echo "  2. Navigate to Library > Ad Copies"
  echo "  3. Click Upload and select the .x-html-package file"
  echo "  4. Assign the ad copy to your campaign"
  echo ""
  echo "🧪 Testing:"
  echo "  Enable debug mode in config.js to see detailed logs"
  echo "  Check Broadsign Player logs for troubleshooting"
  echo ""
else
  echo -e "${RED}❌ Error: Package creation failed!${NC}"
  exit 1
fi


