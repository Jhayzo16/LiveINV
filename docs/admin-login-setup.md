# Admin login setup

The app requires a Supabase email/password session and an entry in `public.admin_users`. There is no public sign-up screen. Inventory queries and Realtime subscriptions start only after admin access is verified. Signing out unmounts the app and clears its query cache.

## One-time setup for the existing project

1. Open the Supabase project used by `VITE_SUPABASE_URL`.
2. Go to **Authentication → Users → Add user → Create new user**.
3. Use **tgmcimis@gmail.com**, choose a strong password privately, and enable **Auto Confirm User** if available. If this account already exists, use it instead of creating a duplicate. Passwords belong in Supabase Authentication, never in source code or Vercel environment variables.
4. In **SQL Editor**, run `supabase/migrations/20260907000000_require_admin_login.sql`. Earlier migrations must already be applied. This migration enrolls that account as an admin, removes anonymous inventory access, and prevents other signed-in users from accessing inventory or adding themselves as admins. It aborts without changing access if the admin account does not exist yet.
5. For this admin-only app, disable **Allow new users to sign up** in the Supabase Auth settings. Admin accounts can still be created through the dashboard. Do not disable email/password sign-in.
6. Test locally: sign in, open the Dashboard, inspect an asset, refresh the browser, and sign out. Try an incorrect password and confirm that it does not reveal inventory.
7. Push this code to GitHub to trigger the Vercel deployment. Keep the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; no new frontend secrets are needed.

Applying the migration immediately blocks anonymous requests, including those from the old deployed app. Publish the login build promptly after setup. The existing asset records are preserved.

## Verification

Run `npm run test:unit` and `npm run build`. Auth tests cover valid/invalid login, session restoration, unauthorized accounts, access-check failures, logout, and stale asynchronous responses. The browser checks intercept Auth and data requests and never create real users or modify real inventory.

For the live deployment, confirm that requests to `assets`, `consumable_receipts`, and `audit_logs` using only the public anon key are rejected. An authenticated account absent from `admin_users` must receive no rows and be unable to insert or update records. An approved admin should retain the existing inventory workflows.

To reset a forgotten password, manage the account in Supabase Authentication. No password-reset email flow is exposed by this initial login screen.
