# My Home Warranty deployment status

## Current verified state (2026-11-10)

- Target branch: `phase19-admin-controls`; `main` remains unchanged.
- Vercel API project: `my-home-warranty-api`.
- Production API deployment: `READY`, built from commit `c8b36c8f21b29ad8b8079ea8757672a65922c6e6`.
- Production alias: `https://my-home-warranty-api.vercel.app`.
- Vercel production build completed successfully; Prisma reported no pending migrations.
- Supabase project `my-home-warranty` is `ACTIVE_HEALTHY`; Prisma schema tables exist.
- Database access hardening has been applied: direct table/sequence grants to `anon` and `authenticated` were revoked, and public execution of `rls_auto_enable()` was revoked. These statements are being captured in a versioned Prisma migration.
- Vercel SSO protection is now limited to preview deployments so the production API domain can serve the public frontend. API routes still enforce the application's JWT authentication and role checks.
- GitHub Actions passed for the previously deployed commit `c8b36c8`. The latest database migration and index changes are undergoing CI validation.

## Not yet verified / not production-ready for personal data

- The GitHub Pages setting is enabled, but the published frontend URL and live browser-to-API flow have not yet been verified end-to-end.
- The current latest database migration commit must pass CI and be deployed to Vercel before it is treated as released.
- Registration, login, owner-scoped CRUD, and admin workflows still need a live integration test.
- Supabase reports RLS enabled but no per-table RLS policies. Public Data API table grants are revoked; the app uses its private backend database connection. Keep this configuration under review.
- Private document upload/download, malware scanning, automatic reminder delivery, full translations, automated integration tests, and a security review remain outstanding.
- Do not enter real customer, personal, or financial data until the frontend/API workflows and security checks pass.

This is an API deployment milestone, not a declaration that the complete application is production-ready.
