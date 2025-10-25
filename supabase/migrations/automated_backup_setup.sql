-- ============================================
-- SISTEMA DE BACKUP AUTOMÁTICO CON S3
-- ============================================
-- Este archivo configura el backup automático
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. CREAR TABLA DE CONFIGURACIÓN DE BACKUP AUTOMÁTICO
-- ============================================

CREATE TABLE IF NOT EXISTS backup_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tables TEXT[] NOT NULL DEFAULT ARRAY[
    'products',
    'categories',
    'orders',
    'order_items',
    'employee_profiles',
    'cash_register_sessions',
    'role_permissions',
    'company_settings',
    'app_settings',
    'tables',
    'servers'
  ],
  s3_enabled BOOLEAN DEFAULT true,
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_time VARCHAR(5) DEFAULT '02:00', -- HH:mm formato 24h
  schedule_frequency VARCHAR(20) DEFAULT 'daily' CHECK (schedule_frequency IN ('daily', 'weekly', 'monthly')),
  retention_days INTEGER DEFAULT 30,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  next_backup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE backup_config IS 'Configuración de backups automáticos a S3';
COMMENT ON COLUMN backup_config.tables IS 'Lista de tablas a incluir en el backup';
COMMENT ON COLUMN backup_config.s3_enabled IS 'Si los backups se suben a S3';
COMMENT ON COLUMN backup_config.schedule_enabled IS 'Si los backups automáticos están activos';
COMMENT ON COLUMN backup_config.schedule_time IS 'Hora del día para ejecutar backup (HH:mm)';
COMMENT ON COLUMN backup_config.schedule_frequency IS 'Frecuencia: daily, weekly, monthly';
COMMENT ON COLUMN backup_config.retention_days IS 'Días de retención de backups antiguos';
COMMENT ON COLUMN backup_config.last_backup_at IS 'Última vez que se ejecutó un backup automático';
COMMENT ON COLUMN backup_config.next_backup_at IS 'Próxima ejecución programada';


-- 2. INSERTAR CONFIGURACIÓN POR DEFECTO
-- ============================================

INSERT INTO backup_config (
  tables,
  s3_enabled,
  schedule_enabled,
  schedule_time,
  schedule_frequency,
  retention_days
)
VALUES (
  ARRAY[
    'products',
    'categories',
    'orders',
    'order_items',
    'employee_profiles',
    'cash_register_sessions',
    'role_permissions',
    'company_settings',
    'app_settings',
    'tables',
    'servers'
  ],
  true,      -- S3 habilitado
  false,     -- Backups automáticos deshabilitados por defecto
  '02:00',   -- A las 2 AM
  'daily',   -- Diario
  30         -- Retener 30 días
)
ON CONFLICT (id) DO NOTHING;


-- 3. HABILITAR ROW LEVEL SECURITY
-- ============================================

ALTER TABLE backup_config ENABLE ROW LEVEL SECURITY;


-- 4. POLÍTICAS DE SEGURIDAD
-- ============================================

-- Solo super_admin puede ver configuración
CREATE POLICY "Super admins can view backup config"
  ON backup_config
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

-- Solo super_admin puede actualizar configuración
CREATE POLICY "Super admins can update backup config"
  ON backup_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
      AND employee_profiles.active = true
      AND employee_profiles.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.role = 'super_admin'
      AND employee_profiles.active = true
      AND employee_profiles.deleted_at IS NULL
    )
  );

-- Solo super_admin puede insertar configuración
CREATE POLICY "Super admins can insert backup config"
  ON backup_config
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


-- 5. FUNCIÓN PARA ACTUALIZAR next_backup_at
-- ============================================

CREATE OR REPLACE FUNCTION calculate_next_backup_time()
RETURNS TRIGGER AS $$
DECLARE
  next_time TIMESTAMP WITH TIME ZONE;
  schedule_hour INTEGER;
  schedule_minute INTEGER;
