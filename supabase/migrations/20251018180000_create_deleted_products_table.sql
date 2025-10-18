-- Create deleted_products table to archive deleted products
-- This allows us to maintain referential integrity in order_history
-- while removing products from the active products table

CREATE TABLE IF NOT EXISTS deleted_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL, -- References the original product id
  name text NOT NULL,
  description text DEFAULT '',
  category_id uuid, -- Keep reference for historical purposes
  base_price decimal(10,2) NOT NULL,
  image_url text DEFAULT '',
  deleted_at timestamptz DEFAULT now(),
  deleted_reason text DEFAULT 'Eliminado por usuario',
  created_at timestamptz DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_deleted_products_original_id ON deleted_products(original_id);
CREATE INDEX IF NOT EXISTS idx_deleted_products_deleted_at ON deleted_products(deleted_at DESC);

-- Enable Row Level Security
ALTER TABLE deleted_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deleted_products
CREATE POLICY "Employees can view deleted products"
  ON deleted_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Admins can manage deleted products"
  ON deleted_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'admin'
      AND employee_profiles.active = true
    )
  );