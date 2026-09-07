-- Requires the existing admin-login migration. Safe to run again.
BEGIN;

CREATE TABLE IF NOT EXISTS public.pms_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date DATE NOT NULL CHECK (service_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
  service_type TEXT NOT NULL CHECK (service_type IN ('Preventive maintenance', 'General cleaning')),
  technician TEXT NOT NULL CHECK (length(btrim(technician)) BETWEEN 1 AND 120),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  CHECK ((completed_at IS NULL) = (completed_by IS NULL))
);

CREATE TABLE IF NOT EXISTS public.pms_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.pms_sessions(id),
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  asset_tag TEXT NOT NULL,
  qr_id TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  department TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('qr', 'manual')),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, asset_id)
);
CREATE INDEX IF NOT EXISTS pms_sessions_date_idx ON public.pms_sessions(service_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS pms_records_asset_idx ON public.pms_records(asset_id, recorded_at DESC);

ALTER TABLE public.pms_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pms_sessions, public.pms_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pms_sessions, public.pms_records TO authenticated;
GRANT ALL ON public.pms_sessions, public.pms_records TO service_role;
DROP POLICY IF EXISTS "Admin PMS session reads" ON public.pms_sessions;
CREATE POLICY "Admin PMS session reads" ON public.pms_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Admin PMS record reads" ON public.pms_records;
CREATE POLICY "Admin PMS record reads" ON public.pms_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.create_pms_session(p_id UUID, p_date DATE, p_service TEXT, p_technician TEXT, p_notes TEXT DEFAULT '')
RETURNS public.pms_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.pms_sessions;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.pms_sessions (id, service_date, service_type, technician, notes, created_by)
    VALUES (p_id, p_date, p_service, btrim(p_technician), coalesce(btrim(p_notes), ''), auth.uid())
    ON CONFLICT (id) DO NOTHING;
  SELECT * INTO saved FROM public.pms_sessions WHERE id = p_id;
  IF saved.created_by IS DISTINCT FROM auth.uid() OR saved.service_date IS DISTINCT FROM p_date
    OR saved.service_type IS DISTINCT FROM p_service OR saved.technician IS DISTINCT FROM btrim(p_technician)
    OR saved.notes IS DISTINCT FROM coalesce(btrim(p_notes), '') THEN
    RAISE EXCEPTION 'This session request already exists with different details. Refresh and try again.';
  END IF;
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pms_asset(p_session_id UUID, p_code TEXT, p_method TEXT DEFAULT 'qr')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  session_row public.pms_sessions;
  asset_row public.assets;
  record_row public.pms_records;
  normalized TEXT := btrim(p_code);
  code_kind TEXT := 'either';
  matches INTEGER;
  matched_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('qr', 'manual') OR normalized IS NULL OR length(normalized) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'Enter a valid asset tag or QR number.';
  END IF;
  -- Serialize scans and completion for this session, including simultaneous staff scans.
  SELECT * INTO session_row FROM public.pms_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PMS session was not found.'; END IF;
  IF session_row.completed_at IS NOT NULL THEN RAISE EXCEPTION 'This PMS session is completed. Start a new session to record maintenance.'; END IF;
  IF normalized ~* '^liveinv:qr:' THEN
    code_kind := 'qr'; normalized := substr(normalized, 12);
  ELSIF normalized ~* '^liveinv:asset:' THEN
    code_kind := 'asset'; normalized := substr(normalized, 15);
  END IF;
  SELECT count(*), min(id::text)::uuid INTO matches, matched_id FROM public.assets
    WHERE (code_kind IN ('qr', 'either') AND lower(qr_id) = lower(normalized))
       OR (code_kind IN ('asset', 'either') AND lower(tag) = lower(normalized));
  IF matches = 0 THEN RAISE EXCEPTION 'No registered asset matches this code. Check the label and try again.'; END IF;
  IF matches > 1 THEN RAISE EXCEPTION 'This code matches more than one asset. Scan the full QR label instead.'; END IF;
  SELECT * INTO asset_row FROM public.assets WHERE id = matched_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The asset is no longer available.'; END IF;
  SELECT * INTO record_row FROM public.pms_records WHERE session_id = p_session_id AND asset_id = matched_id;
  IF FOUND THEN RETURN jsonb_build_object('record', to_jsonb(record_row), 'already_recorded', true); END IF;
  -- Preserve the identity and location at the time of service. Inventory stays unchanged.
  INSERT INTO public.pms_records (session_id, asset_id, asset_tag, qr_id, asset_name, category, location, department, method, recorded_by)
    VALUES (p_session_id, asset_row.id, asset_row.tag, asset_row.qr_id, asset_row.name, asset_row.category,
      coalesce(asset_row.location, 'Unassigned'), coalesce(asset_row.owner, 'Unassigned'), p_method, auth.uid())
    RETURNING * INTO record_row;
  RETURN jsonb_build_object('record', to_jsonb(record_row), 'already_recorded', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_pms_session(p_session_id UUID)
RETURNS public.pms_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.pms_sessions;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access is required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO saved FROM public.pms_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PMS session was not found.'; END IF;
  IF saved.completed_at IS NOT NULL THEN RETURN saved; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pms_records WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'Record at least one maintained asset before completing this session.';
  END IF;
  UPDATE public.pms_sessions SET completed_at = now(), completed_by = auth.uid()
    WHERE id = p_session_id RETURNING * INTO saved;
  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pms_session(UUID, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_pms_asset(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_pms_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pms_session(UUID, DATE, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pms_asset(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_pms_session(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
