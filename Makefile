.PHONY: run build test dev typecheck

run:
	go run ./cmd/server

build:
	go build -ldflags="-s -w" -o bin/thingstodo ./cmd/server

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
