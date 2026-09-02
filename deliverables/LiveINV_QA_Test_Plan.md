# LiveINV Quality Assurance Test Plan

**System:** LiveINV Hospital Visual Inventory Tracking System  
**Prepared:** September 2, 2026  
**Document status:** Draft for review — test execution has not started  
**Target application:** React/TypeScript web application with Supabase persistence

## 1. Purpose

This document defines how LiveINV will be checked for functional correctness, data reliability, usability, accessibility, security, compatibility, and production readiness. It is a documentation-only baseline. A test is not considered passed until its result and evidence are recorded during a separate QA execution phase.

## 2. Quality objectives

LiveINV should:

- Let staff find a hospital floor, room, and asset quickly and consistently.
- Let authorized staff register, edit, assign, identify, and report on assets without losing or duplicating data.
- Keep the Live Mapping room popup, Room Directory, Assignments page, Asset Registry, dashboard, and reports synchronized.
- Preserve confirmed changes after refresh, browser restart, and sign-in on another authorized device.
- Give clear feedback for success, validation errors, unavailable services, and permission failures.
- Remain readable and operable on supported desktop and mobile screen sizes.
- Protect inventory and audit data from unauthorized reading or modification.

## 3. System areas in scope

| Area | Main behavior to verify |
|---|---|
| Navigation and layout | Sidebar, page changes, responsive layout, loading and empty states |
| Dashboard | Totals, status counts, assignment counts, floor distribution, recent inventory |
| Live Mapping | Seven-floor building navigation, floor selection, room interaction, zoom/pan, directory |
| Room popup | Correct room identity, asset totals, asset list, available-asset assignment, immediate refresh |
| Asset Registry | Search, filters, device details, registration, editing, CSV export, QR creation |
| Consumables | Receipt entry, positive quantities, receiving information, search/filter/export, and separation from assignable assets |
| Assignments | Unassigned queue, floor-first selection, room list filtering, persistence, error handling |
| QR Scanner | Camera flow, manual fallback ID, valid/invalid scans, asset display and update |
| Network Registry | Network-capable asset list and displayed network information |
| Maintenance | Status groupings and maintenance-related asset information |
| Reports | Totals, category/status summaries, exports or printed output where provided |
| Users and roles | Access control, role restrictions, identity display, session behavior |
| System Manual | Correct, readable instructions that match the implemented workflows |
| Supabase integration | Reads, inserts, updates, audit records, RLS policies, network failures |

## 4. Out of scope for the first QA cycle

- Medical-device calibration or clinical safety certification.
- Physical validation of hospital networking, room access, or power systems.
- Accuracy of floor plans against the actual building unless approved floor-plan references and a hospital representative are available.
- Native mobile applications; LiveINV is currently tested as a responsive web application.
- Large-scale performance claims until a production-like dataset and staging environment exist.

## 5. Test environments

Testing must use a dedicated staging Supabase project. Production data must not be used for destructive or repeated assignment tests.

| Environment | Minimum coverage |
|---|---|
| Desktop | Current Chrome and Edge at 1920×1080 and 1366×768 |
| Additional browser | Current Firefox |
| Mobile | Chrome at approximately 390×844 and 360×800 |
| Tablet | Approximately 768×1024 in portrait and landscape |
| Network | Normal, slow connection, temporary offline state, and failed database request |
| Permissions | Camera allowed, camera denied, database operation allowed, database operation denied |

For every execution, record the commit ID, build date, browser version, device/viewport, Supabase project, tester, and test date.

## 6. Required test data

Prepare recognizable QA-only records:

- One unassigned asset for every supported category.
- One active, maintenance, broken, and inactive asset.
- One asset with complete computer specifications.
- One asset without an IP address or optional specifications.
- At least one assigned asset on every floor.
- Two rooms with similar names to detect incorrect matching.
- A valid generated QR code, a valid manual fallback ID, an unknown code, and malformed input.
- A duplicate asset tag and duplicate QR ID for negative registration testing.
- An account for each intended user role when authentication and roles are implemented.

QA data must use a visible prefix such as `QA-` and must be removed from staging after sign-off.

