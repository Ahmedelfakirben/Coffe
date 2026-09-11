-- ARREGLO RLS PRODUCT_SIZES: Permitir a todos los usuarios autenticados gestionar tamaños de productos
-- Al igual que products, categories y employee_profiles, la validación de permisos se gestiona a nivel de aplicación

-- 1. Asegurar que RLS está habilitado
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas o restrictivas que bloquean a super_admin y usuarios autenticados
DROP POLICY IF EXISTS "Admins can manage product sizes" ON public.product_sizes;
DROP POLICY IF EXISTS "Anyone can view product sizes" ON public.product_sizes;
DROP POLICY IF EXISTS "Allow Delete for SuperAdmins" ON public.product_sizes;
DROP POLICY IF EXISTS "Allow All" ON public.product_sizes;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.product_sizes;
DROP POLICY IF EXISTS "Authenticated users can manage product sizes" ON public.product_sizes;

-- 3. Crear política para SELECT (lectura)
CREATE POLICY "Anyone can view product sizes"
  ON public.product_sizes FOR SELECT
  TO authenticated
  USING (true);

-- 4. Crear política ALL para INSERT, UPDATE, DELETE para usuarios autenticados
CREATE POLICY "Enable all access for authenticated users"
  ON public.product_sizes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Enable all access for authenticated users" ON public.product_sizes IS 'Permite a usuarios autenticados insertar, actualizar y eliminar tamaños de productos sin bloqueo RLS';
