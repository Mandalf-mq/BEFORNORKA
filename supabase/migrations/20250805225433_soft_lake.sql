/*
  # Correction du rôle webmaster unique

  1. Problème identifié
    - S'assurer que seul de.sousa.barros.alfredo@gmail.com soit webmaster
    - Tous les autres utilisateurs doivent avoir des rôles appropriés
    
  2. Solution
    - Mettre à jour tous les rôles utilisateur
    - Confirmer le webmaster unique
    - Corriger les métadonnées auth
*/

-- ========================================
-- ÉTAPE 1: RÉINITIALISER TOUS LES RÔLES
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
-- ÉTAPE 2: CONFIRMER LE WEBMASTER UNIQUE
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
-- ÉTAPE 3: VÉRIFICATION
-- ========================================

-- Vérifier l'état final des rôles
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