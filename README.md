# ThingsToDo

A self-hosted, Things 3 / Todoist inspired task manager.

## Features

- **Projects & Areas** — organize tasks into projects (completable) and areas (ongoing)
- **Tags** — flexible labeling with inline `#tag` syntax
- **Checklists** — subtasks within any task
- **File Attachments & Links** — attach files or URLs to tasks
- **Repeating Tasks** — daily, weekly, monthly, and custom schedules
- **Natural Language Dates** — type "tomorrow", "next friday", etc.
- **Keyboard-Driven** — full keyboard navigation and shortcuts
- **Search** — full-text search across tasks and notes
- **Dark Mode** — automatic or manual theme switching
- **PWA** — installable on mobile and desktop
- **Single Binary** — Go backend with embedded SPA frontend, SQLite database

## Quick Start

```yaml
# docker-compose.yml
services:
  app:
    image: ghcr.io/c00llin/thingstodo:latest
    container_name: thingstodo
    volumes:
      - ./data:/data
    ports:
      - "2999:2999"
    environment:
      - AUTH_MODE=builtin
      - JWT_SECRET=change-me-to-a-random-string
      - LOGIN_PASSWORD=your-password-here
    restart: unless-stopped
```

```sh
docker compose up -d
```

Open [http://localhost:2999](http://localhost:2999) and log in with the password you set.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2999` | Server port (must match container port) |
| `LOG_LEVEL` | `info` | Log level |
| `MAX_UPLOAD_SIZE` | `26214400` | Max file upload size in bytes (25 MB) |
| `AUTH_MODE` | `builtin` | Auth mode: `builtin` or `proxy` |

### Builtin Auth

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | — | Secret for signing JWT tokens (required) |
| `LOGIN_PASSWORD` | — | Seeds an "admin" user on first start |

### Proxy Auth

For use behind an authenticating reverse proxy (Authelia, Authentik, etc.).

| Variable | Default | Description |
|---|---|---|
| `AUTH_PROXY_HEADER` | `Remote-User` | Header containing the authenticated username |

## Development

```sh
# Clone and configure
cp .env.example .env   # edit JWT_SECRET and LOGIN_PASSWORD

# Run backend (port 2999) + frontend dev server (port 5173)
make dev
```

The Vite dev server on port 5173 proxies API requests to the Go backend and provides hot reload.

## License

AGPL-3.0
