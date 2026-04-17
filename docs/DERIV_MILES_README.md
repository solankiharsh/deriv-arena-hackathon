# Deriv Miles Rewards System

## Overview

**Deriv Miles** is a comprehensive loyalty rewards system that allows users to earn miles from profitable trades, competition wins, streaks, and XP gains. Users can redeem miles for AI analysis, premium features, third-party tool credits, marketplace items, and trading benefits.

## Features Implemented

### Backend (Go)

#### Database Schema
- ✅ 5 new tables with comprehensive constraints and triggers
  - `deriv_miles_balances` - User balances with tier tracking
  - `deriv_miles_transactions` - Complete transaction history
  - `deriv_miles_redemptions` - Redemption records
  - `deriv_miles_catalog` - Marketplace catalog
  - `deriv_miles_earning_rules` - Configurable earning rules
- ✅ Automatic tier calculation triggers
- ✅ Balance integrity constraints
- ✅ Idempotency checks for duplicate awards
- ✅ Seeded catalog with 18 items across 5 categories

#### Core Package (`backend/internal/derivmiles`)
- ✅ **types.go** - Complete type definitions with 15+ structs
- ✅ **store.go** - Database operations with atomic transactions
- ✅ **earning_engine.go** - Miles calculation engine
- ✅ **redemption.go** - Fulfillment processor for all categories
- ✅ **catalog.go** - Catalog management with tier-based pricing
- ✅ **service.go** - HTTP handlers for 17+ API endpoints

#### Earning Mechanics
- ✅ **XP Conversion**: 10 XP = 1 mile
- ✅ **Profitable Trades**: (PnL / 100) * 0.5 miles (1-50 range)
- ✅ **Competition Wins**: 500 miles (1st), 200 miles (2nd/3rd)
- ✅ **Win Streaks**: 100 miles (5 streak), 250 miles (10 streak)
- ✅ **Daily Login**: 5 miles per day

#### API Endpoints

**User Endpoints**
- `GET /api/miles/balance?user_id={id}` - Get balance
- `GET /api/miles/stats?user_id={id}` - Extended stats with tier info
- `GET /api/miles/transactions?user_id={id}&limit=50&offset=0` - Transaction history
- `GET /api/miles/earning-opportunities?user_id={id}` - Available earning methods
- `GET /api/miles/catalog?user_id={id}&category={cat}` - Catalog with tier pricing
- `GET /api/miles/catalog/{id}` - Item details
- `GET /api/miles/catalog/featured?limit=6` - Featured items
- `GET /api/miles/catalog/recommendations?user_id={id}` - Personalized recommendations
- `POST /api/miles/redeem` - Redeem miles for items
- `GET /api/miles/redemptions?user_id={id}&status={status}` - Redemption history
- `GET /api/miles/premium-features?user_id={id}` - Active premium features
- `GET /api/miles/marketplace-items?user_id={id}` - Owned marketplace items
- `GET /api/miles/trading-benefits?user_id={id}` - Active trading benefits

**Admin Endpoints**
- `POST /api/admin/miles/award` - Manually award miles
- `POST /api/admin/miles/catalog` - Create catalog item
- `PATCH /api/admin/miles/catalog/{id}` - Update catalog item
- `GET /api/admin/miles/analytics` - System-wide analytics

#### Integration Hooks
- ✅ **Trade Recording**: Automatic miles for profitable trades
- ✅ **Competition End**: Awards for top 3 finishers
- ✅ **Win Streak Detection**: Bonus miles for streaks
- ✅ **XP System**: Ready for XP → miles conversion

### Frontend (React/Next.js)

#### State Management
- ✅ **miles-store.ts** - Comprehensive Zustand store
  - Balance and stats fetching
  - Transaction history
  - Catalog browsing with filters
  - Redemption processing
  - Error handling and loading states

#### UI Components (`frontend/components/miles`)
- ✅ **MilesIcon** - Consistent miles icon across app
- ✅ **MilesBalance** - Display current balance with tier badge
- ✅ **MilesProgressBar** - Tier progress visualization
- ✅ **EarningNotification** - Toast notifications for earnings

#### Pages
- ✅ **`/marketplace`** - Full marketplace experience
  - Category filtering (AI Analysis, Premium, Tools, Items, Trading)
  - Search functionality
  - Item cards with discount display
  - Redemption modal with quantity selection
  - Stock tracking
  - Balance validation
  
- ✅ **`/miles`** - Comprehensive dashboard
  - Balance overview (current, earned, spent)
  - Tier progress with benefits
  - Earning opportunities cards
  - Recent transactions list
  - Recent redemptions list

## Tier System

| Tier | Threshold | Discount | Benefits |
|------|-----------|----------|----------|
| 🥉 Bronze | 0 miles | 0% | Basic marketplace access |
| 🥈 Silver | 1,000 miles | 5% | Priority support, exclusive badge |
| 🥇 Gold | 5,000 miles | 10% | Early feature access, monthly bonus |
| 💎 Platinum | 10,000 miles | 15% | VIP support, weekly bonus, free AI credits |

## Catalog Categories

