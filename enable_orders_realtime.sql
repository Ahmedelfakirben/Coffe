-- Script SQL para habilitar Supabase Realtime en 'orders' y 'order_items'
-- Ejecutar en el SQL Editor de tu panel de Supabase

DO $$
BEGIN
    -- Agregar tabla 'orders' a la publicación de realtime si no está
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    -- Agregar tabla 'order_items' a la publicación de realtime si no está
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'order_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    END IF;
END $$;

-- Habilitar REPLICA IDENTITY FULL para que los eventos emitan todos los datos
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;

-- Consulta de verificación: Deberías ver 'orders' y 'order_items' listadas abajo
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('orders', 'order_items');
