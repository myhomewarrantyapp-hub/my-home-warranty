# My Home Warranty — deployment status

Last verified: 2026-11-10

## Live services

- **Frontend:** [https://myhomewarrantyapp-hub.github.io/my-home-warranty/](https://myhomewarrantyapp-hub.github.io/my-home-warranty/)
  - GitHub Pages is configured as a legacy Pages site publishing `main:/`.
  - To publish the updated app without merging backend code, only `main/index.html` was updated from the reviewed frontend on `phase19-admin-controls`. Other `main` files were not changed.
- **API:** [https://my-home-warranty-api.vercel.app/health](https://my-home-warranty-api.vercel.app/health)
  - Vercel project: `my-home-warranty-api`.
  - Production deployment: `READY`, deployment `dpl_6gj1STfkVWxJVfywXw5ARj8v56us`, built from commit `45ad7ec8dd66b11d47ea754d8eb1429ed11dc8df`.
  - Production alias: `my-home-warranty-api.vercel.app`.
  - Vercel SSO protection is limited to Preview deployments; Production API remains publicly reachable, with application routes protected by JWT authentication and role checks.
- **Database:** Supabase project `my-home-warranty` is `ACTIVE_HEALTHY`, region `ap-south-1`.

## Verified checks

GitHub Actions run [42782924294](https://github.com/myhomewarrantyapp-hub/my-home-warranty/actions/runs/42782924294) completed successfully. It verified:
- Temporary PostgreSQL 16 migration deployment and migration status.
- Prisma validation and client generation.
- TypeScript backend build.
- JavaScript syntax for both root and `frontend/index.html`.
- Telugu translation JSON parses.
- Live GitHub Pages URL serves the app HTML and production API base URL.
- Production API `/health` and `/v1/site-status` return expected responses.
- GitHub Pages CORS preflight is allowed.
- Unauthenticated access to `/v1/vehicles` is rejected with HTTP 401.

Production Prisma build reports no pending migrations. Supabase migration history contains:
- `20261110090000_init`
- `20261110100000_harden_public_access_and_index_vehicle_event`

Database hardening was verified: no direct table/sequence grants remain for `anon` or `authenticated`; `anon` cannot execute `public.rls_auto_enable()`; the VehicleEvent lookup index exists.

## Remaining before real personal/financial use

- Perform real browser-based registration/login and owner-scoped create/list tests with a disposable test account in a staging environment. CI has tested auth rejection, not a full signed-in workflow.
- Review and configure the first SUPER_ADMIN account through the secure promotion procedure. No public admin bootstrap endpoint should be added.
- Complete session hardening (secure HttpOnly cookies and MFA review); current static frontend keeps its short-lived bearer token in browser `sessionStorage`.
- Implement private document upload/download, file validation and malware scanning.
- Implement scheduled/pushed reminder delivery; current reminders are in-app records only.
- Complete all Telugu/Hindi translations; the language selector currently changes the document language but does not translate the full UI.
- Add record editing/deletion and automated end-to-end tests.
- Review Supabase RLS configuration. RLS is enabled on public tables, with no policies currently defined; public API table grants are revoked and the Express backend uses its private database connection. Keep direct Supabase Data API access disabled for these tables until a reviewed RLS policy model exists.

**Do not enter real customer, personal, insurance, vehicle registration, or financial data until the remaining authentication and security checks are complete.** This is a live frontend/API deployment milestone, not certification that every app workflow is production-ready.
