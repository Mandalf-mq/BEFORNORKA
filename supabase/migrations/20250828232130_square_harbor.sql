/*
  # Correction finale de la contrainte NOT NULL sur members.phone

  1. Problème identifié
    - La colonne phone a encore une contrainte NOT NULL
    - Conflit de noms de variables dans la migration précédente
    - L'import CSV échoue car les téléphones sont optionnels

  2. Solution
    - Utiliser des noms de variables différents pour éviter les conflits
    - Supprimer définitivement la contrainte NOT NULL
    - Tester l'insertion avec valeur NULL

  3. Sécurité
    - Préservation des données existantes
    - Validation côté application maintenue
*/

-- Supprimer la contrainte NOT NULL sur la colonne phone
DO $$
DECLARE
  column_nullable text;
BEGIN
  -- Vérifier l'état actuel de la colonne phone avec un nom de variable différent
  SELECT information_schema.columns.is_nullable INTO column_nullable
  FROM information_schema.columns 
  WHERE table_name = 'members' 
  AND column_name = 'phone';
  
  RAISE NOTICE 'État actuel de members.phone - nullable: %', column_nullable;
  
  -- Si la colonne est encore NOT NULL, la corriger
  IF column_nullable = 'NO' THEN
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
  final_nullable text;
BEGIN
  SELECT information_schema.columns.is_nullable INTO final_nullable
  FROM information_schema.columns 
  WHERE table_name = 'members' 
  AND column_name = 'phone';
  
  RAISE NOTICE 'État final de members.phone - nullable: %', final_nullable;
  
  IF final_nullable = 'YES' THEN
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