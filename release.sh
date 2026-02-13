#!/bin/bash
#
# Release Script for Adlocaite Broadsign Integration
# Creates a new release with proper versioning and testing
#

set -e  # Exit on error

echo "🚀 Adlocaite Broadsign Release Script"
echo ""

# Check if on dev branch
current_branch=$(git symbolic-ref HEAD | sed -e 's,.*/\(.*\),\1,')
if [ "$current_branch" != "dev" ]; then
  echo "❌ ERROR: Must be on 'dev' branch to create a release"
  echo "Current branch: $current_branch"
  echo ""
  echo "Switch to dev:"
  echo "  git checkout dev"
  exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ ERROR: Uncommitted changes detected"
  echo ""
  echo "Please commit or stash your changes before releasing:"
  echo "  git status"
  exit 1
fi

# Get current version from package.json
current_version=$(grep '"version"' package.json | sed -E 's/.*"version": "([^"]+)".*/\1/')
echo "📦 Current version: $current_version"
echo ""

# Ask for new version
echo "Enter new version (format: X.Y.Z):"
read -r new_version

# Validate version format
if ! [[ $new_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ ERROR: Invalid version format"
  echo "Expected: X.Y.Z (e.g., 1.0.0)"
  exit 1
fi

echo ""
echo "📋 Release Checklist:"
echo "  Version: $current_version → $new_version"
echo ""
echo "Continue? (y/n)"
read -r confirm

if [ "$confirm" != "y" ]; then
  echo "❌ Release cancelled"
  exit 0
fi

echo ""
echo "🧪 Running tests..."

# Run test script if it exists
if [ -f "./test.sh" ]; then
  if ! ./test.sh; then
    echo ""
    echo "❌ RELEASE FAILED: Tests did not pass"
    exit 1
  fi
else
  # Fallback: just try to build
  echo "  → Building package..."
  if ! ./build.sh > /dev/null 2>&1; then
    echo ""
    echo "❌ RELEASE FAILED: Build failed"
    echo "Run './build.sh' to see detailed errors"
    exit 1
  fi
  echo "  ✅ Build successful"
fi

echo ""
echo "📝 Updating version..."

# Update version in package.json
sed -i.bak "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" package.json
rm package.json.bak

echo "  ✅ package.json updated"

echo ""
echo "📝 Update CHANGELOG.md manually with release notes"
echo "   Press ENTER when ready to continue..."
read -r

# Commit version bump
echo ""
echo "💾 Committing version bump..."
git add package.json CHANGELOG.md
git commit -m "chore: bump version to $new_version

Release $new_version

🤖 Generated with release.sh"

# Create git tag
echo ""
echo "🏷️  Creating git tag: v$new_version..."
git tag -a "v$new_version" -m "Release v$new_version"

echo ""
echo "✅ Release v$new_version created successfully!"
echo ""
echo "📤 Next steps:"
echo ""
echo "1. Push to dev branch:"
echo "   git push origin dev"
echo ""
echo "2. Push tag:"
echo "   git push origin v$new_version"
echo ""
echo "3. Create PR from dev → main on GitHub"
echo ""
echo "4. After merge, create GitHub Release:"
echo "   - Go to: https://github.com/adlocaite/adlocaite-broadsign/releases/new"
echo "   - Tag: v$new_version"
echo "   - Copy release notes from CHANGELOG.md"
echo ""
