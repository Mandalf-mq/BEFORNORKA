/*
  # CORRECTION FINALE DES RÔLES POUR DÉPLOIEMENT
  
  1. Correction des rôles utilisateurs
    - handala77@gmail.com → member (au lieu de webmaster)
    - de.sousa.barros.alfredo@gmail.com → webmaster (confirmé)
    
  2. Mise à jour de la fonction de création avec rôles
    - Ajout du paramètre p_role
    - Sécurité : seul webmaster peut créer d'autres webmasters
    - Profil membre créé seulement si role = 'member'
    
  3. Logique des rôles clarifiée
    - Webmaster : Accès technique complet
    - Admin/Trésorerie/Entraîneur : Membre + droits supplémentaires
    - Membre : Accès de base
    
  4. Vérification de cohérence
    - Synchronisation auth.users et public.users
    - Métadonnées auth mises à jour
*/

-- ========================================
-- ÉTAPE 1: CORRIGER LES RÔLES UTILISATEURS
-- ========================================

-- Corriger le rôle d'Alessia (handala77@gmail.com) → member
UPDATE users 
SET role = 'member', updated_at = now()
WHERE email = 'handala77@gmail.com';

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "member"}'::jsonb
WHERE email = 'handala77@gmail.com';

-- Confirmer le rôle d'Alfredo (de.sousa.barros.alfredo@gmail.com) → webmaster
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ========================================
-- ÉTAPE 2: MISE À JOUR DE LA FONCTION DE CRÉATION AVEC RÔLES
-- ========================================

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS create_member_account_with_password(text, text, text, text, date, text, text, text, integer);
DROP FUNCTION IF EXISTS create_member_account_with_password(text, text, text, text, date, text, text, integer);

-- Recréer avec le paramètre rôle et logique clarifiée
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

  -- Calculer le tarif si pas fourni (seulement pour les membres)
  IF p_role = 'member' THEN
    IF p_membership_fee IS NULL THEN
      calculated_fee := get_membership_fee_by_category(p_category);
    ELSE
      calculated_fee := p_membership_fee;
    END IF;
  ELSE
    calculated_fee := 0; -- Pas de cotisation pour les rôles administratifs
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
  
  -- Créer le profil membre SEULEMENT si le rôle est 'member'
  -- Les admins/entraîneurs/trésoriers n'ont pas de profil membre
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

-- ========================================
-- ÉTAPE 3: VÉRIFICATION ET DIAGNOSTIC
-- ========================================

-- Fonction pour vérifier l'état des rôles
CREATE OR REPLACE FUNCTION check_user_roles()
RETURNS TABLE(
  email text,
  public_role text,
  auth_role text,
  is_consistent boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.email,
    u.role as public_role,
    (au.raw_user_meta_data->>'role')::text as auth_role,
    (u.role = (au.raw_user_meta_data->>'role')::text) as is_consistent
  FROM users u
  JOIN auth.users au ON u.id = au.id
  ORDER BY u.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ RÔLES CORRIGÉS POUR LE DÉPLOIEMENT !';
  RAISE NOTICE '';
  RAISE NOTICE '👤 UTILISATEURS :';
  RAISE NOTICE '  - handala77@gmail.com → member';
  RAISE NOTICE '  - de.sousa.barros.alfredo@gmail.com → webmaster';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FONCTION MISE À JOUR :';
  RAISE NOTICE '  - create_member_account_with_password avec paramètre p_role';
  RAISE NOTICE '  - Sécurité : seul webmaster peut créer d''autres webmasters';
  RAISE NOTICE '  - Profil membre créé seulement si role = member';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 VÉRIFICATION :';
  RAISE NOTICE '  SELECT * FROM check_user_roles();';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 PRÊT POUR LE DÉPLOIEMENT !';
END $$;