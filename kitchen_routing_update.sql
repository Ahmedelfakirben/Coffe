-- SQL para añadir Zonas de Preparación a las categorías
-- Esto permite el Kitchen Routing (enviar diferentes productos a diferentes impresoras vía QZ Tray)

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS preparation_zone TEXT DEFAULT 'General';

COMMENT ON COLUMN categories.preparation_zone IS 'El nombre exacto de la impresora en QZ Tray (Ej: EPSON_Pizza, POS-80-Crepes). Si está vacío o es General, va a la principal.';
