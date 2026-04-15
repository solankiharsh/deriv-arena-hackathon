.PHONY: help dev backend frontend db-up db-down db-migrate db-rollback clean test stop status

# Directory containing this Makefile (so `make -C … dev` still works)
MAKEFILE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Podman-compatible CLI (use `docker` if you use Docker Desktop: `make dev CONTAINER_RUNTIME=docker`)
CONTAINER_RUNTIME ?= podman
export CONTAINER_RUNTIME

help:
	@echo "DerivArena Development Commands"
	@echo ""
	@echo "  make dev          - Start full stack (backend + frontend + db)"
	@echo "  make stop         - Stop all running services"
	@echo "  make status       - Check what's running"
	@echo "  make backend      - Start backend only"
	@echo "  make frontend     - Start frontend only"
	@echo ""
	@echo "  make db-up        - Start PostgreSQL (port 5436)"
	@echo "  make db-down      - Stop PostgreSQL"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-rollback  - Rollback migrations"
	@echo ""
	@echo "  make test         - Run tests"
	@echo "  make clean        - Clean build artifacts"
	@echo ""
	@echo "  CONTAINER_RUNTIME=podman (default) — Postgres via Podman; set to docker if needed."

# PostgreSQL (5436) → migrations → Go API (8090) → Next.js (3000). Needs Podman or Docker for Postgres.
dev:
	@echo "🎯 DerivArena — starting PostgreSQL, API, and frontend…"
	@$(MAKE) -C "$(MAKEFILE_DIR)" db-up
	@sleep 2
	@$(MAKE) -C "$(MAKEFILE_DIR)" db-migrate
	@SKIP_DB=1 bash "$(MAKEFILE_DIR)scripts/dev.sh"

backend:
	@cd "$(MAKEFILE_DIR)backend" && \
		DATABASE_URL=$${DATABASE_URL:-postgresql://derivarena:derivarena@localhost:5436/derivarena} \
		PORT=$${PORT:-8090} \
		SHARE_BASE_URL=$${SHARE_BASE_URL:-http://localhost:3000} \
		go run cmd/server/main.go

frontend:
	@cd "$(MAKEFILE_DIR)frontend" && NEXT_PUBLIC_API_URL=http://localhost:8090 npm run dev -- -p 3000

db-up:
	@$(CONTAINER_RUNTIME) ps -a | grep derivarena-postgres > /dev/null 2>&1 && \
		($(CONTAINER_RUNTIME) start derivarena-postgres || true) || \
		$(CONTAINER_RUNTIME) run -d --name derivarena-postgres \
			-e POSTGRES_USER=derivarena \
			-e POSTGRES_PASSWORD=derivarena \
			-e POSTGRES_DB=derivarena \
			-p 5436:5432 \
			postgres:16-alpine
	@echo "✅ PostgreSQL running on port 5436"

db-down:
	@$(CONTAINER_RUNTIME) stop derivarena-postgres || true
	@echo "✅ PostgreSQL stopped"

db-migrate:
	@$(CONTAINER_RUNTIME) exec derivarena-postgres psql -U derivarena -d derivarena -c "\dt" > /dev/null 2>&1 && \
		echo "✅ Database already migrated" || \
		($(CONTAINER_RUNTIME) exec -i derivarena-postgres psql -U derivarena -d derivarena < backend/migrations/010_competitions.up.sql && \
		echo "✅ Migrations complete")

db-rollback:
	@$(CONTAINER_RUNTIME) exec -i derivarena-postgres psql -U derivarena -d derivarena < backend/migrations/010_competitions.down.sql
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
	@$(CONTAINER_RUNTIME) ps | grep derivarena-postgres > /dev/null 2>&1 && echo "  ✅ Database: localhost:5436" || echo "  ❌ Database: not running"

clean:
	@rm -rf backend/tmp/
	@rm -rf frontend/.next/
	@rm -rf frontend/out/
	@echo "✅ Cleaned build artifacts"

test:
	@cd backend && go test ./... -v
	@cd frontend && npm test
