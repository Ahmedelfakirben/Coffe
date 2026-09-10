-- Script V2 para el módulo de Economato
-- ¡ADVERTENCIA! Esto eliminará las tablas anteriores del economato si existen.
-- Ejecuta todo esto en el SQL Editor de Supabase.

-- 1. Eliminar tablas antiguas si existen (el orden importa por las claves foráneas)
DROP TRIGGER IF EXISTS trigger_update_supplier_balance ON inventory_receipts;
DROP TRIGGER IF EXISTS trigger_update_stock_on_issue ON inventory_issue_items;
DROP TRIGGER IF EXISTS trigger_update_stock_on_receipt ON inventory_receipt_items;
DROP FUNCTION IF EXISTS update_supplier_balance;
DROP FUNCTION IF EXISTS update_stock_on_issue;
DROP FUNCTION IF EXISTS update_stock_on_receipt;

DROP TABLE IF EXISTS inventory_issue_items CASCADE;
DROP TABLE IF EXISTS inventory_issues CASCADE;
DROP TABLE IF EXISTS inventory_receipt_items CASCADE;
DROP TABLE IF EXISTS inventory_receipts CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;

-- 2. Asegurar que la tabla proveedores tenga el balance
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2) DEFAULT 0.00;

-- 3. Crear las NUEVAS tablas con el esquema correcto
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  current_stock DECIMAL(10, 2) DEFAULT 0.00,
  min_stock_level DECIMAL(10, 2) DEFAULT 0.00,
  unit_cost DECIMAL(10, 2) DEFAULT 0.00,
  expiry_date DATE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE inventory_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  receipt_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  total_amount DECIMAL(10, 2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE inventory_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE inventory_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  issue_type TEXT NOT NULL CHECK (issue_type IN ('internal_use', 'loss', 'expired', 'adjustment')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE inventory_issue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES inventory_issues(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_cost DECIMAL(10, 2) NOT NULL,
  total_value DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Recrear Triggers (sin problemas de sintaxis)
CREATE OR REPLACE FUNCTION trigger_update_stock_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET current_stock = current_stock + NEW.quantity
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_and_balance_on_receipt
  AFTER INSERT ON inventory_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_stock_on_receipt();

CREATE OR REPLACE FUNCTION trigger_update_stock_on_issue()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET current_stock = current_stock - NEW.quantity
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_and_balance_on_issue
  AFTER INSERT ON inventory_issue_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_stock_on_issue();

-- 5. Insertar Permisos para que el Menú aparezca en la App
DELETE FROM role_permissions WHERE page_id = 'economat';

INSERT INTO role_permissions (role, section, page_id, can_access)
VALUES 
  ('super_admin', 'Inventario', 'economat', true),
  ('admin', 'Inventario', 'economat', true);

-- 6. Habilitar Seguridad RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_issue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON inventory_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_receipts FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_receipt_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_issues FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_issue_items FOR ALL TO authenticated USING (true);
