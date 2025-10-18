-- Add order numbering system that resets daily
-- This migration adds a function to generate sequential order numbers

-- Add order_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_number integer;
  END IF;
END$$;

-- Create function to generate next order number for the day
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS integer AS $$
DECLARE
  today_start timestamptz;
  next_number integer;
BEGIN
  -- Get start of today (00:00:00)
  today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  -- Get the highest order number for today, or 0 if none
  SELECT COALESCE(MAX(order_number), 0) INTO next_number
  FROM orders
  WHERE created_at >= today_start;

  -- Return next number
  RETURN next_number + 1;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-assign order numbers
CREATE OR REPLACE FUNCTION assign_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign if order_number is not already set
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign order numbers on insert
DROP TRIGGER IF EXISTS assign_order_number_trigger ON orders;
CREATE TRIGGER assign_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION assign_order_number();

-- Create index for order_number for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Update existing orders that don't have order numbers (optional)
-- This will assign numbers based on creation order within each day
-- UPDATE orders SET order_number = sub.row_num
-- FROM (
--   SELECT id, ROW_NUMBER() OVER (PARTITION BY DATE(created_at) ORDER BY created_at) as row_num
--   FROM orders
--   WHERE order_number IS NULL
-- ) sub
-- WHERE orders.id = sub.id;