# ThingsToDo

A self-hosted, Things 3 / Todoist inspired task manager.

![ThingsToDo screenshot](docs/screenshots/screenshot-light.png)

## Features

- **Projects & Areas** — organize tasks into projects (completable) and areas (ongoing)
- **Tags** — flexible labeling with inline `#tag` syntax and customizable colors
- **Review Tasks** — tasks not edited for a configurable number of days surface in a Review section in Inbox, so nothing falls through the cracks
- **Checklists** — subtasks within any task
- **File Attachments & Links** — attach files or URLs to tasks
- **Multi-Date Scheduling** — schedule tasks across multiple dates with optional start/end times (up to 12 entries per task)
- **Repeating Tasks** — daily, weekly, monthly, and custom schedules
- **Natural Language Dates** — type "tomorrow", "next friday", etc.
- **Keyboard-Driven** — full keyboard navigation and shortcuts
- **Filters** — filter any view by area, project, tag, priority, date, and deadline with saved filter presets
- **Search** — full-text search across tasks and notes
- **Dark Mode** — automatic or manual theme switching
- **Reminders** — per-task reminders with relative (e.g. 15 min before) and exact time options, plus configurable defaults
- **Push Notifications** — reminders via Browser Push (VAPID) or [ntfy](https://ntfy.sh), configurable in Settings
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
| `AUTH_MODE` | `builtin` | Auth mode: `builtin`, `proxy`, or `oidc` |
| `TZ` | `UTC` | Timezone for reminder scheduling (e.g. `Europe/Amsterdam`) |

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

### OIDC Auth

Log in via any OpenID Connect provider (Google, Keycloak, Authelia, etc.). On first login the existing user is automatically linked to your OIDC identity. Only a single user is allowed — other OIDC accounts are rejected.

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | — | Secret for signing JWT tokens (required) |
| `OIDC_ISSUER` | — | OIDC provider URL (e.g. `https://auth.example.com`) |
| `OIDC_CLIENT_ID` | — | OAuth2 client ID |
| `OIDC_CLIENT_SECRET` | — | OAuth2 client secret |
| `OIDC_REDIRECT_URI` | — | Callback URL: `https://your-domain/api/auth/oidc/callback` |

### API Key

Enable external access (e.g. iOS Shortcuts) with a static API key alongside any auth mode.

| Variable | Default | Description |
|---|---|---|
| `API_KEY` | — | Static bearer token for `Authorization: Bearer <key>` |

### Notifications

Push notifications for task reminders can be delivered via **Browser Push** (default) or **[ntfy](https://ntfy.sh)**. Configure the provider in **Settings > Notifications > Delivery**.

> **Important:** Set the `TZ` environment variable (e.g. `TZ=America/Chicago`) so reminders fire at the correct local time. The Docker scratch image defaults to UTC.

#### Browser Push (VAPID)

VAPID keys are auto-generated on first start and stored in the database. You can also set them explicitly:

| Variable | Default | Description |
|---|---|---|
| `VAPID_PRIVATE_KEY` | auto-generated | VAPID private key |
| `VAPID_PUBLIC_KEY` | auto-generated | VAPID public key |
| `VAPID_CONTACT` | — | Contact email for VAPID (e.g. `mailto:you@example.com`) |

#### ntfy

No env vars required — ntfy is configured entirely from the Settings UI:

- **Server URL** — defaults to `https://ntfy.sh` (or your self-hosted instance)
- **Topic** — defaults to `thingstodo`; subscribe to this topic in the ntfy app on your phone/desktop
- **Access Token** — only needed if your ntfy server requires authentication
- **Base URL** — your app's public URL (e.g. `https://tasks.example.com`) for click-through links in notifications

Use the **Send Test** button to verify your setup.

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
