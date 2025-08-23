/*
  # Correction des fonctions d'import CSV avec suppression des conflits

  1. Corrections
    - Suppression des anciennes fonctions avec conflits de signature
    - Recréation avec les bonnes signatures
    - Ajout des colonnes manquantes à la table users

  2. Fonctionnalités
    - Import CSV complet avec création de comptes
    - Génération de mots de passe temporaires
    - Gestion des erreurs détaillée
    - Option d'envoi d'emails

  3. Sécurité
    - Validation des données avant création
    - Gestion des doublons
    - Logs détaillés pour debugging
*/

-- Supprimer les anciennes fonctions avec conflits
DROP FUNCTION IF EXISTS create_member_account_with_password(text,text,text,text,text,date,text,text);
DROP FUNCTION IF EXISTS import_members_with_accounts(jsonb,boolean);
DROP FUNCTION IF EXISTS generate_temp_password();

-- Ajouter les colonnes manquantes à la table users
DO $$
BEGIN
  -- Ajouter temp_password si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'temp_password'
  ) THEN
    ALTER TABLE users ADD COLUMN temp_password text;
    COMMENT ON COLUMN users.temp_password IS 'Mot de passe temporaire pour première connexion';
  END IF;

  -- Ajouter must_change_password si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE users ADD COLUMN must_change_password boolean DEFAULT false;
    COMMENT ON COLUMN users.must_change_password IS 'Forcer le changement de mot de passe à la connexion';
  END IF;
END $$;

-- Fonction pour générer un mot de passe temporaire sécurisé
CREATE OR REPLACE FUNCTION generate_temp_password()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  password text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    password := password || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN password;
END;
$$;

-- Fonction pour créer un compte membre avec mot de passe (nouvelle signature)
CREATE OR REPLACE FUNCTION create_member_account_with_password(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_temporary_password text,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_category text DEFAULT 'senior',
  p_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  new_member_id uuid;
  current_season_id uuid;
  category_fee numeric := 250;
  category_record record;
BEGIN
  -- Vérifier si l'email existe déjà dans users
  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un compte utilisateur existe déjà avec cet email'
    );
  END IF;

  -- Vérifier si l'email existe déjà dans members
  IF EXISTS (SELECT 1 FROM members WHERE email = p_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un profil membre existe déjà avec cet email'
    );
  END IF;

  -- Récupérer la saison courante
  SELECT id INTO current_season_id 
  FROM seasons 
  WHERE is_current = true 
  LIMIT 1;

  -- Récupérer les infos de la catégorie
  SELECT * INTO category_record
  FROM categories 
  WHERE value = p_category
  LIMIT 1;

  IF FOUND THEN
    category_fee := category_record.membership_fee;
  ELSE
    category_fee := 250; -- Valeur par défaut
  END IF;

  -- Générer un ID pour l'utilisateur
  new_user_id := gen_random_uuid();

  -- Créer l'utilisateur dans la table users
  INSERT INTO users (
    id,
    email,
    first_name,
    last_name,
    phone,
    role,
    is_active,
    temp_password,
    must_change_password
  ) VALUES (
    new_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_phone,
    p_role,
    true,
    p_temporary_password,
    true
  );

  -- Si c'est un membre, créer aussi le profil membre
  IF p_role = 'member' THEN
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
      p_phone,
      p_birth_date,
      p_category,
      category_fee,
      'pending',
      'pending',
      current_season_id
    ) RETURNING id INTO new_member_id;

    -- Ajouter la catégorie principale dans member_categories
    INSERT INTO member_categories (
      member_id,
      category_value,
      is_primary
    ) VALUES (
      new_member_id,
      p_category,
      true
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'member_id', new_member_id,
    'temporary_password', p_temporary_password,
    'category_fee', category_fee,
    'message', 'Compte créé avec succès'
  );
END;
$$;

-- Fonction principale d'import CSV avec création de comptes
CREATE OR REPLACE FUNCTION import_members_with_accounts(
  p_csv_data jsonb,
  p_send_emails boolean DEFAULT true
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
  current_season_id uuid;
  temp_password text;
  credentials_list jsonb := '[]';
  member_email text;
  member_name text;
  result jsonb;
  member_id uuid;
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

      -- Créer le compte avec la fonction
      SELECT * INTO result FROM create_member_account_with_password(
        member_email,
        member_data->>'first_name',
        member_data->>'last_name',
        temp_password,
        NULLIF(member_data->>'phone', ''),
        NULLIF(member_data->>'birth_date', '')::date,
        COALESCE(NULLIF(member_data->>'category', ''), 'senior'),
        'member'
      );

      IF (result->>'success')::boolean THEN
        member_id := (result->>'member_id')::uuid;
        
        -- Mettre à jour les informations supplémentaires
        UPDATE members 
        SET 
          address = NULLIF(member_data->>'address', ''),
          postal_code = NULLIF(member_data->>'postal_code', ''),
          city = NULLIF(member_data->>'city', ''),
          membership_fee = COALESCE((member_data->>'membership_fee')::numeric, membership_fee),
          ffvb_license = NULLIF(member_data->>'ffvb_license', ''),
          emergency_contact = NULLIF(member_data->>'emergency_contact', ''),
          emergency_phone = NULLIF(member_data->>'emergency_phone', ''),
          notes = NULLIF(member_data->>'notes', ''),
          updated_at = now()
        WHERE id = member_id;

        -- Ajouter aux identifiants si demandé
        IF p_send_emails THEN
          credentials_list := credentials_list || jsonb_build_object(
            'email', member_email,
            'name', member_name,
            'password', temp_password,
            'member_id', member_id,
            'category', COALESCE(NULLIF(member_data->>'category', ''), 'senior'),
            'fee', result->>'category_fee'
          );
        END IF;

        imported_count := imported_count + 1;
      ELSE
        errors := array_append(errors, member_email || ': ' || (result->>'error'));
        error_count := error_count + 1;
      END IF;

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
    'accounts_created', imported_count,
    'credentials_to_send', CASE WHEN p_send_emails THEN credentials_list ELSE '[]' END,
    'send_emails_requested', p_send_emails,
    'message', CASE 
      WHEN p_send_emails THEN 
        'Import terminé. ' || imported_count || ' comptes créés avec identifiants à envoyer.'
      ELSE 
        'Import terminé. ' || imported_count || ' comptes créés sans envoi d''email.'
    END
  );
END;
$$;