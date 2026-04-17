# Deriv Miles - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- PostgreSQL running on port 5436
- Go 1.21+ installed
- Node.js 18+ installed

### 1. Start the Database

```bash
make db-up
```

### 2. Run Migrations

The migration will automatically run when you start the server. The system includes:
- 5 new tables for miles tracking
- 18 pre-seeded catalog items
- 7 earning rules configured
- Automatic tier calculation triggers

### 3. Start the Backend

```bash
cd backend
go run cmd/server/main.go
```

The Deriv Miles API will be available at `http://localhost:8090/api/miles/*`

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit:
- **Marketplace**: http://localhost:3000/marketplace
- **Miles Dashboard**: http://localhost:3000/miles

## 🧪 Test the System

### 1. Award yourself some miles

```bash
curl -X POST http://localhost:8090/api/admin/miles/award \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo_user",
    "amount": "500",
    "source_type": "manual",
    "description": "Welcome bonus"
  }'
```

### 2. Check your balance

```bash
curl http://localhost:8090/api/miles/balance?user_id=demo_user
```

### 3. Browse the marketplace

```bash
curl http://localhost:8090/api/miles/catalog?user_id=demo_user
```

### 4. Redeem an item

```bash
curl -X POST http://localhost:8090/api/miles/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo_user",
    "item_id": "celebration_fireworks",
    "quantity": 1
  }'
```

## 📊 View in the UI

1. Open http://localhost:3000/marketplace
2. Browse the catalog with category filters
3. Click "Redeem" on any item
4. Confirm your redemption

Then visit http://localhost:3000/miles to see your dashboard with:
- Current balance and tier
- Tier progress bar
- Transaction history
- Earning opportunities

## 🎯 How Miles are Earned

The system automatically awards miles when:

1. **Profitable Trade**: User makes money
   - Formula: `(PnL / 100) * 0.5` miles
   - Range: 1-50 miles per trade

2. **Competition Win**: User places in top 3
   - 1st place: 500 miles
   - 2nd place: 200 miles
   - 3rd place: 200 miles

3. **Win Streak**: User gets consecutive wins
   - 5 wins: 100 miles bonus
   - 10 wins: 250 miles bonus

4. **XP Gains**: User levels up agent
   - Formula: `XP / 10` miles
   - Example: 100 XP = 10 miles

## 🎨 Tier System

As users earn miles, they automatically progress through tiers:

| Tier | Threshold | Discount | Badge |
|------|-----------|----------|-------|
| Bronze | 0 miles | 0% | 🥉 |
| Silver | 1,000 miles | 5% | 🥈 |
| Gold | 5,000 miles | 10% | 🥇 |
| Platinum | 10,000 miles | 15% | 💎 |

Higher tiers get better discounts on all redemptions!

## 🛍️ Available Catalog Items

### AI Analysis (🤖)
- Basic AI Trade Analysis - 50 miles
- Advanced AI Coaching Session - 200 miles
- Weekly Performance Report - 500 miles

### Premium Features (⭐)
- Advanced Charts (1 Week) - 100 miles
- Price Alerts (1 Month) - 50 miles
- Exclusive Competition Entry - 200 miles
- Ad-Free Experience (1 Month) - 150 miles

### Marketplace Items (🛍️)
- Gold Trader Avatar - 75 miles
- Dark Pro Theme - 50 miles
- Fireworks Celebration - 25 miles
- Leaderboard Name Highlight - 75 miles

### Trading Benefits (📈)
- Bonus Starting Balance (+$1000) - 500 miles
- Fee Waiver (10 Trades) - 100 miles
- Exotic Contracts Unlock - 200 miles
- Instant Replay Token - 50 miles

## 🔧 Configuration

The system is controlled by environment variables in `.env`:

```bash
# Enable/disable the system
MILES_EARNING_ENABLED=true
MILES_REDEMPTION_ENABLED=true

# Conversion rate (10 XP = 1 mile)
MILES_XP_CONVERSION_RATE=10

# Daily earning limit
MILES_MAX_DAILY_EARN=1000
```

## 🐛 Troubleshooting

### Backend not starting?
```bash
# Check if migration ran
psql -h localhost -p 5436 -U derivarena -d derivarena
\dt deriv_miles_*
```

### Can't see any catalog items?
```bash
# Check if seeding worked
curl http://localhost:8090/api/miles/catalog
```

### Balance not updating?
```bash
# Check transactions
curl http://localhost:8090/api/miles/transactions?user_id=demo_user
```

## 📚 Next Steps

1. **Read the full documentation**: See `DERIV_MILES_README.md`
2. **Integrate with your app**: Add miles earning to your trade flows
3. **Customize the catalog**: Add your own redemption items
4. **Set up analytics**: Track engagement metrics

## 🎉 That's it!

You now have a fully functional rewards system that:
- ✅ Awards miles automatically for profitable trades
- ✅ Provides a marketplace for redemptions
- ✅ Tracks tiers with increasing benefits
- ✅ Shows comprehensive dashboards
- ✅ Handles all redemption categories

Happy rewarding! 🚀
