-- ACTUALIZACIONES DEL ECONOMATO (FASE 1 Y FASE 2.1)
-- Por favor, ejecuta todo este script en el SQL Editor de Supabase.

-- 1. Añadir received_by a inventory_receipts
ALTER TABLE inventory_receipts 
ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES employee_profiles(id) ON DELETE SET NULL;

-- 2. Añadir issued_by a inventory_issues
ALTER TABLE inventory_issues 
ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES employee_profiles(id) ON DELETE SET NULL;

-- 3. Crear índices para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_user ON inventory_receipts(received_by);
CREATE INDEX IF NOT EXISTS idx_inventory_issues_user ON inventory_issues(issued_by);

-- 4. Crear Vista Unificada de Transacciones para el Kardex
CREATE OR REPLACE VIEW inventory_transactions_view AS
SELECT
  r.id as transaction_id,
  'receipt' as transaction_type,
  r.receipt_date as transaction_date,
  ri.item_id,
  ri.quantity,
  ri.unit_cost,
  (ri.quantity * ri.unit_cost) as total_value,
  r.notes,
  r.received_by as user_id,
  r.created_at
FROM inventory_receipts r
JOIN inventory_receipt_items ri ON r.id = ri.receipt_id

UNION ALL

SELECT
  i.id as transaction_id,
  'issue_' || i.issue_type as transaction_type,
  i.issue_date as transaction_date,
  ii.item_id,
  -ii.quantity as quantity, -- cantidad en negativo porque es salida
  ii.unit_cost,
  -(ii.quantity * ii.unit_cost) as total_value,
  i.notes,
  i.issued_by as user_id,
  i.created_at
FROM inventory_issues i
JOIN inventory_issue_items ii ON i.id = ii.issue_id;

-- Dar permisos a la vista
GRANT SELECT ON inventory_transactions_view TO authenticated;
