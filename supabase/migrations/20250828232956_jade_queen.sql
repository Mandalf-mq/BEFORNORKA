/*
  # Changement de la catégorie par défaut vers "loisirs"

  1. Modifications
    - Changer la catégorie par défaut de "senior" vers "loisirs"
    - Mettre à jour toutes les fonctions concernées
    - S'assurer que la catégorie "loisirs" existe

  2. Fonctions modifiées
    - create_member_profile_only
    - import_members_profiles_only
    - Toutes les fonctions utilisant une catégorie par défaut

  3. Sécurité
    - Vérifier que la catégorie "loisirs" existe
    - Créer la catégorie si elle n'existe pas
    - Préserver les données existantes
*/

-- Vérifier et créer la catégorie "loisirs" si elle n'existe pas
INSERT INTO categories (
  value,
  label,
  description,
  age_range,
  membership_fee,
  color,
  is_active,
  display_order,
  is_system
) VALUES (
  'loisirs',
  'Loisirs',
  'Volleyball loisir pour tous niveaux',
  'Tous âges',
  200,
  '#22c55e',
  true,
  1,
  false
) ON CONFLICT (value) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- Fonction corrigée pour créer SEULEMENT le profil membre avec catégorie "loisirs" par défaut
CREATE OR REPLACE FUNCTION create_member_profile_only(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_category text DEFAULT 'loisirs',  -- 👈 CHANGÉ DE 'senior' VERS 'loisirs'
  p_membership_fee numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_member_id uuid;
  current_season_id uuid;
  category_fee numeric := 200;  -- 👈 CHANGÉ DE 250 VERS 200 (tarif loisirs)
  category_record record;
  clean_phone text;
BEGIN
  -- Nettoyer le téléphone (NULL si vide)
  clean_phone := CASE 
    WHEN p_phone IS NULL OR trim(p_phone) = '' THEN NULL
    ELSE trim(p_phone)
  END;

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
    -- Si catégorie non trouvée, utiliser "loisirs" par défaut
    SELECT membership_fee INTO category_fee
    FROM categories 
    WHERE value = 'loisirs'
    LIMIT 1;
    
    IF NOT FOUND THEN
      category_fee := 200; -- Valeur par défaut si même "loisirs" n'existe pas
    END IF;
  END IF;

  -- Utiliser le montant personnalisé si fourni
  IF p_membership_fee IS NOT NULL THEN
    category_fee := p_membership_fee;
  END IF;

  -- Créer SEULEMENT le profil membre
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

  RETURN jsonb_build_object(
    'success', true,
    'member_id', new_member_id,
    'category_fee', category_fee,
    'category_used', p_category,
    'message', 'Profil membre créé avec succès'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Erreur lors de la création: ' || SQLERRM
  );
END;
$$;

-- Fonction d'import CSV mise à jour avec catégorie "loisirs" par défaut
CREATE OR REPLACE FUNCTION import_members_profiles_only(
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
  result jsonb;
  member_email text;
  member_name text;
BEGIN
  -- Parcourir chaque ligne du CSV
  FOR member_data IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    BEGIN
      member_email := member_data->>'email';
      member_name := (member_data->>'first_name') || ' ' || (member_data->>'last_name');
      
      -- Créer le profil membre avec la fonction simplifiée
      SELECT * INTO result FROM create_member_profile_only(
        member_email,
        member_data->>'first_name',
        member_data->>'last_name',
        NULLIF(member_data->>'phone', ''),
        NULLIF(member_data->>'birth_date', '')::date,
        COALESCE(NULLIF(member_data->>'category', ''), 'loisirs'),  -- 👈 CHANGÉ VERS 'loisirs'
        NULLIF(member_data->>'membership_fee', '')::numeric
      );

      IF (result->>'success')::boolean THEN
        -- Mettre à jour les informations supplémentaires
        UPDATE members 
        SET 
          address = NULLIF(member_data->>'address', ''),
          postal_code = NULLIF(member_data->>'postal_code', ''),
          city = NULLIF(member_data->>'city', ''),
          ffvb_license = NULLIF(member_data->>'ffvb_license', ''),
          emergency_contact = NULLIF(member_data->>'emergency_contact', ''),
          emergency_phone = NULLIF(member_data->>'emergency_phone', ''),
          notes = NULLIF(member_data->>'notes', ''),
          updated_at = now()
        WHERE email = member_email;

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
    'accounts_created', 0,
    'message', 'Import terminé. ' || imported_count || ' profils membres créés avec catégorie "loisirs" par défaut.'
  );
END;
$$;