# LiveINV

LiveINV is a visual hospital inventory tracking system designed for Tagum Global Medical Center. It combines a 3D hospital live mapping, interactive floor maps, room-level equipment views, QR-based identification, and a searchable asset registry.

## Features

- Interactive seven-floor 3D hospital live mapping
- Floor maps with room and equipment interactions
- Searchable and filterable asset registry
- Full device records with category-specific equipment previews
- Device registration with permanent QR fallback IDs
- QR scanning and manual asset identification
- Separate workflow for assigning devices to floors, departments, and rooms
- Realtime assignment updates across the live map, dashboard, registry, QR lookup, network view, and reports
- Consumable receiving records with RAM/SSD stock deductions, returns, and usage history linked to system units
- Inventory reports and a built-in system manual

## Technology

- React
- TypeScript
- Vite
- React Three Fiber and Three.js
- Radix UI
- ZXing QR scanner
- QRCode
- Supabase database and Realtime

## Run locally

1. Install [Node.js](https://nodejs.org/).
2. Install the project dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local address displayed in the terminal, normally `http://localhost:5173/`.

## Backend setup

1. Create a Supabase project and add its URL and anon key to `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Apply the inventory migrations, then follow [Admin login setup](docs/admin-login-setup.md) to create the admin account and apply the admin access migration. That migration requires the account to exist first.
3. Apply [RAM and SSD stock setup](supabase/CONSUMABLE-STOCK-SETUP.md) to enable stock selection in system unit forms.
4. Start the app and sign in. Device registration, editing, assignment, consumable receipts, and live assignment refreshes use the configured project.

The assignment migration keeps the legacy `location` and `owner` values synchronized while adding structured floor, room, department, time, user, and method fields. This lets existing reports remain compatible while Live Mapping uses stable assignment data.

## Keeping assets and floor maps consistent

Live Mapping and Assignments share `src/lib/room-catalog.json`. Each room points to a physical SVG shape and has a unique ID, including rooms with identical names. Unique legacy room names and previous map IDs remain compatible; ambiguous locations appear in the floor's “needs an exact room” list for correction.

After editing a floor-plan SVG, run `node scripts/generate-room-catalog.mjs` and review the catalog changes. The unit tests check that the catalog matches all seven SVGs. The generator and browser check use Playwright Chromium; set `PLAYWRIGHT_CHANNEL=msedge` or `chrome` to use an installed browser instead.

Run `npm run test:unit` and `npm run build` for validation. With the development server running, `node scripts/check-live-mapping.mjs` checks room resolution, saving, reload, map highlighting, and duplicate room names against an intercepted database, without writing to live inventory.

Shared inventory failures are shown explicitly. Sample records and earlier browser-only drafts do not replace database records, and an assignment cannot report success if its stable room ID was not saved. Earlier local drafts remain in browser storage for recovery and trigger a visible notice.

## Production build

```bash
npm run build
```

The login screen protects all app modules. Supabase access rules must also be applied before production use; see [Admin login setup](docs/admin-login-setup.md). A failed connection shows an error instead of sample inventory.

