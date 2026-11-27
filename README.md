# PortalStays Wellbeing Portal

A Next.js portal for employee wellbeing check-ins and HR team-level reporting. The browser talks to the application's same-origin HTTP API; the API validates requests, applies the domain rules, and stores data in PostgreSQL.

## Requirements

- Node.js 20.9 or later.
- npm.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. On first API use, the server initializes an embedded PostgreSQL cluster under `db/pgdata`, creates the `wellbeing` database and schema, and seeds the HR workspace. Keep this directory on persistent storage if the local data should survive restarts.

The application reads these environment variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PG_PASSWORD` | Password for the embedded PostgreSQL user | Local development password in `src/lib/server/pg.ts` |
| `PG_DATABASE` | Application database name | `wellbeing` |
| `JWT_SECRET` | Secret used to sign access tokens | Local development key in `src/lib/server/config.ts` |

Set a unique, private `JWT_SECRET` and `PG_PASSWORD` in any shared or production environment. Do not commit `.env` files or production secrets.

## Frontend and backend connection

The frontend uses `apiRequest` in `src/lib/portal/api.ts` to call relative paths such as `/api/auth/login`, `/api/employee/check-ins/current`, and `/api/hr/wellbeing`. These requests reach the Next.js route handlers in `src/app/api`; the catch-all handler passes the request to `src/lib/server/router.ts`. The router delegates persistence to the PostgreSQL-backed repositories. Because the API is same-origin, local development and a single-origin deployment do not need a separate browser API URL or CORS configuration.

The API health endpoint is `GET /api/health` (also available as `GET /api`). It returns a JSON status response after the database has initialized.

## Build and run

```sh
npm run build
npm run start
```

The `build` script prepares Next.js standalone output and copies its static assets and `public` directory. Run the server with persistent writable storage for `db/pgdata`. Configure the environment variables above in the deployment platform's secret settings.

## Deploy to GitHub

The source repository is [github.com/Samuelnyae/portalstays](https://github.com/Samuelnyae/portalstays). Push the application to its `main` branch after configuring any required secrets in the hosting platform:

```sh
git add -A
git commit -m "Prepare PortalStays Next.js application"
git push origin main
```

If deploying the application itself, include the reviewed application files in the commit and configure the GitHub deployment workflow or hosting platform separately. The application requires persistent storage for its embedded PostgreSQL data; an ephemeral deployment filesystem will lose that data when replaced.
