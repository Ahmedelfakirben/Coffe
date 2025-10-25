-- ============================================
-- SISTEMA DE CAMBIO DE DIVISA GLOBAL
-- ============================================
-- Similar al sistema de idiomas
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. CREAR TABLA DE CONFIGURACIÓN DE DIVISA
-- ============================================

CREATE TABLE IF NOT EXISTS app_currency_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'EUR',
  currency_symbol VARCHAR(5) NOT NULL DEFAULT '€',
  currency_name VARCHAR(50) NOT NULL DEFAULT 'Euro',
  decimal_places INTEGER NOT NULL DEFAULT 2,
  position VARCHAR(10) NOT NULL DEFAULT 'after' CHECK (position IN ('before', 'after')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE app_currency_settings IS 'Configuración global de divisa para toda la aplicación';
COMMENT ON COLUMN app_currency_settings.currency_code IS 'Código ISO 4217 de la divisa (EUR, USD, GBP, etc.)';
COMMENT ON COLUMN app_currency_settings.currency_symbol IS 'Símbolo de la divisa (€, $, £, etc.)';
COMMENT ON COLUMN app_currency_settings.currency_name IS 'Nombre completo de la divisa';
COMMENT ON COLUMN app_currency_settings.decimal_places IS 'Cantidad de decimales a mostrar';
COMMENT ON COLUMN app_currency_settings.position IS 'Posición del símbolo: before (antes) o after (después)';


-- 2. INSERTAR CONFIGURACIÓN POR DEFECTO (EUR)
-- ============================================

INSERT INTO app_currency_settings (
  currency_code,
  currency_symbol,
  currency_name,
  decimal_places,
  position
)
VALUES (
  'EUR',
  '€',
  'Euro',
  2,
  'after'
)
ON CONFLICT (id) DO NOTHING;

-- Solo debe haber una fila en esta tabla
-- Si ya existe, no insertar duplicados
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM app_currency_settings) > 1 THEN
    DELETE FROM app_currency_settings WHERE id NOT IN (
      SELECT id FROM app_currency_settings ORDER BY created_at ASC LIMIT 1
    );
  END IF;
END $$;


-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE app_currency_settings ENABLE ROW LEVEL SECURITY;


-- 4. POLÍTICAS DE SEGURIDAD
-- ============================================

-- Todos pueden ver la configuración de divisa (para mostrarla en la app)
CREATE POLICY "Anyone can view currency settings"
  ON app_currency_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo super_admin puede actualizar la divisa
CREATE POLICY "Super admins can update currency settings"
  ON app_currency_settings
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


-- 5. FUNCIÓN PARA ACTUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_currency_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar automáticamente updated_at
CREATE TRIGGER update_currency_settings_timestamp
  BEFORE UPDATE ON app_currency_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_currency_settings_updated_at();


-- 6. VISTA PARA INFORMACIÓN DE DIVISA
-- ============================================

CREATE OR REPLACE VIEW current_currency AS
SELECT
  currency_code,
  currency_symbol,
  currency_name,
  decimal_places,
  position,
  updated_at as last_changed
FROM app_currency_settings
LIMIT 1;

COMMENT ON VIEW current_currency IS 'Vista para obtener la divisa actual de forma rápida';


-- 7. FUNCIÓN PARA FORMATEAR MONTOS
-- ============================================

CREATE OR REPLACE FUNCTION format_currency(amount NUMERIC)
RETURNS TEXT AS $$
DECLARE
  currency_rec RECORD;
  formatted TEXT;
BEGIN
  -- Obtener configuración actual
  SELECT * INTO currency_rec FROM current_currency LIMIT 1;

  -- Formatear el monto
  formatted := TO_CHAR(amount, 'FM999,999,999,990.00');

  -- Agregar símbolo según posición
  IF currency_rec.position = 'before' THEN
    RETURN currency_rec.currency_symbol || ' ' || formatted;
  ELSE
    RETURN formatted || ' ' || currency_rec.currency_symbol;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION format_currency IS 'Formatea un monto según la configuración de divisa actual';


-- 8. DIVISAS PREDEFINIDAS (PARA REFERENCIA)
-- ============================================

