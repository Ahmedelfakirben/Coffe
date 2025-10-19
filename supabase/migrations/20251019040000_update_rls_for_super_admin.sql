-- Actualizar todas las políticas RLS para incluir super_admin junto con admin
-- Esto permite que super_admin tenga los mismos permisos que admin en todas las tablas

-- PRODUCTS TABLE
DROP POLICY IF EXISTS "Admin can insert products" ON products;
CREATE POLICY "Admin can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admin can update products" ON products;
CREATE POLICY "Admin can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admin can delete products" ON products;
CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- CATEGORIES TABLE
DROP POLICY IF EXISTS "Only admin can insert categories" ON categories;
CREATE POLICY "Only admin can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admin can update categories" ON categories;
CREATE POLICY "Only admin can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admin can delete categories" ON categories;
CREATE POLICY "Only admin can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- SUPPLIERS TABLE
DROP POLICY IF EXISTS "Only admins can insert suppliers" ON suppliers;
CREATE POLICY "Only admins can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    exists (
      select 1 from employee_profiles
      where id = auth.uid()
      and role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can update suppliers" ON suppliers;
CREATE POLICY "Only admins can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    exists (
      select 1 from employee_profiles
      where id = auth.uid()
      and role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can delete suppliers" ON suppliers;
CREATE POLICY "Only admins can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    exists (
      select 1 from employee_profiles
      where id = auth.uid()
      and role IN ('admin', 'super_admin')
    )
  );

-- EXPENSES TABLE
DROP POLICY IF EXISTS "Only admins can insert expenses" ON expenses;
CREATE POLICY "Only admins can insert expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    exists (
      select 1 from employee_profiles
      where id = auth.uid()
      and role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can update expenses" ON expenses;
CREATE POLICY "Only admins can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    exists (
      select 1 from employee_profiles
      where id = auth.uid()
      and role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Only admins can delete expenses" ON expenses;
CREATE POLICY "Only admins can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    exists (
      select 1 from employee_profiles
      where id = auth.uid()
      and role IN ('admin', 'super_admin')
    )
  );

-- TABLES TABLE
-- Solo actualizar INSERT para incluir super_admin
-- SELECT y UPDATE ya permiten a todos los empleados activos
DROP POLICY IF EXISTS "Admins can insert tables" ON tables;
CREATE POLICY "Admins can insert tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role IN ('admin', 'super_admin')
      AND ep.active = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete tables" ON tables;
CREATE POLICY "Admins can delete tables"
  ON tables FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role IN ('admin', 'super_admin')
      AND ep.active = true
    )
  );

-- EMPLOYEE_PROFILES TABLE
DROP POLICY IF EXISTS "Admins can view all profiles" ON employee_profiles;
CREATE POLICY "Admins can view all profiles"
  ON employee_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role IN ('admin', 'super_admin')
      AND ep.active = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert employee profiles" ON employee_profiles;
CREATE POLICY "Admins can insert employee profiles"
  ON employee_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update employee profiles" ON employee_profiles;
CREATE POLICY "Admins can update employee profiles"
  ON employee_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role IN ('admin', 'super_admin')
    )
  );

-- CASH_REGISTER_SESSIONS TABLE - Admin can view all sessions
DROP POLICY IF EXISTS "Admins can view all cash register sessions" ON cash_register_sessions;
CREATE POLICY "Admins can view all cash register sessions"
  ON cash_register_sessions FOR SELECT
  TO authenticated
  USING (
    exists (
      select 1 from employee_profiles ep
      where ep.id = auth.uid() and ep.role IN ('admin', 'super_admin') and ep.active = true
    ) or employee_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update any cash register session" ON cash_register_sessions;
CREATE POLICY "Admins can update any cash register session"
  ON cash_register_sessions FOR UPDATE
  TO authenticated
  USING (
    exists (
      select 1 from employee_profiles ep
      where ep.id = auth.uid() and ep.role IN ('admin', 'super_admin') and ep.active = true
    ) or employee_id = auth.uid()
  );

-- DELETED_PRODUCTS TABLE
DROP POLICY IF EXISTS "Only admins can view deleted products" ON deleted_products;
CREATE POLICY "Only admins can view deleted products"
  ON deleted_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- DELETED_ORDERS TABLE
DROP POLICY IF EXISTS "Solo admin puede ver pedidos eliminados" ON deleted_orders;
CREATE POLICY "Solo admin puede ver pedidos eliminados"
  ON deleted_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Solo admin puede insertar pedidos eliminados" ON deleted_orders;
CREATE POLICY "Solo admin puede insertar pedidos eliminados"
  ON deleted_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Comentario
COMMENT ON POLICY "Admin can insert products" ON products IS 'Permite a admin y super_admin insertar productos';
COMMENT ON POLICY "Admins can view all cash register sessions" ON cash_register_sessions IS 'Permite a admin y super_admin ver todas las sesiones de caja';
