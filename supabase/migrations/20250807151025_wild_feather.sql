-- ========================================
-- DIAGNOSTIC ET CORRECTION DIRECTE DU RÔLE WEBMASTER
-- ========================================

-- ÉTAPE 1: DIAGNOSTIC AVANT CORRECTION
SELECT 
  'DIAGNOSTIC AVANT' as etape,
  u.email, 
  u.role as public_role, 
  au.raw_user_meta_data->>'role' as auth_role,
  u.updated_at as derniere_maj
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 2: VÉRIFIER LES TRIGGERS (on sait qu'il y en a un)
SELECT 
  'TRIGGERS DÉTECTÉS' as info,
  trigger_name, 
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
  AND event_object_schema = 'public';

-- ÉTAPE 3: VÉRIFIER LES CONTRAINTES
SELECT 
  'CONTRAINTES SUR USERS' as info,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'users' 
  AND tc.table_schema = 'public';

-- ÉTAPE 4: CORRECTION DIRECTE (UPDATE SIMPLE)
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 5: VÉRIFICATION IMMÉDIATE
SELECT 
  'APRÈS UPDATE' as etape,
  email,
  role,
  updated_at,
  CASE 
    WHEN role = 'webmaster' THEN '✅ SUCCÈS' 
    ELSE '❌ ÉCHEC - Role actuel: ' || role 
  END as status
FROM users 
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 6: SI ÉCHEC, DÉSACTIVER LE TRIGGER ET RÉESSAYER
DO $$
DECLARE
  current_role text;
BEGIN
  SELECT role INTO current_role FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  IF current_role != 'webmaster' THEN
    RAISE NOTICE '❌ UPDATE SIMPLE ÉCHOUÉ - DÉSACTIVATION DU TRIGGER';
    
    -- Désactiver temporairement le trigger update_users_updated_at
    ALTER TABLE users DISABLE TRIGGER update_users_updated_at;
    
    -- Correction sans trigger
    UPDATE users 
    SET role = 'webmaster'
    WHERE email = 'de.sousa.barros.alfredo@gmail.com';
    
    -- Réactiver le trigger
    ALTER TABLE users ENABLE TRIGGER update_users_updated_at;
    
    RAISE NOTICE '✅ CORRECTION AVEC TRIGGER DÉSACTIVÉ APPLIQUÉE';
  ELSE
    RAISE NOTICE '✅ UPDATE SIMPLE A FONCTIONNÉ';
  END IF;
END $$;

-- ÉTAPE 7: VÉRIFICATION FINALE
SELECT 
  'RÉSULTAT FINAL' as etape,
  email, 
  role,
  updated_at,
  is_active
FROM users 
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 8: MISE À JOUR DES MÉTADONNÉES AUTH POUR COHÉRENCE
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 9: VÉRIFICATION COMPLÈTE FINALE
SELECT 
  'VÉRIFICATION COMPLÈTE' as etape,
  u.email, 
  u.role as public_role, 
  au.raw_user_meta_data->>'role' as auth_role,
  CASE 
    WHEN u.role = 'webmaster' AND au.raw_user_meta_data->>'role' = 'webmaster' 
    THEN '🎉 SUCCÈS COMPLET' 
    ELSE '❌ PROBLÈME PERSISTANT' 
  END as status_final
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'de.sousa.barros.alfredo@gmail.com';