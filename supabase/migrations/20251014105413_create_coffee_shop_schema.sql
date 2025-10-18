/*
  # Coffee Shop Management System - Database Schema

  ## Overview
  Complete database schema for managing a coffee shop including products, orders, customers, employees, and inventory.

  ## New Tables

  ### 1. Categories
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Category name (e.g., "Café", "Té", "Postres")
  - `description` (text) - Category description
  - `created_at` (timestamptz) - Creation timestamp

  ### 2. Products
  - `id` (uuid, primary key) - Unique identifier
  - `category_id` (uuid, foreign key) - References categories
  - `name` (text) - Product name
  - `description` (text) - Product description
  - `base_price` (decimal) - Base price
  - `image_url` (text) - Product image URL
  - `available` (boolean) - Availability status
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. Product Sizes
  - `id` (uuid, primary key) - Unique identifier
  - `product_id` (uuid, foreign key) - References products
  - `size_name` (text) - Size name (e.g., "Pequeño", "Mediano", "Grande")
  - `price_modifier` (decimal) - Price adjustment for this size
  - `created_at` (timestamptz) - Creation timestamp

  ### 4. Customers
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Customer name
  - `email` (text) - Customer email
  - `phone` (text) - Customer phone number
  - `loyalty_points` (integer) - Accumulated loyalty points
  - `created_at` (timestamptz) - Creation timestamp

  ### 5. Orders
  - `id` (uuid, primary key) - Unique identifier
  - `customer_id` (uuid, foreign key) - References customers (nullable)
  - `employee_id` (uuid, foreign key) - References auth.users
  - `status` (text) - Order status: "pending", "preparing", "ready", "completed", "cancelled"
  - `total` (decimal) - Order total amount
  - `payment_method` (text) - Payment method: "cash", "card", "digital"
  - `notes` (text) - Order notes
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 6. Order Items
  - `id` (uuid, primary key) - Unique identifier
  - `order_id` (uuid, foreign key) - References orders
  - `product_id` (uuid, foreign key) - References products
  - `size_id` (uuid, foreign key) - References product_sizes (nullable)
  - `quantity` (integer) - Item quantity
  - `unit_price` (decimal) - Price per unit
  - `subtotal` (decimal) - Line item subtotal
  - `notes` (text) - Item-specific notes
  - `created_at` (timestamptz) - Creation timestamp

  ### 7. Employee Profiles
  - `id` (uuid, primary key) - References auth.users
  - `full_name` (text) - Employee full name
  - `role` (text) - Employee role: "admin", "cashier", "barista"
  - `phone` (text) - Employee phone number
  - `active` (boolean) - Employment status
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable Row Level Security (RLS) on all tables
  - Policies for authenticated users based on roles
  - Admin users can manage all data
  - Cashiers and baristas can view and update orders
  - Customers data protected by user role checks

  ## Indexes
  - Indexes on foreign keys for optimal query performance
  - Index on order status for filtering
  - Index on order created_at for reporting
*/

-- Create categories table
-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text DEFAULT '',
  base_price decimal(10,2) NOT NULL,
  image_url text DEFAULT '',
  available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create product_sizes table
CREATE TABLE IF NOT EXISTS product_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_name text NOT NULL,
  price_modifier decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  loyalty_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  -- Make employee_id nullable since ON DELETE SET NULL is used
  employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  total decimal(10,2) DEFAULT 0,
  payment_method text CHECK (payment_method IN ('cash', 'card', 'digital')),
  order_number integer,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  size_id uuid REFERENCES product_sizes(id) ON DELETE SET NULL,
  quantity integer DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create employee_profiles table
CREATE TABLE IF NOT EXISTS employee_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier', 'barista')),
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_sizes_product ON product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'admin'
      AND employee_profiles.active = true
    )
  );

-- RLS Policies for products
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'admin'
      AND employee_profiles.active = true
    )
  );

-- RLS Policies for product_sizes
CREATE POLICY "Anyone can view product sizes"
  ON product_sizes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage product sizes"
  ON product_sizes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'admin'
      AND employee_profiles.active = true
    )
  );

-- RLS Policies for customers
CREATE POLICY "Employees can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Employees can create customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Employees can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

-- RLS Policies for orders
CREATE POLICY "Employees can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Employees can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Employees can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

-- RLS Policies for order_items
CREATE POLICY "Employees can view order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Employees can create order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Employees can update order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

CREATE POLICY "Employees can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

-- RLS Policies for employee_profiles
CREATE POLICY "Employees can view their own profile"
  ON employee_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON employee_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role = 'admin'
      AND ep.active = true
    )
  );

CREATE POLICY "Admins can manage all profiles"
  ON employee_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles ep
      WHERE ep.id = auth.uid()
      AND ep.role = 'admin'
      AND ep.active = true
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for orders updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();