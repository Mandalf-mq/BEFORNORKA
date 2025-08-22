/*
  # Correction définitive de l'accès webmaster pour de.sousa.barros.alfredo@gmail.com

  1. Diagnostic complet
    - Vérification de l'existence du compte
    - État actuel des rôles
    
  2. Correction forcée
    - Mise à jour du rôle dans public.users
    - Mise à jour des métadonnées dans auth.users
    - Vérification de cohérence
    
  3. Sécurité
    - S'assurer qu'il n'y a qu'un seul webmaster
    - Corriger tous les autres utilisateurs si nécessaire
*/

-- ========================================
-- ÉTAPE 1: DIAGNOSTIC COMPLET
-- ========================================

DO $$
DECLARE
  auth_exists boolean;
  user_exists boolean;
  current_role text;
  auth_role text;
BEGIN
  -- Vérifier l'existence dans auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'de.sousa.barros.alfredo@gmail.com') INTO auth_exists;
  
  -- Vérifier l'existence dans public.users
  SELECT EXISTS(SELECT 1 FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com') INTO user_exists;
  
  -- Récupérer le rôle actuel
  SELECT role INTO current_role FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  -- Récupérer le rôle dans auth
  SELECT raw_user_meta_data->>'role' INTO auth_role FROM auth.users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  RAISE NOTICE '🔍 DIAGNOSTIC POUR de.sousa.barros.alfredo@gmail.com :';
  RAISE NOTICE '  - Existe dans auth.users : %', auth_exists;
  RAISE NOTICE '  - Existe dans public.users : %', user_exists;
  RAISE NOTICE '  - Rôle actuel (public.users) : %', COALESCE(current_role, 'NULL');
  RAISE NOTICE '  - Rôle auth (métadonnées) : %', COALESCE(auth_role, 'NULL');
END $$;

-- ========================================
-- ÉTAPE 2: CORRECTION FORCÉE
-- ========================================

-- Mettre à jour le rôle dans public.users
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- Mettre à jour les métadonnées auth
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- S'assurer que tous les autres utilisateurs ne sont PAS webmaster
UPDATE users 
SET role = 'member', updated_at = now()
WHERE email != 'de.sousa.barros.alfredo@gmail.com' AND role = 'webmaster';

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "member"}'::jsonb
WHERE email != 'de.sousa.barros.alfredo@gmail.com' 
AND raw_user_meta_data->>'role' = 'webmaster';

-- ========================================
-- ÉTAPE 3: VÉRIFICATION FINALE
-- ========================================

DO $$
DECLARE
  webmaster_count integer;
  alfredo_role text;
  alfredo_auth_role text;
BEGIN
  -- Compter les webmasters
  SELECT COUNT(*) INTO webmaster_count FROM users WHERE role = 'webmaster';
  
  -- Vérifier le rôle d'Alfredo
  SELECT role INTO alfredo_role FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  SELECT raw_user_meta_data->>'role' INTO alfredo_auth_role FROM auth.users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  RAISE NOTICE '✅ CORRECTION APPLIQUÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Résultats :';
  RAISE NOTICE '  - Nombre de webmasters : %', webmaster_count;
  RAISE NOTICE '  - Rôle Alfredo (public.users) : %', COALESCE(alfredo_role, 'NULL');
  RAISE NOTICE '  - Rôle Alfredo (auth) : %', COALESCE(alfredo_auth_role, 'NULL');
  RAISE NOTICE '';
  
  IF webmaster_count = 1 AND alfredo_role = 'webmaster' AND alfredo_auth_role = 'webmaster' THEN
    RAISE NOTICE '✅ SUCCÈS ! Alfredo est maintenant le seul webmaster.';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 PROCHAINES ÉTAPES :';
    RAISE NOTICE '  1. Déconnectez-vous de l''application';
    RAISE NOTICE '  2. Reconnectez-vous avec de.sousa.barros.alfredo@gmail.com';
    RAISE NOTICE '  3. Vous devriez voir tous les menus admin/webmaster';
  ELSE
    RAISE NOTICE '❌ PROBLÈME PERSISTANT !';
    RAISE NOTICE 'Vérifiez manuellement les données dans les tables.';
  END IF;
END $$;

-- ========================================
-- ÉTAPE 4: AFFICHER TOUS LES UTILISATEURS POUR DEBUG
-- ========================================

DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '👥 TOUS LES UTILISATEURS :';
  
  FOR user_record IN 
    SELECT u.email, u.role as public_role, au.raw_user_meta_data->>'role' as auth_role
    FROM users u
    JOIN auth.users au ON u.id = au.id
    ORDER BY u.email
  LOOP
    RAISE NOTICE '  - % : public=% | auth=%', 
      user_record.email, 
      COALESCE(user_record.public_role, 'NULL'),
      COALESCE(user_record.auth_role, 'NULL');
  END LOOP;
END $$;