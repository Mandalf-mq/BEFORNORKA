/*
  # Mise à jour de la fonction de création de membre avec rôle

  1. Modification de la fonction
    - Ajout du paramètre p_role
    - Attribution du rôle spécifié au lieu de 'member' par défaut
    - Vérifications de sécurité
*/

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS create_member_account_with_password(text, text, text, text, date, text, text, integer);

-- Recréer avec le paramètre rôle
CREATE FUNCTION create_member_account_with_password(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birth_date date,
  p_category text,
  p_temporary_password text,
  p_role text DEFAULT 'member',
  p_membership_fee integer DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  new_user_id uuid;
  new_member_id uuid;
  calculated_fee integer;
  result jsonb;
BEGIN
  -- Vérification de sécurité : seul un webmaster peut créer d'autres webmasters
  IF p_role = 'webmaster' THEN
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'webmaster'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Seul un Webmaster peut créer d''autres Webmasters'
      );
    END IF;
  END IF;

  -- Calculer le tarif si pas fourni
  IF p_membership_fee IS NULL THEN
    calculated_fee := get_membership_fee_by_category(p_category);
  ELSE
    calculated_fee := p_membership_fee;
  END IF;
  
  -- Créer le compte auth avec mot de passe temporaire
  new_user_id := gen_random_uuid();
  
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
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_temporary_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'role', p_role,
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
    new_user_id,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', p_email,
      'first_name', p_first_name,
      'last_name', p_last_name
    ),
    'email',
    NOW(),
    NOW()
  );
  
  -- Créer le profil utilisateur avec le rôle spécifié
  INSERT INTO users (
    id,
    email,
    first_name,
    last_name,
    phone,
    role,
    is_active
  ) VALUES (
    new_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_phone,
    p_role,
    true
  );
  
  -- Créer le profil membre seulement si le rôle est 'member'
  IF p_role = 'member' THEN
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
      registration_date,
      season_id
    ) VALUES (
      p_first_name,
      p_last_name,
      p_email,
      p_phone,
      p_birth_date,
      p_category,
      calculated_fee,
      'pending',
      'pending',
      CURRENT_DATE,
      (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
    ) RETURNING id INTO new_member_id;
  END IF;
  
  result := jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'member_id', new_member_id,
    'email', p_email,
    'role', p_role,
    'temporary_password', p_temporary_password,
    'message', 'Compte ' || p_role || ' créé avec succès'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un compte avec cet email existe déjà'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ FONCTION DE CRÉATION MISE À JOUR !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Nouveautés :';
  RAISE NOTICE '  - Paramètre p_role ajouté';
  RAISE NOTICE '  - Vérification sécurité pour webmaster';
  RAISE NOTICE '  - Profil membre créé seulement si role = member';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Prêt pour la création avec rôles !';
END $$;