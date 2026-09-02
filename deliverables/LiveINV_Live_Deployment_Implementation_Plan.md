# LiveINV Live Server Deployment Implementation Plan

**Prepared:** September 2, 2026  
**Application:** LiveINV Hospital Visual Inventory Tracking System  
**Frontend:** React, TypeScript, and Vite  
**Backend:** Supabase Auth, Postgres, and Row Level Security  
**Recommended frontend host:** Vercel  
**Plan status:** Ready for implementation  
**Current release status:** No-go until the security and data-integrity gates in this plan pass

## 1. Target production architecture

Use three isolated environments:

| Environment | Frontend | Supabase | Data | Purpose |
|---|---|---|---|---|
| Local development | Developer computer | Local Supabase stack or development project | Seeded QA data | Feature work and unit testing |
| Staging | Protected preview/staging URL | Organization-owned staging project | Non-sensitive QA data | Integration, security, and user acceptance testing |
| Production | Public or hospital-restricted live URL | Organization-owned production project | Approved operational inventory | Real use |

Rules:

- Never use production as the development or QA database.
- Never place a Supabase service-role key in the Vite frontend or any `VITE_` variable.
- Keep schema, functions, triggers, grants, and RLS policies in versioned migrations.
- Deploy only a clean, reviewed Git commit.
- Use the browser’s public/publishable Supabase key only after RLS is proven.

## 2. Roles and responsibilities

Assign names before implementation begins.

| Role | Responsibility |
|---|---|
| System owner | Owns Supabase/Vercel organizations, approves access and launch |
| Lead developer | Implements application, Auth, persistence, and deployment changes |
| Database/security owner | Reviews schema, grants, RLS, audit trail, backups, and migrations |
| QA tester | Executes the QA plan and maintains defect evidence |
| Hospital UAT representative | Verifies rooms, workflows, terminology, and acceptance |
| Release manager | Approves the release commit, deployment, rollback, and launch record |

One person may hold multiple roles, but production ownership must not depend on only one personal account.

## 3. Delivery phases and estimated effort

| Phase | Estimated effort | Exit gate |
|---|---:|---|
| 0. Scope and ownership | 0.5–1 day | Owners, scope, domain, and data classification approved |
| 1. Source-control baseline | 0.5 day | Clean reviewed branch containing all intended fixes |
| 2. Supabase environments | 1 day | Organization-owned staging and production projects exist |
| 3. Reproducible database | 1–2 days | Clean database can be rebuilt from migrations |
| 4. Authentication and roles | 2–4 days | Real sign-in and role model work on staging |
| 5. Secure RLS and audit trail | 2–4 days | Automated allow/deny policy tests pass |
| 6. Data-integrity fixes | 2–3 days | No fake fallback or false-success workflow remains |
| 7. Production UX/error handling | 1–3 days | Failures, loading, offline, and recovery are clear |
| 8. Automated QA | 3–6 days | Critical unit/integration/end-to-end suite passes |
| 9. Hosting and CI/CD | 1–2 days | Staging deploys automatically and passes smoke tests |
| 10. Performance/accessibility | 1–3 days | Agreed budgets and supported-device tests pass |
| 11. UAT and data preparation | 1–3 days | Hospital representative signs off |
| 12. Production launch | 0.5–1 day | Production verification and launch record complete |

Estimated total: approximately **16–33 person-days**, depending on the final role model, hosting access, and defects found during QA.

## 4. Step-by-step implementation

### Phase 0 — Confirm scope, ownership, and launch policy

#### Step 0.1: Define the production users

Decide who will use LiveINV and what they may do. Recommended initial roles:

- **Administrator:** manage users, configuration, assets, assignments, and reports.
- **Inventory Staff:** register/edit assets, assign rooms, scan QR codes, and view reports.
- **Maintenance Staff:** view inventory and update approved condition/maintenance fields.
- **Viewer/Auditor:** read-only access to maps, assets, and approved reports.

**Output:** approved permission matrix listing every page and operation for every role.

#### Step 0.2: Classify the data

