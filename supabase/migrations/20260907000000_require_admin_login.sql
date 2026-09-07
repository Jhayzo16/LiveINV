-- Run after creating the admin in Supabase Authentication > Users.
-- The preflight prevents accidentally locking everyone out before provisioning.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'tgmcimis@gmail.com') THEN
    RAISE EXCEPTION 'Create tgmcimis@gmail.com in Authentication > Users first, then run this migration again.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

DROP POLICY IF EXISTS "Admins can check their own access" ON public.admin_users;
CREATE POLICY "Admins can check their own access" ON public.admin_users
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

INSERT INTO public.admin_users (user_id)
  SELECT id FROM auth.users WHERE lower(email) = 'tgmcimis@gmail.com'
  ON CONFLICT (user_id) DO NOTHING;

-- Replace all prototype policies: permissive policies combine with OR, so
-- leaving even one anonymous policy behind would bypass the admin requirement.
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('assets', 'consumable_receipts', 'audit_logs')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END $$;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.assets, public.consumable_receipts, public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assets TO authenticated;
GRANT SELECT, INSERT ON public.consumable_receipts TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

CREATE POLICY "Admin asset reads" ON public.assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Admin asset registration" ON public.assets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Admin asset updates" ON public.assets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Admin receipt reads" ON public.consumable_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Admin receipt registration" ON public.consumable_receipts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "Admin audit reads" ON public.audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));

-- Audit identity comes from the authenticated database session, not browser input.
CREATE OR REPLACE FUNCTION public.log_asset_location_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.location IS DISTINCT FROM NEW.location THEN
    INSERT INTO public.audit_logs (asset_id, action, previous_location, new_location, performed_by)
    VALUES (NEW.id, 'LOCATION_UPDATE', OLD.location, NEW.location, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
