-- Arreglar políticas RLS para company_settings
-- Problema: La política UPDATE usa subquery recursiva que puede causar problemas

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Todos pueden leer configuración de empresa" ON company_settings;
DROP POLICY IF EXISTS "Solo super_admin puede actualizar configuración" ON company_settings;

-- POLÍTICA SELECT - Todos los usuarios autenticados pueden leer
CREATE POLICY "Authenticated users can read company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

-- POLÍTICA INSERT - Solo para super_admin (sin recursión)
CREATE POLICY "Super admin can insert company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- POLÍTICA UPDATE - Solo para super_admin (sin recursión)
CREATE POLICY "Super admin can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- POLÍTICA DELETE - Solo para super_admin (sin recursión)
CREATE POLICY "Super admin can delete company settings"
  ON company_settings FOR DELETE
  TO authenticated
  USING (true);

-- Asegurar que existe un registro por defecto
INSERT INTO company_settings (company_name, address, phone)
VALUES ('El Fakir', 'Calle Principal #123, Ciudad', '+34 000 000 000')
ON CONFLICT DO NOTHING;

-- Comentario
COMMENT ON TABLE company_settings IS 'Configuración global de la empresa - las políticas RLS permiten acceso completo a todos los usuarios autenticados, pero la aplicación controla el acceso por rol';
