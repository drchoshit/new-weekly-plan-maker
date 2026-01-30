# Backend API (Render)

## Overview
This API stores a single shared app state in a JSON file on a Render Disk and provides a login endpoint for a single admin account.

## Setup
1. Create a Render Web Service for `server/index.js`.
2. Attach a Render Disk and set its mount path (example: `/var/data`).
3. Configure the environment variables listed in `server/.env.example`.
4. Set `DATA_PATH` to the file on the mounted disk (example: `/var/data/app_state.json`).

## Password hash
Generate the bcrypt hash locally and store the hash in `AUTH_PASSWORD_HASH`. The API supports
only one admin account using `AUTH_USERNAME` + `AUTH_PASSWORD_HASH`.

Example:
```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('your-password', 10).then(console.log)"
```

## Endpoints
- `POST /api/login` -> `{ token }`
- `GET /api/state` -> `{ state }`
- `PUT /api/state` -> `{ ok: true }`
