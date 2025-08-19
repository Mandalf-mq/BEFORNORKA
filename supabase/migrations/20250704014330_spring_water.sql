/*
  # Fix members table RLS policy for anonymous registration

  1. Security fixes
    - Add RLS policy to allow anonymous users to insert new member registrations
    - This enables the registration form to work without requiring prior authentication
    
  2. Changes
    - Add "Allow anon insert for new member registration" policy to members table
*/

-- Allow anonymous users to insert new member registrations
CREATE POLICY "Allow anon insert for new member registration"
  ON members
  FOR INSERT
  TO anon
  WITH CHECK (true);