-- Actualizar el tipo de rol para incluir nuevos roles
-- Nota: Primero debemos eliminar el constraint y recrearlo

-- Agregar tabla de permisos de roles
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  section VARCHAR(100) NOT NULL,
  page_id VARCHAR(100) NOT NULL,
  can_access BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, section, page_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_page ON role_permissions(page_id);

-- Habilitar RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Todos pueden ver permisos"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo super_admin puede modificar permisos"
  ON role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Insertar permisos por defecto para cada rol

-- SUPER ADMIN - Acceso total
INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
  ('super_admin', 'Ventas', 'floor', true),
  ('super_admin', 'Ventas', 'pos', true),
  ('super_admin', 'Ventas', 'orders', true),
  ('super_admin', 'Inventario', 'products', true),
  ('super_admin', 'Inventario', 'categories', true),
  ('super_admin', 'Inventario', 'users', true),
  ('super_admin', 'Finanzas', 'cash', true),
  ('super_admin', 'Finanzas', 'time-tracking', true),
  ('super_admin', 'Finanzas', 'suppliers', true),
  ('super_admin', 'Finanzas', 'expenses', true),
  ('super_admin', 'Finanzas', 'analytics', true),
  ('super_admin', 'Sistema', 'role-management', true)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- ADMIN - Acceso completo excepto gestión de roles
INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
  ('admin', 'Ventas', 'floor', true),
  ('admin', 'Ventas', 'pos', true),
  ('admin', 'Ventas', 'orders', true),
  ('admin', 'Inventario', 'products', true),
  ('admin', 'Inventario', 'categories', true),
  ('admin', 'Inventario', 'users', true),
  ('admin', 'Finanzas', 'cash', true),
  ('admin', 'Finanzas', 'time-tracking', true),
  ('admin', 'Finanzas', 'suppliers', true),
  ('admin', 'Finanzas', 'expenses', true),
  ('admin', 'Finanzas', 'analytics', true),
  ('admin', 'Sistema', 'role-management', false)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- CASHIER - Ventas y caja
INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
  ('cashier', 'Ventas', 'floor', true),
  ('cashier', 'Ventas', 'pos', true),
  ('cashier', 'Ventas', 'orders', true),
  ('cashier', 'Inventario', 'products', false),
  ('cashier', 'Inventario', 'categories', false),
  ('cashier', 'Inventario', 'users', false),
  ('cashier', 'Finanzas', 'cash', true),
  ('cashier', 'Finanzas', 'time-tracking', false),
  ('cashier', 'Finanzas', 'suppliers', false),
  ('cashier', 'Finanzas', 'expenses', false),
  ('cashier', 'Finanzas', 'analytics', false),
  ('cashier', 'Sistema', 'role-management', false)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- BARISTA - Solo ventas
INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
  ('barista', 'Ventas', 'floor', true),
  ('barista', 'Ventas', 'pos', true),
  ('barista', 'Ventas', 'orders', true),
  ('barista', 'Inventario', 'products', false),
  ('barista', 'Inventario', 'categories', false),
  ('barista', 'Inventario', 'users', false),
  ('barista', 'Finanzas', 'cash', false),
  ('barista', 'Finanzas', 'time-tracking', false),
  ('barista', 'Finanzas', 'suppliers', false),
  ('barista', 'Finanzas', 'expenses', false),
  ('barista', 'Finanzas', 'analytics', false),
  ('barista', 'Sistema', 'role-management', false)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- WAITER (Camarero) - Solo sala y órdenes (sin validar)
INSERT INTO role_permissions (role, section, page_id, can_access) VALUES
  ('waiter', 'Ventas', 'floor', true),
  ('waiter', 'Ventas', 'pos', false),
  ('waiter', 'Ventas', 'orders', true),
  ('waiter', 'Inventario', 'products', false),
  ('waiter', 'Inventario', 'categories', false),
  ('waiter', 'Inventario', 'users', false),
  ('waiter', 'Finanzas', 'cash', false),
  ('waiter', 'Finanzas', 'time-tracking', false),
  ('waiter', 'Finanzas', 'suppliers', false),
  ('waiter', 'Finanzas', 'expenses', false),
  ('waiter', 'Finanzas', 'analytics', false),
  ('waiter', 'Sistema', 'role-management', false)
ON CONFLICT (role, section, page_id) DO NOTHING;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_role_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_role_permissions_updated_at_trigger
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_role_permissions_updated_at();

-- Comentarios
COMMENT ON TABLE role_permissions IS 'Tabla de permisos configurables por rol para control de acceso granular';
COMMENT ON COLUMN role_permissions.role IS 'Rol del empleado (super_admin, admin, cashier, barista, waiter)';
COMMENT ON COLUMN role_permissions.section IS 'Sección del sistema (Ventas, Inventario, Finanzas, Sistema)';
COMMENT ON COLUMN role_permissions.page_id IS 'ID de la página dentro de la sección';
COMMENT ON COLUMN role_permissions.can_access IS 'Si el rol tiene permiso para acceder a esta página';
