-- FORCE DELETE PERMISSIONS SCRIPT
-- Run this to forcibly allow deletion on operational tables for authenticated users.

DO $$
DECLARE
    -- List of tables that need delete permissions
    tables text[] := ARRAY[
        'order_items', 
        'orders', 
        'cash_withdrawals', 
        'cash_register_sessions', 
        'expenses', 
        'employee_time_entries',
        'app_settings',
        'company_settings',
        'backup_config',
        'employee_profiles',
        'role_permissions'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- 1. Enable RLS (just in case)
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

        -- 2. Drop existing policies that might be conflicting or too restrictive
        -- We drop common names we might have used previously
        EXECUTE format('DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow Delete for SuperAdmins" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow All" ON %I', t);

        -- 3. Create a blanket "ALLOW ALL" policy for authenticated users
        -- This allows SELECT, INSERT, UPDATE, DELETE for anyone logged in.
        -- In a stricter production app, you would check for (auth.uid() = ...) or role='admin'
        EXECUTE format('CREATE POLICY "Allow All" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
        
        RAISE NOTICE 'Policies updated for table: %', t;
    END LOOP;
END $$;
