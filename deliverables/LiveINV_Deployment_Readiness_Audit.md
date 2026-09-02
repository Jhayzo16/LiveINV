# LiveINV Deployment Readiness Audit

**Audit date:** September 2, 2026  
**Reviewed branch:** `main` at `a87b50c` plus local uncommitted changes  
**Target:** Public/live web deployment using Supabase  
**Decision:** **NO-GO — not ready for a public live server**

LiveINV is usable as a controlled staging/demo application. The production build completes, the available automated tests pass, Supabase is reachable, and the main modules and all seven interactive floor maps load. It is not yet safe to publish as a real hospital inventory system because anonymous clients can read and modify inventory, authentication is not implemented, and some database failures can be presented as successful or replaced with convincing demo/local data.

## 1. Audit scope

This review included:

- Production TypeScript/Vite build.
- Existing unit tests.
- NPM dependency vulnerability audit.
- Supabase client configuration, migrations, RLS policies, repository behavior, and remote read connectivity.
- Main navigation smoke testing in the running application.
- Direct SVG room selection and Room Directory popup behavior.
- Interactive floor-map smoke testing for Floors 1–7.
- Source-control and deployment-configuration inspection.
- Static review of registration, editing, assignment, reports, QR, error handling, accessibility basics, and operational readiness.

No production data was modified during this audit. Destructive, permission-denial, concurrency, mobile-device, camera, and full end-to-end write tests remain pending.

## 2. Evidence summary

| Check | Result | Evidence |
|---|---|---|
| Production build | Pass with warning | 1,004 modules built; JS bundle 2,139.82 kB minified / 585.05 kB gzip; Vite large-chunk warning |
| Existing unit tests | Pass, insufficient coverage | 2 files, 4 tests passed |
| Dependency audit | Pass at audit time | 0 known vulnerabilities across 352 dependencies |
| Supabase connectivity | Pass | Anonymous REST read returned HTTP 200 and 11 asset rows |
| Main module smoke test | Pass | Dashboard, Assets, Assignments, QR Scanner, Reports, and Manual opened without a loading deadlock |
| Direct room interaction | Pass in smoke test | Floor 1 direct SVG click opened the room assignment dialog |
| Room Directory interaction | Pass in smoke test | Directory room opened the same assignment dialog |
| Seven-floor smoke test | Pass | 81, 67, 55, 40, 38, 37, and 37 room hit targets loaded on Floors 1–7; first room popup opened on each |
| Authentication and authorization | Fail / blocker | No Supabase Auth workflow; UI always identifies a hard-coded Administrator |
| Production RLS | Fail / blocker | Prototype policies allow anonymous asset SELECT, INSERT, and UPDATE and anonymous audit-log SELECT |
| Failure/data consistency behavior | Fail / blocker | Remote failure may display seed data or accept a browser-local override as success |
| Reproducible source release | Fail / blocker | Current feature fixes and migration are uncommitted; local branch matches origin only before those changes |
| Hosting configuration | Not ready | No selected hosting config, CI pipeline, environment template, security headers, or deployment verification workflow |

## 3. Release blockers

### B-01: No real authentication or server-enforced user roles

**Severity:** Critical  
**Why it blocks release:** Anyone who obtains the deployed site and public anon key can use the same application privileges. The visible “Admin / Administrator” identity and Users & Roles screen are static UI, not security controls.

Required remediation:

- Implement Supabase Auth and an explicit sign-in/sign-out/session-expiry flow.
- Create a server-backed profile/role model, such as Administrator, Inventory Staff, Viewer, and Maintenance Staff.
- Enforce each permission with RLS, not only by hiding buttons.
- Protect all inventory pages and write operations from unauthenticated access.
- Record the authenticated user in audit events.

### B-02: Supabase RLS permits anonymous inventory modification

**Severity:** Critical  
**Why it blocks release:** The checked-in initial migration enables RLS but then grants all clients unrestricted asset reads, inserts, and updates using `USING (true)` / `WITH CHECK (true)`. Audit logs are also readable by every anonymous client.

Required remediation:

- Replace prototype policies with least-privilege authenticated policies.
- Define who may view assets, register assets, edit details, assign locations, and read audit history.
- Explicitly deny direct audit-log insertion, update, and deletion by ordinary clients.
- Test policies using unauthenticated and every supported role account.
- Apply the secured policies through a versioned migration and verify them on a clean staging project.

