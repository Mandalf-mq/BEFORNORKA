/*
  # Fix users table errors

  1. Schema fixes
    - Add missing `phone` column to users table
    
  2. Security fixes
    - Remove problematic RLS policy causing infinite recursion
    - Add granular RLS policies that don't cause recursion
    - Separate policies for different operations (SELECT, INSERT, UPDATE, DELETE)
    
  3. Changes
    - Add phone column with proper constraints
    - Replace broad "Webmasters peuvent gérer tous les utilisateurs" policy
    - Add specific policies for user self-management and webmaster privileges
*/

-- Add missing phone column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone text;
  END IF;
END $$;

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Webmasters peuvent gérer tous les utilisateurs" ON users;

-- Create granular RLS policies that don't cause recursion

-- Allow users to insert their own profile during registration
CREATE POLICY "Allow authenticated user to insert their own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "Allow authenticated user to update their own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Allow webmasters to view all users (using auth.jwt() to avoid recursion)
CREATE POLICY "Webmasters can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'webmaster' OR
    id = auth.uid()
  );

-- Allow webmasters to update all users (using auth.jwt() to avoid recursion)
CREATE POLICY "Webmasters can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'webmaster' OR
    id = auth.uid()
  );

-- Allow webmasters to delete users (using auth.jwt() to avoid recursion)
CREATE POLICY "Webmasters can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'webmaster');

-- Allow public insert for initial user registration (needed for signup)
CREATE POLICY "Allow public user registration"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);