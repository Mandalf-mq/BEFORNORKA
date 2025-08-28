/*
  # Correction finale de la contrainte NOT NULL sur members.phone

  1. Problème identifié
    - La colonne phone a encore une contrainte NOT NULL
    - L'import CSV échoue car les téléphones sont optionnels
    - Les migrations précédentes n'ont pas réussi à supprimer la contrainte

  2. Solution
    - Suppression forcée de la contrainte NOT NULL
    - Vérification avec des noms de variables non ambigus
    - Test d'insertion pour confirmer

  3. Sécurité
    - Préservation des données existantes
    - Validation côté application maintenue
*/

-- Supprimer la contrainte NOT NULL sur la colonne phone
DO $$
DECLARE
  phone_nullable text;
BEGIN
  -- Vérifier l'état actuel de la colonne phone
  SELECT col.is_nullable INTO phone_nullable
  FROM information_schema.columns col
  WHERE col.table_name = 'members' 
  AND col.column_name = 'phone';
  
  RAISE NOTICE 'État actuel de members.phone - nullable: %', phone_nullable;
  
  -- Si la colonne est encore NOT NULL, la corriger
  IF phone_nullable = 'NO' THEN
    RAISE NOTICE 'Suppression de la contrainte NOT NULL sur members.phone';
    ALTER TABLE members ALTER COLUMN phone DROP NOT NULL;
    RAISE NOTICE 'Contrainte NOT NULL supprimée avec succès';
  ELSE
    RAISE NOTICE 'La colonne phone est déjà nullable';
  END IF;
END $$;

-- Vérifier que la modification a bien été appliquée
DO $$
DECLARE
  phone_final_state text;
BEGIN
  SELECT col.is_nullable INTO phone_final_state
  FROM information_schema.columns col
  WHERE col.table_name = 'members' 
  AND col.column_name = 'phone';
  
  RAISE NOTICE 'État final de members.phone - nullable: %', phone_final_state;
  
  IF phone_final_state = 'YES' THEN
    RAISE NOTICE '✅ La colonne phone accepte maintenant les valeurs NULL';
  ELSE
    RAISE NOTICE '❌ ERREUR: La colonne phone refuse encore les valeurs NULL';
  END IF;
END $$;

-- Fonction de test pour vérifier que l'insertion avec phone NULL fonctionne
CREATE OR REPLACE FUNCTION test_phone_null_works()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_member_uuid uuid;
  current_season_uuid uuid;
BEGIN
  -- Récupérer la saison courante
  SELECT s.id INTO current_season_uuid
  FROM seasons s
  WHERE s.is_current = true 
  LIMIT 1;

  -- Tenter d'insérer un membre test avec phone NULL
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
    'Test',
    'PhoneNull',
    'test_phone_null_' || extract(epoch from now()) || '@test.com',
    NULL,  -- Tester explicitement avec NULL
    '1990-01-01',
    'loisirs',
    200,
    'pending',
    'pending',
    current_season_uuid
  ) RETURNING id INTO test_member_uuid;

  -- Supprimer le membre test
  DELETE FROM members WHERE id = test_member_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Test réussi - La colonne phone accepte les valeurs NULL'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Test échoué: ' || SQLERRM
  );
END;
$$;

-- Exécuter le test
SELECT test_phone_null_works();

-- Fonction corrigée pour créer le profil membre avec téléphone optionnel
CREATE OR REPLACE FUNCTION create_member_profile_only(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_birth_date date DEFAULT NULL,
  p_category text DEFAULT 'loisirs',
  p_membership_fee numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_member_uuid uuid;
  current_season_uuid uuid;
  category_fee_amount numeric := 200;
  category_info record;
  cleaned_phone text;
BEGIN
  -- Nettoyer le téléphone (NULL si vide ou invalide)
  cleaned_phone := CASE 
    WHEN p_phone IS NULL OR trim(p_phone) = '' OR trim(p_phone) = 'NULL' THEN NULL
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
  SELECT s.id INTO current_season_uuid
  FROM seasons s
  WHERE s.is_current = true 
  LIMIT 1;

  -- Récupérer les infos de la catégorie
  SELECT c.* INTO category_info
  FROM categories c
  WHERE c.value = p_category
  LIMIT 1;

  IF FOUND THEN
    category_fee_amount := category_info.membership_fee;
  ELSE
    -- Si catégorie non trouvée, utiliser "loisirs" par défaut
    SELECT c.membership_fee INTO category_fee_amount
    FROM categories c
    WHERE c.value = 'loisirs'
    LIMIT 1;
    
    IF NOT FOUND THEN
      category_fee_amount := 200; -- Valeur par défaut
    END IF;
  END IF;

  -- Utiliser le montant personnalisé si fourni
  IF p_membership_fee IS NOT NULL THEN
    category_fee_amount := p_membership_fee;
  END IF;

  -- Créer le profil membre avec téléphone optionnel
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
    cleaned_phone,  -- Peut être NULL maintenant
    p_birth_date,
    p_category,
    category_fee_amount,
    'pending',
    'pending',
    current_season_uuid
  ) RETURNING id INTO new_member_uuid;

  -- Ajouter la catégorie principale dans member_categories
  INSERT INTO member_categories (
    member_id,
    category_value,
    is_primary
  ) VALUES (
    new_member_uuid,
    p_category,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'member_id', new_member_uuid,
    'category_fee', category_fee_amount,
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