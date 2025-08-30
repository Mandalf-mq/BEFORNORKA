/*
  # Correction finale de la contrainte birth_date

  1. Problème identifié
    - La colonne birth_date a encore une contrainte NOT NULL
    - L'import CSV échoue avec "null value in column birth_date violates not-null constraint"

  2. Solution
    - Suppression forcée de la contrainte NOT NULL
    - Test d'insertion pour vérifier
*/

-- Supprimer la contrainte NOT NULL sur birth_date
DO $$
DECLARE
  birth_date_state text;
BEGIN
  SELECT col.is_nullable INTO birth_date_state
  FROM information_schema.columns col
  WHERE col.table_name = 'members' 
  AND col.column_name = 'birth_date';
  
  RAISE NOTICE 'État birth_date: %', birth_date_state;
  
  IF birth_date_state = 'NO' THEN
    ALTER TABLE members ALTER COLUMN birth_date DROP NOT NULL;
    RAISE NOTICE 'Contrainte NOT NULL supprimée sur birth_date';
  END IF;
END $$;

-- Test d'insertion avec birth_date NULL
DO $$
DECLARE
  test_id uuid;
  season_id uuid;
BEGIN
  SELECT id INTO season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  INSERT INTO members (
    first_name, last_name, email, birth_date, category, 
    membership_fee, status, payment_status, season_id
  ) VALUES (
    'Test', 'BirthNull', 'test_birth_' || extract(epoch from now()) || '@test.com',
    NULL, 'loisirs', 200, 'pending', 'pending', season_id
  ) RETURNING id INTO test_id;
  
  DELETE FROM members WHERE id = test_id;
  
  RAISE NOTICE '✅ Test birth_date NULL réussi';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Test birth_date NULL échoué: %', SQLERRM;
END $$;