Confirm whether asset IP addresses, room assignments, user identities, audit records, and maintenance notes are internal, confidential, or public. Do not store patient or clinical information unless governance, privacy, and compliance requirements are separately approved.

**Output:** one-page data classification and retention decision.

#### Step 0.3: Choose the live access model

Choose one:

- Internet-accessible but login-protected.
- Restricted by hospital network/VPN plus login.
- Internal-only deployment.

For hospital inventory, restricted network/VPN plus application authentication is preferred when operationally available.

#### Step 0.4: Establish organization ownership

- Create or use an organization-owned Git repository.
- Create organization-owned Supabase and Vercel accounts/projects.
- Add at least two trusted administrators with MFA.
- Record billing owner, technical owner, emergency contact, and account-recovery process.
- Do not use a friend’s personal Supabase project as production.

**Gate 0:** System owner signs the scope, access model, role matrix, and ownership list.

### Phase 1 — Create a clean source-control baseline

#### Step 1.1: Preserve and review current local changes

The current working tree contains uncommitted application fixes and a Supabase migration. Review each changed file and confirm it belongs to the release.

#### Step 1.2: Synchronize safely with the repository

1. Fetch/pull the latest remote state.
2. Resolve conflicts without discarding the current room-assignment fixes.
3. Run the build and tests.
4. Commit the reviewed changes using a clear release-preparation message.
5. Push to a protected feature/release branch and open a review before merging to `main`.

#### Step 1.3: Add repository protections

- Require pull-request review for `main`.
- Require passing build/test checks.
- Prevent force pushes and accidental branch deletion.
- Enable secret scanning and dependency alerts where available.

#### Step 1.4: Pin the release toolchain

- Replace `latest` package ranges with reviewed versions.
- Continue committing `package-lock.json`.
- Standardize the supported Node.js version in the repository and CI.
- Use `npm ci`, not `npm install`, in deployment builds.

**Gate 1:** Clean working tree, reviewed pull request, protected `main`, and repeatable install/build.

### Phase 2 — Create separate Supabase projects

#### Step 2.1: Create staging and production projects

Create both projects inside the organization-owned Supabase organization:

- `liveinv-staging`
- `liveinv-production`

Use strong database passwords stored in an approved password manager. Configure project region based on hospital latency and data-governance requirements.

#### Step 2.2: Configure administrators and safeguards

- Require MFA for organization administrators.
- Add at least two owners/administrators.
- Review the Supabase Security Advisor.
- Select an appropriate paid plan before real operational use if backup, recovery, uptime, or resource requirements exceed the free plan.
- Define monthly spending alerts and service ownership.

#### Step 2.3: Record environment identifiers safely

Each frontend environment receives only:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Create `.env.example` with placeholder values. Store real values only in local ignored files and host-managed environment variables. Never commit them.

**Gate 2:** Staging and production ownership, MFA, environment records, and recovery access verified.

### Phase 3 — Make the database reproducible

Supabase recommends tracking schema changes through migrations and validating that a fresh database can be recreated from them.

#### Step 3.1: Initialize the Supabase project structure

Ensure the repository contains:

- `supabase/config.toml`
- `supabase/migrations/`
- Optional `supabase/seed.sql` containing QA/demo data only
- `supabase/tests/` for database and RLS tests

#### Step 3.2: Reconcile dashboard changes with Git

Because SQL has already been applied manually to the existing project:

1. Link the CLI to the staging project.
2. Compare local and remote migration history.
3. Pull remote-only schema changes into a migration if necessary.
4. Review the generated SQL carefully.
5. Reset a local/test database from the migration chain.

Do not reset a remote production database.

#### Step 3.3: Separate production schema from demo data

- Remove operational seed inserts from production migrations.
- Put QA records in `seed.sql` or a dedicated staging-only script.
- Confirm that applying production migrations creates an empty but functional system.

#### Step 3.4: Regenerate database types

Regenerate `src/lib/database.types.ts` from the final schema and make type generation a documented or automated step after schema changes.

#### Step 3.5: Verify migrations locally and on staging

Required checks:

