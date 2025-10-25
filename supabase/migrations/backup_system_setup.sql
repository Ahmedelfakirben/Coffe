-- ============================================
-- SISTEMA DE BACKUP - CONFIGURACIÓN
-- ============================================
-- Este archivo configura el sistema de backup
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. AGREGAR PERMISO DE BACKUP PARA SUPER_ADMIN
-- ============================================

INSERT INTO role_permissions (role, section, page_id, can_access)
VALUES ('super_admin', 'system', 'backup', true)
ON CONFLICT (role, section, page_id)
DO UPDATE SET
  can_access = true;

-- Verificar que se agregó correctamente
SELECT * FROM role_permissions WHERE page_id = 'backup';


-- 2. CREAR TABLA DE HISTORIAL DE BACKUPS (OPCIONAL)
-- ============================================

CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  backup_type VARCHAR(20) CHECK (backup_type IN ('manual', 'automatic')) DEFAULT 'manual',
  size_mb DECIMAL(10,2) NOT NULL,
  tables_included TEXT[] NOT NULL,
  status VARCHAR(20) CHECK (status IN ('completed', 'failed')) DEFAULT 'completed',
  notes TEXT
);

-- Agregar comentarios a la tabla
COMMENT ON TABLE backup_history IS 'Registro histórico de backups creados en el sistema';
COMMENT ON COLUMN backup_history.created_by IS 'ID del usuario que creó el backup';
COMMENT ON COLUMN backup_history.backup_type IS 'Tipo de backup: manual o automatic';
COMMENT ON COLUMN backup_history.size_mb IS 'Tamaño del backup en megabytes';
COMMENT ON COLUMN backup_history.tables_included IS 'Array de nombres de tablas incluidas en el backup';
COMMENT ON COLUMN backup_history.status IS 'Estado del backup: completed o failed';


-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;


-- 4. POLÍTICAS DE SEGURIDAD
-- ============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Super admins can view backup history" ON backup_history;
DROP POLICY IF EXISTS "Super admins can insert backup history" ON backup_history;
DROP POLICY IF EXISTS "Super admins can delete old backup history" ON backup_history;

-- Política para ver historial (solo super_admin)
CREATE POLICY "Super admins can view backup history"
  ON backup_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
      AND employee_profiles.active = true
      AND employee_profiles.deleted_at IS NULL
    )
  );

-- Política para insertar registros (solo super_admin)
CREATE POLICY "Super admins can insert backup history"
  ON backup_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
      AND employee_profiles.active = true
      AND employee_profiles.deleted_at IS NULL
    )
  );

-- Política para eliminar registros antiguos (solo super_admin)
CREATE POLICY "Super admins can delete old backup history"
  ON backup_history
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
      AND employee_profiles.active = true
      AND employee_profiles.deleted_at IS NULL
    )
  );


-- 5. ÍNDICES PARA MEJORAR RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_backup_history_created_at
  ON backup_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_history_created_by
  ON backup_history(created_by);

CREATE INDEX IF NOT EXISTS idx_backup_history_status
  ON backup_history(status);


-- 6. FUNCIÓN PARA LIMPIAR HISTORIAL ANTIGUO
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_backup_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar registros más antiguos que el número de días especificado
  DELETE FROM backup_history
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agregar comentario a la función
COMMENT ON FUNCTION cleanup_old_backup_history IS 'Elimina registros de backup_history más antiguos que el número de días especificado (por defecto 90 días)';


-- 7. VERIFICACIÓN FINAL
-- ============================================

-- Mostrar permisos de backup
SELECT
  role,
  page_id,
  page_name,
  can_access
FROM role_permissions
WHERE page_id = 'backup';

-- Mostrar estructura de la tabla
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'backup_history'
ORDER BY ordinal_position;

-- Mostrar políticas RLS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'backup_history';


-- ============================================
-- INSTRUCCIONES DE USO
-- ============================================

-- Para limpiar backups antiguos (más de 90 días):
-- SELECT cleanup_old_backup_history(90);

-- Para ver estadísticas de backups:
-- SELECT
--   backup_type,
--   COUNT(*) as total,
--   AVG(size_mb) as avg_size_mb,
--   SUM(size_mb) as total_size_mb
-- FROM backup_history
-- GROUP BY backup_type;

-- Para ver los últimos 10 backups:
-- SELECT
--   b.created_at,
--   e.full_name as created_by,
--   b.backup_type,
--   b.size_mb,
--   array_length(b.tables_included, 1) as tables_count,
--   b.status
-- FROM backup_history b
-- LEFT JOIN employee_profiles e ON b.created_by = e.id
-- ORDER BY b.created_at DESC
-- LIMIT 10;

-- ============================================
-- FIN DE LA CONFIGURACIÓN
-- ============================================
