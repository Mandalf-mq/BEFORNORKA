/*
  # Correction de la fonction WhatsApp et support catégories multiples

  1. Corrections
    - Suppression de l'ancienne fonction get_members_for_whatsapp
    - Recréation avec aliases explicites pour éviter l'ambiguïté "id"
    - Support des catégories multiples via member_categories

  2. Nouvelles fonctionnalités
    - Filtrage par catégories principales ET supplémentaires
    - Retour des catégories supplémentaires dans le résultat
    - Gestion robuste des membres sans catégories multiples
*/

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS get_members_for_whatsapp(text[]);

-- Recréer la fonction avec support des catégories multiples
CREATE OR REPLACE FUNCTION get_members_for_whatsapp(p_categories text[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  phone text,
  category text,
  additional_categories text[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id,
    m.first_name,
    m.last_name,
    m.phone,
    m.category,
    COALESCE(
      ARRAY(
        SELECT mc.category_value 
        FROM member_categories mc 
        WHERE mc.member_id = m.id 
        AND mc.is_primary = false
      ), 
      ARRAY[]::text[]
    ) as additional_categories
  FROM members m
  LEFT JOIN member_categories mc ON mc.member_id = m.id
  WHERE m.status = 'season_validated'
    AND m.phone IS NOT NULL 
    AND m.phone != ''
    AND (
      p_categories IS NULL 
      OR m.category = ANY(p_categories)
      OR mc.category_value = ANY(p_categories)
    )
  ORDER BY m.first_name, m.last_name;
END;
$$;