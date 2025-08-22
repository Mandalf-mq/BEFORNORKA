/*
  # Création de la fonction update_user_role_and_metadata manquante

  1. Fonction pour mettre à jour les rôles utilisateur
    - Mise à jour dans public.users
    - Mise à jour des métadonnées auth.users
    - Vérifications de sécurité intégrées

  2. Sécurité
    - Seul webmaster peut créer d'autres webmasters
    - Protection contre l'auto-dégradation
    - Validation des rôles
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
  UPDATE users 
  SET role = p_new_role, updated_at = now()
  WHERE email = p_user_email;
  
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
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ FONCTION update_user_role_and_metadata CRÉÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonction disponible :';
  RAISE NOTICE '  - update_user_role_and_metadata(email, new_role) → jsonb';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sécurités intégrées :';
  RAISE NOTICE '  - Seul webmaster peut créer d''autres webmasters';
  RAISE NOTICE '  - Protection contre l''auto-dégradation';
  RAISE NOTICE '  - Validation des rôles';
  RAISE NOTICE '  - Mise à jour cohérente auth + public';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant le changement de rôle dans Paramètres devrait fonctionner !';
END $$;