-- Primero, actualizamos los estados existentes
UPDATE orders 
SET status = 'preparing' 
WHERE status IN ('pending', 'ready');

-- Modificamos la tabla orders para tener solo los estados que necesitamos
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('preparing', 'completed', 'cancelled'));

-- Creamos una tabla para el historial de órdenes
CREATE TABLE IF NOT EXISTS order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'cancelled')),
  status text NOT NULL,
  total decimal(10,2),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Creamos índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_employee_id ON order_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_order_history_customer_id ON order_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at DESC);

-- Habilitamos RLS en la nueva tabla
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para order_history
CREATE POLICY "Employees can view order history"
  ON order_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE employee_profiles.id = auth.uid()
      AND employee_profiles.active = true
    )
  );

-- Crear una función trigger para registrar cambios automáticamente
CREATE OR REPLACE FUNCTION record_order_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Registrar la creación de la orden
    INSERT INTO order_history (
      order_id, 
      employee_id, 
      customer_id, 
      action,
      status,
      total,
      notes
    ) VALUES (
      NEW.id,
      NEW.employee_id,
      NEW.customer_id,
      'created',
      NEW.status,
      NEW.total,
      NEW.notes
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Registrar la actualización de la orden
    IF OLD.status != NEW.status THEN
      INSERT INTO order_history (
        order_id,
        employee_id,
        customer_id,
        action,
        status,
        total,
        notes
      ) VALUES (
        NEW.id,
        NEW.employee_id,
        NEW.customer_id,
        CASE 
          WHEN NEW.status = 'completed' THEN 'completed'
          WHEN NEW.status = 'cancelled' THEN 'cancelled'
          ELSE 'updated'
        END,
        NEW.status,
        NEW.total,
        NEW.notes
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS orders_history_trigger ON orders;
CREATE TRIGGER orders_history_trigger
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION record_order_history();