```text
supabase db reset
supabase migration list
supabase db push --dry-run
supabase db push
```

Review the target project before every remote command. Never use a linked remote reset on production.

**Gate 3:** A clean local database and staging database can be created entirely from version-controlled migrations.

### Phase 4 — Implement Supabase Auth and real roles

#### Step 4.1: Add the user profile model

Create a versioned migration for a `profiles` table linked to `auth.users`, including:

- User ID primary key.
- Display name.
- Approved role.
- Active/disabled status.
- Created/updated timestamps.
- Optional department if required.

Use a database enum or constrained role value so clients cannot invent arbitrary roles.

#### Step 4.2: Implement sign-in and session behavior

- Replace the hard-coded Admin identity with the authenticated user.
- Add sign-in, loading, invalid-credentials, disabled-user, session-expired, and sign-out states.
- Protect the application until session and profile checks complete.
- Redirect unauthenticated users to sign-in.
- Decide whether administrators invite users or use an approved email/password/SSO workflow.

#### Step 4.3: Apply role-based UI behavior

- Show only modules and actions relevant to the role.
- Disable or remove editing/assignment controls for read-only users.
- Treat the UI as convenience only; the database remains the authority.

#### Step 4.4: Add administrator provisioning

Create the first administrator through a controlled server/admin process. Never expose the service-role key in the browser to create or promote users.

**Gate 4:** Sign-in, sign-out, refresh, expiry, disabled account, and every intended role work on staging.

### Phase 5 — Replace prototype policies with secure RLS

#### Step 5.1: Remove broad anonymous policies

Create a new migration that drops the prototype policies allowing universal asset SELECT, INSERT, UPDATE, and audit-log SELECT.

#### Step 5.2: Define grants and policies together

Recommended starting behavior:

| Operation | Admin | Inventory Staff | Maintenance | Viewer | Anonymous |
|---|---:|---:|---:|---:|---:|
| Read assets | Allow | Allow | Allow | Allow | Deny |
| Register assets | Allow | Allow | Deny | Deny | Deny |
| Edit asset identity/location | Allow | Allow | Limited/deny | Deny | Deny |
| Update maintenance status | Allow | Allow | Allow | Deny | Deny |
| Read audit logs | Allow | Approved scope | Approved scope | Optional | Deny |
| Write/alter audit logs directly | Deny through client | Deny | Deny | Deny | Deny |
| Manage users/roles | Allow through controlled path | Deny | Deny | Deny | Deny |

Use `auth.uid()` and the approved server-backed role/profile. Do not trust a role value supplied by browser form data.

#### Step 5.3: Make the audit trigger accountable

- Store the authenticated user responsible for each change.
- Include previous and new relevant values, timestamp, and action type.
- Preserve `SECURITY DEFINER` only with a safe fixed `search_path` and narrowly scoped behavior.
- Prevent clients from modifying or deleting audit history.

#### Step 5.4: Add automated RLS tests

Under `supabase/tests/`, assert allow and deny behavior for:

- Anonymous clients.
- Each authenticated role.
- Cross-user/role escalation attempts.
- Asset select/insert/update/delete.
- Audit-log select/insert/update/delete.
- Direct attempts to forge a role or audit record.

Run database tests in CI and before each migration promotion.

**Gate 5:** All RLS allow/deny tests pass and a security reviewer signs off.

### Phase 6 — Fix persistence and consistency behavior

#### Step 6.1: Remove production seed fallback

- When Supabase cannot load inventory, show a blocking data-unavailable state.
- Display retry and last-successful-sync information.
- Keep seed data only in development/demo mode.
- Never make demo data look like current hospital inventory.

#### Step 6.2: Remove silent browser-local assignment success

- A failed Supabase update must reject the operation and keep the asset unassigned in the UI.
- Do not store an authoritative-looking assignment in local storage.
- If offline assignment is later required, implement it as an explicit pending-sync feature with visible status and conflict resolution.

#### Step 6.3: Await all writes

Update registration, editing, QR-based editing, Assignments, and room-popup assignment so that each workflow:

