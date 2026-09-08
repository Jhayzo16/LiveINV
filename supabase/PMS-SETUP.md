# PMS setup

The application uses the existing Supabase project and admin account. No new environment variables are needed.

1. Open the hospital inventory project in Supabase.
2. Open **SQL Editor**, then create a new query.
3. Copy the complete contents of `migrations/20260907010000_create_pms.sql` into the query and select **Run**. The existing admin-login migration must already be installed.
4. Refresh the website and select **PMS**.

The script creates two tables and three protected database functions. It does not modify existing assets or their locations. The script is transactional and can be run again safely.

## Using PMS

Choose **New PMS session**, select the maintenance date and service type, enter the technician or team name, and start the session. Dates are calendar dates; the actual recording timestamp is stored separately.

After service or cleaning is finished, select **Scan asset QR**. One successful camera scan automatically records the asset as maintained for the open session. Select **Scan asset QR** again for the next asset. A handheld scanner can enter a code in the **QR number or asset tag** field; submitting that field records code entry as the method. Manual entry is also supported.

Only existing registered assets are accepted. A repeat scan in the same session returns the original record without adding another count. A different session can record later work on the same asset. The asset's operating status and room assignment are unchanged.

Use **Session history** to resume an open session or review completed work. **Complete session** locks that session against further additions. Records retain the asset identity and location at service time, even if the inventory record is later renamed or moved.

Select **View session details** on a session to see its maintenance date, technician, notes, creation and completion times, and all assets maintained during that session. Search the maintained assets by asset tag, QR number, or room. Select **View record** beside an asset to expand its saved identity, location, department, service, and recording details.

All existing allowlisted administrators can use PMS. The database records the authenticated account that created the session, recorded each asset, and completed the session. Direct browser writes to the history tables are blocked; validated database functions perform these actions.

## Verification

- `npm run test:unit`: database authorization, deduplication, snapshot integrity, completion, camera lifecycle, and existing app tests.
- `node scripts/check-pms.mjs`: browser workflow against a disposable PostgreSQL database; no live data is changed. Set `PLAYWRIGHT_CHANNEL=msedge` on machines using installed Edge.
- A physical camera scan should also be checked on the hospital's chosen device after setup.

Reference: [Supabase database function security](https://supabase.com/docs/guides/database/functions).
