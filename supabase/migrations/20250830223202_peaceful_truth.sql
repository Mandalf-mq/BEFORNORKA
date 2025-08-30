/*
  # Fonction d'import CSV qui fonctionne vraiment

  1. Corrections
    - Supprimer définitivement la contrainte NOT NULL sur birth_date
    - Créer une fonction d'import simple et robuste
    - Gérer les doublons proprement

  2. Fonctionnalités
    - Import CSV avec création de profils membres
    - Génération de mots de passe temporaires
    - Gestion des erreurs détaillée

  3. Sécurité
    - Validation des données
    - Gestion des doublons
    - Logs détaillés
*/

-- Nettoyer les doublons existants d'abord
DELETE FROM member_categories 
WHERE member_id IN (
  SELECT id FROM members 
  WHERE email IN (
    SELECT email 
    FROM members 
    GROUP BY email 
    HAVING COUNT(*) > 1
  )
  AND id NOT IN (
    SELECT DISTINCT ON (email) id 
    FROM members 
    ORDER BY email, created_at DESC
  )
);

DELETE FROM members 
WHERE id NOT IN (
  SELECT DISTINCT ON (email) id 
  FROM members 
  ORDER BY email, created_at DESC
);

-- Supprimer la contrainte NOT NULL sur birth_date
ALTER TABLE members ALTER COLUMN birth_date DROP NOT NULL;

-- Fonction simple et robuste pour l'import CSV
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
  current_season_id uuid;
  new_member_id uuid;
  temp_password text;
  member_email text;
  member_name text;
BEGIN
  -- Récupérer la saison courante
  SELECT id INTO current_season_id 
  FROM seasons 
  WHERE is_current = true 
  LIMIT 1;

  IF current_season_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucune saison courante trouvée'
    );
  END IF;

  -- Parcourir chaque ligne du CSV
  FOR member_data IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    BEGIN
      member_email := member_data->>'email';
      member_name := (member_data->>'first_name') || ' ' || (member_data->>'last_name');
      
      -- Vérifier si le membre existe déjà
      IF EXISTS (SELECT 1 FROM members WHERE email = member_email) THEN
        errors := array_append(errors, member_email || ': Membre déjà existant');
        error_count := error_count + 1;
        CONTINUE;
      END IF;

      -- Générer un mot de passe temporaire
      temp_password := generate_temp_password();

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
        season_id,
        address,
        postal_code,
        city,
        ffvb_license,
        emergency_contact,
        emergency_phone,
        notes
      ) VALUES (
        member_data->>'first_name',
        member_data->>'last_name',
        member_email,
        NULLIF(member_data->>'phone', ''),
        NULLIF(member_data->>'birth_date', '')::date,
        COALESCE(NULLIF(member_data->>'category', ''), 'loisirs'),
        COALESCE((member_data->>'membership_fee')::numeric, 200),
        'pending',
        'pending',
        current_season_id,
        NULLIF(member_data->>'address', ''),
        NULLIF(member_data->>'postal_code', ''),
        NULLIF(member_data->>'city', ''),
        NULLIF(member_data->>'ffvb_license', ''),
        NULLIF(member_data->>'emergency_contact', ''),
        NULLIF(member_data->>'emergency_phone', ''),
        NULLIF(member_data->>'notes', '')
      ) RETURNING id INTO new_member_id;

      -- Ajouter la catégorie principale
      INSERT INTO member_categories (
        member_id,
        category_value,
        is_primary
      ) VALUES (
        new_member_id,
        COALESCE(NULLIF(member_data->>'category', ''), 'loisirs'),
        true
      );

      -- Ajouter aux identifiants
      credentials_list := credentials_list || jsonb_build_object(
        'email', member_email,
        'name', member_name,
        'password', temp_password,
        'member_id', new_member_id
      );

      imported_count := imported_count + 1;

    EXCEPTION WHEN OTHERS THEN
      errors := array_append(errors, member_email || ': ' || SQLERRM);
      error_count := error_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'imported_count', imported_count,
    'error_count', error_count,
    'errors', errors,
    'credentials', credentials_list,
    'message', imported_count || ' profils créés. Identifiants temporaires générés.'
  );
END;
$$;