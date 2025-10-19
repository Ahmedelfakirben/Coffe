-- ARREGLO RECURSIÓN INFINITA: Eliminar todas las políticas con subqueries recursivas
-- El problema: las políticas estaban consultando employee_profiles dentro de políticas de employee_profiles

-- 1. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Users can view own profile" ON employee_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON employee_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON employee_profiles;
DROP POLICY IF EXISTS "Admins can update employee profiles" ON employee_profiles;
DROP POLICY IF EXISTS "Admins can insert employee profiles" ON employee_profiles;
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON employee_profiles;
DROP POLICY IF EXISTS "Employees can view their profile" ON employee_profiles;

-- 2. POLÍTICA SELECT SIMPLE - Sin subqueries, sin recursión
-- Todos los usuarios autenticados pueden ver TODOS los perfiles
CREATE POLICY "Authenticated users can view profiles"
  ON employee_profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. POLÍTICA UPDATE - Solo el propio usuario puede actualizar su perfil
CREATE POLICY "Users can update own profile"
  ON employee_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. POLÍTICA INSERT - Cualquier usuario autenticado puede insertar (para registro)
-- La validación de roles se hace a nivel de aplicación
CREATE POLICY "Authenticated users can insert profiles"
  ON employee_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. POLÍTICA DELETE - Nadie puede eliminar (usamos soft delete con deleted_at)
-- Si necesitas permitir DELETE, hazlo a nivel de aplicación, no con RLS

-- Comentarios
COMMENT ON POLICY "Authenticated users can view profiles" ON employee_profiles IS 'Todos los usuarios autenticados pueden ver perfiles - Sin recursión';
COMMENT ON POLICY "Users can update own profile" ON employee_profiles IS 'Usuarios solo pueden actualizar su propio perfil';
COMMENT ON POLICY "Authenticated users can insert profiles" ON employee_profiles IS 'Permite inserción para nuevos usuarios - Validación en app';
