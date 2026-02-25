.PHONY: run build test dev typecheck

run:
	go run ./cmd/server

build:
	go build -ldflags="-s -w -X main.Version=$$(jq -r .version frontend/package.json) -X main.Commit=$$(git rev-parse --short HEAD)" -o bin/thingstodo ./cmd/server

test:
	go test ./...

dev:
	@echo "Starting backend and frontend dev servers..."
	@trap 'kill 0' EXIT; \
		go run ./cmd/server & \
		cd frontend && npm run dev & \
		wait

typecheck:
	cd frontend && npx tsc -b --noEmit