1. Enters a saving state.
2. Awaits Supabase.
3. Verifies the affected/returned row.
4. Refreshes authoritative query data.
5. Shows success only after confirmation.
6. Shows an actionable error without closing or losing user input on failure.

#### Step 6.4: Add concurrency protection

- Add an `updated_at`/version check to prevent silent last-write-wins conflicts.
- Return a conflict message when another user changed the same asset.
- Prevent double submission while a write is pending.

#### Step 6.5: Harden validation and uniqueness

- Validate category and status with strict enums.
- Require positive whole numbers for modules, drive counts, and capacities.
- Normalize asset tags consistently.
- Handle duplicate tags and QR IDs with user-friendly messages.
- Retry QR token generation if the database reports a collision.

**Gate 6:** Every write persists across refresh and a second session; every simulated failure produces no false success.

### Phase 7 — Finish production UX and error handling

#### Step 7.1: Add a global error boundary

Provide a safe recovery screen with retry/reload guidance. Log a technical error reference without exposing database details or secrets.

#### Step 7.2: Add explicit floor-map failure states

- Remove timestamp cache-busting from normal floor SVG requests.
- Check HTTP response status.
- Show loading, failed-map, retry, and unavailable-room states.
- Cache versioned map assets through filenames or deployment hashes.

#### Step 7.3: Resolve placeholder controls

Implement, hide, or clearly disable:

- Top Search.
- Notifications.
- Topology asset Edit button.
- Report catalog actions.
- Users & Roles controls.
- Network and Maintenance modules if they belong to the launch scope.

#### Step 7.4: Add production HTML metadata

Add a valid HTML document with language, charset, viewport, title, description, favicon, theme color, and a useful no-JavaScript message.

#### Step 7.5: Improve accessibility

- Implement dialog focus trapping and focus return.
- Verify all controls by keyboard.
- Add meaningful status announcements.
- Check color contrast and 200% zoom.
- Test map access through the keyboard-friendly Room Directory.

**Gate 7:** No unfinished action appears functional, and all critical errors have a clear recovery path.

### Phase 8 — Build the automated release test suite

#### Step 8.1: Expand unit/component tests

Cover:

- Registration and assignment validation.
- Location parsing and exact room matching.
- Asset search/filter/report calculations.
- CSV escaping.
- Repository success, zero-row, permission, timeout, and offline failures.
- Registration/edit/assignment saving and error states.

#### Step 8.2: Add Supabase integration tests

Test inserts, edits, location audit records, unique constraints, role permissions, and transaction/concurrency behavior against a disposable test environment.

#### Step 8.3: Add Playwright end-to-end tests

Minimum critical flows:

1. Sign in and sign out.
2. Register a device and verify QR generation.
3. Assign through the Assignments page.
4. Assign through a floor-map room popup.
5. Refresh and verify persistence.
6. Open the same data in a second authorized session.
7. Search and manually identify by QR fallback ID.
8. Verify viewer and anonymous denial.
9. Simulate database/network failure and verify no false success.
10. Load and click a room on all seven floors.

#### Step 8.4: Add coverage and release thresholds

Do not use coverage percentage alone as the release decision. Require all security, persistence, and core workflow tests to pass.

**Gate 8:** Critical automated suite passes locally and in CI from a clean checkout.

### Phase 9 — Configure frontend hosting and CI/CD

This plan recommends Vercel because the current application is a Vite SPA. Another approved static host can be substituted if it supports equivalent controls.

#### Step 9.1: Connect the repository

- Import the organization-owned repository into the organization-owned Vercel account.
- Use the Vite framework preset.
- Build command: `npm run build`.
- Output directory: `dist`.
- Install from the lockfile using `npm ci` through the deployment configuration where supported.

#### Step 9.2: Configure environment variables

Set separate Supabase URL/public keys for preview/staging and production. Never reuse the production backend in pull-request previews.

#### Step 9.3: Configure SPA routing and static behavior

If client-side routes are added, configure a rewrite to `index.html` according to the host’s Vite SPA guidance. Configure:

