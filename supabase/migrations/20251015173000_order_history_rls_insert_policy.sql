-- Allow inserting into order_history under RLS for authenticated employees

-- Ensure RLS is enabled (safe to run multiple times)
ALTER TABLE IF EXISTS public.order_history ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy so triggers can write history rows
DROP POLICY IF EXISTS "Employees can insert order history" ON public.order_history;
CREATE POLICY "Employees can insert order history"
  ON public.order_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE public.employee_profiles.id = auth.uid()
        AND public.employee_profiles.active = true
    )
    AND employee_id = auth.uid()
  );

-- (Optional) Allow updates if needed in the future
DROP POLICY IF EXISTS "Employees can update order history" ON public.order_history;
CREATE POLICY "Employees can update order history"
  ON public.order_history
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE public.employee_profiles.id = auth.uid()
        AND public.employee_profiles.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employee_profiles
      WHERE public.employee_profiles.id = auth.uid()
        AND public.employee_profiles.active = true
    )
    AND employee_id = auth.uid()
  );