-- Fix order_history triggers and schema inconsistencies
-- Drops conflicting trigger/function and ensures the history works with the frontend expectations

-- Drop conflicting trigger and function introduced in later migration
DROP TRIGGER IF EXISTS orders_history_trigger ON public.orders;
DROP FUNCTION IF EXISTS public.record_order_history();

-- Ensure order_history has FK to employee_profiles(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'order_history'
  ) THEN
    -- Drop any existing FK on employee_id to avoid mismatches
    BEGIN
      ALTER TABLE public.order_history DROP CONSTRAINT IF EXISTS order_history_employee_id_fkey;
    EXCEPTION WHEN undefined_object THEN
      -- Ignore if constraint does not exist
    END;

    -- Add FK to employee_profiles(id)
    ALTER TABLE public.order_history
      ADD CONSTRAINT order_history_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employee_profiles(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Recreate indices if missing
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON public.order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON public.order_history(created_at);

-- Recreate the handle_order_change function to ensure consistent behavior
CREATE OR REPLACE FUNCTION public.handle_order_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.order_history (
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
                FROM public.order_items oi
                WHERE oi.order_id = NEW.id
            ),
            NEW.employee_id,
            NEW.created_at
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.order_history (
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
                FROM public.order_items oi
                WHERE oi.order_id = NEW.id
            ),
            NEW.employee_id,
            NOW()
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Ensure only one trigger is active for orders history
DROP TRIGGER IF EXISTS orders_audit_trigger ON public.orders;
CREATE TRIGGER orders_audit_trigger
    AFTER INSERT OR UPDATE
    ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_change();