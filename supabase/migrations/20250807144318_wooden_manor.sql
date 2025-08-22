-- ========================================
-- CODE SQL DIRECT À EXÉCUTER DANS SUPABASE
-- ========================================

-- ÉTAPE 1: DIAGNOSTIC COMPLET
SELECT 
  'DIAGNOSTIC AVANT CORRECTION' as etape,
  u.email, 
  u.role as public_role, 
  au.raw_user_meta_data->>'role' as auth_role,
  u.id as user_id,
  au.id as auth_id
FROM users u
FULL OUTER JOIN auth.users au ON u.id = au.id
WHERE u.email = 'de.sousa.barros.alfredo@gmail.com' 
   OR au.email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 2: VÉRIFIER LES TRIGGERS PROBLÉMATIQUES
SELECT 
  'TRIGGERS SUR TABLE USERS' as info,
  trigger_name, 
  event_manipulation, 
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
  AND event_object_schema = 'public';

-- ÉTAPE 3: CORRECTION DIRECTE ET FORCÉE
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 4: MISE À JOUR DES MÉTADONNÉES AUTH
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 5: VÉRIFICATION IMMÉDIATE
SELECT 
  'VÉRIFICATION APRÈS CORRECTION' as etape,
  u.email, 
  u.role as public_role, 
  au.raw_user_meta_data->>'role' as auth_role,
  CASE 
    WHEN u.role = 'webmaster' AND au.raw_user_meta_data->>'role' = 'webmaster' 
    THEN '✅ SUCCÈS' 
    ELSE '❌ ÉCHEC' 
  END as status
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'de.sousa.barros.alfredo@gmail.com';

-- ÉTAPE 6: COMPTER LES WEBMASTERS
SELECT 
  'NOMBRE DE WEBMASTERS' as info,
  COUNT(*) as webmaster_count,
  STRING_AGG(email, ', ') as webmaster_emails
FROM users 
WHERE role = 'webmaster';

-- ÉTAPE 7: SI ÉCHEC, RECRÉATION COMPLÈTE
DO $$
DECLARE
  current_role text;
  auth_user_id uuid;
BEGIN
  -- Vérifier si la correction a fonctionné
  SELECT role INTO current_role FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  IF current_role != 'webmaster' THEN
    RAISE NOTICE '❌ CORRECTION SIMPLE ÉCHOUÉE - RECRÉATION COMPLÈTE';
    
    -- Récupérer l'ID auth
    SELECT id INTO auth_user_id FROM auth.users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
    
    -- Supprimer l'ancien profil
    DELETE FROM users WHERE email = 'de.sousa.barros.alfredo@gmail.com';
    
    -- Recréer avec le bon rôle
    INSERT INTO users (id, email, first_name, last_name, role, is_active) 
    VALUES (
      auth_user_id,
      'de.sousa.barros.alfredo@gmail.com',
      'Alfredo',
      'De Sousa Barros',
      'webmaster',
      true
    );
    
    RAISE NOTICE '✅ PROFIL RECRÉÉ AVEC RÔLE WEBMASTER';
  ELSE
    RAISE NOTICE '✅ CORRECTION SIMPLE RÉUSSIE';
  END IF;
END $$;

-- ÉTAPE 8: VÉRIFICATION FINALE
SELECT 
  'ÉTAT FINAL' as etape,
  email, 
  role as public_role,
  is_active,
  created_at,
  updated_at
FROM users 
WHERE email = 'de.sousa.barros.alfredo@gmail.com';