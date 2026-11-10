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
- A GitHub Actions workflow validates the Prisma schema, generates the client, compiles the backend, checks frontend JavaScript syntax, and parses the Telugu translation JSON.
- A Vercel serverless entry point and routing configuration are included under `backend/api/` and `backend/vercel.json`.

## Not production-ready
CI previously passed dependency installation, Prisma validation/generation, TypeScript build, frontend JavaScript syntax, and Telugu translation JSON parsing on the earlier code state. An initial versioned PostgreSQL migration matching the current Prisma models has now been added under `backend/prisma/migrations/20261110090000_init/`; its CI run is pending. No database connection, backend host, JWT secret, CORS origin, private storage bucket, or SUPER_ADMIN account has been configured. The Vercel configuration is source-only and has not been deployed or smoke-tested. The frontend's API URL and full user workflows still need integration testing. Do not enter real customer data or expose this API as a production application yet.

## Required next steps
1. Confirm the GitHub Actions Prisma validation and TypeScript build pass; fix all reported errors.
2. Validate the initial migration in CI, then apply and test it against a non-production PostgreSQL database.
3. Complete frontend/API integration, including reliable date handling, record listing, editing/deletion, dashboard counts, reminders, and all 23 translations.
4. Implement private document upload/download, access controls, file validation, and malware scanning.
5. Add automated unit/integration tests and complete a security review (including session handling, rate limits, CORS, and admin bootstrap).
6. Deploy the `backend/` folder as a Vercel project on its free Hobby tier if eligible, and configure `DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), and `CORS_ORIGIN` in Vercel environment variables. Never commit secrets or send them in chat.
7. Configure Supabase PostgreSQL and apply reviewed Prisma migrations before using registration or records. Do not use `prisma db push` against a live database without a verified backup.
8. Deploy to staging, verify critical workflows, backups, and restore procedures, then consider production.
9. Keep `main` unchanged until the owner reviews and explicitly approves a pull request.

## Hosting and visibility
GitHub Pages and the API are separate deployments. The private/maintenance switch blocks API access but cannot unpublish the static GitHub Pages site. Disable Pages separately if the entire site must be hidden.