## 7. Entry criteria

QA execution can begin when:

- The intended release commit is identified and builds successfully.
- Environment variables point to the staging project.
- Required database migrations are applied to staging.
- Supported browsers and viewports are agreed upon.
- QA test data and role accounts are available.
- The approved room names and floor-plan SVGs for Floors 1–7 are identified.
- Known incomplete features are documented so they are not confused with regressions.

## 8. Test case status and priority

**Status:** Not Run, Pass, Fail, Blocked, or Not Applicable.  
**Priority:** P0 is release-critical, P1 is high-value, P2 is normal, and P3 is low-risk polish.

## 9. Functional test cases

### 9.1 Application, navigation, and dashboard

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| APP-001 | P0 | Open the application with a working database connection. | The application loads without a blank screen, uncaught error, or endless loading state. |
| APP-002 | P1 | Open every sidebar module and return to Live Mapping. | The correct page opens, the active item is visible, and no previous page incorrectly overlays the new page. |
| APP-003 | P1 | Collapse and expand the sidebar at desktop and mobile widths. | Content remains reachable and no important control is clipped. |
| APP-004 | P1 | Refresh the browser while viewing the system. | The application recovers cleanly and persisted inventory is reloaded. |
| APP-005 | P1 | Load the application while Supabase is slow or unavailable. | A clear loading/error state appears; the UI does not report an unconfirmed database change as successful. |
| DASH-001 | P0 | Compare registered, active, attention, and assigned totals with the asset records. | All dashboard totals match the source records and use the same status definitions. |
| DASH-002 | P1 | Compare “Assets by floor” with assigned asset locations. | Each floor count is correct; unassigned and malformed locations are not assigned to the wrong floor. |
| DASH-003 | P2 | Add or update an asset, then return to Dashboard. | Dashboard cards and recent inventory reflect the confirmed change without stale values. |
| DASH-004 | P2 | Test with zero assets and with only unassigned assets. | Empty metrics remain valid, readable, and free of calculation errors. |

### 9.2 Live Mapping and room interaction

Run MAP-002 through MAP-011 on every floor, not only on one sample floor.

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| MAP-001 | P0 | Select each floor from the 3D hospital view. | Floors 1–7 open the matching map and heading/context. |
| MAP-002 | P0 | Visually compare the map with its approved floor-plan reference. | Room shapes, placement, names, and relative grouping match the approved reference. |
| MAP-003 | P0 | Click several rooms directly on the SVG map. | Each click opens the popup for the room that was clicked; no neighboring room is selected. |
| MAP-004 | P0 | Open the same rooms from the Room Directory. | The same popup and room data appear as with direct map selection. |
| MAP-005 | P1 | Pan or drag the map beginning over a room. | The map moves without accidentally opening a room after a genuine drag. |
| MAP-006 | P1 | Click a room without dragging. | The click is not swallowed by pointer capture and the room popup opens once. |
| MAP-007 | P1 | Zoom in/out and use any reset control. | The map remains usable, labels stay associated with rooms, and reset restores the intended view. |
| MAP-008 | P1 | Inspect long, short, and multiline room names. | Names are legible, not misleadingly truncated, and do not overlap unrelated rooms. |
| MAP-009 | P1 | Inspect the full map at supported desktop and mobile sizes. | Users can reach every room by pan/zoom or directory; no room is permanently clipped. |
| MAP-010 | P2 | Close a room popup by its close button, Escape, and outside click where supported. | The popup closes predictably and keyboard focus returns to a sensible control. |
| MAP-011 | P1 | Search/filter the Room Directory, including no matches. | Matching rooms are correct and an understandable empty state is shown. |
| MAP-012 | P1 | Switch floors after selecting a room. | The previous room selection does not leak into the new floor. |