- Long-lived caching for hashed assets.
- Appropriate caching for `index.html`.
- HTTPS-only access.
- Content Security Policy designed around Supabase, fonts, images, workers, and camera use.
- `X-Content-Type-Options`, `Referrer-Policy`, clickjacking protection, and a suitable Permissions Policy.

Test QR camera behavior over HTTPS.

#### Step 9.4: Create CI checks

For every pull request:

1. Clean install.
2. Type-check/production build.
3. Unit and component tests.
4. Database/RLS tests.
5. End-to-end staging/preview smoke tests.
6. Dependency and secret checks.

For production promotion, require manual approval by the release manager after staging passes.

#### Step 9.5: Add post-deploy smoke tests

Automatically verify:

- Application HTTP success.
- Sign-in screen.
- Authorized asset read.
- Floor SVG loading.
- A room popup.
- No obvious browser runtime errors.

**Gate 9:** Every merge creates a verified staging build; production requires explicit approval.

### Phase 10 — Performance, compatibility, and accessibility

#### Step 10.1: Reduce the application bundle

- Lazy-load Three.js/3D topology, QR scanner, reports, and other large modules.
- Split vendor and feature chunks where useful.
- Measure the result rather than only suppressing Vite’s warning.

#### Step 10.2: Optimize visual assets

- Resize the approximately 2.53 MB monitor image and other large images.
- Prefer WebP/AVIF where supported.
- Preserve SVG for floor plans and logos where appropriate.
- Add explicit image dimensions to reduce layout shift.

#### Step 10.3: Run the supported-device matrix

Test current Chrome, Edge, and Firefox plus agreed mobile/tablet sizes. Include slow network, denied camera, expired session, and temporary backend outage.

**Gate 10:** Agreed performance budget, accessibility checks, and supported-browser matrix pass.

### Phase 11 — Staging QA, UAT, and production data preparation

#### Step 11.1: Execute the full QA plan

Use `LiveINV_QA_Test_Plan.md`. Record the build commit, environment, evidence, defects, retests, and pass rate.

#### Step 11.2: Conduct hospital UAT

The hospital representative must verify:

- All seven floor maps.
- Official room/office names.
- Assignment workflow and terminology.
- Device categories/statuses.
- Reports and QR labels.
- User permissions.

#### Step 11.3: Prepare production inventory import

- Clean and normalize source records.
- Detect duplicate tags, QR IDs, and IP addresses.
- Confirm every location matches an exact production room identifier.
- Import through a reviewed script or controlled process.
- Reconcile imported counts and retain a signed import report.

#### Step 11.4: Prepare operations

- Configure monitoring and alert recipients.
- Test Supabase backup/restore appropriate to the selected plan.
- Write incident, account-recovery, key-rotation, and rollback procedures.
- Train administrators and inventory staff.

**Gate 11:** No Critical/High defects, UAT signed, data import reconciled, and operations checklist approved.

### Phase 12 — Production launch

#### Step 12.1: Freeze the release

- Stop non-release changes.
- Identify the release commit and tag.
- Confirm clean CI results and approvals.
- Take/verify the required pre-launch backup.

#### Step 12.2: Apply production database migrations

1. Confirm the CLI is linked to the production project.
2. Review the migration list.
3. Run a dry run.
4. Apply only reviewed pending migrations.
5. Verify tables, constraints, functions, grants, RLS, and Auth configuration.
6. Do not seed QA/demo data into production.

#### Step 12.3: Deploy the frontend

- Promote the verified staging commit to production.
- Confirm production Supabase public variables.
- Attach the approved domain and HTTPS certificate.
- Do not rebuild from a different commit during promotion.

#### Step 12.4: Run the production smoke checklist

Use a dedicated test asset/room if write verification is approved:

- Sign in as each essential role.
- Confirm anonymous denial.
- Load dashboard and assets.
- Open a room on every floor.
- Register/edit a controlled test asset.
- Assign it through both supported assignment paths.
- Refresh and verify it in a second authorized session.
- Verify the audit record and actor.
- Scan or manually enter its QR ID.
- Export and reconcile the test record.
- Remove/archive the test record through the approved process.

