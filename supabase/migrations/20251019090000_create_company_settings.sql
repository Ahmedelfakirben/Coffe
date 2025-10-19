-- Crear tabla para configuración de la empresa
-- Solo el super_admin puede modificar esta información

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL DEFAULT 'Coffee Shop',
  address TEXT,
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración por defecto
INSERT INTO company_settings (company_name, address, phone)
VALUES ('Coffee Shop', 'Calle Principal #123', '+34 000 000 000')
ON CONFLICT DO NOTHING;

-- Solo puede haber un registro de configuración
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_settings_singleton ON company_settings ((true));

-- Habilitar RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer la configuración
CREATE POLICY "Todos pueden leer configuración de empresa"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

-- Solo super_admin puede actualizar
CREATE POLICY "Solo super_admin puede actualizar configuración"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_settings_updated_at_trigger
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_settings_updated_at();

-- Comentarios
COMMENT ON TABLE company_settings IS 'Configuración global de la empresa - nombre, dirección, teléfono';
COMMENT ON COLUMN company_settings.company_name IS 'Nombre de la empresa que aparece en tickets y reportes';
COMMENT ON COLUMN company_settings.address IS 'Dirección física de la empresa';
COMMENT ON COLUMN company_settings.phone IS 'Número de teléfono de contacto';