### 9.3 Room popup and map-based asset assignment

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| ROOM-001 | P0 | Open a room with no assets. | The correct floor and room name appear, totals show zero, and assignment controls are available when permitted. |
| ROOM-002 | P0 | Open a room with mixed asset categories. | Total and per-category counts match the asset list. |
| ROOM-003 | P0 | Choose an available asset and select **Assign to this room**. | The button shows progress, the database update completes, and one success message appears. |
| ROOM-004 | P0 | Observe the popup after a successful assignment. | The assigned asset is shown immediately and all room counts update without closing/reopening the popup. |
| ROOM-005 | P0 | Refresh and reopen the same room. | The assignment persists and the asset is no longer offered as available elsewhere. |
| ROOM-006 | P0 | Open the Assignments page and Asset Registry after map assignment. | Both show the same floor, room, department/owner, and assigned state. |
| ROOM-007 | P0 | Force a database permission or network failure during assignment. | The user sees an error, no success is shown, and the asset remains available unless persistence is explicitly confirmed. |
| ROOM-008 | P1 | Double-click or rapidly press the assignment button. | Only one update is produced; duplicate audit records or conflicting assignments are not created. |
| ROOM-009 | P1 | Open a room when no unassigned devices remain. | The popup explains that no devices are available and does not show a broken selector. |
| ROOM-010 | P1 | Assign assets with punctuation-heavy room names and similar room names. | The selected room receives the asset using an exact, stable mapping. |

### 9.4 Asset Registry and registration

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| AST-001 | P0 | Load the Asset Registry and compare it with database records. | Every permitted record appears once with correct identity, category, status, and assignment. |
| AST-002 | P1 | Search by asset tag, QR ID, name, brand, model, room, and department. | Relevant results appear case-insensitively and unrelated records are excluded. |
| AST-003 | P1 | Apply category and status filters alone and together with search. | Filters combine correctly and can be cleared. |
| AST-004 | P1 | Open an asset card. | Full details belong to the selected asset and remain readable when optional values are missing. |
| AST-005 | P0 | Register one valid asset for every supported category. | Required fields change appropriately, the record is saved once, and it begins unassigned. |
| AST-006 | P0 | Try missing required values, invalid numeric specifications, invalid IP, and invalid status/category data. | Submission is blocked and field-specific validation is understandable. |
| AST-007 | P0 | Try a duplicate asset tag and duplicate QR ID. | The duplicate is rejected without damaging the existing record. |
| AST-008 | P1 | Complete QR generation after registration. | The displayed QR and fallback ID identify the newly created asset. |
| AST-009 | P1 | Download and print a generated QR label. | The file/print view is readable, correctly named, and contains the intended asset identity. |
| AST-010 | P0 | Edit asset details and save. | Confirmed changes persist after refresh; location does not change when the edit form says assignment is managed separately. |
| AST-011 | P1 | Cancel registration and editing after entering values. | No record or partial update is saved. |
| AST-012 | P1 | Export the full registry and a filtered registry. | CSV columns and rows match the visible/export scope, preserve punctuation, and open without corrupted values. |

### 9.4A Consumables receiving

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| CON-001 | P0 | Record a valid RAM, SSD, and Other receipt. | Each receipt persists with the correct item, specification, quantity, unit, supplier, reference, date, receiver, and notes. |
| CON-002 | P0 | Inspect Assignments, maps, rooms, assets, and QR lookup after recording consumables. | Consumables never appear as assignable assets and receive no asset tag, QR ID, floor, room, office, or department. |
| CON-003 | P0 | Submit zero, negative, fractional, blank, or malformed quantities. | Submission is blocked and a positive whole-number message is shown. |
| CON-004 | P1 | Search and filter receipt history by category and receiving information. | Only matching receipt records appear and filters do not affect assignable assets. |
| CON-005 | P1 | Export all and filtered receipt history. | CSV rows match the visible scope and preserve punctuation safely. |
| CON-006 | P0 | Force a database or permission failure while saving. | No success appears, entered data remains available, and no local-only receipt is created. |
| CON-007 | P1 | Compare metrics with receipt history. | Total units, current-month units, RAM units, and storage units are calculated from recorded receipts. |

