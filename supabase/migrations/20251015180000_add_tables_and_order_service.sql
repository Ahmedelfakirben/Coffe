-- Add dining tables and service_type/table_id to orders
-- Ensures employees can view tables and link orders to a table

-- Ensure pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create tables table
CREATE TABLE IF NOT EXISTS public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  seats integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','dirty')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tables_status ON public.tables(status);
CREATE INDEX IF NOT EXISTS idx_tables_name ON public.tables(name);

-- RLS
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view tables
DROP POLICY IF EXISTS "Employees can view tables" ON public.tables;
CREATE POLICY "Employees can view tables"
  ON public.tables FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.active = true
    )
  );

-- Employees can update tables status (e.g., available/occupied)
DROP POLICY IF EXISTS "Employees can update tables" ON public.tables;
CREATE POLICY "Employees can update tables"
  ON public.tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.active = true
    )
  );

-- Admins can insert tables
DROP POLICY IF EXISTS "Admins can insert tables" ON public.tables;
CREATE POLICY "Admins can insert tables"
  ON public.tables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role = 'admin'
      AND ep.active = true
    )
  );

-- Trigger to update updated_at on tables
CREATE OR REPLACE FUNCTION public.handle_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tables_updated_at ON public.tables;
CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tables_updated_at();

-- Alter orders to include service_type and table_id link
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'takeaway' CHECK (service_type IN ('dine_in','takeaway')),
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON public.orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders(table_id);

-- Note: order_history trigger remains unchanged; it logs core fields.