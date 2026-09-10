-- Añadir columnas para trazabilidad de usuarios en las tablas de economato

-- 1. Añadir received_by a inventory_receipts
ALTER TABLE inventory_receipts 
ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES employee_profiles(id) ON DELETE SET NULL;

-- 2. Añadir issued_by a inventory_issues
ALTER TABLE inventory_issues 
ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES employee_profiles(id) ON DELETE SET NULL;

-- 3. Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_user ON inventory_receipts(received_by);
CREATE INDEX IF NOT EXISTS idx_inventory_issues_user ON inventory_issues(issued_by);
