-- Create missing tables script (UPDATED)
-- Run this in Supabase SQL Editor to fix the "relation does not exist" errors.

-- 1. Create employee_time_entries if it doesn't exist
CREATE TABLE IF NOT EXISTS public.employee_time_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employee_profiles(id) ON DELETE SET NULL,
    clock_in TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    total_hours NUMERIC(5,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create backup_config if it doesn't exist
CREATE TABLE IF NOT EXISTS public.backup_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL, 
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create app_settings if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create company_settings if it doesn't exist
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    tax_id TEXT,
    currency TEXT DEFAULT 'EUR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);


-- Enable RLS for all
ALTER TABLE public.employee_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;


-- Create policies for these new tables (Basic access)
DO $$ 
BEGIN
    -- Policy for employee_time_entries
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_time_entries' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.employee_time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Policy for backup_config
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'backup_config' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.backup_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Policy for app_settings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    -- Policy for company_settings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'Enable all access for authenticated users') THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
