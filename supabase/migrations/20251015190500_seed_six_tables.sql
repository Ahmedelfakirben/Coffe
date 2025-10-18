-- Seed six dining tables
INSERT INTO public.tables (name, seats, status)
VALUES
  ('Mesa 1', 4, 'available'),
  ('Mesa 2', 4, 'available'),
  ('Mesa 3', 4, 'available'),
  ('Mesa 4', 4, 'available'),
  ('Mesa 5', 4, 'available'),
  ('Mesa 6', 4, 'available');

-- If tables already exist, ignore conflicts on unique name
-- (Run-time behavior depends on migration runner; for safety):
-- INSERT INTO public.tables (name, seats, status)
-- VALUES ('Mesa 1', 4, 'available')
-- ON CONFLICT (name) DO NOTHING;