### B-03: Supabase outages can be hidden by realistic seed data

**Severity:** Critical  
**Why it blocks release:** When `AssetRepository.getAll()` receives a Supabase error, it returns built-in seed assets. A live user may believe the displayed demo inventory is the hospital’s current inventory even when the database is unavailable.

Required remediation:

- Do not return seed/demo inventory in production.
- Show an explicit unavailable/offline state and last successful synchronization time.
- Keep demo data behind a development-only flag or separate demo deployment.
- Add retry and recovery behavior without replacing authoritative data.

### B-04: A failed remote assignment can be reported as locally saved

**Severity:** Critical  
**Why it blocks release:** For a particular Supabase audit permission failure, `AssetRepository.update()` stores a browser-local override and returns successfully. Calling screens can then show a success message even though other users and devices do not have that assignment.

Required remediation:

- Remove the implicit local-success fallback from the production path.
- Treat a failed remote update as a failed assignment.
- If offline work is a formal requirement, build a visible pending-sync queue with conflict handling, retry, reconciliation, and audit rules.
- Add an end-to-end test proving an assignment survives refresh and appears in a second authorized session.

### B-05: Registration and editing do not reliably await persistence

**Severity:** Critical  
**Why it blocks release:** The registration dialog invokes the asynchronous `onRegister` callback without awaiting it inside the success workflow. QR completion and “saved” feedback can occur before Supabase confirms the insert, and a rejected promise may not be handled by that flow. Asset editing similarly calls an asynchronous save through a callback typed as returning `void`, then closes/reopens UI without a confirmed result.

Required remediation:

- Type registration/edit callbacks as `Promise<void>` and await them.
- Show saving, confirmed success, and actionable failure states.
- Do not generate final success/close the editor until persistence is confirmed.
- Test duplicate tags, database denial, offline behavior, and zero-row updates.

### B-06: The deployable source does not contain the current working system

**Severity:** Critical operational blocker  
**Why it blocks release:** `main` and `origin/main` point to the same commit, but the restored assignment behavior, error handling, local repository behavior, map click fix, styles, and audit-trigger migration are still uncommitted. A repository-based deployment would omit these changes.

Required remediation:

- Review the local diff and decide which changes belong in the release.
- Commit the application changes and migration together or in a documented sequence.
- Pull/rebase safely if the remote moves, rerun the release checks, then push.
- Deploy only an identified immutable commit, not an uncommitted workstation state.

### B-07: Supabase project ownership and operational access are not established

**Severity:** Critical operational blocker  
**Why it blocks release:** The configured project is reachable, but earlier project context indicates it belongs to the user’s friend. A live system requires organizational ownership, multiple authorized administrators, recovery access, billing control, and a documented handover.

Required remediation:

- Use a Supabase organization/project owned by the system owner or formally transfer ownership/access.
- Ensure at least two authorized maintainers can access the project.
- Configure billing, backups, recovery, MFA, alerts, and key-rotation responsibility.
- Separate development/staging and production projects.

## 4. High-priority issues before release candidate testing

### H-01: Automated coverage is far below the risk of the system

Only four unit tests exist: three registration-schema cases and one loading-state case. There are no committed end-to-end tests for registration, editing, either assignment path, cross-page synchronization, persistence, QR lookup, RLS denial, or database outage behavior.

Minimum release suite:

- Unit tests for validation, room/location mapping, CSV escaping, and repository errors.
- Component tests for registration/edit/assignment loading, success, and failure states.
- Supabase integration tests against a test project.
- Playwright tests for register → assign → reload → find on map → QR lookup.
- RLS tests for unauthenticated, viewer, editor, and administrator roles.

### H-02: No deployment pipeline or hosting contract

No Vercel, Netlify, Cloudflare, Docker, GitHub Actions, or other hosting configuration was found. The hosting target must define:

- Immutable build from `npm ci` and `npm run build`.
- Production environment variables without committing `.env`.
- HTTPS, SPA fallback/rewrite, caching rules, security headers, and rollback.
- Separate preview/staging deployments.
- Automated smoke tests after deployment.

### H-03: No global production error boundary or monitoring

An unexpected rendering error can blank the application, and there is no configured client error monitoring. Add a global error boundary, user-safe recovery page, structured logging, and alerting. Ensure logs never contain secrets or sensitive hospital information.

