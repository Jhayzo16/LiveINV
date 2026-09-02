-- Consumables are stock receipts only. They are intentionally separate from
-- assignable assets and have no floor, room, department, or assignment fields.
CREATE TABLE public.consumable_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('RAM', 'SSD', 'HDD', 'Network Cable', 'Ink / Toner', 'Battery', 'Other')),
    item_name VARCHAR(120) NOT NULL,
    brand VARCHAR(80),
    specification VARCHAR(240) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit VARCHAR(30) NOT NULL DEFAULT 'pieces',
    supplier VARCHAR(120),
    reference_number VARCHAR(80),
    date_received DATE NOT NULL,
    received_by VARCHAR(120),
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX consumable_receipts_date_received_idx
    ON public.consumable_receipts (date_received DESC);

CREATE INDEX consumable_receipts_category_idx
    ON public.consumable_receipts (category);

ALTER TABLE public.consumable_receipts ENABLE ROW LEVEL SECURITY;

-- These policies match the current prototype's anonymous data-access model so
-- the feature works before Auth is introduced. Replace them with role-based,
-- authenticated policies before live deployment.
CREATE POLICY "Enable consumable receipt reads for prototype"
    ON public.consumable_receipts FOR SELECT
    USING (true);

CREATE POLICY "Enable consumable receipt inserts for prototype"
    ON public.consumable_receipts FOR INSERT
    WITH CHECK (true);
