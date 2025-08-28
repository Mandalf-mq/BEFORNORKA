/*
  # Correction de la contrainte NOT NULL sur la colonne phone

  1. Problème identifié
    - La colonne phone dans la table members a une contrainte NOT NULL
    - L'import CSV échoue car certains membres n'ont pas de téléphone
    - Le téléphone devrait être optionnel

  2. Solution
    - Supprimer la contrainte NOT NULL sur members.phone
    - Modifier la fonction pour gérer les téléphones vides
    - Permettre les valeurs NULL pour phone

  3. Sécurité
    - Préserver les données existantes
    - Validation côté application maintenue
*/

-- Supprimer la contrainte NOT NULL sur la colonne phone
ALTER TABLE members ALTER COLUMN phone DROP NOT NULL;

-- Mettre à jour la fonction pour gérer les téléphones optionnels
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
  new_member_id uuid;
  current_season_id uuid;
  category_fee numeric := 250;
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
    category_fee := 250; -- Valeur par défaut
  END IF;

  -- Créer le profil membre
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
      clean_phone,  -- Utiliser le téléphone nettoyé (peut être NULL)
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
    'member_id', new_member_id,
    'temporary_password', p_temporary_password,
    'category_fee', category_fee,
    'message', 'Profil membre créé avec succès'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Erreur lors de la création: ' || SQLERRM
  );
END;
$$;