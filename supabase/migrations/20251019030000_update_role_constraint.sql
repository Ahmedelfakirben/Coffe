-- Actualizar el constraint de roles para incluir super_admin y waiter

-- Primero, encontrar y eliminar el constraint existente
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Buscar el nombre del constraint
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'employee_profiles'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%role%';

    -- Eliminar el constraint si existe
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE employee_profiles DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Constraint % eliminado', constraint_name;
    END IF;
END $$;

-- Agregar el nuevo constraint con todos los roles
ALTER TABLE employee_profiles
ADD CONSTRAINT employee_profiles_role_check
CHECK (role IN ('super_admin', 'admin', 'cashier', 'barista', 'waiter'));

-- Comentario
COMMENT ON CONSTRAINT employee_profiles_role_check ON employee_profiles IS 'Permite los roles: super_admin, admin, cashier, barista, waiter';
