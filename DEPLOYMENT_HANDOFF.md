# Deployment handoff — My Home Warranty

## Current repository state
This branch is a work-in-progress. The frontend starter is present. A minimal Express health-check scaffold and configuration examples have been added under backend/. The Telugu translation starter is under translations/te.json.

## Not production-ready
The API scaffold currently exposes only /health and /v1/site-status. It does not yet implement authentication, user-owned records, vehicles, bills, Payments & Money, reminders, insurance, documents, or SUPER_ADMIN controls. No database schema or migrations have been deployed. Do not enter real customer data or expose this API as a production application yet.

## Required next steps
1. Integrate and review the complete application backend and Prisma schema.
2. Create and test versioned PostgreSQL migrations.
3. Implement authentication, role provisioning, owner-scoped CRUD, admin site controls, audit logging, and validation.
4. Complete frontend-to-API integration and all 23 translations.
5. Run dependency installation, TypeScript build, unit/integration tests, and security review.
6. Configure a backend host, database connection, JWT secret, and CORS origin using the host's secret manager. Never commit .env or credentials.
7. Deploy to staging, verify health and critical workflows, then promote to production.
8. Keep the main branch unchanged until the owner reviews and merges a pull request.

## Safety
The GitHub Pages frontend and API deployment are separate. A private/maintenance switch in an API does not unpublish static GitHub Pages content. Disable Pages separately if the entire site must be hidden.
