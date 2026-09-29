# LiveINV Mobile

React Native + Expo companion to the existing LiveINV web system. This is a native application, with React Native screens and native camera/SVG rendering. It does not embed the website in a WebView.

## Run on your phone

From the repository root:

```powershell
cd mobile
npm ci
node scripts/setup-env.mjs
npm start
```

Install Expo Go matching SDK 57, connect your phone and computer to the same network, and open the Expo QR code. The QR code in the development terminal opens the app; equipment QR codes are scanned inside the app. If the network blocks local connections, try `npx expo start --tunnel` (Expo may ask to install its tunnel helper).

The setup script copies only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the web app's local `.env` into the corresponding `EXPO_PUBLIC_` variables. It never overwrites an existing mobile configuration or prints values. Alternatively, copy `.env.example` to `.env` and enter those public values. Never put a Supabase service-role key in a mobile app. Restart Expo after configuration changes.

Sign in with an existing approved LiveINV admin account. Existing database migrations and admin access rules must already be applied; see [admin setup](../docs/admin-login-setup.md). The mobile app uses the same live database as the web app. Saving a mobile update changes the shared inventory once synchronization succeeds. No new database migration is needed for this version.

## Included workflows

### Browser preview

From `mobile`, run `npm run web` (or `npx expo start --web --clear` after installing dependencies). This previews the Expo app in a browser. The original desktop website is separate: run `npm run dev` from the repository root.

The browser preview uses tab-session storage for login and cached data; Android/iOS continue to use encrypted SQLite with SecureStore. Browser storage does not provide the native encryption guarantee. Signing out clears this app's account cache. Closing the browser tab ends the preview session. Use a phone for final camera and QR-label sharing/printing checks.

- Website branding: original LiveINV logo, maroon/green theme, Montserrat headings, and Plus Jakarta Sans text. Dashboard metrics, asset health ring, floor distribution, and attention/recent equipment cards.
- Native interactive 3D hospital topology using the website model, drag rotation, zoom, and highlighted floor selection; drill down into all seven original SVG floor plans and room equipment lists. The 3D canvas unmounts when leaving its tab, renders on demand, and offers a floor-plan fallback if rendering fails.
- Native camera QR scanning and manual lookup, compatible with `liveinv:qr:` and legacy `liveinv:asset:` labels.
- Illustrated equipment cards and detail images using the original seven category illustrations, with category/status/search filters, specifications, location, department, and IP address.
- Condition and IPv4 updates, plus exact room assignments using the existing stable room IDs.
- Existing permanent QR labels, with PDF label sharing/printing through the phone's system sheet.
- Encrypted local inventory and pending updates, a sync queue, conflict review, and automatic sync when the open app reconnects or resumes.
- Existing admin login and database authorization.
- Add device from Assets: category, unique tag, brand/model, status, optional IPv4, and system-unit processor and consumable-backed RAM/SSD. Saving creates the shared unassigned asset and a permanent QR label; open its record to assign a room or share/print the label.

The web app continues to handle stock receiving, changes to installed RAM/SSD on existing devices, PMS sessions, reports, the manual, and network topology views. Those separate modules have not been ported to native screens in this version.

New device registration requires internet and fresh admin verification. RAM/SSD receipts come from the existing consumables inventory; the `20260908010000_link_system_unit_consumables.sql` migration must already be applied for stock linking. The database deducts stock atomically with the asset insert. Registrations are not queued offline. If a response is lost, retry the same save to check its fixed device ID before inserting again. Leave uncertain registration details unchanged until confirmed; if the app closes, refresh inventory and check the tag before registering it again.

## Offline behavior

First sign-in and first inventory download require internet. After server-side access verification, the app can reopen offline for up to eight hours, including when its short-lived access token needs renewal. After that, reconnect and select **Retry saved session**. This is a bounded offline authorization window; remote access revocation cannot be detected while disconnected. A detected revocation immediately invalidates the saved offline grant.