-- Crear tabla de divisas disponibles (opcional)
CREATE TABLE IF NOT EXISTS available_currencies (
  code VARCHAR(3) PRIMARY KEY,
  symbol VARCHAR(5) NOT NULL,
  name VARCHAR(50) NOT NULL,
  decimal_places INTEGER DEFAULT 2,
  symbol_position VARCHAR(10) DEFAULT 'after'
);

-- Insertar divisas comunes
INSERT INTO available_currencies (code, symbol, name, decimal_places, symbol_position) VALUES
  ('EUR', '€', 'Euro', 2, 'after'),
  ('USD', '$', 'US Dollar', 2, 'before'),
  ('MAD', 'DH', 'Dirham Marroquí', 2, 'after'),
  ('GBP', '£', 'British Pound', 2, 'before'),
  ('JPY', '¥', 'Japanese Yen', 0, 'before'),
  ('CHF', 'CHF', 'Swiss Franc', 2, 'after'),
  ('CAD', 'CA$', 'Canadian Dollar', 2, 'before'),
  ('AUD', 'A$', 'Australian Dollar', 2, 'before'),
  ('CNY', '¥', 'Chinese Yuan', 2, 'before'),
  ('SEK', 'kr', 'Swedish Krona', 2, 'after'),
  ('NOK', 'kr', 'Norwegian Krone', 2, 'after'),
  ('DKK', 'kr', 'Danish Krone', 2, 'after'),
  ('PLN', 'zł', 'Polish Zloty', 2, 'after'),
  ('CZK', 'Kč', 'Czech Koruna', 2, 'after'),
  ('HUF', 'Ft', 'Hungarian Forint', 0, 'after'),
  ('RON', 'lei', 'Romanian Leu', 2, 'after'),
  ('BGN', 'лв', 'Bulgarian Lev', 2, 'after'),
  ('HRK', 'kn', 'Croatian Kuna', 2, 'after'),
  ('RUB', '₽', 'Russian Ruble', 2, 'after'),
  ('TRY', '₺', 'Turkish Lira', 2, 'after'),
  ('INR', '₹', 'Indian Rupee', 2, 'before'),
  ('BRL', 'R$', 'Brazilian Real', 2, 'before'),
  ('MXN', 'MX$', 'Mexican Peso', 2, 'before'),
  ('ZAR', 'R', 'South African Rand', 2, 'before'),
  ('KRW', '₩', 'South Korean Won', 0, 'before'),
  ('SGD', 'S$', 'Singapore Dollar', 2, 'before'),
  ('HKD', 'HK$', 'Hong Kong Dollar', 2, 'before'),
  ('NZD', 'NZ$', 'New Zealand Dollar', 2, 'before'),
  ('THB', '฿', 'Thai Baht', 2, 'before'),
  ('MYR', 'RM', 'Malaysian Ringgit', 2, 'before'),
  ('IDR', 'Rp', 'Indonesian Rupiah', 0, 'before')
ON CONFLICT (code) DO NOTHING;

-- Habilitar RLS para available_currencies
ALTER TABLE available_currencies ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver las divisas disponibles
CREATE POLICY "Anyone can view available currencies"
  ON available_currencies
  FOR SELECT
  TO authenticated
  USING (true);


-- 9. VERIFICACIÓN FINAL
-- ============================================

-- Mostrar configuración actual
SELECT
  'Configuración de divisa creada' as mensaje,
  currency_code,
  currency_symbol,
  currency_name,
  decimal_places,
  position
FROM app_currency_settings
LIMIT 1;

-- Mostrar divisas disponibles
SELECT COUNT(*) as total_currencies_available
FROM available_currencies;

-- Probar función de formateo
SELECT format_currency(1234.56) as ejemplo_formato;


-- ============================================
-- INSTRUCCIONES DE USO
-- ============================================

-- Para cambiar la divisa:
-- UPDATE app_currency_settings
-- SET currency_code = 'USD',
--     currency_symbol = '$',
--     currency_name = 'US Dollar',
--     position = 'before';

-- Para ver la divisa actual:
-- SELECT * FROM current_currency;

-- Para formatear un monto:
-- SELECT format_currency(1500.75);

-- Para ver todas las divisas disponibles:
-- SELECT * FROM available_currencies ORDER BY name;

-- ============================================
-- FIN DE LA CONFIGURACIÓN
-- ============================================
