/*
  # Création des comptes de démonstration

  1. Comptes de démonstration
    - Création des utilisateurs dans auth.users avec mots de passe
    - Insertion des profils correspondants dans public.users
    - Attribution des rôles appropriés

  2. Sécurité
    - Mots de passe hashés automatiquement par Supabase
    - Comptes immédiatement utilisables
    - Email confirmé par défaut

  Note: Ces comptes sont pour la démonstration uniquement.
  En production, supprimez cette migration ou changez les mots de passe.
*/

-- Fonction pour créer un utilisateur avec mot de passe
CREATE OR REPLACE FUNCTION create_demo_user(
  user_email text,
  user_password text,
  user_first_name text,
  user_last_name text,
  user_role text DEFAULT 'member'
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
    format('{"sub":"%s","email":"%s"}', user_id::text, user_email)::jsonb,
    'email',
    NOW(),
    NOW()
  );
  
  -- Insérer le profil dans public.users
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    role,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_first_name,
    user_last_name,
    user_role,
    NOW(),
    NOW()
  );
  
  RETURN user_id;
END;
$$;

-- Créer les comptes de démonstration
DO $$
BEGIN
  -- Webmaster (accès complet)
  PERFORM create_demo_user(
    'webmaster@befornorka.fr',
    'admin123',
    'Web',
    'Master',
    'webmaster'
  );
  
  -- Administrateur
  PERFORM create_demo_user(
    'admin@befornorka.fr',
    'admin123',
    'Admin',
    'Système',
    'admin'
  );
  
  -- Trésorier
  PERFORM create_demo_user(
    'tresorier@befornorka.fr',
    'tresor123',
    'Trésorier',
    'Club',
    'treasurer'
  );
  
  -- Entraîneur
  PERFORM create_demo_user(
    'coach@befornorka.fr',
    'coach123',
    'Coach',
    'Principal',
    'trainer'
  );
  
  -- Membre simple
  PERFORM create_demo_user(
    'membre@email.com',
    'membre123',
    'Membre',
    'Test',
    'member'
  );
  
  -- Utilisateur de test supplémentaire
  PERFORM create_demo_user(
    'test@befornorka.fr',
    'test123',
    'Test',
    'User',
    'member'
  );
END $$;

-- Supprimer la fonction temporaire
DROP FUNCTION create_demo_user(text, text, text, text, text);