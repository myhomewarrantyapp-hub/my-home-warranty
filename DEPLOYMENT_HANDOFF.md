# Deployment handoff — My Home Warranty

## Current repository state
This is an active work-in-progress on `phase19-admin-controls`. The `main` branch has not been changed. The branch contains a mobile-first frontend starter, an Express API starter, a Prisma data model, authentication routes, role-protected site controls, owner-scoped record routes, document metadata listing, audit logging, and a Telugu translation starter.

## Implemented in source (not yet production-verified)
- Registration and login using bcrypt password hashes and short-lived JWTs.
- Roles including USER, SUPPORT, ADMIN, and SUPER_ADMIN; a controlled script promotes an already-registered account.
- Site visibility and maintenance controls restricted to SUPER_ADMIN.
- Owner-scoped create/list routes for assets, vehicles, bills, money entries, insurance policies, payment requests, and support tickets.
- Document metadata listing; actual private file upload/download and malware scanning are not implemented.
- Basic frontend screens for the main modules.
- Payments & Money contains Home Bills, Credit Card Bills, Money Given, Money Received, Payment Requests, and All Transactions; bill and money tabs filter their own record types.
- Reminder UI supports creating, listing, completing, and cancelling owner-scoped reminders. Reminder delivery is not yet scheduled/pushed automatically; this is an in-app record workflow only.
- Vehicle maintenance history API and UI support service/repair/insurance/PUC/tyre/other events, dates, odometer, cost, notes, and next-due details, with vehicle ownership checks.
- A GitHub Actions workflow starts a temporary PostgreSQL 16 service, applies and checks the versioned Prisma migration, validates/generates the Prisma client, compiles the backend, checks frontend JavaScript syntax, and parses the Telugu translation JSON.
- A Vercel serverless entry point and routing configuration are included under `backend/api/` and `backend/vercel.json`.

## Not production-ready
CI has passed on the latest frontend, vehicle-history, and reminder changes, including PostgreSQL 16 migration deployment/status checks, Prisma validation/generation, TypeScript build, frontend JavaScript syntax, and Telugu translation JSON parsing. No database connection, backend host, JWT secret, CORS origin, private storage bucket, or SUPER_ADMIN account has been configured. The Vercel configuration is source-only and has not been deployed or smoke-tested. The frontend's API URL and full user workflows still need integration testing. Do not enter real customer data or expose this API as a production application yet.

## Required next steps
1. Complete frontend/API integration, including reliable date handling, record editing/deletion, dashboard counts, and all 23 translations.
2. Implement private document upload/download, access controls, file validation, and malware scanning.
3. Add automated unit/integration tests and complete a security review (including session handling, rate limits, CORS, and admin bootstrap).
4. Deploy the `backend/` folder as a Vercel project on its free Hobby tier if eligible, and configure `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (at least 32 random characters), and `CORS_ORIGIN` in Vercel environment variables. Never commit secrets or send them in chat.
5. Configure Supabase PostgreSQL and apply reviewed Prisma migrations before using registration or records. Do not use `prisma db push` against a live database without a verified backup.
6. Deploy to staging, verify critical workflows, backups, and restore procedures, then consider production.
7. Keep `main` unchanged until the owner reviews and explicitly approves a pull request.

## Supabase PostgreSQL setup (owner action required)

The initial Prisma migration is committed at `backend/prisma/migrations/20261110090000_init/migration.sql`. CI now starts a temporary PostgreSQL 16 service and runs `prisma migrate deploy` plus `prisma migrate status` against it before building. This validates the migration in CI but does not touch the owner's Supabase project.

To connect the real Supabase database safely:
1. Open the Supabase project dashboard and select **Project Settings → Database → Connection string**. Use the URI connection string and require SSL. Prefer the Supabase pooler/session-compatible URI if deploying on serverless; follow the dashboard's current recommendation.
2. In the Vercel project settings for the backend, set `DATABASE_URL` to the Supabase Transaction Pooler URI (port 6543, with the pooler options recommended by Supabase), and `DIRECT_URL` to the Session Pooler URI (port 5432) for Prisma migrations. Set `JWT_SECRET` to a newly generated random value of at least 32 characters and `CORS_ORIGIN` to the exact deployed frontend origin. Never put these values in GitHub source, commits, screenshots, or chat.
3. Set the Vercel project root to `backend`. Set the Build Command to `npm run vercel-build` (this runs Prisma Client generation, versioned migrations, and the TypeScript build). Keep the Production Branch set to `phase19-admin-controls`; do not deploy `main`. Deploy first to a private/staging environment and verify the build logs show the migration applied.
4. If Vercel build logs report a database connectivity issue, stop and correct the connection string/network mode in the dashboard; do not paste the password into chat.
5. After the first successful migration, create a normal account through the app, then use the documented admin-promotion procedure from a secure trusted environment to grant SUPER_ADMIN. Do not expose a public admin bootstrap endpoint.

The assistant cannot access the owner's Supabase dashboard or secrets through this repository connection, so it cannot apply the migration to the live project or deploy Vercel on the owner's behalf. Do not enter real personal or financial data until staging workflows and security checks pass.

## Hosting and visibility
GitHub Pages and the API are separate deployments. The private/maintenance switch blocks API access but cannot unpublish the static GitHub Pages site. Disable Pages separately if the entire site must be hidden.
