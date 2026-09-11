# Mobile responsiveness verification

Verified locally on 11 September 2026. Changes are in the working tree; no deployment was performed.

## Changes

- Added the missing mobile viewport declaration, including support for display safe areas.
- Added a navigation drawer at widths up to 1024px. All nine destinations and Sign out remain accessible. The drawer supports keyboard focus containment, Escape, outside dismissal, and closing when resized to desktop.
- Reworked shared phone and tablet layouts, touch targets, forms, filters, cards, reports, and dialog scrolling. Small-screen inputs use 16px text to avoid automatic focus zoom on iOS.
- Kept wide registry data inside horizontally scrollable containers rather than hiding columns.
- Adapted floor controls, room equipment panels, QR results, and registration confirmation. The QR confirmation resets to the top after saving.
- Loaded responsive overrides after module styles so their breakpoints apply consistently.

## Coverage

The browser regression uses intercepted test data and mock authentication. It does not change hospital inventory.

| Area | Checked states |
| --- | --- |
| Sign in and navigation | Phone viewport, all destinations, drawer focus, Escape, outside dismissal, resize, Sign out |
| Dashboard | Metrics, equipment health, activity, long equipment names |
| Assets | Grid, registration fields and footer, generated QR and label actions, full record, edit dialog |
| Consumables | Stock overview, receipt form and footer |
| Assignments | Destination selection, assigned equipment, unassign confirmation and cancellation |
| PMS | History, session details, expanded record, completion confirmation, new-session form |
| QR Scanner | Manual lookup and populated device result |
| Reports and Manual | Full page layouts; existing report export regression |
| Live Mapping | All seven floor maps and directories, room equipment, nested full device record |

Phone/tablet/desktop checks cover 320, 390, 480, 620, 768, 820, 1024, 1280, and 1440px widths. The expanded workflow regression covers 320, 390, 768, 820, 1024, 1280, and 1440px, plus 844 × 390 landscape. It asserts the actual viewport width, absence of page-wide horizontal overflow and browser errors, and dialog containment. Form and QR footers are scrolled into view and checked for reachability.

Screenshots were reviewed at representative phone, tablet, and desktop sizes. These checks use Chromium through Microsoft Edge on Windows. Physical iPhone/Safari behavior, the on-screen keyboard, and camera scanning hardware were not exercised.

## Reproduce

Start the app with `npm run dev`, then run in a second PowerShell terminal:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node scripts/check-responsive.mjs
```

The script defaults to 320, 390, 768, 1024, 1280, and 1440px. Set `MOBILE_WIDTHS` to a comma-separated list and `MOBILE_HEIGHT` to override height. `TEST_BASE_URL` defaults to `http://127.0.0.1:5173`.

Screenshots and layout results are written to the ignored `.tmp/responsive/` directory. The production build, 94 unit tests, button/export regression, and existing live-mapping regression passed. The build still reports its existing large JavaScript bundle warning.
