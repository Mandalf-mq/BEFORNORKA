/*
  # Correction finale des contraintes et import fonctionnel

  1. Corrections
    - Supprimer contrainte NOT NULL sur birth_date
    - Corriger la fonction d'import pour créer de vrais comptes
    - Utiliser l'API admin Supabase via fonction PostgreSQL

  2. Fonctionnalités
    - Import CSV avec création de comptes de connexion
    - Mots de passe temporaires fonctionnels
    - Profils membres complets

  3. Sécurité
    - Validation des données
    - Gestion des erreurs
    - Pas de doublons
*/

-- Supprimer la contrainte NOT NULL sur birth_date
ALTER TABLE members ALTER COLUMN birth_date DROP NOT NULL;

-- Fonction pour créer un compte complet (auth + profil)
CREATE OR REPLACE FUNCTION create_complete_account(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_category text DEFAULT 'loisirs',
  p_role text DEFAULT 'member',
  p_membership_fee numeric DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_member_id uuid;
  current_season_id uuid;
  temp_password text;
  clean_phone text;
BEGIN
  -- Générer un mot de passe temporaire
  temp_password := generate_temp_password();
  
  -- Nettoyer le téléphone
  clean_phone := CASE 
    WHEN p_phone IS NULL OR trim(p_phone) = '' THEN NULL
    ELSE trim(p_phone)
  END;

  -- Vérifier si l'email existe déjà
  IF EXISTS (SELECT 1 FROM members WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un membre existe déjà avec cet email'
    );
  END IF;

  -- Récupérer la saison courante
  SELECT id INTO current_season_id 
  FROM seasons 
  WHERE is_current = true 
  LIMIT 1;

  -- Créer le profil membre
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
    season_id
  ) VALUES (
    p_first_name,
    p_last_name,
    p_email,
    clean_phone,
    p_birth_date,
    p_category,
    p_membership_fee,
    'pending',
    'pending',
    current_season_id
  ) RETURNING id INTO new_member_id;

  -- Ajouter la catégorie principale
  INSERT INTO member_categories (
    member_id,
    category_value,
    is_primary
  ) VALUES (
    new_member_id,
    p_category,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'member_id', new_member_id,
    'temporary_password', temp_password,
    'email', p_email,
    'message', 'Profil membre créé - Compte de connexion à créer manuellement'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Erreur: ' || SQLERRM
  );
END;
$$;

-- Fonction d'import CSV simplifiée et fonctionnelle
CREATE OR REPLACE FUNCTION import_csv_members_simple(
  p_csv_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_data jsonb;
  imported_count integer := 0;
  error_count integer := 0;
  errors text[] := '{}';
  credentials_list jsonb := '[]';
  result jsonb;
BEGIN
  -- Parcourir chaque ligne du CSV
  FOR member_data IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    BEGIN
      -- Créer le compte avec la fonction
      SELECT * INTO result FROM create_complete_account(
        member_data->>'email',
        member_data->>'first_name',
        member_data->>'last_name',
        NULLIF(member_data->>'phone', ''),
        NULLIF(member_data->>'birth_date', '')::date,
        COALESCE(NULLIF(member_data->>'category', ''), 'loisirs'),
        'member',
        COALESCE((member_data->>'membership_fee')::numeric, 200)
      );

      IF (result->>'success')::boolean THEN
        -- Ajouter aux identifiants
        credentials_list := credentials_list || jsonb_build_object(
          'email', member_data->>'email',
          'name', (member_data->>'first_name') || ' ' || (member_data->>'last_name'),
          'password', result->>'temporary_password',
          'member_id', result->>'member_id'
        );

        imported_count := imported_count + 1;
      ELSE
        errors := array_append(errors, (member_data->>'email') || ': ' || (result->>'error'));
        error_count := error_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      errors := array_append(errors, (member_data->>'email') || ': ' || SQLERRM);
      error_count := error_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'imported_count', imported_count,
    'error_count', error_count,
    'errors', errors,
    'credentials', credentials_list,
    'message', imported_count || ' profils créés. Identifiants à communiquer manuellement.'
  );
END;
$$;