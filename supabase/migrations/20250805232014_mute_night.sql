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
-- ÉTAPE 2: RÉINITIALISER TOUS LES RÔLES
-- ========================================

-- Mettre tous les utilisateurs en 'member' par défaut
UPDATE users 
SET role = 'member', updated_at = now()
WHERE email != 'de.sousa.barros.alfredo@gmail.com';

-- Mettre à jour les métadonnées auth pour tous sauf le webmaster
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "member"}'::jsonb
WHERE email != 'de.sousa.barros.alfredo@gmail.com';

-- ========================================
-- ÉTAPE 3: CONFIRMER LE WEBMASTER UNIQUE
-- ========================================

-- S'assurer que de.sousa.barros.alfredo@gmail.com est webmaster
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- Mettre à jour les métadonnées auth pour le webmaster
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ========================================
-- ÉTAPE 4: VÉRIFICATION
-- ========================================

DO $$
DECLARE
  webmaster_count integer;
  member_count integer;
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO webmaster_count FROM users WHERE role = 'webmaster';
  SELECT COUNT(*) INTO member_count FROM users WHERE role = 'member';
  SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'administrateur';
  
  RAISE NOTICE '✅ RÔLES CORRIGÉS !';
  RAISE NOTICE '';
  RAISE NOTICE '👑 Webmasters : % (doit être 1)', webmaster_count;
  RAISE NOTICE '👤 Membres : %', member_count;
  RAISE NOTICE '👨‍💼 Administrateurs : %', admin_count;
  RAISE NOTICE '';
  
  IF webmaster_count = 1 THEN
    RAISE NOTICE '✅ Un seul webmaster configuré correctement';
  ELSE
    RAISE NOTICE '❌ PROBLÈME : % webmasters trouvés', webmaster_count;
  END IF;
  
  -- Afficher le webmaster
  RAISE NOTICE 'Webmaster : %', (SELECT email FROM users WHERE role = 'webmaster');
END $$;