#### Step 12.5: Monitor the launch

For the first 24–72 hours:

- Monitor frontend errors, failed Supabase requests, Auth failures, latency, database/storage usage, and unusual access.
- Keep a named developer and system owner available.
- Record all incidents and decisions in the launch log.

**Gate 12:** Production smoke passes, monitoring is healthy, and the release manager declares the system live.

## 5. Rollback plan

Rollback must be prepared before launch.

### Frontend rollback

- Preserve the last known-good deployment.
- If a Critical frontend issue occurs, immediately promote/restore that deployment.
- Keep the database compatible with both the new and previous frontend during the release window when possible.

### Database rollback

- Prefer forward-fix migrations for non-destructive schema problems.
- Never improvise destructive rollback SQL during an incident.
- For destructive migrations, prepare and review a restore/down strategy before applying them.
- If data corruption occurs, stop writes, preserve evidence, and follow the tested backup/restore procedure.

### Emergency access/security response

- Disable affected user accounts or revoke compromised keys.
- Rotate public keys only through a planned frontend redeployment; rotate privileged secrets immediately when compromised.
- Temporarily block writes with RLS if inventory integrity is at risk.
- Record the incident timeline and affected records.

Rollback triggers include unauthorized access, wrong-room assignments, false success, data loss/corruption, widespread sign-in failure, unusable core workflows, or unacceptable error rates.

## 6. Production launch checklist

### Ownership and security

- [ ] Organization owns Git, Supabase, Vercel, and domain.
- [ ] At least two administrators have MFA and recovery access.
- [ ] Authentication and role matrix are implemented.
- [ ] Anonymous asset and audit access is denied.
- [ ] RLS tests pass for every role and operation.
- [ ] Service-role and database secrets are absent from the frontend/repository.
- [ ] Security Advisor findings are reviewed.

### Data and reliability

- [ ] Demo/seed fallback is disabled in production.
- [ ] Browser-local false-success assignment fallback is removed.
- [ ] All writes await and verify Supabase persistence.
- [ ] Audit records include the authenticated actor.
- [ ] Backup and restore have been tested.
- [ ] Production import has been reconciled.

### Code and QA

- [ ] Release commit is clean, reviewed, pushed, and tagged.
- [ ] Build and all automated tests pass in CI.
- [ ] All P0 and required P1 QA cases pass.
- [ ] No unresolved Critical or High defects.
- [ ] Seven-floor map, directory, assignments, registration, editing, reports, and QR workflows pass.
- [ ] Supported desktop/mobile browsers pass.
- [ ] UAT is signed by the hospital representative.

### Hosting and operations

- [ ] Staging and production use different Supabase projects.
- [ ] Production environment variables are verified.
- [ ] HTTPS, domain, headers, caching, and SPA behavior are verified.
- [ ] Monitoring and alerts reach the correct people.
- [ ] Rollback instructions and last known-good deployment are ready.
- [ ] Production smoke test and launch log are complete.

## 7. Implementation tracking template

| Step | Owner | Target date | Status | Pull request / migration | Evidence | Blocker |
|---|---|---|---|---|---|---|
| Example: 5.2 Secure asset RLS | Database owner |  | Not started |  |  |  |

Use only: Not Started, In Progress, Ready for Review, Blocked, or Complete. “Complete” requires the stated gate and evidence, not only code completion.

## 8. Official implementation references

- Supabase production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase local development workflow: https://supabase.com/docs/guides/local-development/cli-workflows
- Supabase database migrations: https://supabase.com/docs/guides/local-development/database-migrations
- Supabase environment management: https://supabase.com/docs/guides/deployment/managing-environments
- Vercel Vite deployment: https://vercel.com/docs/frameworks/frontend/vite

## 9. Immediate next action

Start with **Phase 0 and Phase 1**, then stop before changing Supabase until the organization-owned staging project and role matrix are approved. The first implementation pull request should establish the clean source baseline and deployment/test scaffolding; the second should introduce Auth/profile migrations and secure RLS on staging.