### 1. AI Analysis (🤖)
- **Basic AI Trade Analysis** - 50 miles
- **Advanced AI Coaching** - 200 miles
- **Weekly Performance Report** - 500 miles

### 2. Premium Features (⭐)
- **Advanced Charts (1 Week)** - 100 miles
- **Price Alerts (1 Month)** - 50 miles
- **Exclusive Competition Entry** - 200 miles
- **Ad-Free Experience** - 150 miles

### 3. Third-party Tools (🔧)
- **SEO Tool Credits** - Voucher codes
- **Design Tool Access** - Canva Pro credits
- **Analytics Tools** - GA Premium access

### 4. Marketplace Items (🛍️)
- **Gold Trader Avatar** - 75 miles
- **Dark Pro Theme** - 50 miles
- **Fireworks Celebration** - 25 miles
- **Leaderboard Name Highlight** - 75 miles

### 5. Trading Benefits (📈)
- **Bonus Starting Balance (+$1000)** - 500 miles
- **Fee Waiver (10 Trades)** - 100 miles
- **Exotic Contracts Unlock** - 200 miles
- **Instant Replay Token** - 50 miles

## Security Features

### Transaction Safety
- ✅ Atomic database transactions
- ✅ Idempotency for duplicate prevention
- ✅ Balance validation before spending
- ✅ Complete audit trail with metadata
- ✅ Row-level locking for concurrent updates

### Input Validation
- ✅ Server-side validation for all requests
- ✅ Stock availability checks
- ✅ User eligibility verification
- ✅ Metadata sanitization

### Rate Limiting (Planned)
- Max 1000 miles per day from trades
- Max 5 redemptions per hour per user
- Catalog item cooldown periods

## Environment Variables

Add to `.env`:

```bash
# Deriv Miles Configuration
MILES_EARNING_ENABLED=true
MILES_XP_CONVERSION_RATE=10
MILES_MAX_DAILY_EARN=1000
MILES_REDEMPTION_ENABLED=true

# Third-party integrations (optional)
AHREFS_API_KEY=
CANVA_API_KEY=
```

## Database Migration

Run the migration to create all tables:

```bash
# The migration will run automatically on server start
# Files: backend/migrations/020_deriv_miles.up.sql
make db-migrate
```

## API Usage Examples

### Get User Balance
```bash
curl http://localhost:8090/api/miles/balance?user_id=demo_user
```

### List Catalog with Tier Pricing
```bash
curl "http://localhost:8090/api/miles/catalog?user_id=demo_user&category=ai_analysis"
```

### Redeem an Item
```bash
curl -X POST http://localhost:8090/api/miles/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo_user",
    "item_id": "ai_analysis_basic",
    "quantity": 1,
    "metadata": {"trade_id": "abc123"}
  }'
```

### Manual Award (Admin)
```bash
curl -X POST http://localhost:8090/api/admin/miles/award \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo_user",
    "amount": "100",
    "source_type": "manual",
    "description": "Bonus for testing"
  }'
```

## Integration Guide

### Adding New Earning Sources

1. **Define the rule in migration**:
```sql
INSERT INTO deriv_miles_earning_rules (id, rule_type, miles_formula, conditions)
VALUES ('new_rule', 'custom_action', '{{amount}} * 2', '{"multiplier": 2}');
```

2. **Add processor method** in `earning_engine.go`:
```go
func (e *EarningEngine) ProcessCustomAction(ctx context.Context, userID string, amount decimal.Decimal) error {
    milesEarned := amount.Mul(decimal.NewFromInt(2))
    sourceID := fmt.Sprintf("custom_%s", uuid.New().String()[:8])
    _, err := e.store.AwardMiles(ctx, userID, milesEarned, "custom_action", sourceID, description, metadata)
    return err
}
```

3. **Call from your service**:
```go
milesEngine.ProcessCustomAction(ctx, userID, actionAmount)
```

### Adding New Redemption Categories

1. **Add category to catalog table** (already supports extensibility via metadata)
2. **Implement fulfillment handler** in `redemption.go`:
```go
func (r *RedemptionProcessor) fulfillCustomCategory(...) {
    // Your fulfillment logic
    fulfillmentData := map[string]interface{}{
        "status": "ready",
        "custom_field": value,
    }
    return fulfillmentData, expiresAt, nil
}
```

3. **Update switch statement** in `fulfillItem` method

## Frontend Integration

### Using the Miles Store

```typescript
import { useMilesStore } from '@/lib/stores/miles-store';

function MyComponent() {
  const { balance, fetchBalance, redeemItem } = useMilesStore();
  
  useEffect(() => {
    fetchBalance(userId);
  }, [userId]);
  
  const handleRedeem = async () => {
    try {
      await redeemItem(userId, itemId, quantity);
      toast.success('Redemption successful!');
    } catch (error) {
      toast.error(error.message);
    }
  };
}
```

### Using Miles Components

