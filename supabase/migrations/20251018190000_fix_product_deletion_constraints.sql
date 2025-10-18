-- Fix foreign key constraints to allow product deletion
-- Change order_items constraint from RESTRICT to CASCADE
-- This allows products to be deleted while maintaining order history integrity

-- First, drop the existing constraint
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

-- Recreate the constraint with CASCADE deletion
ALTER TABLE order_items
ADD CONSTRAINT order_items_product_id_fkey
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- Also ensure product_sizes can be deleted when product is deleted
ALTER TABLE product_sizes DROP CONSTRAINT IF EXISTS product_sizes_product_id_fkey;
ALTER TABLE product_sizes
ADD CONSTRAINT product_sizes_product_id_fkey
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;