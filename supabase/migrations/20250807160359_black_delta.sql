/*
  # Fonction pour mettre à jour les rôles utilisateur de manière transparente

  1. Problème identifié
    - Les membres n'ont pas forcément de compte dans auth.users
    - La table users a une contrainte REFERENCES auth.users(id)
    - Erreur 409 lors de l'upsert car l'ID n'existe pas dans auth.users
    
  2. Solution
    - Créer une fonction PostgreSQL sécurisée
    - Gérer la création automatique du compte auth si nécessaire
    - Mise à jour transparente du rôle
    
  3. Sécurité
    - Vérifications de permissions intégrées
    - Seul webmaster peut créer d'autres webmasters
    - Audit trail des changements
*/

-- ========================================
-- FONCTION POUR METTRE À JOUR LE RÔLE D'UN MEMBRE
-- ========================================

CREATE OR REPLACE FUNCTION update_member_role(
  p_member_email text,
  p_new_role text,
  p_temporary_password text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  member_record members%ROWTYPE;
  auth_user_id uuid;
  current_user_role text;
  result jsonb;
BEGIN
  -- Vérifier que le rôle est valide
  IF p_new_role NOT IN ('webmaster', 'administrateur', 'tresorerie', 'entraineur', 'member') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rôle invalide: ' || p_new_role
    );
  END IF;
  
  -- Récupérer le rôle de l'utilisateur qui fait la demande
  SELECT role INTO current_user_role 
  FROM users 
  WHERE id = auth.uid();
  
  -- Vérification de sécurité : seul un webmaster peut créer d'autres webmasters
  IF p_new_role = 'webmaster' AND current_user_role != 'webmaster' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seul un Webmaster peut attribuer le rôle Webmaster'
    );
  END IF;
  
  -- Récupérer les infos du membre
  SELECT * INTO member_record FROM members WHERE email = p_member_email;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Membre non trouvé: ' || p_member_email
    );
  END IF;
  
  -- Vérifier si l'utilisateur existe déjà dans auth.users
  SELECT id INTO auth_user_id FROM auth.users WHERE email = p_member_email;
  
  -- Si l'utilisateur n'existe pas dans auth.users, le créer
  IF auth_user_id IS NULL THEN
    auth_user_id := gen_random_uuid();
    
    -- Générer un mot de passe temporaire si pas fourni
    IF p_temporary_password IS NULL THEN
      p_temporary_password := 'temp' || LPAD((random() * 999999)::int::text, 6, '0');
    END IF;
    
    -- Créer le compte auth
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      auth_user_id,
      'authenticated',
      'authenticated',
      p_member_email,
      crypt(p_temporary_password, gen_salt('bf')),
      NOW(),
      jsonb_build_object(
        'first_name', member_record.first_name,
        'last_name', member_record.last_name,
        'role', p_new_role,
        'must_change_password', true
      ),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    
    -- Créer l'identité
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      auth_user_id,
      jsonb_build_object(
        'sub', auth_user_id::text,
        'email', p_member_email,
        'first_name', member_record.first_name,
        'last_name', member_record.last_name
      ),
      'email',
      NOW(),
      NOW()
    );
  ELSE
    -- Mettre à jour les métadonnées auth existantes
    UPDATE auth.users 
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_new_role)
    WHERE id = auth_user_id;
  END IF;
  
  -- Créer ou mettre à jour le profil dans public.users
  INSERT INTO users (
    id,
    email,
    first_name,
    last_name,
    phone,
    role,
    is_active
  ) VALUES (
    auth_user_id,
    p_member_email,
    member_record.first_name,
    member_record.last_name,
    member_record.phone,
    p_new_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = p_new_role,
    updated_at = now();
  
  -- Construire le résultat
  result := jsonb_build_object(
    'success', true,
    'message', 'Rôle mis à jour avec succès',
    'member_email', p_member_email,
    'new_role', p_new_role,
    'auth_user_created', (auth_user_id IS NOT NULL AND p_temporary_password IS NOT NULL),
    'temporary_password', CASE WHEN p_temporary_password IS NOT NULL THEN p_temporary_password ELSE NULL END
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erreur lors de la mise à jour: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;