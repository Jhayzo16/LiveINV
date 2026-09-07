-- Store a device's current hospital assignment as structured data. The legacy
-- location and owner columns remain synchronized for existing screens/reports.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS assignment_floor_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS assignment_department_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assignment_room_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assignment_room_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(20);

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_assignment_method_check;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_assignment_method_check
  CHECK (assignment_method IS NULL OR assignment_method IN ('manual', 'qr'));

-- Backfill records that were assigned before structured assignment data existed.
UPDATE public.assets
SET assignment_floor_id = (regexp_match(location, '^F([1-7])\s*[·|-]\s*(.+)$', 'i'))[1],
    assignment_room_name = (regexp_match(location, '^F([1-7])\s*[·|-]\s*(.+)$', 'i'))[2],
    assignment_room_id = 'legacy-' || lower(regexp_replace((regexp_match(location, '^F([1-7])\s*[·|-]\s*(.+)$', 'i'))[2], '[^a-zA-Z0-9]+', '-', 'g')),
    assignment_department_id = owner,
    assigned_at = COALESCE(updated_at, created_at, NOW()),
    assigned_by = 'Migration',
    assignment_method = 'manual'
WHERE location <> 'Unassigned'
  AND owner <> 'Unassigned'
  AND location ~* '^F([1-7])\s*[·|-]\s*(.+)$'
  AND assignment_floor_id IS NULL;

CREATE INDEX IF NOT EXISTS assets_assignment_floor_room_idx
  ON public.assets (assignment_floor_id, assignment_room_id)
  WHERE assignment_floor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_asset_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.location = 'Unassigned' OR NEW.owner = 'Unassigned' THEN
    NEW.location := 'Unassigned';
    NEW.owner := 'Unassigned';
    NEW.assignment_floor_id := NULL;
    NEW.assignment_department_id := NULL;
    NEW.assignment_room_id := NULL;
    NEW.assignment_room_name := NULL;
    NEW.assigned_at := NULL;
    NEW.assigned_by := NULL;
    NEW.assignment_method := NULL;
    RETURN NEW;
  END IF;

  -- Continue accepting older clients that only send location and owner while
  -- deriving the structured fields they did not know about.
  IF (NEW.assignment_floor_id IS NULL OR NEW.assignment_room_name IS NULL)
     AND NEW.location ~* '^F([1-7])\s*[·|-]\s*(.+)$' THEN
    NEW.assignment_floor_id := (regexp_match(NEW.location, '^F([1-7])\s*[·|-]\s*(.+)$', 'i'))[1];
    NEW.assignment_room_name := (regexp_match(NEW.location, '^F([1-7])\s*[·|-]\s*(.+)$', 'i'))[2];
  END IF;
  NEW.assignment_room_id := COALESCE(
    NEW.assignment_room_id,
    'legacy-' || lower(regexp_replace(NEW.assignment_room_name, '[^a-zA-Z0-9]+', '-', 'g'))
  );
  NEW.assignment_department_id := COALESCE(NEW.assignment_department_id, NEW.owner);

  IF NEW.assignment_floor_id IS NULL OR NEW.assignment_department_id IS NULL
     OR NEW.assignment_room_id IS NULL OR NEW.assignment_room_name IS NULL THEN
    RAISE EXCEPTION 'Assigned assets require floor, department, room id, and room name';
  END IF;

  NEW.location := 'F' || NEW.assignment_floor_id || ' · ' || NEW.assignment_room_name;
  NEW.owner := NEW.assignment_department_id;
  NEW.assigned_at := COALESCE(NEW.assigned_at, NOW());
  NEW.assigned_by := COALESCE(NULLIF(NEW.assigned_by, ''), 'Admin');
  NEW.assignment_method := COALESCE(NEW.assignment_method, 'manual');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_asset_assignment ON public.assets;
CREATE TRIGGER validate_asset_assignment
  BEFORE INSERT OR UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_asset_assignment();

-- Supabase Realtime needs a full row identity for reliable update payloads.
ALTER TABLE public.assets REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'assets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
  END IF;
END $$;
