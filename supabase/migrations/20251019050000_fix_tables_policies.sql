-- Revertir política incorrecta de tables y restaurar políticas correctas
-- El problema: la política FOR ALL estaba bloqueando el acceso de todos los empleados

-- 1. Eliminar la política incorrecta
DROP POLICY IF EXISTS "Admins can manage tables" ON tables;

-- 2. Restaurar política SELECT - TODOS los empleados activos pueden ver mesas
DROP POLICY IF EXISTS "Employees can view tables" ON tables;
CREATE POLICY "Employees can view tables"
  ON tables FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.active = true
    )
  );

-- 3. Restaurar política UPDATE - TODOS los empleados activos pueden actualizar estado de mesas
DROP POLICY IF EXISTS "Employees can update tables" ON tables;
CREATE POLICY "Employees can update tables"
  ON tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.active = true
    )
  );

-- 4. Política INSERT - Solo admin y super_admin pueden crear mesas
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

-- 5. Política DELETE - Solo admin y super_admin pueden eliminar mesas
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

-- Comentarios
COMMENT ON POLICY "Employees can view tables" ON tables IS 'Todos los empleados activos pueden ver las mesas';
COMMENT ON POLICY "Employees can update tables" ON tables IS 'Todos los empleados activos pueden actualizar el estado de las mesas';
COMMENT ON POLICY "Admins can insert tables" ON tables IS 'Solo admin y super_admin pueden crear mesas';
COMMENT ON POLICY "Admins can delete tables" ON tables IS 'Solo admin y super_admin pueden eliminar mesas';
