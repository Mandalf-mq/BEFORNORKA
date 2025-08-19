/*
  # Correction du rôle utilisateur handala77@gmail.com

  1. Problème identifié
    - L'utilisateur handala77@gmail.com a le rôle 'webmaster' au lieu de 'member'
    
  2. Solution
    - Mettre à jour le rôle dans la table users
    - Mettre à jour les métadonnées auth
*/

-- Corriger le rôle dans la table users
UPDATE users 
SET role = 'member', updated_at = now()
WHERE email = 'handala77@gmail.com';

-- Corriger les métadonnées auth
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "member"}'::jsonb
WHERE email = 'handala77@gmail.com';

-- Vérification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE email = 'handala77@gmail.com' AND role = 'member'
  ) THEN
    RAISE NOTICE '✅ Rôle utilisateur corrigé: handala77@gmail.com est maintenant un membre';
  ELSE
    RAISE NOTICE '❌ Erreur: Rôle utilisateur non corrigé';
  END IF;
END $$;