### 9.5 Assignments page

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| ASN-001 | P0 | Open Assignments with several assigned and unassigned assets. | Only genuinely unassigned assets appear in the queue and selector. |
| ASN-002 | P0 | Select an asset, then select a floor. | The room/office control appears only after floor selection. |
| ASN-003 | P0 | Inspect the room list for every floor. | Only rooms belonging to the selected floor appear and approved room names are used. |
| ASN-004 | P0 | Assign an asset through the page. | A progress state is shown, success appears only after persistence, and the asset leaves the queue. |
| ASN-005 | P0 | Refresh after assignment and inspect Live Mapping. | The asset remains assigned and appears in the exact selected room. |
| ASN-006 | P0 | Enter Assignments from a room-specific action. | Floor and room are preselected correctly and cannot silently point to another room. |
| ASN-007 | P1 | Change the floor after choosing a room. | The old room selection is cleared and a room from the new floor is required. |
| ASN-008 | P1 | Use Clear while a selection and message are present. | Floor, room, validation, success, and error state reset consistently. |
| ASN-009 | P0 | Force a database error during assignment. | The asset remains in the queue and an actionable error replaces any loading state. |
| ASN-010 | P1 | Test when the unassigned queue is empty. | A clear completion state appears and no invalid form is submitted. |

### 9.6 QR identification

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| QR-001 | P0 | Scan a valid LiveINV QR label. | Exactly one matching asset opens with correct details and location. |
| QR-002 | P0 | Enter a valid asset tag and valid QR fallback ID manually. | Both methods identify the same correct asset. |
| QR-003 | P1 | Enter unknown, blank, malformed, and whitespace-padded values. | Input is safely normalized where intended and clear “not found” or validation feedback appears. |
| QR-004 | P1 | Deny camera access. | The app explains the problem and preserves manual identification as a usable fallback. |
| QR-005 | P1 | Start and stop scanning repeatedly, then leave the page. | Camera resources are released and duplicate scanner sessions are not created. |
| QR-006 | P1 | Scan in low light and scan the same code repeatedly. | The UI remains stable and does not create repeated updates or stacked dialogs. |

### 9.7 Network, maintenance, reports, users, and manual

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| MOD-001 | P1 | Compare Network Registry entries with inventory categories and IP data. | Included assets and displayed network values follow the documented rule. |
| MOD-002 | P1 | Compare Maintenance counts/lists with asset statuses. | Maintenance, broken, inactive, and active assets are grouped or excluded consistently. |
| MOD-003 | P0 | Compare report totals and breakdowns with the Asset Registry. | Reports use the same records and definitions; all totals reconcile. |
| MOD-004 | P1 | Print/export reports where provided. | Output is complete, readable, and identifies the report date/scope. |
| MOD-005 | P0 | Attempt restricted actions with each user role. | Each role can perform only approved actions; direct page access does not bypass restrictions. |
| MOD-006 | P0 | Sign out or expire a session, then attempt a saved page or database action. | Protected information/actions require authentication and do not remain accessible from stale UI. |
| MOD-007 | P2 | Follow the System Manual for registration, assignment, map use, and QR lookup. | Instructions accurately reproduce the current UI and successful workflow. |

## 10. Data integrity and Supabase tests

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| DB-001 | P0 | Refresh and reopen the app after every create/update/assignment operation. | Confirmed changes remain in Supabase and are reloaded correctly. |
| DB-002 | P0 | Change an asset location. | One accurate audit record contains the previous and new location with a reliable timestamp and actor when identity is available. |
| DB-003 | P0 | Attempt to modify assets and audit logs using an unauthorized/anonymous session. | RLS denies every operation not explicitly allowed by the approved access model. |
| DB-004 | P0 | Submit simultaneous assignments for the same asset from two sessions. | The final state is deterministic, conflicts are surfaced, and the audit trail remains explainable. |
| DB-005 | P1 | Disconnect during an update, reconnect, and reload. | Local UI and Supabase do not silently diverge; pending/local fallback state is clearly identified and reconciled. |
| DB-006 | P1 | Verify uniqueness and required constraints through the UI and direct staging requests. | Invalid rows, duplicate tags, and duplicate QR IDs cannot be stored. |
| DB-007 | P1 | Review migration application on a clean staging project. | The schema, trigger, policies, seed behavior, and application queries work from a repeatable setup. |
| DB-008 | P1 | Inspect database/API errors shown to the browser. | Sensitive keys, SQL details, internal stack traces, and other users’ data are not exposed. |

