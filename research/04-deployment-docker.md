# Deployment & Docker Research

## Docker Compose Pattern

For a modular monolith with SQLite, the compose setup is minimal:

```yaml
services:
  app:
    image: thingstodo:latest        # ~15 MB (Go) or ~150 MB (Node)
    build:
      context: .
      dockerfile: Dockerfile
    volumes:
      - ./data:/data                # thingstodo.db lives here
      - ./attachments:/attachments  # uploaded file attachments
    ports:
      - "2999:2999"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:2999/health"]
      interval: 30s
      timeout: 5s
      retries: 3

```

**Total footprint:** ~15 MB disk, ~25 MB RAM (Go) or ~100 MB RAM (Node).

---

## Reverse Proxy

**Not included in the Docker setup.** The reverse proxy is the user's responsibility. Most self-hosters already run a centralized reverse proxy (Traefik, Caddy, nginx-proxy-manager, etc.) and prefer to manage TLS, routing, and auth layers themselves.

The app exposes port 2999 and expects to be proxied by whatever the user already has. Example proxy configs for documentation purposes:

```
# Caddy
things.yourdomain.com {
    reverse_proxy thingstodo:2999
}

# Nginx
location / {
    proxy_pass http://thingstodo:2999;
}

# Traefik (Docker labels)
labels:
  - "traefik.http.routers.thingstodo.rule=Host(`things.yourdomain.com`)"
  - "traefik.http.services.thingstodo.loadbalancer.server.port=2999"
```

**Note for SSE:** Ensure the proxy does not buffer SSE responses. Most proxies handle this correctly, but nginx may need `proxy_buffering off;` for the `/api/events` endpoint.

---

## Dockerfile Patterns

### Go (Multi-stage, minimal image)

```dockerfile
# Build stage
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app ./cmd/server

# Runtime stage
FROM scratch
COPY --from=build /app /app
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 2999
ENTRYPOINT ["/app"]
```

Result: **~10-15 MB image**. No shell, no OS, minimal attack surface.

### Node/TypeScript (Multi-stage)

```dockerfile
# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 2999
CMD ["node", "dist/server.js"]
```

Result: **~120-180 MB image** (Node runtime + node_modules).

### Frontend (Static build served by backend)

For the SPA frontend, embed the built static files into the backend binary (Go: `embed.FS`) or serve from a `dist/` directory. No separate Nginx container needed for the frontend.

---

## Data Persistence & Backup

### Volume Strategy

```yaml
volumes:
  - ./data:/data                # thingstodo.db + WAL/SHM files
  - ./attachments:/attachments  # uploaded file attachments
```

Two separate bind mounts:
- `./data` — contains `thingstodo.db` and its WAL/SHM files
- `./attachments` — uploaded file attachments, organized by task ID

Separate volumes allow independent backup strategies and storage locations (e.g., DB on fast SSD, attachments on larger/cheaper storage).

### Backup Approaches

| Method | Complexity | Recovery | Covers |
|---|---|---|---|
| **Directory copy/tar** (when app stopped) | Simplest | Copy back | DB + attachments |
| **SQLite `.backup` + rsync** (while running) | Low | Consistent DB snapshot + file sync | DB + attachments |
| **Litestream + rsync** (continuous) | Medium | Stream DB to S3 + sync attachments | DB + attachments |
| **Cron + tar** | Low | Scheduled snapshots | DB + attachments |

**Recommendation:** For single-user, a cron backup script that covers both DB and attachments:
```bash
# backup.sh - add to host crontab
sqlite3 /path/to/data/thingstodo.db ".backup '/path/to/backups/thingstodo-$(date +%Y%m%d).db'"
rsync -a /path/to/attachments/ /path/to/backups/attachments/
```

For more robust needs, **Litestream** provides continuous DB replication. Attachments need separate file-level backup (rsync, tar, or S3 sync).

---

## Configuration Management

### Environment Variables (via .env)

```env
# .env (git-ignored)
ATTACHMENTS_PATH=/attachments
MAX_UPLOAD_SIZE=25MB
PORT=2999
LOG_LEVEL=info

# Auth mode: "builtin" (default, JWT login) or "proxy" (trust reverse proxy, no login)
AUTH_MODE=builtin
# When AUTH_MODE=proxy, optionally read user identity from this header
AUTH_PROXY_HEADER=Remote-User
```

Docker Compose loads `.env` automatically. For production:

```yaml
services:
  app:
    env_file: .env
```

### Secrets Handling

For single-user self-hosted, environment variables are sufficient. No need for Docker Secrets, Vault, or SOPS. The `.env` file should be:
- Git-ignored
- Readable only by the user running Docker
- Documented via a `.env.example` template

---

## Health Checks & Restart Policies

```yaml
services:
  app:
    restart: unless-stopped    # Restart on crash, not on manual stop
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:2999/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

The `/health` endpoint should verify:
- Application is running
- SQLite database is accessible (simple query like `SELECT 1`)

---

## Multi-Architecture Builds

For ARM support (Raspberry Pi, Apple Silicon, ARM servers):

```bash
# Build and push multi-arch image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t thingstodo:latest \
  --push .
```

**Go note:** Cross-compilation is trivial with `GOOS` and `GOARCH`. No CGO means true static binaries for any platform.

**Node note:** Works on ARM64 natively. `better-sqlite3` needs native compilation per architecture — handled by `npm rebuild` in the Dockerfile.

---

## Inspiration from Existing Self-Hosted Apps

### Vikunja (Go-based task manager)
- Single binary + SQLite (or Postgres/MySQL optional)
- Simple docker-compose with one container
- Config via env vars or YAML file
- ~30 MB Docker image

### Trilium Notes (Node.js)
- Single container with embedded SQLite
- Data volume for persistence
- ~200 MB image
- Config via env vars

### Planka (React + Node + Postgres)
- Two containers (app + postgres)
- Heavier footprint (~400 MB)
- Shows why Postgres adds unnecessary complexity for single-user

**Key takeaway:** The most beloved self-hosted apps (Trilium, Vikunja, Miniflux) all follow the same pattern: **single binary + embedded SQLite + single Docker container + env config**. Simplicity wins for self-hosting.

---

## Deployment Summary

### Deployment
```
1 container: app (Go binary + SQLite)
~15 MB RAM, ~15 MB disk
Access: http://localhost:2999 (direct) or via user's reverse proxy
```

### Quick Start for End Users
```bash
git clone https://github.com/you/thingstodo.git
cd thingstodo
cp .env.example .env
# Edit .env with your API key
docker compose up -d
# Open http://localhost:2999
```
