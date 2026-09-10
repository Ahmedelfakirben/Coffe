-- Script para crear el esquema del módulo de Economato (Inventario y Suministros)

-- 1. Suppliers (Fournisseurs) - Alter existing table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2) DEFAULT 0.00;


-- 2. Inventory Items (Articles)
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL, -- Ej: kg, L, pcs, boxes
  min_stock_alert DECIMAL(10, 2) DEFAULT 0.00,
  current_stock DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Inventory Receipts (Bons de réception)
CREATE TABLE inventory_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
  received_by UUID REFERENCES employee_profiles(id) ON DELETE RESTRICT,
  receipt_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  total_amount DECIMAL(10, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Inventory Receipt Items
CREATE TABLE inventory_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Inventory Issues (Bons de sortie / Pertes)
CREATE TABLE inventory_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES employee_profiles(id) ON DELETE RESTRICT,
  issued_by UUID REFERENCES employee_profiles(id) ON DELETE RESTRICT,
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  type TEXT NOT NULL CHECK (type IN ('usage', 'loss', 'expired')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Inventory Issue Items
CREATE TABLE inventory_issue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES inventory_issues(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- --------------------------------------------------------
-- TRIGGERS PARA ACTUALIZACIONES AUTOMÁTICAS
-- --------------------------------------------------------

-- Trigger: Al recibir mercancía, aumenta el stock
CREATE OR REPLACE FUNCTION update_stock_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET current_stock = current_stock + NEW.quantity
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_receipt
AFTER INSERT ON inventory_receipt_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_receipt();

-- Trigger: Al registrar salida o pérdida, disminuye el stock
CREATE OR REPLACE FUNCTION update_stock_on_issue()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET current_stock = current_stock - NEW.quantity
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_issue
AFTER INSERT ON inventory_issue_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_issue();

-- Trigger: Al registrar una recepción, incrementamos el saldo (deuda) con el proveedor
CREATE OR REPLACE FUNCTION update_supplier_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers
  SET balance = balance + NEW.total_amount
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_balance
AFTER INSERT ON inventory_receipts
FOR EACH ROW
EXECUTE FUNCTION update_supplier_balance();

-- --------------------------------------------------------
-- POLÍTICAS DE SEGURIDAD (RLS)
-- --------------------------------------------------------

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_issue_items ENABLE ROW LEVEL SECURITY;

-- Permitir lectura y escritura general a usuarios autenticados 
-- (Podemos restringir a solo admins en el futuro si es necesario)
CREATE POLICY "Enable all for authenticated users" ON suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_receipts FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_receipt_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_issues FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON inventory_issue_items FOR ALL TO authenticated USING (true);
