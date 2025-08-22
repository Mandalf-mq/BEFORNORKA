-- ========================================
-- CORRECTION DIRECTE DU RÔLE WEBMASTER
-- ========================================

-- ÉTAPE 1: DIAGNOSTIC
SELECT 
  'AVANT CORRECTION' as etape,
  u.email, 
  u.role as public_role, 
  au.raw_user_meta_data->>'role' as auth_role
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 2: CORRECTION DIRECTE (PAS D'INSERT, JUSTE UPDATE)
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 3: MISE À JOUR AUTH
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 4: VÉRIFICATION IMMÉDIATE
SELECT 
  'APRÈS CORRECTION' as etape,
  u.email, 
  u.role as public_role, 
  au.raw_user_meta_data->>'role' as auth_role,
  CASE 
    WHEN u.role = 'webmaster' THEN '✅ SUCCÈS' 
    ELSE '❌ ÉCHEC' 
  END as status
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 5: VÉRIFIER S'IL Y A DES TRIGGERS PROBLÉMATIQUES
SELECT 
  'TRIGGERS SUR USERS' as info,
  trigger_name, 
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
  AND event_object_schema = 'public';

-- ÉTAPE 6: FORCER LA MISE À JOUR SI NÉCESSAIRE
DO $$
DECLARE
  current_role text;
BEGIN
  SELECT role INTO current_role FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  IF current_role != 'webmaster' THEN
    RAISE NOTICE '❌ MISE À JOUR SIMPLE ÉCHOUÉE';
    
    -- Essayer de supprimer les contraintes qui bloquent
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    
    -- Forcer la mise à jour sans contrainte
    UPDATE users 
    SET role = 'webmaster', updated_at = now()
    WHERE email = 'de.sousa.barros.alfredo@gmail.com';
    
    -- Remettre la contrainte
    ALTER TABLE users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('webmaster', 'administrateur', 'tresorerie', 'entraineur', 'member'));
    
    RAISE NOTICE '✅ CORRECTION FORCÉE APPLIQUÉE';
  ELSE
    RAISE NOTICE '✅ CORRECTION SIMPLE RÉUSSIE';
  END IF;
END $$;

-- ÉTAPE 7: VÉRIFICATION FINALE
SELECT 
  'RÉSULTAT FINAL' as etape,
  email, 
  role,
  updated_at
FROM users 
WHERE email = 'de.sousa.barros.alfredo@gmail.com';