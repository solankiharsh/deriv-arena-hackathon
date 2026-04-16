#!/bin/bash
# DerivArena frontend — optional Vercel deploy helper
# Run from frontend/: ./DEPLOY_TO_VERCEL.sh

set -e

if [ ! -f "package.json" ]; then
  echo "Run this script from the frontend/ directory."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  npm install
fi

npm run build

echo ""
echo "Build OK. Deploy with:"
echo "  npx vercel --prod"
echo ""
echo "Set environment variables in Vercel to match your Go API, e.g.:"
echo "  NEXT_PUBLIC_API_URL=https://your-api.example.com"
echo "  NEXT_PUBLIC_WS_URL=wss://your-api.example.com"
echo ""
