#!/bin/bash

# Deriv Miles System Test Script
echo "🎯 Testing Deriv Miles Rewards System"
echo "======================================"
echo ""

API_URL="http://localhost:8090"
USER_ID="demo_user"

echo "1️⃣ Awarding 500 miles to $USER_ID..."
curl -s -X POST $API_URL/api/admin/miles/award \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER_ID\",\"amount\":\"500\",\"source_type\":\"manual\",\"description\":\"Welcome bonus!\"}" | jq '.'
echo ""

echo "2️⃣ Checking balance..."
curl -s "$API_URL/api/miles/balance?user_id=$USER_ID" | jq '.'
echo ""

echo "3️⃣ Viewing transaction history..."
curl -s "$API_URL/api/miles/transactions?user_id=$USER_ID&limit=5" | jq '.'
echo ""

echo "4️⃣ Browsing AI Analysis items..."
curl -s "$API_URL/api/miles/catalog?user_id=$USER_ID&category=ai_analysis" | jq '.[] | {name, miles_cost, description}'
echo ""

echo "5️⃣ Redeeming 'Fireworks Celebration' (25 miles)..."
curl -s -X POST $API_URL/api/miles/redeem \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER_ID\",\"item_id\":\"celebration_fireworks\",\"quantity\":1}" | jq '.'
echo ""

echo "6️⃣ Checking updated balance..."
curl -s "$API_URL/api/miles/balance?user_id=$USER_ID" | jq '.'
echo ""

echo "✅ Test complete!"
echo ""
echo "🌐 Visit these URLs to see the UI:"
echo "   - Marketplace: http://localhost:3000/marketplace"
echo "   - Dashboard:   http://localhost:3000/miles"
