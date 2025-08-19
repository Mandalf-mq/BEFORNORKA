/*
  # Correction définitive du rôle webmaster pour de.sousa.barros.alfredo@gmail.com

  1. Problème identifié
    - auth.users.raw_user_meta_data contient {"role":"webmaster"} ✅
    - public.users.role contient "member" ❌
    - Le frontend lit depuis public.users et récupère le mauvais rôle
    
  2. Solution
    - Forcer la mise à jour du rôle dans public.users
    - Synchroniser avec les métadonnées auth
    - Vérifier la cohérence
    
  3. Sécurité
    - S'assurer qu'il n'y a qu'un seul webmaster
    - Maintenir la cohérence des données
*/

-- ========================================
-- ÉTAPE 1: DIAGNOSTIC AVANT CORRECTION
-- ========================================

DO $$
DECLARE
  auth_role text;
  public_role text;
  user_exists boolean;
BEGIN
  -- Vérifier l'état actuel
  SELECT raw_user_meta_data->>'role' INTO auth_role 
  FROM auth.users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  SELECT role INTO public_role 
  FROM users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  SELECT EXISTS(SELECT 1 FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com') INTO user_exists;
  
  RAISE NOTICE '🔍 DIAGNOSTIC AVANT CORRECTION :';
  RAISE NOTICE '  - Email: de.sousa.barros.alfredo@gmail.com';
  RAISE NOTICE '  - Rôle auth.users: %', COALESCE(auth_role, 'NULL');
  RAISE NOTICE '  - Rôle public.users: %', COALESCE(public_role, 'NULL');
  RAISE NOTICE '  - Profil existe: %', user_exists;
END $$;

-- ========================================
-- ÉTAPE 2: CORRECTION FORCÉE DU RÔLE
-- ========================================

-- Forcer la mise à jour du rôle dans public.users
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- S'assurer que les métadonnées auth sont aussi correctes
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ========================================
-- ÉTAPE 3: VÉRIFICATION APRÈS CORRECTION
-- ========================================

DO $$
DECLARE
  auth_role text;
  public_role text;
  webmaster_count integer;
  correction_success boolean;
BEGIN
  -- Vérifier l'état après correction
  SELECT raw_user_meta_data->>'role' INTO auth_role 
  FROM auth.users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  SELECT role INTO public_role 
  FROM users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  -- Compter les webmasters
  SELECT COUNT(*) INTO webmaster_count FROM users WHERE role = 'webmaster';
  
  -- Vérifier le succès de la correction
  correction_success := (auth_role = 'webmaster' AND public_role = 'webmaster');
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ CORRECTION APPLIQUÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 RÉSULTATS :';
  RAISE NOTICE '  - Rôle auth.users: %', COALESCE(auth_role, 'NULL');
  RAISE NOTICE '  - Rôle public.users: %', COALESCE(public_role, 'NULL');
  RAISE NOTICE '  - Nombre de webmasters: %', webmaster_count;
  RAISE NOTICE '  - Correction réussie: %', correction_success;
  RAISE NOTICE '';
  
  IF correction_success THEN
    RAISE NOTICE '🎉 SUCCÈS ! de.sousa.barros.alfredo@gmail.com est maintenant webmaster !';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 PROCHAINES ÉTAPES :';
    RAISE NOTICE '  1. Rafraîchissez votre page (F5)';
    RAISE NOTICE '  2. Ou déconnectez-vous et reconnectez-vous';
    RAISE NOTICE '  3. Vous devriez voir tous les menus admin';
    RAISE NOTICE '  4. La section Paramètres devrait être accessible';
  ELSE
    RAISE NOTICE '❌ PROBLÈME PERSISTANT !';
    RAISE NOTICE 'Vérifiez manuellement les données dans les tables.';
  END IF;
END $$;

-- ========================================
-- ÉTAPE 4: SÉCURITÉ - S'ASSURER QU'IL N'Y A QU'UN SEUL WEBMASTER
-- ========================================

-- Mettre tous les autres utilisateurs en 'member' s'ils étaient webmaster
UPDATE users 
SET role = 'member', updated_at = now()
WHERE email != 'de.sousa.barros.alfredo@gmail.com' 
AND role = 'webmaster';

-- Mettre à jour les métadonnées auth pour les autres
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "member"}'::jsonb
WHERE email != 'de.sousa.barros.alfredo@gmail.com' 
AND raw_user_meta_data->>'role' = 'webmaster';

-- ========================================
-- ÉTAPE 5: AFFICHAGE FINAL DE TOUS LES UTILISATEURS
-- ========================================

DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '👥 ÉTAT FINAL DE TOUS LES UTILISATEURS :';
  RAISE NOTICE '';
  
  FOR user_record IN 
    SELECT 
      u.email, 
      u.role as public_role, 
      au.raw_user_meta_data->>'role' as auth_role,
      CASE WHEN u.role = au.raw_user_meta_data->>'role' THEN '✅' ELSE '❌' END as sync_status
    FROM users u
    JOIN auth.users au ON u.id = au.id
    ORDER BY u.email
  LOOP
    RAISE NOTICE '  - % : public=% | auth=% %', 
      user_record.email, 
      COALESCE(user_record.public_role, 'NULL'),
      COALESCE(user_record.auth_role, 'NULL'),
      user_record.sync_status;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '🚀 CORRECTION TERMINÉE !';
END $$;