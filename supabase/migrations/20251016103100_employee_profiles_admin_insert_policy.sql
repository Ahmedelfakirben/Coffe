-- Allow admins to insert employee profiles (explicit INSERT policy with WITH CHECK)
-- Complements existing "Admins can manage all profiles" policy that might not include WITH CHECK for INSERT

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_profiles'
      AND policyname = 'Admins can insert profiles'
  ) THEN
    CREATE POLICY "Admins can insert profiles"
      ON public.employee_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employee_profiles ep
          WHERE ep.id = auth.uid()
            AND ep.role = 'admin'
            AND ep.active = true
        )
      );
  END IF;
END $$;