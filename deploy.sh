#!/bin/bash

echo "🚀 Deploying Social Media Backup System to Firebase..."

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

# Deploy Firebase Functions
echo "🔥 Deploying Firebase Functions..."
firebase deploy --only functions

# Deploy Firebase Hosting
echo "🌐 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo "🌐 Website: https://rdsem-a00a4.web.app"
echo "🔧 Functions: https://us-central1-rdsem-a00a4.cloudfunctions.net"