```tsx
import { MilesBalance, MilesProgressBar, showMilesEarnedNotification } from '@/components/miles';

// Display balance in navbar
<MilesBalance userId={userId} showTier />

// Show tier progress
<MilesProgressBar userId={userId} />

// Show earning notification
showMilesEarnedNotification({
  amount: 50,
  source: 'profitable trade',
  description: 'Great trade! Keep it up.'
});
```

## Testing

### Manual Testing Checklist

1. **Earning Miles**
   - [ ] Make a profitable trade → Check miles awarded
   - [ ] Win a competition → Check position-based miles
   - [ ] Complete a win streak → Check bonus miles
   - [ ] Gain XP → Check conversion to miles

2. **Tier System**
   - [ ] Start at Bronze tier
   - [ ] Earn 1000 miles → Check upgrade to Silver
   - [ ] Check discount applied in catalog
   - [ ] Verify tier benefits display

3. **Catalog & Redemption**
   - [ ] Browse catalog by category
   - [ ] Search for items
   - [ ] View item details with tier pricing
   - [ ] Redeem item with sufficient balance
   - [ ] Try redemption with insufficient balance
   - [ ] Check stock quantity updates

4. **Dashboard**
   - [ ] View balance overview
   - [ ] Check transaction history
   - [ ] View earning opportunities
   - [ ] Check redemption history

### Automated Testing (Future)

```go
// Example test
func TestAwardMiles(t *testing.T) {
    store := NewStore(pool)
    engine := NewEarningEngine(store)
    
    err := engine.ProcessProfitableTrade(ctx, "user1", "trade1", decimal.NewFromInt(1000))
    assert.NoError(t, err)
    
    balance, _ := store.GetBalance(ctx, "user1")
    assert.Equal(t, "5", balance.CurrentBalance) // (1000/100)*0.5 = 5
}
```

## Performance Considerations

- Database indexes on frequently queried columns
- Transaction pagination with offset/limit
- Catalog caching (future enhancement)
- Background job for expired redemptions cleanup

## Future Enhancements

1. **Miles Expiration** - Expire miles after 1 year
2. **Miles Gifting** - Transfer miles between users
3. **Miles Competitions** - Entry fee in miles
4. **Seasonal Promotions** - 2x miles events
5. **Referral System** - Earn when friends trade
6. **Partner Integration** - Sponsor-funded catalog items
7. **Mobile App Integration** - Push notifications for earnings
8. **Analytics Dashboard** - Admin metrics and insights

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    DerivArena Frontend                   │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Marketplace│  │ Miles Dash   │  │ Miles Balance  │  │
│  │   Page     │  │    Page      │  │   Component    │  │
│  └────────────┘  └──────────────┘  └────────────────┘  │
│           │              │                   │           │
│           └──────────────┴───────────────────┘           │
│                          │                                │
│                   miles-store.ts (Zustand)               │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP/JSON
┌─────────────────────────┴───────────────────────────────┐
│              Backend API (Go + Chi Router)               │
│  ┌──────────────────────────────────────────────────┐   │
│  │   derivmiles.Service (17+ endpoints)             │   │
│  │  ├─ balance, stats, transactions                │   │
│  │  ├─ catalog, featured, recommendations          │   │
│  │  ├─ redeem, redemptions                         │   │
│  │  └─ admin: award, catalog CRUD, analytics       │   │
│  └────────┬─────────────────────────────────────────┘   │
│           │                                               │
│  ┌────────┴──────────────────────────────────────────┐  │
│  │   derivmiles Package                              │  │
│  │  ├─ Store (DB operations, atomic transactions)   │  │
│  │  ├─ EarningEngine (miles calculation)            │  │
│  │  ├─ RedemptionProcessor (fulfillment logic)      │  │
│  │  └─ CatalogManager (tier pricing, search)        │  │
│  └────────┬──────────────────────────────────────────┘  │
│           │                                               │
│  ┌────────┴──────────────────────────────────────────┐  │
│  │   Integration Hooks                               │  │
│  │  ├─ competition.Store.RecordTrade                │  │
│  │  └─ competition.Store.EndCompetition             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │ SQL
┌─────────────────────────┴───────────────────────────────┐
│                    PostgreSQL Database                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  deriv_miles_balances (with tier triggers)      │    │
│  │  deriv_miles_transactions (idempotent inserts)  │    │
│  │  deriv_miles_redemptions (fulfillment tracking) │    │
│  │  deriv_miles_catalog (18 seeded items)          │    │
│  │  deriv_miles_earning_rules (7 seeded rules)     │    │
│  └─────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

## Success Metrics

Track these KPIs to measure success:

1. **Engagement**
   - Miles earned per user (average)
   - Redemption rate (% of users who redeem)
   - Time to first redemption

2. **Tier Distribution**
   - % users in each tier
   - Average time to reach each tier

3. **Catalog Performance**
   - Most popular categories
   - Most redeemed items
   - Average redemption value

4. **Business Impact**
   - Conversion impact (do miles increase deposits?)
   - User retention improvement
   - Trading activity increase

## Support

For issues or questions:
- Backend: Check logs in `backend/` with `zap` logger
- Frontend: Check browser console for store errors
- Database: Query `deriv_miles_transactions` for audit trail

## License

MIT - Part of DerivArena project
