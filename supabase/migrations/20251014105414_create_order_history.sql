-- Create order_history table
CREATE TABLE IF NOT EXISTS order_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'completed', 'cancelled')),
    status TEXT NOT NULL CHECK (status IN ('preparing', 'completed', 'cancelled')),
    total DECIMAL(10,2) NOT NULL,
    items JSONB,
    employee_id UUID REFERENCES employee_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('UTC'::text, now()) NOT NULL
);

-- Create function to handle order changes
CREATE OR REPLACE FUNCTION handle_order_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- When a new order is created
        INSERT INTO order_history (
            order_id,
            action,
            status,
            total,
            items,
            employee_id,
            created_at
        ) VALUES (
            NEW.id,
            'created',
            NEW.status,
            NEW.total,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'size_id', oi.size_id
                    )
                )
                FROM order_items oi
                WHERE oi.order_id = NEW.id
            ),
            NEW.employee_id,
            NEW.created_at
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- When an order is updated
        INSERT INTO order_history (
            order_id,
            action,
            status,
            total,
            items,
            employee_id,
            created_at
        ) VALUES (
            NEW.id,
            CASE
                WHEN NEW.status = 'completed' THEN 'completed'
                WHEN NEW.status = 'cancelled' THEN 'cancelled'
                ELSE 'updated'
            END,
            NEW.status,
            NEW.total,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'size_id', oi.size_id
                    )
                )
                FROM order_items oi
                WHERE oi.order_id = NEW.id
            ),
            NEW.employee_id,
            NOW()
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for orders table
DROP TRIGGER IF EXISTS orders_audit_trigger ON orders;
CREATE TRIGGER orders_audit_trigger
    AFTER INSERT OR UPDATE
    ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_change();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at);