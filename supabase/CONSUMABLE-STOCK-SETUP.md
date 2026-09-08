# RAM and SSD stock setup

Apply `migrations/20260908010000_link_system_unit_consumables.sql` in the existing project's Supabase SQL Editor before deploying this feature. The asset, consumable receipts, and admin login migrations must already be installed. This migration is transactional and safe to rerun. No additional frontend environment variables are needed.

## Using linked stock

1. In Consumables, record RAM or SSD receipts in **pieces**. Enter capacity per piece in GB to automatically fill the matching specification in the asset form. For older receipts without a numeric capacity, check the specification and enter the capacity in the asset form.
2. Add or edit a System Unit. In Memory and storage, choose the RAM and/or SSD from Consumables and enter the installed quantity beside each selection. Capacity and total GB are shown automatically; a capacity input appears only for receipts without a saved capacity. Each type uses one receipt source, matching the existing per-module/per-drive capacity fields.
3. Save. The asset and stock deduction commit together. If either receipt lacks enough stock, neither is changed and the form remains open with the error.
4. Subsequent edits deduct only the increase. Replacing a source deducts the replacement quantity. Reducing, unlinking, or replacing installed parts requires a choice: return usable parts to available stock, or leave them counted as used/discarded. Setting the installed count to zero removes that stock link.
5. Consumables shows received quantity, used/installed quantity, remaining availability, and usage history including the asset tag, item, action, quantity, and timestamp.

Existing system units remain unlinked and do not consume stock automatically. Keep **Keep existing installed parts** for preinstalled parts that were never received into this stock. Linking an existing device consumes its full entered installed quantity, so do not link historical equipment to an unrelated receipt.

Original receiving quantities are retained. Available = received minus used/installed. Discarded parts stay counted as used; returned usable parts increase availability. Each movement records the authenticated administrator. Stock counters and history cannot be directly edited by browser clients. Receipt row locks prevent over-allocation; a version check rejects stale component edits.

## Verification

- `npm run test:unit` checks deduction, rollback, returns, discards, stale edits, permissions, preserved historical parts, and existing app behavior.
- `npm run build` checks the production bundle.
- Start the local development server, then run `node scripts/check-consumable-stock.mjs`. Set `PLAYWRIGHT_CHANNEL=msedge` if needed. This tests receiving, failed and successful registration, edits, persisted stock history, and mobile layout against a disposable PostgreSQL database; it does not touch live inventory.
