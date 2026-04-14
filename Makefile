.PHONY: help dev backend frontend db-up db-down db-migrate db-rollback clean test stop status

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

dev:
	@./scripts/dev.sh

backend:
	@export $$(cat .env | grep -v '^#' | xargs) && cd backend && go run cmd/server/main.go

frontend:
	@cd frontend && export NEXT_PUBLIC_API_URL=http://localhost:8090 && npm run dev -- -p 3000

db-up:
	@docker ps -a | grep derivarena-postgres > /dev/null 2>&1 && \
		(docker start derivarena-postgres || true) || \
		docker run -d --name derivarena-postgres \
			-e POSTGRES_USER=derivarena \
			-e POSTGRES_PASSWORD=derivarena \
			-e POSTGRES_DB=derivarena \
			-p 5436:5432 \
			postgres:16-alpine
	@echo "✅ PostgreSQL running on port 5436"

db-down:
	@docker stop derivarena-postgres || true
	@echo "✅ PostgreSQL stopped"

db-migrate:
	@docker exec derivarena-postgres psql -U derivarena -d derivarena -c "\dt" > /dev/null 2>&1 && \
		echo "✅ Database already migrated" || \
		(docker exec -i derivarena-postgres psql -U derivarena -d derivarena < backend/migrations/010_competitions.up.sql && \
		echo "✅ Migrations complete")

db-rollback:
	@docker exec -i derivarena-postgres psql -U derivarena -d derivarena < backend/migrations/010_competitions.down.sql
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
	@docker ps | grep derivarena-postgres > /dev/null 2>&1 && echo "  ✅ Database: localhost:5436" || echo "  ❌ Database: not running"

clean:
	@rm -rf backend/tmp/
	@rm -rf frontend/.next/
	@rm -rf frontend/out/
	@echo "✅ Cleaned build artifacts"

test:
	@cd backend && go test ./... -v
	@cd frontend && npm test
