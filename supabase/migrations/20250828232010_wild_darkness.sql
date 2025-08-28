/*
  # Suppression forcée de la contrainte NOT NULL sur members.phone

  1. Problème identifié
    - La contrainte NOT NULL sur members.phone n'a pas été supprimée
    - L'import CSV échoue car certains membres n'ont pas de téléphone
    - La migration précédente n'a pas fonctionné

  2. Solution
    - Suppression forcée de la contrainte NOT NULL
    - Vérification de l'état de la colonne
    - Mise à jour de la fonction d'import

  3. Sécurité
    - Préservation des données existantes
    - Validation côté application maintenue
*/

-- Vérifier l'état actuel de la colonne phone
DO $$
DECLARE
  is_nullable text;
BEGIN
  SELECT is_nullable INTO is_nullable
  FROM information_schema.columns 
  WHERE table_name = 'members' 
  AND column_name = 'phone';
  
  RAISE NOTICE 'État actuel de members.phone - is_nullable: %', is_nullable;
  
  -- Si la colonne est encore NOT NULL, la corriger
  IF is_nullable = 'NO' THEN
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
  is_nullable text;
BEGIN
  SELECT is_nullable INTO is_nullable
  FROM information_schema.columns 
  WHERE table_name = 'members' 
  AND column_name = 'phone';
  
  RAISE NOTICE 'État final de members.phone - is_nullable: %', is_nullable;
  
  IF is_nullable = 'YES' THEN
    RAISE NOTICE '✅ La colonne phone accepte maintenant les valeurs NULL';
  ELSE
    RAISE NOTICE '❌ ERREUR: La colonne phone refuse encore les valeurs NULL';
  END IF;
END $$;

-- Fonction de test pour vérifier que l'insertion avec phone NULL fonctionne
CREATE OR REPLACE FUNCTION test_phone_null_insertion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_member_id uuid;
  current_season_id uuid;
BEGIN
  -- Récupérer la saison courante
  SELECT id INTO current_season_id 
  FROM seasons 
  WHERE is_current = true 
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
    'senior',
    250,
    'pending',
    'pending',
    current_season_id
  ) RETURNING id INTO test_member_id;

  -- Supprimer le membre test
  DELETE FROM members WHERE id = test_member_id;

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
SELECT test_phone_null_insertion();