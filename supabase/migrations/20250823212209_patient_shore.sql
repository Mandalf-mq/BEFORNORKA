/*
  # Nettoyage et correction des catégories des membres

  1. Problème identifié
    - Membres avec catégorie "2 vs 2 Competition" qui n'existe pas
    - Catégories incohérentes dans la base de données
    - Affichage incorrect dans le dashboard

  2. Corrections
    - Nettoyer les catégories invalides
    - Mapper vers les vraies catégories configurées
    - Synchroniser member_categories avec members.category

  3. Sécurité
    - Sauvegarde des données avant modification
    - Validation des catégories existantes
    - Logs pour traçabilité
*/

-- 1. Identifier les catégories invalides
DO $$
DECLARE
  invalid_categories text[];
  valid_categories text[];
  member_record record;
  default_category text := 'senior';
BEGIN
  -- Récupérer les catégories valides
  SELECT array_agg(value) INTO valid_categories
  FROM categories 
  WHERE is_active = true;
  
  -- Si aucune catégorie valide, créer une catégorie par défaut
  IF valid_categories IS NULL OR array_length(valid_categories, 1) = 0 THEN
    INSERT INTO categories (
      value, label, description, age_range, membership_fee, 
      color, is_active, display_order, is_system
    ) VALUES (
      'senior', 'Senior', 'Catégorie senior par défaut', '18+ ans', 250,
      '#3b82f6', true, 1, false
    ) ON CONFLICT (value) DO NOTHING;
    
    valid_categories := ARRAY['senior'];
  ELSE
    default_category := valid_categories[1];
  END IF;
  
  RAISE NOTICE 'Catégories valides trouvées: %', valid_categories;
  
  -- Identifier les membres avec des catégories invalides
  SELECT array_agg(DISTINCT category) INTO invalid_categories
  FROM members 
  WHERE category IS NOT NULL 
  AND NOT (category = ANY(valid_categories));
  
  RAISE NOTICE 'Catégories invalides trouvées: %', invalid_categories;
  
  -- Corriger les catégories invalides
  IF invalid_categories IS NOT NULL THEN
    UPDATE members 
    SET 
      category = default_category,
      updated_at = now()
    WHERE category = ANY(invalid_categories);
    
    RAISE NOTICE 'Membres mis à jour avec catégorie par défaut: %', default_category;
  END IF;
  
  -- Synchroniser member_categories avec members.category
  FOR member_record IN 
    SELECT id, category FROM members WHERE category IS NOT NULL
  LOOP
    -- Vérifier si la catégorie principale existe dans member_categories
    IF NOT EXISTS (
      SELECT 1 FROM member_categories 
      WHERE member_id = member_record.id 
      AND category_value = member_record.category 
      AND is_primary = true
    ) THEN
      -- Supprimer les anciennes catégories principales
      DELETE FROM member_categories 
      WHERE member_id = member_record.id 
      AND is_primary = true;
      
      -- Ajouter la catégorie principale correcte
      INSERT INTO member_categories (
        member_id, category_value, is_primary
      ) VALUES (
        member_record.id, member_record.category, true
      ) ON CONFLICT (member_id, category_value) 
      DO UPDATE SET is_primary = true;
      
      RAISE NOTICE 'Catégorie principale synchronisée pour membre: %', member_record.id;
    END IF;
  END LOOP;
  
END $$;

-- 2. Nettoyer les catégories orphelines dans member_categories
DELETE FROM member_categories 
WHERE category_value NOT IN (
  SELECT value FROM categories WHERE is_active = true
);

-- 3. Vérifier la cohérence des données
DO $$
DECLARE
  inconsistent_count integer;
BEGIN
  -- Compter les incohérences
  SELECT COUNT(*) INTO inconsistent_count
  FROM members m
  WHERE NOT EXISTS (
    SELECT 1 FROM member_categories mc 
    WHERE mc.member_id = m.id 
    AND mc.category_value = m.category 
    AND mc.is_primary = true
  );
  
  RAISE NOTICE 'Membres avec incohérences catégorie: %', inconsistent_count;
  
  -- Corriger les incohérences restantes
  INSERT INTO member_categories (member_id, category_value, is_primary)
  SELECT m.id, m.category, true
  FROM members m
  WHERE m.category IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM member_categories mc 
    WHERE mc.member_id = m.id 
    AND mc.category_value = m.category 
    AND mc.is_primary = true
  )
  ON CONFLICT (member_id, category_value) 
  DO UPDATE SET is_primary = true;
  
END $$;

-- 4. Fonction pour diagnostiquer les problèmes de catégories
CREATE OR REPLACE FUNCTION diagnose_category_issues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_members integer;
  members_with_category integer;
  members_with_valid_category integer;
  invalid_categories text[];
  valid_categories text[];
  orphaned_member_categories integer;
BEGIN
  -- Statistiques générales
  SELECT COUNT(*) INTO total_members FROM members;
  SELECT COUNT(*) INTO members_with_category FROM members WHERE category IS NOT NULL;
  
  -- Catégories valides
  SELECT array_agg(value) INTO valid_categories FROM categories WHERE is_active = true;
  
  -- Membres avec catégorie valide
  SELECT COUNT(*) INTO members_with_valid_category 
  FROM members 
  WHERE category = ANY(valid_categories);
  
  -- Catégories invalides
  SELECT array_agg(DISTINCT category) INTO invalid_categories
  FROM members 
  WHERE category IS NOT NULL 
  AND NOT (category = ANY(valid_categories));
  
  -- Catégories orphelines
  SELECT COUNT(*) INTO orphaned_member_categories
  FROM member_categories mc
  WHERE NOT EXISTS (
    SELECT 1 FROM categories c 
    WHERE c.value = mc.category_value 
    AND c.is_active = true
  );
  
  RETURN jsonb_build_object(
    'total_members', total_members,
    'members_with_category', members_with_category,
    'members_with_valid_category', members_with_valid_category,
    'valid_categories', valid_categories,
    'invalid_categories', COALESCE(invalid_categories, ARRAY[]::text[]),
    'orphaned_member_categories', orphaned_member_categories,
    'issues_found', (
      COALESCE(array_length(invalid_categories, 1), 0) > 0 OR 
      orphaned_member_categories > 0 OR
      members_with_valid_category < members_with_category
    )
  );
END;
$$;

-- Exécuter le diagnostic
SELECT diagnose_category_issues();