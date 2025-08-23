/*
  # Correction de la structure member_categories

  1. Problème identifié
    - Le code utilise 'category_id' mais la table n'a que 'category_value'
    - Incohérence entre le schéma et le code frontend

  2. Solution
    - Ajouter la colonne 'category_id' pour référencer categories.id
    - Maintenir 'category_value' pour compatibilité
    - Synchroniser les données existantes

  3. Sécurité
    - Migration sécurisée avec gestion d'erreurs
    - Préservation des données existantes
    - Index pour les performances
*/

-- Ajouter la colonne category_id si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'member_categories' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE member_categories 
    ADD COLUMN category_id uuid REFERENCES categories(id);
    
    COMMENT ON COLUMN member_categories.category_id IS 'Référence vers categories.id';
  END IF;
END $$;

-- Synchroniser les category_id avec les category_value existants
UPDATE member_categories 
SET category_id = (
  SELECT c.id 
  FROM categories c 
  WHERE c.value = member_categories.category_value
  LIMIT 1
)
WHERE category_id IS NULL 
AND category_value IS NOT NULL;

-- Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_member_categories_category_id 
ON member_categories(category_id);

-- Fonction pour synchroniser les catégories
CREATE OR REPLACE FUNCTION sync_member_category_references()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer := 0;
  orphaned_count integer := 0;
BEGIN
  -- Synchroniser les category_id manquants
  UPDATE member_categories 
  SET category_id = (
    SELECT c.id 
    FROM categories c 
    WHERE c.value = member_categories.category_value
    LIMIT 1
  )
  WHERE category_id IS NULL 
  AND category_value IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Compter les catégories orphelines
  SELECT COUNT(*) INTO orphaned_count
  FROM member_categories 
  WHERE category_id IS NULL;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'orphaned_count', orphaned_count,
    'message', 'Synchronisation des références de catégories terminée'
  );
END;
$$;

-- Exécuter la synchronisation
SELECT sync_member_category_references();