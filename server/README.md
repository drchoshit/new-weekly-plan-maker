# Backend API (Render)

## Overview
This API stores a single shared app state in PostgreSQL and provides a login endpoint for a single admin account.

## Setup
1. Create a Render PostgreSQL instance.
2. Run `server/schema.sql` to initialize the `app_state` table.
3. Configure the environment variables listed in `server/.env.example`.

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
