/*
  # Alter employee_profiles: add email and deleted_at for soft delete

  - Adds `email` column to store the user's email for admin operations like password reset.
  - Adds `deleted_at` column to mark logical deletion without removing auth user, preserving order history.
*/

-- Add email column if it does not exist
ALTER TABLE IF EXISTS employee_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Add deleted_at column if it does not exist
ALTER TABLE IF EXISTS employee_profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Optional: index to filter by deleted_at quickly
CREATE INDEX IF NOT EXISTS idx_employee_profiles_deleted_at ON employee_profiles(deleted_at);

-- Note: We intentionally do not delete from auth.users to preserve order linkages.
-- Orders.employee_id references auth.users(id) ON DELETE SET NULL; by avoiding deletion of auth users,
-- historical orders keep the association.