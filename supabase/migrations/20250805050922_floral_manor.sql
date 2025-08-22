/*
  # Correction du profil membre manquant
  
  1. Problème identifié
    - L'utilisateur handala77@gmail.com n'a pas de profil dans la table members
    - Erreur de clé étrangère lors de l'upload de documents
    
  2. Solutions
    - Créer automatiquement un profil membre pour tous les utilisateurs auth
    - Corriger les politiques RLS
    - Améliorer le trigger de création automatique
*/

-- Fonction pour créer un profil membre pour un utilisateur spécifique
CREATE OR REPLACE FUNCTION create_member_for_auth_user(user_email text)
RETURNS uuid AS $$
DECLARE
  new_member_id uuid;
  auth_user_data RECORD;
BEGIN
  -- Récupérer les données de l'utilisateur auth
  SELECT id, email, raw_user_meta_data 
  INTO auth_user_data
  FROM auth.users 
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur % non trouvé dans auth.users', user_email;
  END IF;
  
  -- Vérifier si le membre existe déjà
  SELECT id INTO new_member_id FROM members WHERE email = user_email;
  
  IF new_member_id IS NOT NULL THEN
    RAISE NOTICE 'Membre existe déjà pour %: %', user_email, new_member_id;
    RETURN new_member_id;
  END IF;
  
  -- Créer le profil membre
  INSERT INTO members (
    first_name,
    last_name,
    email,
    phone,
    birth_date,
    category,
    membership_fee,
    status,
    payment_status,
    registration_date
  ) VALUES (
    COALESCE(auth_user_data.raw_user_meta_data->>'first_name', 'Prénom'),
    COALESCE(auth_user_data.raw_user_meta_data->>'last_name', 'Nom'),
    user_email,
    COALESCE(auth_user_data.raw_user_meta_data->>'phone', '0000000000'),
    '1990-01-01',
    'senior',
    250,
    'pending',
    'pending',
    CURRENT_DATE
  ) RETURNING id INTO new_member_id;
  
  RAISE NOTICE 'Profil membre créé pour %: %', user_email, new_member_id;
  RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le profil membre pour l'utilisateur actuel
SELECT create_member_for_auth_user('handala77@gmail.com');

-- Créer des profils membres pour tous les utilisateurs auth qui n'en ont pas
DO $$
DECLARE
  user_record RECORD;
  created_count integer := 0;
BEGIN
  FOR user_record IN 
    SELECT au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN members m ON m.email = au.email
    WHERE m.id IS NULL AND au.email IS NOT NULL
  LOOP
    BEGIN
      PERFORM create_member_for_auth_user(user_record.email);
      created_count := created_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erreur création profil pour %: %', user_record.email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Profils membres créés pour % utilisateurs', created_count;
END $$;

-- Améliorer le trigger pour créer automatiquement un profil membre
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Créer le profil utilisateur
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = now();
  
  -- Créer aussi le profil membre automatiquement
  INSERT INTO public.members (
    first_name,
    last_name,
    email,
    phone,
    birth_date,
    category,
    membership_fee,
    status,
    payment_status,
    registration_date
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Prénom'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nom'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '0000000000'),
    '1990-01-01',
    'senior',
    250,
    'pending',
    'pending',
    CURRENT_DATE
  )
  ON CONFLICT (email) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erreur création profil: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de diagnostic
CREATE OR REPLACE FUNCTION diagnose_user_profile(user_email text)
RETURNS text AS $$
DECLARE
  diagnosis text := '';
  auth_exists boolean;
  user_exists boolean;
  member_exists boolean;
  auth_id uuid;
  member_id uuid;
BEGIN
  -- Vérifier auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = user_email) INTO auth_exists;
  SELECT id INTO auth_id FROM auth.users WHERE email = user_email;
  
  -- Vérifier public.users
  SELECT EXISTS(SELECT 1 FROM users WHERE email = user_email) INTO user_exists;
  
  -- Vérifier members
  SELECT EXISTS(SELECT 1 FROM members WHERE email = user_email) INTO member_exists;
  SELECT id INTO member_id FROM members WHERE email = user_email;
  
  diagnosis := diagnosis || 'DIAGNOSTIC POUR: ' || user_email || E'\n';
  diagnosis := diagnosis || '- Auth user: ' || CASE WHEN auth_exists THEN 'OUI (' || auth_id || ')' ELSE 'NON' END || E'\n';
  diagnosis := diagnosis || '- User profile: ' || CASE WHEN user_exists THEN 'OUI' ELSE 'NON' END || E'\n';
  diagnosis := diagnosis || '- Member profile: ' || CASE WHEN member_exists THEN 'OUI (' || member_id || ')' ELSE 'NON' END || E'\n';
  
  IF NOT member_exists THEN
    diagnosis := diagnosis || E'\nSOLUTION: SELECT create_member_for_auth_user(''' || user_email || ''');';
  END IF;
  
  RETURN diagnosis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Diagnostic pour l'utilisateur actuel
SELECT diagnose_user_profile('handala77@gmail.com');