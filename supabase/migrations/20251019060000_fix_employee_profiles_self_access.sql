-- ARREGLO CRÍTICO: Restaurar acceso de empleados a sus propios perfiles
-- Sin esto, los usuarios no pueden autenticarse ni ver su información

-- 1. Asegurar que TODOS los usuarios puedan ver SU PROPIO perfil
DROP POLICY IF EXISTS "Users can view own profile" ON employee_profiles;
CREATE POLICY "Users can view own profile"
  ON employee_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2. Admin y super_admin pueden ver TODOS los perfiles
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

-- 3. Usuarios pueden actualizar su propio perfil (excepto rol)
DROP POLICY IF EXISTS "Users can update own profile" ON employee_profiles;
CREATE POLICY "Users can update own profile"
  ON employee_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Admins pueden actualizar cualquier perfil
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

-- 5. Solo admins pueden insertar nuevos perfiles
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

-- 6. Permitir auto-inserción en el registro (para nuevos usuarios)
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON employee_profiles;
CREATE POLICY "Users can insert own profile on signup"
  ON employee_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Comentarios
COMMENT ON POLICY "Users can view own profile" ON employee_profiles IS 'Usuarios pueden ver su propio perfil - CRÍTICO para autenticación';
COMMENT ON POLICY "Admins can view all profiles" ON employee_profiles IS 'Admin y super_admin pueden ver todos los perfiles';
COMMENT ON POLICY "Users can update own profile" ON employee_profiles IS 'Usuarios pueden actualizar su propio perfil';
COMMENT ON POLICY "Admins can update employee profiles" ON employee_profiles IS 'Admin y super_admin pueden actualizar cualquier perfil';
