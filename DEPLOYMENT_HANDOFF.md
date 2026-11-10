# My Home Warranty — project handoff

Last verified: 2026-11-10

## Repository and deployment layout

- GitHub repository: `myhomewarrantyapp-hub/my-home-warranty`.
- Development/integration branch: `phase19-admin-controls`.
- GitHub Pages publishes from `main:/` (legacy source). To make the new frontend live while keeping backend work off `main`, only `main/index.html` was updated with the reviewed root frontend from `phase19-admin-controls`. The backend source and database migrations were not merged into `main`.
- GitHub Pages URL: https://myhomewarrantyapp-hub.github.io/my-home-warranty/
- Vercel API project: `my-home-warranty-api`.
- Production API URL: https://my-home-warranty-api.vercel.app
- Production API deployment: `dpl_6gj1STfkVWxJVfywXw5ARj8v56us`, READY, built from commit `45ad7ec8dd66b11d47ea754d8eb1429ed11dc8df`.
- Supabase PostgreSQL project: `my-home-warranty`, ACTIVE_HEALTHY, region `ap-south-1`.

## Implemented in source

- Express API with registration/login, bcrypt password hashes, short-lived JWTs, role checks and audit logging.
- Roles: USER, SUPPORT, ADMIN and SUPER_ADMIN. Existing accounts can be promoted through the controlled admin-promotion script; there is no public admin bootstrap route.
- Owner-scoped asset, vehicle, bill, money entry, insurance, payment request and support-ticket create/list endpoints.
- Vehicle service/maintenance history, including service/repair/insurance/PUC/tyre/other events, dates, odometer, cost and next-due information.
- Payments & Money grouped into one module with Home Bills, Credit Card Bills, Money Given, Money Received, Payment Requests and All Transactions.
- Reminder create/list/complete/cancel workflow. Automatic scheduled notifications and WhatsApp delivery are not implemented.
- Admin site visibility/maintenance controls restricted to SUPER_ADMIN.
- Document metadata listing. Private file upload/download, access controls and malware scanning are not implemented.
- Frontend with dashboard, assets, vehicles, Payments & Money, insurance, reminders, documents, support, settings and admin screens.
- Navigation now reloads the corresponding module data; sign-out clears the tab token and displayed records.
- GitHub Actions CI verifies PostgreSQL 16 migrations, Prisma validation/generation, TypeScript build, both frontend scripts, Telugu JSON parsing, GitHub Pages publication and production API/CORS/auth-gate smoke tests.

## Latest successful verification

GitHub Actions run [42782924294](https://github.com/myhomewarrantyapp-hub/my-home-warranty/actions/runs/42782924294) passed.

It confirmed:
- GitHub Pages serves the current app HTML at the URL above.
- Production API health and site-status endpoints respond correctly.
- GitHub Pages origin CORS preflight is allowed.
- A request to the protected vehicle endpoint without a token receives HTTP 401.
- The code and database migration build checks pass.

The production Prisma build reports no pending migrations. Supabase migration history contains:
- `20261110090000_init`
- `20261110100000_harden_public_access_and_index_vehicle_event`

Database access hardening is applied and verified: direct table/sequence grants to `anon` and `authenticated` are revoked; `anon` cannot execute `public.rls_auto_enable()`; the VehicleEvent lookup index exists.

## Important security and readiness caveats

- CI smoke testing is not a substitute for a complete browser-based signed-in test. Registration, login, owner-scoped CRUD and SUPER_ADMIN workflows still need testing with a disposable account in staging.
- The frontend stores its short-lived bearer token in browser `sessionStorage`. A production-grade session should move to secure HttpOnly cookies and include an MFA review.
- Supabase RLS is enabled on public tables, but no per-table policies are currently defined. Public Data API table grants are revoked; the Express API uses its private database connection and enforces ownership in its routes. Do not re-enable public Supabase table grants without a reviewed RLS policy model.
- Document upload/download and malware scanning are not implemented.
- Reminder delivery is not scheduled or pushed automatically.
- The Telugu translation file is a starter; the language selector does not yet translate the entire UI. Hindi translation is also incomplete.
- Record editing/deletion and full integration tests remain outstanding.
- Do not enter real customer, personal, insurance, vehicle registration or financial data until the remaining security checks and workflows are complete.

## Next work

1. Build a staging-only end-to-end test for registration/login and owner-scoped assets, vehicles, service events, bills, money entries, payment requests, insurance, reminders and support.
2. Establish and securely promote the first SUPER_ADMIN account.
3. Harden sessions and review authorization, rate limiting, CORS and audit trails.
4. Implement private document storage with file validation and malware scanning.
5. Add scheduled in-app reminder delivery; only add WhatsApp after a supported provider integration and explicit permissions.
6. Finish all translations and test date handling on mobile.
7. Add edit/delete operations and restore/backup verification before accepting real user data.
