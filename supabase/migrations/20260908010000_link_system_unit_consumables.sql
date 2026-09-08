-- Link installed RAM/SSD to stock receipts. Asset writes and stock movements
-- commit together; receipt row locks prevent concurrent over-allocation.
BEGIN;
ALTER TABLE public.consumable_receipts
  ADD COLUMN IF NOT EXISTS used_quantity integer NOT NULL DEFAULT 0 CHECK (used_quantity >= 0 AND used_quantity <= quantity),
  ADD COLUMN IF NOT EXISTS capacity_gb integer CHECK (capacity_gb > 0);
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS ram_receipt_id uuid REFERENCES public.consumable_receipts(id),
  ADD COLUMN IF NOT EXISTS ssd_receipt_id uuid REFERENCES public.consumable_receipts(id),
  ADD COLUMN IF NOT EXISTS stock_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_ram_to_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_ssd_to_stock boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.consumable_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.consumable_receipts(id),
  asset_id uuid NOT NULL,
  asset_tag text NOT NULL,
  category text NOT NULL CHECK (category IN ('RAM', 'SSD')),
  action text NOT NULL CHECK (action IN ('Installed', 'Returned', 'Removed / used')),
  quantity integer NOT NULL CHECK (quantity > 0),
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consumable_movements_receipt_idx ON public.consumable_movements(receipt_id, created_at DESC);
ALTER TABLE public.consumable_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consumable_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.consumable_movements TO authenticated;
DROP POLICY IF EXISTS "Admin stock movement reads" ON public.consumable_movements;
CREATE POLICY "Admin stock movement reads" ON public.consumable_movements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())));
-- Users can receive stock, but cannot set or overwrite its usage counter.
REVOKE INSERT ON public.consumable_receipts FROM authenticated;
GRANT INSERT (category, item_name, brand, specification, quantity, unit, supplier,
  reference_number, date_received, received_by, notes, capacity_gb) ON public.consumable_receipts TO authenticated;

CREATE OR REPLACE FUNCTION public.track_system_unit_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  old_ids uuid[] := ARRAY[NULL::uuid, NULL::uuid];
  old_counts integer[] := ARRAY[0,0];
  new_ids uuid[] := ARRAY[NEW.ram_receipt_id, NEW.ssd_receipt_id];
  new_counts integer[] := ARRAY[NEW.ram_modules, NEW.ssd_count];
  capacities integer[] := ARRAY[NEW.ram_capacity_gb, NEW.ssd_capacity_gb];
  return_parts boolean[] := ARRAY[NEW.return_ram_to_stock, NEW.return_ssd_to_stock];
  categories text[] := ARRAY['RAM','SSD'];
  receipt public.consumable_receipts%ROWTYPE;
  added integer; removed integer; i integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_ids := ARRAY[OLD.ram_receipt_id, OLD.ssd_receipt_id];
    old_counts := ARRAY[OLD.ram_modules, OLD.ssd_count];
    IF (new_ids IS DISTINCT FROM old_ids OR new_counts IS DISTINCT FROM old_counts)
       AND (NEW.ram_receipt_id IS NOT NULL OR NEW.ssd_receipt_id IS NOT NULL OR OLD.ram_receipt_id IS NOT NULL OR OLD.ssd_receipt_id IS NOT NULL)
       AND NEW.stock_version IS DISTINCT FROM OLD.stock_version THEN
      RAISE EXCEPTION 'Installed parts changed in another session. Close and reopen the asset editor before saving.';
    END IF;
    NEW.stock_version := OLD.stock_version;
  ELSE
    NEW.stock_version := 0;
  END IF;
  NEW.return_ram_to_stock := false;
  NEW.return_ssd_to_stock := false;
  IF NEW.category <> 'System Unit' AND (NEW.ram_receipt_id IS NOT NULL OR NEW.ssd_receipt_id IS NOT NULL) THEN
    RAISE EXCEPTION 'RAM and SSD stock can only be installed in a System Unit.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(new_ids || old_ids) id WHERE id IS NOT NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Administrator access is required to use consumable stock.';
    END IF;
    -- Lock every affected receipt in one stable order, including returned stock.
    PERFORM id FROM public.consumable_receipts WHERE id = ANY(new_ids || old_ids) ORDER BY id FOR UPDATE;
  END IF;
  FOR i IN 1..2 LOOP
    IF new_ids[i] IS NOT NULL THEN
      SELECT * INTO receipt FROM public.consumable_receipts WHERE id = new_ids[i];
      IF NOT FOUND OR receipt.category <> categories[i] OR receipt.unit <> 'pieces' THEN
        RAISE EXCEPTION 'Select a valid % stock receipt recorded in pieces.', categories[i];
      END IF;
      IF new_counts[i] IS NULL OR new_counts[i] < 1 OR capacities[i] IS NULL OR capacities[i] < 1 THEN
        RAISE EXCEPTION 'Enter a positive installed quantity and capacity for %.', categories[i];
      END IF;
      IF receipt.capacity_gb IS NOT NULL AND receipt.capacity_gb <> capacities[i] THEN
        RAISE EXCEPTION '% capacity must match the selected stock receipt (% GB).', categories[i], receipt.capacity_gb;
      END IF;
    END IF;
    IF new_ids[i] IS NOT DISTINCT FROM old_ids[i] THEN
      added := CASE WHEN new_ids[i] IS NULL THEN 0 ELSE greatest(new_counts[i] - old_counts[i], 0) END;
      removed := CASE WHEN old_ids[i] IS NULL THEN 0 ELSE greatest(old_counts[i] - new_counts[i], 0) END;
    ELSE
      added := CASE WHEN new_ids[i] IS NULL THEN 0 ELSE new_counts[i] END;
      removed := CASE WHEN old_ids[i] IS NULL THEN 0 ELSE old_counts[i] END;
    END IF;
    IF removed > 0 THEN
      IF return_parts[i] THEN
        UPDATE public.consumable_receipts SET used_quantity = used_quantity - removed WHERE id = old_ids[i];
      END IF;
      INSERT INTO public.consumable_movements(receipt_id, asset_id, asset_tag, category, action, quantity, performed_by)
        VALUES (old_ids[i], NEW.id, NEW.tag, categories[i], CASE WHEN return_parts[i] THEN 'Returned' ELSE 'Removed / used' END, removed, auth.uid());
    END IF;
    IF added > 0 THEN
      UPDATE public.consumable_receipts SET used_quantity = used_quantity + added
        WHERE id = new_ids[i] AND quantity - used_quantity >= added;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Not enough % stock available. Refresh stock and reduce the quantity or select another receipt.', categories[i];
      END IF;
      INSERT INTO public.consumable_movements(receipt_id, asset_id, asset_tag, category, action, quantity, performed_by)
        VALUES (new_ids[i], NEW.id, NEW.tag, categories[i], 'Installed', added, auth.uid());
    END IF;
    IF added > 0 OR removed > 0 THEN NEW.stock_version := NEW.stock_version + 1; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.track_system_unit_stock() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS track_system_unit_stock ON public.assets;
CREATE TRIGGER track_system_unit_stock BEFORE INSERT OR UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.track_system_unit_stock();
COMMIT;
