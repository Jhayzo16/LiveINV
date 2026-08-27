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
- Inventory reports and a built-in system manual

## Technology

- React
- TypeScript
- Vite
- React Three Fiber and Three.js
- Radix UI
- ZXing QR scanner
- QRCode

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

## Production build

```bash
npm run build
```

The current project is a front-end prototype. Demo inventory records are stored in the browser's local storage.