## 11. UX, accessibility, and responsive checks

| ID | Pri. | Check | Acceptance expectation |
|---|---:|---|---|
| UX-001 | P1 | Complete registration, page assignment, and map assignment without guidance. | A representative staff member can finish each core task without getting lost. |
| UX-002 | P1 | Review every loading, empty, success, warning, and error state. | Messages explain what happened and what the user can do next. |
| UX-003 | P1 | Use keyboard only across navigation, forms, floor directory, and dialogs. | All actions are reachable; focus is visible and follows a logical order. |
| UX-004 | P1 | Open and close every dialog with keyboard and pointer. | Focus is trapped appropriately, Escape behavior is consistent, and focus returns after closing. |
| UX-005 | P1 | Inspect labels, error associations, headings, landmarks, and accessible names. | Controls have meaningful names and assistive technology can understand form errors and dialogs. |
| UX-006 | P1 | Check text and interactive-state color contrast. | Contrast meets WCAG 2.1 AA for normal text, large text, and necessary controls. |
| UX-007 | P1 | Test at 200% zoom and narrow widths. | Content reflows without losing controls, text, room access, or horizontal context. |
| UX-008 | P1 | Test touch targets and map gestures on mobile. | Important targets are comfortably tappable and page scrolling does not fight map interaction. |
| UX-009 | P2 | Review wording and capitalization across room names, statuses, buttons, and messages. | Terms are consistent, concise, and understandable to hospital staff. |
| UX-010 | P2 | Measure time and clicks for common tasks. | Finding an asset, opening a room, and assigning a device require no unnecessary detours. |

## 12. Performance and reliability checks

| ID | Pri. | Test | Expected result |
|---|---:|---|---|
| PERF-001 | P1 | Measure first load on a mid-range phone and throttled network. | An agreed performance budget is met and useful loading feedback appears. |
| PERF-002 | P1 | Load a production-like asset count and open/search/filter repeatedly. | The UI remains responsive and results remain correct. |
| PERF-003 | P1 | Switch floors and open large floor SVGs repeatedly. | Maps do not visibly leak memory, refetch unnecessarily, or become sluggish. |
| PERF-004 | P2 | Inspect built JavaScript and image/SVG payloads. | Avoidable large assets and chunks are identified, cached correctly, and optimized before release. |
| PERF-005 | P1 | Leave the app open, background it, then resume. | Data refresh and camera/map behavior recover without a forced reload. |

## 13. Security checks

- Confirm that Supabase URL/client configuration contains no service-role secret in the browser bundle.
- Replace prototype-wide anonymous read/write policies with authenticated, least-privilege RLS before public deployment.
- Verify server-side authorization for every create/update action; hiding a button is not authorization.
- Ensure audit logs cannot be forged, altered, or deleted by ordinary clients.
- Validate and encode all user-controlled values, exports, search input, asset fields, and displayed database content.
- Review dependency vulnerabilities and lock dependency versions for reproducible releases.
- Define session expiry, logout, password/account recovery, and inactive-user handling.
- Confirm HTTPS, secure hosting headers, backup/restore procedures, and secrets management.

## 14. Automated test strategy

The repository currently contains four unit tests: three registration-schema cases and one initial loading-state case. This is a useful start but does not cover the critical end-to-end workflows.

Recommended automation layers:

1. **Unit tests:** registration and assignment schemas, asset/location parsing, floor/room exact matching, category totals, filters, CSV escaping, and repository error/fallback behavior.
2. **Component tests:** registration form, floor-first room selector, room popup, success/error/loading states, QR manual search, and empty queues.
3. **Repository integration tests:** Supabase mapping, insert/update failures, audit trigger behavior, local override reconciliation, and RLS expectations against a test project.
4. **Playwright end-to-end tests:** application smoke test, register asset, assign from page, assign from floor-map popup, reload persistence, search asset, QR fallback lookup, and permission denial.
5. **Continuous integration:** install from lockfile, type-check/build, unit/component tests, end-to-end smoke tests, and artifact/report upload on every pull request.

