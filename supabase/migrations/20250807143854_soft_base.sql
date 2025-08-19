/*
  # CORRECTION DIRECTE DU RÔLE WEBMASTER
  
  Code SQL à exécuter directement dans Supabase SQL Editor
  pour corriger le rôle de de.sousa.barros.alfredo@gmail.com
*/

-- ========================================
-- DIAGNOSTIC AVANT CORRECTION
-- ========================================

DO $$
DECLARE
  auth_role text;
  public_role text;
BEGIN
  -- Vérifier l'état actuel
  SELECT raw_user_meta_data->>'role' INTO auth_role 
  FROM auth.users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  SELECT role INTO public_role 
  FROM users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  RAISE NOTICE '🔍 ÉTAT AVANT CORRECTION :';
  RAISE NOTICE '  - Rôle auth.users: %', COALESCE(auth_role, 'NULL');
  RAISE NOTICE '  - Rôle public.users: %', COALESCE(public_role, 'NULL');
END $$;

-- ========================================
-- CORRECTION FORCÉE
-- ========================================

-- Forcer la mise à jour du rôle dans public.users
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- S'assurer que les métadonnées auth sont correctes
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- ========================================
-- VÉRIFICATION APRÈS CORRECTION
-- ========================================

DO $$
DECLARE
  auth_role text;
  public_role text;
  correction_success boolean;
BEGIN
  -- Vérifier l'état après correction
  SELECT raw_user_meta_data->>'role' INTO auth_role 
  FROM auth.users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  SELECT role INTO public_role 
  FROM users 
  WHERE email = 'de.sousa.barros.alfredo@gmail.com';
  
  -- Vérifier le succès
  correction_success := (auth_role = 'webmaster' AND public_role = 'webmaster');
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ CORRECTION APPLIQUÉE !';
  RAISE NOTICE '  - Rôle auth.users: %', COALESCE(auth_role, 'NULL');
  RAISE NOTICE '  - Rôle public.users: %', COALESCE(public_role, 'NULL');
  RAISE NOTICE '  - Correction réussie: %', correction_success;
  
  IF correction_success THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SUCCÈS ! Vous êtes maintenant webmaster !';
    RAISE NOTICE '🔄 Rafraîchissez votre page (F5)';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ PROBLÈME PERSISTANT !';
  END IF;
END $$;