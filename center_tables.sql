-- Centrar las mesas existentes en el lienzo de 3000x2000
-- (Versión corregida para PostgreSQL)

WITH numbered_tables AS (
  SELECT id, ROW_NUMBER() OVER(ORDER BY name) as rn
  FROM tables
  WHERE pos_x = 0 AND pos_y = 0
)
UPDATE tables t
SET 
  pos_x = 1000 + (nt.rn * 150) % 1000,
  pos_y = 800 + ((nt.rn * 150) / 1000) * 150,
  width = 120,
  height = 120,
  shape = 'rectangle'
FROM numbered_tables nt
WHERE t.id = nt.id;
