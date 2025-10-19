-- Crear tabla para registrar pedidos eliminados
CREATE TABLE IF NOT EXISTS deleted_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  order_number INTEGER,
  total DECIMAL(10, 2) NOT NULL,
  items JSONB NOT NULL,
  deleted_by UUID REFERENCES employee_profiles(id) NOT NULL,
  deletion_note TEXT NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_deleted_orders_deleted_at ON deleted_orders(deleted_at);
CREATE INDEX idx_deleted_orders_deleted_by ON deleted_orders(deleted_by);
CREATE INDEX idx_deleted_orders_order_id ON deleted_orders(order_id);

-- Habilitar RLS
ALTER TABLE deleted_orders ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Empleados pueden ver pedidos eliminados"
  ON deleted_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden insertar pedidos eliminados"
  ON deleted_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Comentarios
COMMENT ON TABLE deleted_orders IS 'Registro de pedidos eliminados por administradores con notas explicativas';
COMMENT ON COLUMN deleted_orders.order_id IS 'ID del pedido original eliminado';
COMMENT ON COLUMN deleted_orders.order_number IS 'Número del pedido eliminado';
COMMENT ON COLUMN deleted_orders.total IS 'Total del pedido eliminado';
COMMENT ON COLUMN deleted_orders.items IS 'Items del pedido en formato JSON';
COMMENT ON COLUMN deleted_orders.deleted_by IS 'ID del administrador que eliminó el pedido';
COMMENT ON COLUMN deleted_orders.deletion_note IS 'Nota explicando la razón de la eliminación';
COMMENT ON COLUMN deleted_orders.deleted_at IS 'Fecha y hora de eliminación';
