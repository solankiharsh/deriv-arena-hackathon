.PHONY: help dev backend frontend db-up db-down db-migrate db-seed-trading-copilot db-rollback clean test stop status

# Directory containing this Makefile (so `make -C … dev` still works)
MAKEFILE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Local PostgreSQL via Homebrew (no Podman/Docker required)
PSQL ?= /opt/homebrew/opt/postgresql@16/bin/psql
PG_ISREADY ?= /opt/homebrew/opt/postgresql@16/bin/pg_isready
DB_HOST ?= localhost
DB_PORT ?= 5432
DB_USER ?= derivarena
DB_NAME ?= derivarena

help:
	@echo "DerivArena Development Commands"
	@echo ""
	@echo "  make dev          - Start full stack (backend + frontend + db)"
	@echo "  make stop         - Stop all running services"
	@echo "  make status       - Check what's running"
	@echo "  make backend      - Start backend only"
	@echo "  make frontend     - Start frontend only"
	@echo ""
	@echo "  make db-up        - Start PostgreSQL (port $(DB_PORT))"
	@echo "  make db-down      - Stop PostgreSQL"
	@echo "  make db-migrate              - Run base DB migrations (010)"
	@echo "  make db-seed-trading-copilot - Idempotent miles marketplace + Copilot seed (run if redeem fails)"
	@echo "  make db-rollback  - Rollback migrations"
	@echo ""
	@echo "  make test         - Run tests"
	@echo "  make clean        - Clean build artifacts"

dev:
	@echo "🎯 DerivArena — starting PostgreSQL, API, and frontend…"
	@$(MAKE) -C "$(MAKEFILE_DIR)" db-up
	@sleep 1
	@$(MAKE) -C "$(MAKEFILE_DIR)" db-migrate
	@SKIP_DB=1 bash "$(MAKEFILE_DIR)scripts/dev.sh"

backend:
	@cd "$(MAKEFILE_DIR)backend" && \
		DATABASE_URL=$${DATABASE_URL:-postgresql://$(DB_USER):$(DB_USER)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)} \
		PORT=$${PORT:-8090} \
		SHARE_BASE_URL=$${SHARE_BASE_URL:-http://localhost:3000} \
		go run cmd/server/main.go

frontend:
	@cd "$(MAKEFILE_DIR)frontend" && NEXT_PUBLIC_API_URL=http://localhost:8090 npm run dev -- -p 3000

db-up:
	@$(PG_ISREADY) -h $(DB_HOST) -p $(DB_PORT) > /dev/null 2>&1 && \
		echo "✅ PostgreSQL already running on port $(DB_PORT)" || \
		(echo "Starting PostgreSQL via brew services..." && brew services start postgresql@16 && sleep 2)
	@$(PG_ISREADY) -h $(DB_HOST) -p $(DB_PORT) > /dev/null 2>&1 || (echo "❌ PostgreSQL failed to start"; exit 1)
	@$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$(DB_USER)'" 2>/dev/null | grep -q 1 || \
		$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -d postgres -c "CREATE USER $(DB_USER) WITH PASSWORD '$(DB_USER)';"
	@$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$(DB_NAME)'" 2>/dev/null | grep -q 1 || \
		(/opt/homebrew/opt/postgresql@16/bin/createdb -h $(DB_HOST) -p $(DB_PORT) -O $(DB_USER) $(DB_NAME) && \
		$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $(DB_NAME) TO $(DB_USER);" && \
		$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -d $(DB_NAME) -c "GRANT ALL ON SCHEMA public TO $(DB_USER);")
	@echo "✅ PostgreSQL running on port $(DB_PORT)"

db-down:
	@brew services stop postgresql@16 || true
	@echo "✅ PostgreSQL stopped"

db-migrate:
	@$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -c "\dt" 2>/dev/null | grep -q competitions && \
		echo "✅ Database already migrated" || \
		($(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) < backend/migrations/010_competitions.up.sql && \
		echo "✅ Migrations complete")
	@$(MAKE) db-seed-trading-copilot

db-seed-trading-copilot:
	@echo "📎 Applying Trading Copilot / marketplace miles catalog seed (idempotent)…"
	@$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) -v ON_ERROR_STOP=1 \
		-f "$(MAKEFILE_DIR)scripts/seed-trading-copilot-catalog.sql" && \
		echo "✅ Miles catalog seed OK"

db-rollback:
	@$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_USER) -d $(DB_NAME) < backend/migrations/010_competitions.down.sql
	@echo "✅ Migrations rolled back"

stop:
	@echo "Stopping DerivArena..."
	@lsof -ti:8090 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@rm -rf frontend/.next/dev/lock 2>/dev/null || true
	@echo "✅ All services stopped"

status:
	@echo "DerivArena Status:"
	@echo ""
	@curl -s http://localhost:8090/health > /dev/null 2>&1 && echo "  ✅ Backend:  http://localhost:8090" || echo "  ❌ Backend:  not running"
	@curl -s http://localhost:3000 > /dev/null 2>&1 && echo "  ✅ Frontend: http://localhost:3000" || echo "  ❌ Frontend: not running"
	@$(PG_ISREADY) -h $(DB_HOST) -p $(DB_PORT) > /dev/null 2>&1 && echo "  ✅ Database: $(DB_HOST):$(DB_PORT)" || echo "  ❌ Database: not running"

clean:
	@rm -rf backend/tmp/
	@rm -rf frontend/.next/
	@rm -rf frontend/out/
	@echo "✅ Cleaned build artifacts"

test:
	@cd backend && go test ./... -v
	@cd frontend && npm test
