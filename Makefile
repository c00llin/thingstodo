.PHONY: run build build-frontend test dev typecheck

run:
	go run ./cmd/server

build-frontend:
	cd frontend && npm run build

build: build-frontend
	CGO_ENABLED=0 go build -ldflags="-s -w -X main.Version=$$(jq -r .version frontend/package.json) -X main.Commit=$$(git rev-parse --short HEAD)" -o bin/thingstodo ./cmd/server

test:
	go test ./...

dev:
	@echo "Starting backend and frontend dev servers..."
	@set -a; [ -f .env ] && . ./.env; set +a; \
		trap 'kill 0' EXIT; \
		go run ./cmd/server & \
		cd frontend && npm run dev & \
		wait

typecheck:
	cd frontend && npx tsc -b --noEmit
