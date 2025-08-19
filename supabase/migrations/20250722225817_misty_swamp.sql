/*
  # Création d'un profil webmaster

  1. Création manuelle d'un utilisateur webmaster
    - Insertion dans auth.users avec mot de passe hashé
    - Création du profil correspondant dans public.users
    - Attribution du rôle webmaster

  2. Sécurité
    - Mot de passe hashé avec bcrypt
    - Email confirmé automatiquement
    - Compte immédiatement utilisable

  Note: Changez le mot de passe après la première connexion
*/

-- Fonction pour créer un utilisateur webmaster
CREATE OR REPLACE FUNCTION create_webmaster_user(
  user_email text,
  user_password text,
  user_first_name text DEFAULT 'Web',
  user_last_name text DEFAULT 'Master'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
  encrypted_pw text;
BEGIN
  -- Générer un ID utilisateur
  user_id := gen_random_uuid();
  
  -- Hasher le mot de passe (utilise la fonction interne de Supabase)
  encrypted_pw := crypt(user_password, gen_salt('bf'));
  
  -- Insérer dans auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    user_id,
    'authenticated',
    'authenticated',
    user_email,
    encrypted_pw,
    NOW(),
    NOW(),
    NOW(),
    json_build_object(
      'first_name', user_first_name,
      'last_name', user_last_name,
      'role', 'webmaster'
    )::jsonb,
    '',
    '',
    '',
    ''
  );
  
  -- Insérer dans auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    user_id,
    json_build_object(
      'sub', user_id::text,
      'email', user_email,
      'first_name', user_first_name,
      'last_name', user_last_name,
      'role', 'webmaster'
    )::jsonb,
    'email',
    NOW(),
    NOW()
  );
  
  -- Insérer le profil dans public.users (si la table existe et est correctement configurée)
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_first_name,
    user_last_name,
    'webmaster',
    true,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    updated_at = NOW();
  
  RAISE NOTICE 'Utilisateur webmaster créé avec succès: %', user_email;
  RAISE NOTICE 'ID utilisateur: %', user_id;
  
  RETURN user_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de la création de l''utilisateur: %', SQLERRM;
END;
$$;

-- Créer le compte webmaster
DO $$
DECLARE
  webmaster_id uuid;
BEGIN
  -- Créer le compte webmaster principal
  webmaster_id := create_webmaster_user(
    'webmaster@befornorka.fr',
    'admin123',
    'Web',
    'Master'
  );
  
  RAISE NOTICE '✅ Compte webmaster créé avec succès !';
  RAISE NOTICE '📧 Email: webmaster@befornorka.fr';
  RAISE NOTICE '🔑 Mot de passe: admin123';
  RAISE NOTICE '🆔 ID: %', webmaster_id;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Changez le mot de passe après la première connexion !';
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE '⚠️  Un utilisateur avec cet email existe déjà';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur: %', SQLERRM;
END $$;

-- Supprimer la fonction temporaire
DROP FUNCTION create_webmaster_user(text, text, text, text);

-- Vérification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'webmaster@befornorka.fr'
  ) THEN
    RAISE NOTICE '✅ Vérification: Utilisateur webmaster trouvé dans auth.users';
  ELSE
    RAISE NOTICE '❌ Erreur: Utilisateur webmaster non trouvé dans auth.users';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = 'webmaster@befornorka.fr' AND role = 'webmaster'
  ) THEN
    RAISE NOTICE '✅ Vérification: Profil webmaster trouvé dans public.users';
  ELSE
    RAISE NOTICE '❌ Erreur: Profil webmaster non trouvé dans public.users';
  END IF;
END $$;