BEGIN
  -- Extraer hora y minuto del schedule_time
  schedule_hour := CAST(SPLIT_PART(NEW.schedule_time, ':', 1) AS INTEGER);
  schedule_minute := CAST(SPLIT_PART(NEW.schedule_time, ':', 2) AS INTEGER);

  -- Calcular próxima ejecución según frecuencia
  CASE NEW.schedule_frequency
    WHEN 'daily' THEN
      next_time := (CURRENT_DATE + INTERVAL '1 day' +
                   (schedule_hour || ' hours')::INTERVAL +
                   (schedule_minute || ' minutes')::INTERVAL);
    WHEN 'weekly' THEN
      next_time := (CURRENT_DATE + INTERVAL '7 days' +
                   (schedule_hour || ' hours')::INTERVAL +
                   (schedule_minute || ' minutes')::INTERVAL);
    WHEN 'monthly' THEN
      next_time := (CURRENT_DATE + INTERVAL '1 month' +
                   (schedule_hour || ' hours')::INTERVAL +
                   (schedule_minute || ' minutes')::INTERVAL);
    ELSE
      next_time := NULL;
  END CASE;

  -- Si está habilitado, establecer next_backup_at
  IF NEW.schedule_enabled THEN
    NEW.next_backup_at := next_time;
  ELSE
    NEW.next_backup_at := NULL;
  END IF;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular automáticamente next_backup_at
CREATE TRIGGER update_next_backup_time
  BEFORE INSERT OR UPDATE ON backup_config
  FOR EACH ROW
  EXECUTE FUNCTION calculate_next_backup_time();


-- 6. FUNCIÓN PARA LIMPIAR BACKUPS ANTIGUOS AUTOMÁTICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION auto_cleanup_old_backups()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  retention_days INTEGER;
BEGIN
  -- Obtener días de retención de la configuración
  SELECT bc.retention_days INTO retention_days
  FROM backup_config bc
  LIMIT 1;

  -- Si no hay configuración, usar 30 días por defecto
  IF retention_days IS NULL THEN
    retention_days := 30;
  END IF;

  -- Eliminar backups antiguos
  DELETE FROM backup_history
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. ACTUALIZAR TABLA backup_history PARA S3
-- ============================================

-- Agregar columna para URL de S3 si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_history'
    AND column_name = 's3_url'
  ) THEN
    ALTER TABLE backup_history ADD COLUMN s3_url TEXT;
  END IF;
END $$;

-- Agregar columna para nombre de archivo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'backup_history'
    AND column_name = 'file_name'
  ) THEN
    ALTER TABLE backup_history ADD COLUMN file_name VARCHAR(255);
  END IF;
END $$;

-- Comentarios
COMMENT ON COLUMN backup_history.s3_url IS 'URL del backup en S3 storage';
COMMENT ON COLUMN backup_history.file_name IS 'Nombre del archivo de backup';


-- 8. ÍNDICES PARA RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_backup_history_s3_url
  ON backup_history(s3_url) WHERE s3_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_backup_history_backup_type_created
  ON backup_history(backup_type, created_at DESC);


-- 9. VISTA PARA ESTADÍSTICAS DE BACKUP
-- ============================================

CREATE OR REPLACE VIEW backup_statistics AS
SELECT
  backup_type,
  COUNT(*) as total_backups,
  AVG(size_mb) as avg_size_mb,
  SUM(size_mb) as total_size_mb,
  MAX(created_at) as last_backup,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN s3_url IS NOT NULL THEN 1 END) as s3_backups_count
FROM backup_history
GROUP BY backup_type;

COMMENT ON VIEW backup_statistics IS 'Estadísticas de backups por tipo';


-- 10. VERIFICACIÓN FINAL
-- ============================================

-- Mostrar configuración creada
SELECT
  'Configuración de backup creada' as mensaje,
  tables,
  s3_enabled,
  schedule_enabled,
  schedule_time,
  schedule_frequency,
  retention_days
FROM backup_config
LIMIT 1;

-- Mostrar estructura de backup_config
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'backup_config'
ORDER BY ordinal_position;

-- Mostrar políticas
SELECT
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'backup_config';


-- ============================================
-- INSTRUCCIONES DE USO
-- ============================================

-- Para habilitar backups automáticos:
-- UPDATE backup_config SET schedule_enabled = true;

-- Para cambiar la hora de backup:
-- UPDATE backup_config SET schedule_time = '03:00';

-- Para cambiar la frecuencia:
-- UPDATE backup_config SET schedule_frequency = 'weekly';

-- Para ver estadísticas:
-- SELECT * FROM backup_statistics;

-- Para limpiar backups antiguos manualmente:
-- SELECT auto_cleanup_old_backups();

-- ============================================
-- FIN DE LA CONFIGURACIÓN
-- ============================================
