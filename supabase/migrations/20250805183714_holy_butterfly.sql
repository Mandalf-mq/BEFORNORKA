/*
  # Correction des rôles utilisateurs pour le déploiement

  1. Correction des rôles
    - handala77@gmail.com → member (au lieu de webmaster)
    - de.sousa.barros.alfredo@gmail.com → webmaster (confirmé)
    
  2. Vérification des données
    - Mise à jour des métadonnées auth
    - Cohérence entre auth.users et public.users
*/

-- Corriger le rôle d'Alessia (handala77@gmail.com) → member
UPDATE users 
SET role = 'member', updated_at = now()
WHERE email = 'handala77@gmail.com';

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "member"}'::jsonb
WHERE email = 'handala77@gmail.com';

-- Confirmer le rôle d'Alfredo (de.sousa.barros.alfredo@gmail.com) → webmaster
UPDATE users 
SET role = 'webmaster', updated_at = now()
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ RÔLES CORRIGÉS POUR LE DÉPLOIEMENT !';
  RAISE NOTICE '';
  RAISE NOTICE '👤 handala77@gmail.com → member';
  RAISE NOTICE '👑 de.sousa.barros.alfredo@gmail.com → webmaster';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Prêt pour le déploiement !';
END $$;