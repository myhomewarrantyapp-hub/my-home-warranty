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
- A GitHub Actions workflow has been added to validate the Prisma schema, generate the client, and compile the backend on branch changes.

## Not production-ready
No successful CI run, dependency install, TypeScript build, database migration, integration test, security review, or production deployment has yet been confirmed. No database connection, backend host, JWT secret, CORS origin, private storage bucket, or SUPER_ADMIN account has been configured. The frontend's API URL and full user workflows still need integration testing. Do not enter real customer data or expose this API as a production application yet.

## Required next steps
1. Confirm the GitHub Actions Prisma validation and TypeScript build pass; fix all reported errors.
2. Create and test versioned PostgreSQL migrations against a non-production database.
3. Complete frontend/API integration, including reliable date handling, record listing, editing/deletion, dashboard counts, reminders, and all 23 translations.
4. Implement private document upload/download, access controls, file validation, and malware scanning.
5. Add automated unit/integration tests and complete a security review (including session handling, rate limits, CORS, and admin bootstrap).
6. Configure a backend host, database connection, JWT secret, and CORS origin using the host's secret manager. Never commit secrets or send them in chat.
7. Deploy to staging, verify critical workflows, backups, and restore procedures, then consider production.
8. Keep `main` unchanged until the owner reviews and explicitly approves a pull request.

## Hosting and visibility
GitHub Pages and the API are separate deployments. The private/maintenance switch blocks API access but cannot unpublish the static GitHub Pages site. Disable Pages separately if the entire site must be hidden.
