/*
  # Debug du mapping entre auth.users et members
  
  Cette migration aide à diagnostiquer pourquoi l'upload échoue
  malgré l'existence des profils.
*/

-- Fonction pour diagnostiquer le mapping auth.users <-> members
CREATE OR REPLACE FUNCTION debug_user_member_mapping(user_email text)
RETURNS TABLE(
  auth_user_id uuid,
  auth_email text,
  auth_metadata jsonb,
  user_profile_id uuid,
  user_profile_email text,
  user_profile_role text,
  member_profile_id uuid,
  member_profile_email text,
  member_profile_name text,
  mapping_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id as auth_user_id,
    au.email as auth_email,
    au.raw_user_meta_data as auth_metadata,
    u.id as user_profile_id,
    u.email as user_profile_email,
    u.role as user_profile_role,
    m.id as member_profile_id,
    m.email as member_profile_email,
    (m.first_name || ' ' || m.last_name) as member_profile_name,
    CASE 
      WHEN au.id IS NULL THEN 'NO_AUTH_USER'
      WHEN u.id IS NULL THEN 'NO_USER_PROFILE'
      WHEN m.id IS NULL THEN 'NO_MEMBER_PROFILE'
      WHEN au.id = u.id THEN 'PERFECT_MAPPING'
      ELSE 'ID_MISMATCH'
    END as mapping_status
  FROM auth.users au
  FULL OUTER JOIN users u ON au.id = u.id
  FULL OUTER JOIN members m ON au.email = m.email
  WHERE au.email = user_email OR u.email = user_email OR m.email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour corriger le mapping si nécessaire
CREATE OR REPLACE FUNCTION fix_user_member_mapping(user_email text)
RETURNS text AS $$
DECLARE
  auth_user_id uuid;
  member_id uuid;
  result_message text;
BEGIN
  -- Récupérer l'ID auth
  SELECT id INTO auth_user_id FROM auth.users WHERE email = user_email;
  
  IF auth_user_id IS NULL THEN
    RETURN 'ERROR: Utilisateur auth non trouvé pour ' || user_email;
  END IF;
  
  -- Récupérer l'ID membre
  SELECT id INTO member_id FROM members WHERE email = user_email;
  
  IF member_id IS NULL THEN
    RETURN 'ERROR: Profil membre non trouvé pour ' || user_email;
  END IF;
  
  -- Vérifier si le profil user existe et le corriger
  INSERT INTO users (id, email, first_name, last_name, role)
  SELECT 
    auth_user_id,
    user_email,
    m.first_name,
    m.last_name,
    'member'
  FROM members m
  WHERE m.email = user_email
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();
  
  result_message := 'SUCCESS: Mapping corrigé pour ' || user_email || 
                   ' - Auth ID: ' || auth_user_id || 
                   ' - Member ID: ' || member_id;
  
  RETURN result_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Diagnostic pour l'utilisateur actuel
SELECT * FROM debug_user_member_mapping('handala77@gmail.com');

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '🔍 DIAGNOSTIC DU MAPPING CRÉÉ !';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Tests à effectuer :';
  RAISE NOTICE '  1. SELECT * FROM debug_user_member_mapping(''handala77@gmail.com'');';
  RAISE NOTICE '  2. SELECT fix_user_member_mapping(''handala77@gmail.com'');';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Cela va nous dire exactement où est le problème !';
END $$;