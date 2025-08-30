/*
  # Correction de la contrainte NOT NULL sur birth_date

  1. Problème identifié
    - La colonne birth_date a une contrainte NOT NULL
    - L'import CSV échoue car les dates de naissance sont optionnelles
    - Erreur: null value in column "birth_date" violates not-null constraint

  2. Solution
    - Supprimer la contrainte NOT NULL sur members.birth_date
    - Permettre les valeurs NULL pour les dates de naissance
    - Mettre à jour les fonctions pour gérer les dates optionnelles

  3. Sécurité
    - Préserver les données existantes
    - Validation côté application maintenue
*/

-- Supprimer la contrainte NOT NULL sur la colonne birth_date
DO $$
DECLARE
  birth_date_nullable text;
BEGIN
  -- Vérifier l'état actuel de la colonne birth_date
  SELECT col.is_nullable INTO birth_date_nullable
  FROM information_schema.columns col
  WHERE col.table_name = 'members' 
  AND col.column_name = 'birth_date';
  
  RAISE NOTICE 'État actuel de members.birth_date - nullable: %', birth_date_nullable;
  
  -- Si la colonne est encore NOT NULL, la corriger
  IF birth_date_nullable = 'NO' THEN
    RAISE NOTICE 'Suppression de la contrainte NOT NULL sur members.birth_date';
    ALTER TABLE members ALTER COLUMN birth_date DROP NOT NULL;
    RAISE NOTICE 'Contrainte NOT NULL supprimée avec succès';
  ELSE
    RAISE NOTICE 'La colonne birth_date est déjà nullable';
  END IF;
END $$;

-- Vérifier que la modification a bien été appliquée
DO $$
DECLARE
  birth_date_final_state text;
BEGIN
  SELECT col.is_nullable INTO birth_date_final_state
  FROM information_schema.columns col
  WHERE col.table_name = 'members' 
  AND col.column_name = 'birth_date';
  
  RAISE NOTICE 'État final de members.birth_date - nullable: %', birth_date_final_state;
  
  IF birth_date_final_state = 'YES' THEN
    RAISE NOTICE '✅ La colonne birth_date accepte maintenant les valeurs NULL';
  ELSE
    RAISE NOTICE '❌ ERREUR: La colonne birth_date refuse encore les valeurs NULL';
  END IF;
END $$;

-- Fonction de test pour vérifier que l'insertion avec birth_date NULL fonctionne
CREATE OR REPLACE FUNCTION test_birth_date_null_works()
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

  -- Tenter d'insérer un membre test avec birth_date NULL
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
    'BirthDateNull',
    'test_birth_date_null_' || extract(epoch from now()) || '@test.com',
    NULL,
    NULL,  -- Tester explicitement avec NULL
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
    'message', 'Test réussi - La colonne birth_date accepte les valeurs NULL'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Test échoué: ' || SQLERRM
  );
END;
$$;

-- Exécuter le test
SELECT test_birth_date_null_works();