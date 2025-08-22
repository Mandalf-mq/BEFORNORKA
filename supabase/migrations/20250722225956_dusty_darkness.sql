/*
  # Passer votre compte en webmaster

  1. Mise à jour des métadonnées utilisateur
    - Ajout du rôle webmaster dans auth.users
    
  2. Mise à jour du profil
    - Création/mise à jour dans public.users
    
  3. Vérifications
    - Contrôles de sécurité
*/

-- Mettre à jour les métadonnées utilisateur dans auth.users
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email = 'de.sousa.barros.alfredo@gmail.com';

-- Créer ou mettre à jour le profil dans public.users
INSERT INTO public.users (
  id,
  email,
  first_name,
  last_name,
  role,
  is_active
)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'first_name', 'Alfredo'),
  COALESCE(raw_user_meta_data->>'last_name', 'De Sousa Barros'),
  'webmaster',
  true
FROM auth.users 
WHERE email = 'de.sousa.barros.alfredo@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'webmaster',
  is_active = true,
  updated_at = now();

-- Vérification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'de.sousa.barros.alfredo@gmail.com' 
    AND raw_user_meta_data->>'role' = 'webmaster'
  ) THEN
    RAISE NOTICE '✅ Métadonnées utilisateur mises à jour avec succès';
  ELSE
    RAISE NOTICE '❌ Erreur: Métadonnées utilisateur non mises à jour';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE email = 'de.sousa.barros.alfredo@gmail.com' 
    AND role = 'webmaster'
  ) THEN
    RAISE NOTICE '✅ Profil webmaster créé/mis à jour avec succès';
  ELSE
    RAISE NOTICE '❌ Erreur: Profil webmaster non trouvé';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Votre compte est maintenant webmaster !';
  RAISE NOTICE '📧 Email: de.sousa.barros.alfredo@gmail.com';
  RAISE NOTICE '👑 Rôle: webmaster';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Déconnectez-vous et reconnectez-vous pour voir les changements';
END $$;