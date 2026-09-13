-- ==============================================================================
-- SCRIPT: ELIMINAR TODAS LAS MESAS Y CREAR DE MESA 1 A MESA 34 (4 PERSONAS)
-- ==============================================================================
-- Este script realiza lo siguiente:
-- 1. Desvincula cualquier pedido antiguo que estuviese asociado a mesas anteriores.
-- 2. Elimina todas las mesas existentes.
-- 3. Inserta 34 mesas: "Mesa 1", "Mesa 2", ..., "Mesa 34".
-- 4. Todas con capacidad para 4 personas (seats = 4) y estado 'available'.
-- 5. Las distribuye automáticamente en una cuadrícula visual para la vista de Sala.
-- ==============================================================================

BEGIN;

-- 1. Asegurar columnas de soporte gráfico por si la tabla no las tenía
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS pos_x INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pos_y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS shape TEXT DEFAULT 'rectangle',
ADD COLUMN IF NOT EXISTS zone_id TEXT DEFAULT 'main';

-- 2. Desvincular pedidos anteriores para evitar errores de clave foránea (FK)
UPDATE public.orders 
SET table_id = NULL 
WHERE table_id IS NOT NULL;

-- 3. Eliminar todas las mesas actuales
DELETE FROM public.tables;

-- 4. Insertar las 34 mesas (Mesa 1 a Mesa 34) de 4 personas
INSERT INTO public.tables (name, seats, status, pos_x, pos_y, width, height, shape, zone_id)
SELECT 
    'Mesa ' || i AS name,
    4 AS seats,
    'available' AS status,
    100 + (((i - 1) % 6) * 160) AS pos_x,   -- Coloca 6 mesas por fila en la vista interactiva
    100 + (((i - 1) / 6) * 160) AS pos_y,
    120 AS width,
    120 AS height,
    'rectangle' AS shape,
    'main' AS zone_id
FROM generate_series(1, 34) AS i;

COMMIT;

-- 5. Comprobación final: listar las mesas creadas
SELECT name, seats, status 
FROM public.tables 
ORDER BY length(name), name;
