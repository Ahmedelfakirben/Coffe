-- Agregar permisos granulares para el Punto de Venta
-- Permite configurar si un rol puede confirmar pedidos, validar pedidos, o ambos

-- 1. Agregar columnas para permisos específicos de POS
ALTER TABLE role_permissions
ADD COLUMN IF NOT EXISTS can_confirm_order BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_validate_order BOOLEAN DEFAULT true;

-- 2. Actualizar permisos por defecto para cada rol

-- SUPER_ADMIN - Puede hacer todo
UPDATE role_permissions
SET can_confirm_order = true, can_validate_order = true
WHERE role = 'super_admin' AND page_id = 'pos';

-- ADMIN - Puede hacer todo
UPDATE role_permissions
SET can_confirm_order = true, can_validate_order = true
WHERE role = 'admin' AND page_id = 'pos';

-- CASHIER - Puede confirmar y validar (acceso completo)
UPDATE role_permissions
SET can_confirm_order = true, can_validate_order = true
WHERE role = 'cashier' AND page_id = 'pos';

-- BARISTA - Puede confirmar y validar (acceso completo)
UPDATE role_permissions
SET can_confirm_order = true, can_validate_order = true
WHERE role = 'barista' AND page_id = 'pos';

-- WAITER - No tiene acceso a POS (can_access = false)
-- Pero si se le da acceso, por defecto solo puede confirmar (no validar)
UPDATE role_permissions
SET can_confirm_order = true, can_validate_order = false
WHERE role = 'waiter' AND page_id = 'pos';

-- 3. Comentarios
COMMENT ON COLUMN role_permissions.can_confirm_order IS 'Permite confirmar/crear pedidos en POS (agregar items)';
COMMENT ON COLUMN role_permissions.can_validate_order IS 'Permite validar/completar pedidos en POS (finalizar con pago)';

-- 4. Índice para consultas de permisos granulares
CREATE INDEX IF NOT EXISTS idx_role_permissions_pos_granular
ON role_permissions(role, page_id, can_confirm_order, can_validate_order)
WHERE page_id = 'pos';
