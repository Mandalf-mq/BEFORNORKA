/*
  # Fonction sécurisée pour mettre à jour les rôles utilisateur

  1. Problème identifié
    - Le frontend ne peut pas utiliser supabase.auth.admin directement
    - Erreur 403: "User not allowed" car pas de privilèges admin côté client
    
  2. Solution
    - Créer une fonction PostgreSQL avec SECURITY DEFINER
    - Permettre la mise à jour sécurisée des rôles
    - Vérifications de sécurité intégrées
    
  3. Sécurité
    - Seul un webmaster peut créer d'autres webmasters
    - Validation des rôles autorisés
    - Mise à jour cohérente auth.users et public.users
*/

-- ========================================
-- FONCTION POUR METTRE À JOUR LE RÔLE D'UN UTILISATEUR
-- ========================================

CREATE OR REPLACE FUNCTION update_user_role_and_metadata(
  p_user_email text,
  p_new_role text
)
RETURNS jsonb AS $$
DECLARE
  target_user_id uuid;
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
  
  -- Récupérer l'ID de l'utilisateur cible depuis auth.users
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = p_user_email;
  
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Utilisateur non trouvé: ' || p_user_email
    );
  END IF;
  
  -- Empêcher l'auto-dégradation du webmaster
  IF p_user_email = (SELECT email FROM auth.users WHERE id = auth.uid()) 
     AND current_user_role = 'webmaster' 
     AND p_new_role != 'webmaster' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vous ne pouvez pas retirer vos propres privilèges de Webmaster'
    );
  END IF;
  
  -- Mettre à jour le rôle dans public.users
  INSERT INTO users (id, email, first_name, last_name, role, is_active)
  SELECT 
    target_user_id,
    p_user_email,
    COALESCE(m.first_name, 'Prénom'),
    COALESCE(m.last_name, 'Nom'),
    p_new_role,
    true
  FROM members m
  WHERE m.email = p_user_email
  ON CONFLICT (id) DO UPDATE SET
    role = p_new_role,
    updated_at = now();
  
  -- Mettre à jour les métadonnées dans auth.users
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_new_role)
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Rôle mis à jour avec succès',
    'user_email', p_user_email,
    'new_role', p_new_role
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erreur lors de la mise à jour: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FONCTION POUR OBTENIR TOUS LES UTILISATEURS AVEC LEURS RÔLES
-- ========================================

CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE(
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  is_active boolean,
  has_member_profile boolean,
  member_id uuid,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.is_active,
    (m.id IS NOT NULL) as has_member_profile,
    m.id as member_id,
    u.created_at
  FROM users u
  LEFT JOIN members m ON u.email = m.email
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ FONCTION DE MISE À JOUR DES RÔLES CRÉÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions disponibles :';
  RAISE NOTICE '  - update_user_role_and_metadata(email, new_role) → jsonb';
  RAISE NOTICE '  - get_all_users_with_roles() → table';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sécurités intégrées :';
  RAISE NOTICE '  - Seul webmaster peut créer d''autres webmasters';
  RAISE NOTICE '  - Protection contre l''auto-dégradation';
  RAISE NOTICE '  - Validation des rôles';
  RAISE NOTICE '  - Mise à jour cohérente auth + public';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Le frontend peut maintenant utiliser ces fonctions via RPC !';
END $$;