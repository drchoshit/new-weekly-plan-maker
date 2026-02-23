# Backend API (Render)

## Overview
This API stores one shared app state in a JSON file on a Render Disk and provides a login endpoint for a single admin account.

State writes are versioned to prevent silent overwrite when two computers save at the same time.
If a conflict happens, the API returns `409 STATE_CONFLICT` with the latest server state/version.

## Setup
1. Create a Render Web Service for `server/index.js`.
2. Attach a Render Disk and set its mount path (example: `/var/data`).
3. Configure the environment variables listed in `server/.env.example`.
4. Set `DATA_PATH` to the file on the mounted disk (example: `/var/data/app_state.json`).
5. Configure backup variables (`BACKUP_*`) for daily automatic backups.

## Daily backup (KST)
- Backup schedule runs inside the web service process.
- Default schedule: every day at `03:00` KST.
- Default retention: 30 days.
- Backups are written to `BACKUP_DIR` (default: sibling folder `backups` next to `DATA_PATH`).

## Password hash
Generate the bcrypt hash locally and store the hash in `AUTH_PASSWORD_HASH`. The API supports
only one admin account using `AUTH_USERNAME` + `AUTH_PASSWORD_HASH`.

Example:
```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('your-password', 10).then(console.log)"
```

## Endpoints
- `POST /api/login` -> `{ token }`
- `GET /api/state` -> `{ state, version, updatedAt }`
- `PUT /api/state` -> `{ ok, version, updatedAt }` (`baseVersion` optional, returns `409` on conflict)
- `PUT /api/state/weekly-calendars` -> `{ ok, version, updatedAt }` (`baseVersion` optional, returns `409` on conflict)
- `POST /api/backups/run` -> manual backup trigger for admins
