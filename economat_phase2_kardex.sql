-- Crear Vista Unificada de Transacciones para el Kardex
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
  -ii.quantity as quantity, -- negative for issues
  ii.unit_cost,
  -(ii.quantity * ii.unit_cost) as total_value,
  i.notes,
  i.issued_by as user_id,
  i.created_at
FROM inventory_issues i
JOIN inventory_issue_items ii ON i.id = ii.issue_id;

-- Dar permisos a la vista
GRANT SELECT ON inventory_transactions_view TO authenticated;
