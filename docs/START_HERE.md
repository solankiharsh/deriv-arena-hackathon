# 🚀 Start DerivArena

## Quick Start (One Command)

```bash
./scripts/dev.sh
```

That's it! This will:
1. Start PostgreSQL (if not running)
2. Run database migrations
3. Start backend on http://localhost:8090
4. Start frontend on http://localhost:3000

## Alternative: Use Makefile

```bash
make dev
```

## Check It's Working

Open these URLs:
- **Frontend:** http://localhost:3000
- **Backend Health:** http://localhost:8090/health
- **API:** http://localhost:8090/api/competitions

## Test the API

```bash
# Create a competition
curl -X POST http://localhost:8090/api/competitions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Competition",
    "duration_hours": 24,
    "contract_types": ["CALL", "PUT"],
    "starting_balance": "1000"
  }'

# List competitions
curl http://localhost:8090/api/competitions
```

## Troubleshooting

### Port Already in Use

```bash
# Kill processes on ports 8090 and 3000
lsof -ti:8090 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Remove lock file
rm -rf frontend/.next/dev/lock

# Try again
./scripts/dev.sh
```

### PostgreSQL Not Running

```bash
make db-up
sleep 2
make db-migrate
```

### Backend Won't Start

Check logs:
```bash
tail -f /tmp/derivarena-backend.log
```

### Frontend Won't Start

Check logs:
```bash
tail -f /tmp/derivarena-frontend.log
```

## Stop Everything

Press `Ctrl+C` in the terminal where `dev.sh` is running.

Or kill processes manually:
```bash
lsof -ti:8090 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
docker stop derivarena-postgres  # Database (optional)
```

## Need More Help?

See detailed documentation:
- `README.md` - Full project documentation
- `GETTING_STARTED.md` - Detailed setup guide
- `docs/DERIV_V2_API_IMPLEMENTATION.md` - **Deriv API V2:** reference script, OTP flow, what to build (for integrators / agents)
- `STATUS.md` - Current progress
- `WORKING.md` - Success summary
