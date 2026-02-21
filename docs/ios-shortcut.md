# iOS Shortcut: Add Task to ThingsToDo

Use this guide to create an iOS Shortcut that adds tasks via the API — perfect for the iPhone Action Button.

## Prerequisites

1. Set `API_KEY` in your `.env` file to a random secret string (e.g. `openssl rand -hex 32`)
2. Restart the server so it picks up the new env var
3. Your ThingsToDo instance must be reachable from your phone (e.g. via Tailscale, Cloudflare Tunnel, or local network)

## Shortcut Setup

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Add the following actions in order:

### Action 1: Ask for Input

- **Action:** Ask for Input
- **Type:** Text
- **Prompt:** `Task title`

### Action 2: Get Contents of URL

- **URL:** `https://your-server:2999/api/tasks`
- **Method:** POST
- **Headers:**
  - `Authorization`: `Bearer YOUR_API_KEY`
  - `Content-Type`: `application/json`
- **Request Body (JSON):**
  - `title`: *Provided Input* (select the variable from Action 1)

### Optional: add more fields

You can include any of these fields in the request body:

| Field          | Type          | Example              |
|----------------|---------------|----------------------|
| `notes`        | string        | `"Call back later"`  |
| `when_date`    | string (ISO)  | `"2026-02-21"`       |
| `when_evening` | boolean       | `true`               |
| `high_priority`| boolean       | `true`               |
| `deadline`     | string (ISO)  | `"2026-02-28"`       |
| `project_id`   | string        | `"abc123"`           |
| `tag_ids`      | string array  | `["tagid1"]`         |

### Action 3 (optional): Show Notification

- **Action:** Show Notification
- **Title:** Task added
- **Body:** *Provided Input*

## Assign to Action Button

1. Go to **Settings > Action Button**
2. Select **Shortcut**
3. Choose the shortcut you just created

## Quick-Add Variant (No Prompt)

If you want to skip the text prompt and use dictation or clipboard instead:

**Dictation:** Replace "Ask for Input" with **Dictate Text** to speak your task title.

**Clipboard:** Replace "Ask for Input" with **Get Clipboard** to add whatever you last copied.

## Troubleshooting

- **401 Unauthorized:** Double-check that the `API_KEY` in your `.env` matches the `Bearer` token in the shortcut exactly (no extra spaces)
- **Connection refused:** Make sure your server is reachable from your phone's network. Test with `curl` from another device first
- **Task not appearing:** The task lands in the Inbox by default. Check there if you didn't specify a `project_id` or `when_date`
