-- ============================================
-- INSTALACIÓN RÁPIDA DEL SISTEMA DE BACKUP
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- PASO 1: Agregar permiso de backup para super_admin
INSERT INTO role_permissions (role, section, page_id, can_access)
VALUES ('super_admin', 'system', 'backup', true)
ON CONFLICT (role, section, page_id)
DO UPDATE SET can_access = true;

-- PASO 2: Crear tabla de historial de backups
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

-- PASO 3: Habilitar Row Level Security
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- PASO 4: Crear política para ver historial (solo super_admin)
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

-- PASO 5: Crear política para insertar registros (solo super_admin)
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

-- VERIFICACIÓN FINAL
SELECT
  'Permiso de backup creado' as mensaje,
  role,
  section,
  page_id,
  can_access
FROM role_permissions
WHERE page_id = 'backup';
