-- Create custom types
CREATE TYPE asset_state AS ENUM ('Active', 'Maintenance', 'Broken', 'Inactive');
CREATE TYPE device_category AS ENUM ('Printer', 'Monitor', 'Keyboard', 'System Unit', 'UPS', 'Scanner', 'Router');

-- Create assets table
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag VARCHAR(50) UNIQUE NOT NULL,
    qr_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category device_category NOT NULL,
    location VARCHAR(255) DEFAULT 'Unassigned',
    owner VARCHAR(255) DEFAULT 'Unassigned',
    state asset_state DEFAULT 'Active',
    ip VARCHAR(45) DEFAULT '—',
    brand VARCHAR(100),
    model VARCHAR(100),
    processor VARCHAR(255),
    ram_capacity_gb INTEGER,
    ram_modules INTEGER,
    ssd_capacity_gb INTEGER,
    ssd_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    previous_location VARCHAR(255),
    new_location VARCHAR(255),
    performed_by UUID, -- References auth.users later
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to log location changes
CREATE OR REPLACE FUNCTION log_asset_location_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.location IS DISTINCT FROM NEW.location THEN
        INSERT INTO audit_logs (asset_id, action, previous_location, new_location)
        VALUES (NEW.id, 'LOCATION_UPDATE', OLD.location, NEW.location);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_location_changes
    AFTER UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION log_asset_location_change();

-- Seed data
INSERT INTO assets (tag, qr_id, name, category, location, owner, state, ip, brand, model, processor, ram_capacity_gb, ram_modules, ssd_capacity_gb, ssd_count)
VALUES 
    ('PC-MRR-01', 'LIV-MRR0001', 'Dell OptiPlex 7090', 'System Unit', 'F5 · Medical Records', 'IT Department', 'Active', '10.20.5.31', 'Dell', 'OptiPlex 7090', 'Intel Core i5-10500', 8, 2, 512, 1),
    ('PRN-ACC-02', 'LIV-ACC0002', 'HP LaserJet Pro M404', 'Printer', 'F5 · Accounting', 'Finance', 'Maintenance', '10.20.5.52', 'HP', 'LaserJet Pro M404', NULL, NULL, NULL, NULL, NULL),
    ('MON-HR-04', 'LIV-HR00004', 'Dell P2422H Display', 'Monitor', 'F5 · HR Office', 'Human Resources', 'Active', '—', 'Dell', 'P2422H Display', NULL, NULL, NULL, NULL, NULL),
    ('PC-ER-12', 'LIV-ER00012', 'Lenovo ThinkCentre M80', 'System Unit', 'F1 · ER Reception', 'Emergency', 'Broken', '10.20.1.42', 'Lenovo', 'ThinkCentre M80', 'Intel Core i5-10500', 8, 2, 256, 1),
    ('AP-OR-03', 'LIV-OR00003', 'Aruba AP-515', 'Router', 'F2 · Operating Room', 'IT Department', 'Active', '10.20.2.11', 'Aruba', 'AP-515', NULL, NULL, NULL, NULL, NULL),
    ('UPS-LAB-02', 'LIV-LAB0002', 'APC Smart-UPS 1500', 'UPS', 'F1 · Laboratory', 'Laboratory', 'Inactive', '—', 'APC', 'Smart-UPS 1500', NULL, NULL, NULL, NULL, NULL),
    ('PC-NEW-07', 'LIV-NEW0007', 'Acer Veriton X', 'System Unit', 'Unassigned', 'Unassigned', 'Active', '—', 'Acer', 'Veriton X', 'Intel Core i5-12400', 8, 1, 512, 1);

-- Row Level Security (RLS)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- For the prototype, allow anon read/write (we can restrict this once Auth is added in the UI)
CREATE POLICY "Enable read access for all users" ON assets FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON assets FOR UPDATE USING (true);
CREATE POLICY "Enable read access for all users" ON audit_logs FOR SELECT USING (true);