No automated test should depend on production data or a friend’s personal Supabase session.

## 15. Preliminary risks found during document preparation

These are code/configuration observations, not completed QA verdicts:

| Risk | Initial severity | Required follow-up |
|---|---:|---|
| The initial migration permits anonymous asset reads/inserts/updates for a prototype. | Critical before public release | Define authentication/roles and replace broad RLS policies. |
| The UI exposes a Users & Roles area, but the production access model must be proven end to end. | Critical | Test real identities and server-enforced permissions. |
| Confirmed operations can use a browser-local fallback when a particular audit permission error occurs. | High | Make offline/local status visible and define reconciliation or remove fallback for production. |
| Automated coverage is currently limited to four unit tests. | High | Add critical component, integration, and end-to-end coverage. |
| The application uses several `latest` dependency ranges. | Medium | Pin reviewed versions and use the lockfile in deployment. |
| The current production build has previously reported a large JavaScript chunk and large visual assets. | Medium | Establish and measure a performance budget. |
| Floor and room identity is represented in both application data and SVG content. | High | Add a consistency test so assignments never target a similarly named or stale room. |

## 16. Defect severity and release policy

| Severity | Definition | Example | Release rule |
|---|---|---|---|
| Critical | Security breach, data corruption/loss, system unusable, or assignment to the wrong room without detection | Unauthorized update; false successful assignment; wrong-room persistence | Must be fixed and retested before release |
| High | Core workflow unavailable or seriously misleading with no practical workaround | Map rooms do not open; registration fails; data disappears after refresh | Must be fixed before release |
| Medium | Important problem with a reasonable workaround | Filter error, confusing validation, layout clipping on one supported size | Fix or formally accept with owner/date |
| Low | Cosmetic or minor wording issue | Small spacing inconsistency | May be scheduled after release |

Regression testing is mandatory for the affected workflow and its connected modules after every Critical or High fix.

## 17. Defect report template

```text
Defect ID:
Title:
Severity / Priority:
Environment and browser:
Build / commit:
Account or role:
Preconditions and test data:
Steps to reproduce:
Expected result:
Actual result:
Reproduction rate:
Evidence (screenshot/video/log):
Database state before/after:
Related test case:
Owner:
Fix commit:
Retest result and date:
```

Do not include passwords, private keys, medical/patient data, or full production records in defect evidence.

## 18. Test execution record

Use one row per test/environment combination.

| Test ID | Environment | Status | Defect ID | Evidence | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| Example: ROOM-003 | Chrome / Desktop / Staging | Not Run | — | — | — | — | — |

## 19. Exit and release criteria

LiveINV is ready for a controlled production release only when:

- All P0 tests pass on the release candidate.
- At least 95% of applicable P1 tests pass, with no unresolved Critical or High defects.
- Authentication and least-privilege Supabase RLS are implemented and security-reviewed.
- Registration, both assignment paths, reload persistence, floor-map selection, and QR fallback lookup pass end to end.
- Dashboard, room popup, registry, assignments, and reports reconcile against the same staging data.
- The production build, automated suite, and supported-browser smoke suite pass from a clean checkout.
- Backup and restore are tested, monitoring/error reporting is active, and a rollback procedure exists.
- A hospital representative approves floor names/room names and completes user acceptance testing.
- The release owner signs the QA summary and accepts any remaining Medium or Low risks.

## 20. Recommended execution order

1. Prepare staging, roles, migrations, and QA data.
2. Run build/unit checks and the P0 smoke suite.
3. Execute core asset registration and editing.
4. Execute assignment persistence from both the Assignments page and every floor-map path.
5. Reconcile data across all modules and audit logs.
6. Execute QR, failure, permission, accessibility, responsive, and cross-browser tests.
7. Run regression after fixes.
8. Produce a final QA summary containing pass rate, open defects, evidence, risks, and release recommendation.

---

**Approval placeholders**

| Role | Name | Decision | Date |
|---|---|---|---|
| QA tester |  |  |  |
| Developer |  |  |  |
| System owner |  |  |  |
| Hospital representative / UAT approver |  |  |  |
