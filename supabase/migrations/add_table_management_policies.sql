-- ============================================
-- POLÍTICAS PARA GESTIÓN DE MESAS
-- ============================================
-- Solo super_admin puede INSERT y DELETE mesas
-- Todos los empleados pueden ver (SELECT) y actualizar estado (UPDATE)
-- ============================================

-- DROP políticas existentes si existen
DROP POLICY IF EXISTS "Super admins can insert tables" ON public.tables;
DROP POLICY IF EXISTS "Super admins can delete tables" ON public.tables;

-- Super admins pueden CREAR mesas
CREATE POLICY "Super admins can insert tables"
  ON public.tables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role = 'super_admin'
      AND ep.active = true
      AND ep.deleted_at IS NULL
    )
  );

-- Super admins pueden ELIMINAR mesas
CREATE POLICY "Super admins can delete tables"
  ON public.tables FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role = 'super_admin'
      AND ep.active = true
      AND ep.deleted_at IS NULL
    )
  );

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Mostrar todas las políticas de la tabla 'tables'
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tables'
ORDER BY policyname;

-- ============================================
-- RESULTADO ESPERADO
-- ============================================
-- Empleados autenticados: SELECT (ver mesas)
-- Empleados autenticados: UPDATE (cambiar estado)
-- Solo super_admin: INSERT (crear mesas)
-- Solo super_admin: DELETE (eliminar mesas)
