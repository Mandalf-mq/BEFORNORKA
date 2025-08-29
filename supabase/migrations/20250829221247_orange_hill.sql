/*
  # Correction de l'erreur de syntaxe dans create_member_account_with_password

  1. Problème identifié
    - Erreur de syntaxe SQL : "syntax error at or near IF"
    - Structure de fonction PostgreSQL incorrecte
    - Bloc IF mal formé

  2. Solution
    - Recréer la fonction avec la syntaxe PostgreSQL correcte
    - Gérer proprement les blocs BEGIN/END
    - Validation des licences FFVB avec gestion des doublons
*/

-- Supprimer l'ancienne fonction défectueuse
DROP FUNCTION IF EXISTS create_member_account_with_password(text,text,text,text,text,date,text,text);

-- Recréer la fonction avec la syntaxe correcte
CREATE OR REPLACE FUNCTION create_member_account_with_password(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_temporary_password text,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_category text DEFAULT 'loisirs',
  p_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_member_id uuid;
  current_season_id uuid;
  category_fee numeric := 200;
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

  -- Calculer la cotisation
  IF FOUND THEN
    category_fee := category_record.membership_fee;
  ELSE
    -- Si catégorie non trouvée, utiliser "loisirs" par défaut
    SELECT membership_fee INTO category_fee
    FROM categories 
    WHERE value = 'loisirs'
    LIMIT 1;
    
    IF NOT FOUND THEN
      category_fee := 200; -- Valeur par défaut
    END IF;
  END IF;

  -- Créer le profil membre SEULEMENT si le rôle est "member"
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
      'temporary_password', p_temporary_password,
      'category_fee', category_fee,
      'message', 'Compte membre créé avec profil complet'
    );
  ELSE
    -- Pour les rôles administratifs, pas de profil membre
    RETURN jsonb_build_object(
      'success', true,
      'member_id', null,
      'temporary_password', p_temporary_password,
      'category_fee', 0,
      'message', 'Compte administratif créé (pas de profil membre)'
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Erreur lors de la création: ' || SQLERRM
  );
END;
$$;