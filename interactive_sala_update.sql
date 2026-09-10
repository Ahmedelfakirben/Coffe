-- SQL Script: Actualización de la tabla 'tables' para Plano Interactivo (Drag & Drop)

-- Añadir nuevas columnas si no existen
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS pos_x INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pos_y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS shape TEXT DEFAULT 'rectangle', -- options: 'rectangle', 'circle', 'square'
ADD COLUMN IF NOT EXISTS zone_id TEXT DEFAULT 'main';

-- Añadir comentarios descriptivos
COMMENT ON COLUMN tables.pos_x IS 'Posición X horizontal en el lienzo del plano interactivo';
COMMENT ON COLUMN tables.pos_y IS 'Posición Y vertical en el lienzo del plano interactivo';
COMMENT ON COLUMN tables.width IS 'Ancho visual de la mesa en píxeles';
COMMENT ON COLUMN tables.height IS 'Alto visual de la mesa en píxeles';
COMMENT ON COLUMN tables.shape IS 'Forma de la mesa (rectangle, circle, square)';
COMMENT ON COLUMN tables.zone_id IS 'Identificador de la zona o salón (ej. terraza, interior)';
