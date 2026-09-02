-- Location updates are written to audit_logs by a database trigger. Run the
-- trigger with the function owner's privileges so clients cannot forge audit
-- entries and row-level security does not block legitimate asset updates.
CREATE OR REPLACE FUNCTION public.log_asset_location_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.location IS DISTINCT FROM NEW.location THEN
        INSERT INTO public.audit_logs (asset_id, action, previous_location, new_location)
        VALUES (NEW.id, 'LOCATION_UPDATE', OLD.location, NEW.location);
    END IF;
    RETURN NEW;
END;
$$;