### H-04: Floor SVG loading has no failure UI and defeats caching

Floor plans are fetched with a `Date.now()` query on every load, preventing normal browser caching. The fetch does not check `response.ok` or show a catch/error state. A missing or failed SVG can produce a blank map without guidance.

### H-05: Audit trail lacks accountable user identity

The schema has `performed_by`, but the location trigger does not populate it and no authenticated user exists. Location history cannot prove who moved an asset.

### H-06: Several visible controls/features are placeholders or unreachable

Examples found during review include the top Search and notification controls without actions, an asset-detail Edit button without behavior in one topology view, report catalog tiles without actions, and static Users & Roles content. Network and Maintenance pages exist in code but are not linked in the current sidebar. These must either work, be clearly labeled as unavailable, or be removed from the production scope.

## 5. Medium-priority production quality issues

- The main JavaScript bundle is approximately 2.14 MB minified. Introduce route/module code splitting, especially for Three.js, QR scanning, and less-used modules.
- A monitor image is approximately 2.53 MB and other visual assets are large. Resize/compress and serve appropriate formats.
- `index.html` contains only the root element and script. Add a valid document structure, title, charset, viewport, description, favicon, and theme metadata.
- Several dependencies use `latest` ranges. Pin reviewed versions and continue deploying from the lockfile.
- There is no `.env.example` documenting required public client variables.
- The README still describes the product as a front-end prototype with browser-local demo records, which no longer accurately describes the Supabase-connected behavior.
- CSV generation needs systematic escaping for commas, quotes, formulas, and line breaks in every exported field.
- Update operations should verify that exactly one row was changed; a zero-row match should not count as success.
- Full cross-browser, mobile, keyboard, focus-management, screen-reader, color-contrast, and camera-permission testing remains pending.
- Backup/restore, retention, incident response, data ownership, privacy classification, and disaster recovery are not documented.

## 6. What is currently working well

- Strict TypeScript production build completes.
- Existing automated tests pass.
- Current dependency audit reports no known vulnerabilities.
- `.env` is ignored by Git, and only the Supabase public URL and anon key variable names are used in client code.
- Supabase is reachable from the current environment.
- Main user-facing modules load in the browser.
- All seven floor maps loaded their interactive room hit targets.
- Direct map-room selection opened the room popup on all seven tested floors.
- Floor 1 Room Directory selection opened the same popup and displayed available assignment controls.
- The audit-log trigger security-definer migration addresses the earlier trigger/RLS conflict when applied correctly.

These successes support continued staging and QA work, but they do not override the Critical blockers.

## 7. Minimum path to a release candidate

Complete these in order:

1. Establish an organization-owned production Supabase project and a separate staging project.
2. Implement Supabase Auth, real roles, and server-enforced least-privilege RLS.
3. Remove demo fallback behavior and false local success from production.
4. Make registration, editing, and assignment await and verify remote persistence.
5. Add accountable audit identity and test the audit trail.
6. Finish or remove placeholder controls and agree on the actual production feature scope.
7. Commit all intended application changes and migrations; ensure a clean release branch.
8. Add critical unit, integration, RLS, and Playwright end-to-end tests.
9. Select/configure hosting, CI/CD, environment management, security headers, monitoring, backups, and rollback.
10. Optimize the bundle and assets, update HTML metadata and documentation, then run the full QA plan on staging.

## 8. Release acceptance gates

The decision can change to **GO** only when:

- All seven Critical blockers are closed and retested.
- Unauthenticated users cannot read or modify inventory or audit information unless explicitly approved by the system owner.
- Registration, editing, map assignment, Assignments-page assignment, refresh persistence, cross-session visibility, and QR lookup pass end to end.
- Database outage and permission-denial tests never show fake data or false success.
- The release is built from a clean, tagged commit through the chosen deployment pipeline.
- No Critical or High defects remain open.
- Backups, monitoring, rollback, project ownership, and administrator access are verified.
- The system owner and hospital representative approve UAT and the release record.

## 9. Final recommendation

Do **not** publish the current build as a public or operational hospital inventory system. Continue using it only in a restricted staging/demo environment with non-sensitive data. Address the seven Critical blockers first; after that, execute the full QA plan and perform a second deployment-readiness audit on the release candidate.
