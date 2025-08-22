/*
  # Correction définitive du rôle d'Alessia

  1. Problème identifié
    - handala77@gmail.com est encore en 'administrateur' au lieu de 'member'
    
  2. Solution
    - Forcer la mise à jour du rôle vers 'member'
    - Mettre à jour les métadonnées auth
    - Vérifier la cohérence
*/

-- Corriger le rôle d'Alessia (handala77@gmail.com) → member
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
    RAISE NOTICE '✅ Rôle Alessia corrigé: handala77@gmail.com → member';
  ELSE
    RAISE NOTICE '❌ Erreur: Rôle Alessia non corrigé';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'handala77@gmail.com' 
    AND raw_user_meta_data->>'role' = 'member'
  ) THEN
    RAISE NOTICE '✅ Métadonnées auth corrigées pour Alessia';
  ELSE
    RAISE NOTICE '❌ Erreur: Métadonnées auth non corrigées pour Alessia';
  END IF;
END $$;