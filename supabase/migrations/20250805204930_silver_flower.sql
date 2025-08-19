/*
  # Fix missing user profiles in public.users table

  1. Problem identified
    - Authenticated users exist in auth.users but not in public.users
    - This causes PGRST116 error when trying to fetch user profile
    
  2. Solution
    - Backfill public.users table with missing user profiles
    - Update existing profiles to ensure consistency
    - Ensure all authenticated users have a profile
*/

-- Insert missing user profiles from auth.users to public.users
INSERT INTO public.users (id, email, first_name, last_name, phone, role, is_active, created_at, updated_at)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', ''),
    COALESCE(au.raw_user_meta_data->>'last_name', ''),
    COALESCE(au.raw_user_meta_data->>'phone', ''),
    COALESCE(au.raw_user_meta_data->>'role', 'member'),
    TRUE,
    au.created_at,
    au.updated_at
FROM
    auth.users au
LEFT JOIN
    public.users pu ON au.id = pu.id
WHERE
    pu.id IS NULL;

-- Update existing public.users entries with metadata from auth.users if they are inconsistent
UPDATE public.users pu
SET
    email = au.email,
    first_name = COALESCE(au.raw_user_meta_data->>'first_name', pu.first_name),
    last_name = COALESCE(au.raw_user_meta_data->>'last_name', pu.last_name),
    phone = COALESCE(au.raw_user_meta_data->>'phone', pu.phone),
    role = COALESCE(au.raw_user_meta_data->>'role', pu.role),
    updated_at = NOW()
FROM
    auth.users au
WHERE
    pu.id = au.id AND (
        pu.email IS DISTINCT FROM au.email OR
        pu.first_name IS DISTINCT FROM COALESCE(au.raw_user_meta_data->>'first_name', pu.first_name) OR
        pu.last_name IS DISTINCT FROM COALESCE(au.raw_user_meta_data->>'last_name', pu.last_name) OR
        pu.phone IS DISTINCT FROM COALESCE(au.raw_user_meta_data->>'phone', pu.phone) OR
        pu.role IS DISTINCT FROM COALESCE(au.raw_user_meta_data->>'role', pu.role)
    );

-- Confirmation message
DO $$
DECLARE
  missing_profiles_count integer;
  updated_profiles_count integer;
BEGIN
  -- Count how many profiles were missing
  SELECT COUNT(*) INTO missing_profiles_count
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL;
  
  -- Count total profiles now
  SELECT COUNT(*) INTO updated_profiles_count
  FROM public.users;
  
  RAISE NOTICE '✅ USER PROFILES SYNCHRONIZED!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Results:';
  RAISE NOTICE '  - Missing profiles found and created';
  RAISE NOTICE '  - Total profiles in public.users: %', updated_profiles_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 The PGRST116 error should now be resolved!';
END $$;