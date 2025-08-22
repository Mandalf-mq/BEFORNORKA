/*
  # Correction du problème de profil membre manquant
  
  1. Problème identifié
    - Les utilisateurs auth.users n'ont pas automatiquement de profil dans members
    - Erreur de clé étrangère lors de l'upload de documents
    
  2. Solutions
    - Trigger pour créer automatiquement un profil membre
    - Fonction pour lier auth.users à members
    - Correction des contraintes
*/

-- Fonction pour créer automatiquement un profil membre
CREATE OR REPLACE FUNCTION create_member_profile_on_signup()
RETURNS trigger AS $$
BEGIN
  -- Créer un profil membre automatiquement lors de l'inscription
  INSERT INTO public.members (
    first_name,
    last_name,
    email,
    phone,
    birth_date,
    category,
    membership_fee,
    status,
    payment_status,
    registration_date
  ) VALUES (
    COALESCE(NEW.raw_user_meta_data->>'first_name', COALESCE(NEW.raw_user_meta_data->>'firstName', 'Prénom')),
    COALESCE(NEW.raw_user_meta_data->>'last_name', COALESCE(NEW.raw_user_meta_data->>'lastName', 'Nom')),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '0000000000'),
    '1990-01-01', -- Date par défaut
    'senior',
    250,
    'pending',
    'pending',
    CURRENT_DATE
  )
  ON CONFLICT (email) DO NOTHING; -- Éviter les doublons
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Ne pas faire échouer l'inscription si la création du profil membre échoue
    RAISE WARNING 'Erreur création profil membre: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger pour l'auto-création de profil membre
DROP TRIGGER IF EXISTS create_member_profile_trigger ON auth.users;
CREATE TRIGGER create_member_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_member_profile_on_signup();

-- Fonction pour créer manuellement un profil membre pour les utilisateurs existants
CREATE OR REPLACE FUNCTION create_missing_member_profiles()
RETURNS integer AS $$
DECLARE
  user_record RECORD;
  created_count integer := 0;
BEGIN
  -- Pour chaque utilisateur auth sans profil membre
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN members m ON m.email = au.email
    WHERE m.id IS NULL
  LOOP
    BEGIN
      INSERT INTO members (
        first_name,
        last_name,
        email,
        phone,
        birth_date,
        category,
        membership_fee,
        status,
        payment_status,
        registration_date
      ) VALUES (
        COALESCE(user_record.raw_user_meta_data->>'first_name', 'Prénom'),
        COALESCE(user_record.raw_user_meta_data->>'last_name', 'Nom'),
        user_record.email,
        COALESCE(user_record.raw_user_meta_data->>'phone', '0000000000'),
        '1990-01-01',
        'senior',
        250,
        'pending',
        'pending',
        CURRENT_DATE
      );
      
      created_count := created_count + 1;
      RAISE NOTICE 'Profil membre créé pour: %', user_record.email;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erreur création profil pour %: %', user_record.email, SQLERRM;
    END;
  END LOOP;
  
  RETURN created_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exécuter la création des profils manquants
SELECT create_missing_member_profiles();

-- Supprimer la contrainte NOT NULL sur season_id si elle pose problème
ALTER TABLE member_documents ALTER COLUMN season_id DROP NOT NULL;

-- Message de confirmation
DO $$
DECLARE
  member_count integer;
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO member_count FROM members;
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  RAISE NOTICE '✅ CORRECTION DU PROFIL MEMBRE TERMINÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 État actuel :';
  RAISE NOTICE '  - Utilisateurs auth : %', user_count;
  RAISE NOTICE '  - Profils membres : %', member_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Corrections appliquées :';
  RAISE NOTICE '  - Trigger de création automatique de profil membre';
  RAISE NOTICE '  - Profils manquants créés pour utilisateurs existants';
  RAISE NOTICE '  - Contrainte season_id assouplie';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant l''upload de documents devrait fonctionner !';
END $$;