-- ========================================
-- DIAGNOSTIC COMPLET DU PROBLÈME DE RÔLE
-- ========================================

-- ÉTAPE 1: ÉTAT ACTUEL COMPLET
SELECT 
  'ÉTAT ACTUEL COMPLET' as info,
  u.email, 
  u.role as public_role, 
  au.raw_user_meta_data->>'role' as auth_role,
  u.id as public_id,
  au.id as auth_id,
  u.updated_at as last_update,
  u.is_active
FROM users u
FULL OUTER JOIN auth.users au ON u.id = au.id
WHERE u.email = 'de.sousa.barros.alfredo@gmail.com' 
   OR au.email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 2: VÉRIFIER TOUS LES TRIGGERS SUR USERS
SELECT 
  'TRIGGERS SUR TABLE USERS' as info,
  trigger_name, 
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
  AND event_object_schema = 'public';

-- ÉTAPE 3: VÉRIFIER LES CONTRAINTES
SELECT 
  'CONTRAINTES SUR USERS' as info,
  constraint_name,
  constraint_type,
  check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'users' 
  AND tc.table_schema = 'public';

-- ÉTAPE 4: VÉRIFIER LES POLITIQUES RLS
SELECT 
  'POLITIQUES RLS SUR USERS' as info,
  policyname,
  cmd as policy_command,
  roles
FROM pg_policies 
WHERE tablename = 'users' 
  AND schemaname = 'public';

-- ÉTAPE 5: CORRECTION DIRECTE (UPDATE SIMPLE)
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 6: VÉRIFICATION IMMÉDIATE APRÈS UPDATE
SELECT 
  'APRÈS UPDATE SIMPLE' as info,
  email,
  role,
  updated_at,
  CASE 
    WHEN role = 'webmaster' THEN '✅ SUCCÈS' 
    ELSE '❌ ÉCHEC - Role: ' || role 
  END as status
FROM users 
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 7: SI ÉCHEC, DÉSACTIVER TEMPORAIREMENT LES TRIGGERS
DO $$
DECLARE
  current_role text;
BEGIN
  SELECT role INTO current_role FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  IF current_role != 'webmaster' THEN
    RAISE NOTICE '❌ UPDATE SIMPLE ÉCHOUÉ - DÉSACTIVATION TRIGGERS';
    
    -- Désactiver temporairement le trigger
    ALTER TABLE users DISABLE TRIGGER update_users_updated_at;
    
    -- Essayer la correction sans trigger
    UPDATE users 
    SET role = 'webmaster'
    WHERE email = 'de.sousa.barros.alfredo@gmail.com';
    
    -- Réactiver le trigger
    ALTER TABLE users ENABLE TRIGGER update_users_updated_at;
    
    RAISE NOTICE '✅ CORRECTION AVEC TRIGGER DÉSACTIVÉ';
  ELSE
    RAISE NOTICE '✅ UPDATE SIMPLE A FONCTIONNÉ';
  END IF;
END $$;

-- ÉTAPE 8: VÉRIFICATION FINALE
SELECT 
  'RÉSULTAT FINAL' as info,
  email, 
  role,
  updated_at,
  is_active
FROM users 
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 9: COMPTER TOUS LES WEBMASTERS
SELECT 
  'TOUS LES WEBMASTERS' as info,
  COUNT(*) as webmaster_count,
  STRING_AGG(email, ', ') as emails
FROM users 
WHERE role = 'webmaster';

-- ÉTAPE 10: AFFICHER TOUS LES UTILISATEURS
SELECT 
  'TOUS LES UTILISATEURS' as info,
  email,
  role,
  is_active,
  updated_at
FROM users 
ORDER BY email;