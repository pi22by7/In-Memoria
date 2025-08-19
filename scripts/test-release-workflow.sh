#!/bin/bash
set -e

echo "🧪 Testing release workflow locally..."

# Simulate the workflow steps for current platform
TARGET="x86_64-unknown-linux-gnu"
PLATFORM="linux-x64"

echo "📝 Building for target: $TARGET"
npm run build

echo "📁 Creating platform package directory..."
mkdir -p npm/$PLATFORM

echo "📦 Copying binary to platform package..."
if [ -f rust-core/*.node ]; then
    cp rust-core/*.node npm/$PLATFORM/
    echo "✅ Binary copied successfully"
else
    echo "❌ No .node file found"
    exit 1
fi

echo "🔍 Checking platform package structure..."
ls -la npm/$PLATFORM/

echo "📋 Validating package.json..."
if [ -f npm/$PLATFORM/package.json ]; then
    echo "✅ package.json exists"
    node -e "
        const pkg = require('./npm/$PLATFORM/package.json');
        console.log('Package name:', pkg.name);
        console.log('Version:', pkg.version);
        console.log('Main:', pkg.main);
        console.log('OS:', pkg.os);
        console.log('CPU:', pkg.cpu);
    "
else
    echo "❌ package.json missing"
    exit 1
fi

echo "🎯 Testing npm pack (dry run)..."
cd npm/$PLATFORM
npm pack --dry-run
cd ../..

echo "✅ Release workflow test completed successfully!"
echo "🚀 Ready for production release!"