-- POLICY FIX SCRIPT
-- Run this in your Supabase SQL Editor if you encounter "Error deleting..." permissions issues.

-- 1. Enable deletion for authenticated users (or specific roles) on critical tables
-- IMPORTANT: Replace 'authenticated' with 'service_role' or specific checking logic if you want more security.
-- Ideally, only admins should delete.

-- Helper function to assume we are Super Admin (you might already have logic for this)
-- Here we just ensure policies exist for DELETE.

CREATE POLICY "Enable delete for users based on user_id" ON "public"."orders"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (true); -- DANGER: This allows ANY authenticated user to delete. Restrict if needed.

-- BETTER APPROACH: Explicitly allow deletions for tables if they don't have a check.

DO $$
DECLARE
    tables text[] := ARRAY[
        'order_items', 'orders', 'cash_withdrawals', 'cash_register_sessions', 
        'expenses', 'employee_time_entries', 'backup_config', 
        'company_settings', 'app_settings', 'products', 'categories', 'product_sizes'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Remove existing restrictive delete policies if necessary or just add a broad one
        -- Note: Postgres policies are OR-ed (permissive). So adding a permissive one grants access.
        
        EXECUTE format('DROP POLICY IF EXISTS "Allow Delete for SuperAdmins" ON %I', t);
        
        -- Create a policy that allows everything for simplicity in this manual tool context
        -- OR strictly check for role = super_admin if you have that setup in metadata
        
        EXECUTE format('CREATE POLICY "Allow Delete for SuperAdmins" ON %I FOR DELETE TO authenticated USING (true)', t);
        
        -- Ensure RLS is enabled so policies apply (usually yes)
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        
    END LOOP;
END $$;