SQLite stores encrypted payloads using AES-256-GCM with a fresh random nonce for every write. The key resides in Expo SecureStore; record keys are authenticated as additional data. Auth sessions, cached inventory, offline identity, and pending changes use this storage. Android app backup is disabled. The SQLite file's record keys and metadata are not encrypted. This is application-level encryption, not SQLCipher, so it works with Expo Go's bundled modules.

Pending changes remain visibly separate from confirmed server records. Each change records the original asset's `updated_at`. Synchronization updates only changed fields and only when that timestamp still matches. A different server version becomes a conflict; it is never silently overwritten. A retry can recognize a previously successful write whose response was lost. Discard a conflicting pending change, refresh, and review the latest asset before editing again. Only one pending change per asset is allowed.

Sync runs while the app is open, on reconnect/resume, or when requested. There is no background sync when the app is terminated. Sign-out asks before discarding cached inventory and unsynced changes. Do not uninstall the app or clear its storage while changes are pending.

## Build an Android APK

```powershell
cd mobile
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

This requires your Expo account, an EAS project, and Android signing setup. Configure the two `EXPO_PUBLIC_SUPABASE_*` variables in the EAS build environment; the ignored local `.env` should not be relied on for cloud builds. The preview profile creates an installable APK. The production profile creates an Android App Bundle. No cloud build, signing, store submission, or production deployment was performed during implementation.

## Keep room maps consistent

Generated shared files are checked in so the mobile app can be built independently. After changing the web room catalog, assignment rules, SVG floor maps, hospital model, or design artwork, install the root project's dependencies and run:

```powershell
cd mobile
npm run prepare:shared
```

Do not manually edit `src/shared/`. The generator copies the website's pure TypeScript models and room rules and creates native SVG hit areas from the original floor plans. The design generator also copies original equipment artwork and extracts hospital geometry into a native adapter. Tests check generated room file parity and every room's hit area.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run export:android
npx expo-doctor
```

Tests cover encrypted payload tampering, account isolation, durable offline writes, access expiry/revocation, duplicate pending edits, conflict and retry handling, existing QR formats, and shared room identities. Android export validates the native JavaScript bundle; it does not produce an APK or prove camera, printing, or device behavior.

Verified on 28 September 2026: TypeScript and ESLint passed, 21 mobile tests passed, Expo Doctor passed all 21 checks, and Android export succeeded. The existing web app also passed its 108 tests and production build. No live inventory writes were used for verification.

Before a class demonstration, test with a dedicated approved test account/project: sign in, refresh, scan a printed label, select a room, save an assignment, reopen offline, queue a condition update, reconnect, and confirm it appears on the website. Also change the same asset in another session before syncing to verify conflict handling. Test sign-out with pending changes and denied camera permission. Physical-device and live-account testing remain required.


## Native design and 3D compatibility

The mobile UI reuses the website's original artwork and color/font choices. The building preserves the original geometry, with simpler native materials and touch controls. `three` is pinned to 0.185.1 because the 0.186 CommonJS entry calls Node-only `process.emitWarning`; Metro resolves all Three imports to a single instance. Keep this pin and resolver when updating dependencies until Android rendering has been rechecked. `NativeMaterial` initializes an otherwise unused shader member for Android GPU compatibility.

On 29 September 2026, the redesigned dashboard, header logo, 3D building, illustrated asset registry, and equipment detail image were visually checked in the Android emulator. The app still needs a physical-device check for camera, printing, performance, and a complete offline/live synchronization demonstration.

Final design-pass validation: TypeScript, ESLint, and 24 mobile tests pass, including new request-timeout and cancellation coverage. Backend requests are aborted after 15 seconds to prevent a stalled connection from keeping session restoration waiting indefinitely. After the emulator restart, its expired session returned to sign-in; final floor-selection/rotation interaction checks await sign-in. Rendering of the hospital and asset artwork was confirmed earlier in the same design pass.
