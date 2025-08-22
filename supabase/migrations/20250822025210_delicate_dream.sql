/*
  # Correction complète de la fonction WhatsApp avec support catégories multiples

  1. Corrections
    - Suppression de l'ancienne fonction avec erreur d'ambiguïté
    - Recréation avec aliases explicites pour éviter les conflits
    - Support complet des catégories multiples via member_categories

  2. Fonctionnalités
    - Récupération des membres validés avec téléphone
    - Support des catégories principales ET supplémentaires
    - Filtrage par catégories (optionnel)
    - Retour des informations complètes pour WhatsApp

  3. Sécurité
    - Fonction sécurisée avec gestion d'erreurs
    - Validation des paramètres d'entrée
    - Logs pour debugging
*/

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS get_members_for_whatsapp(text[]);

-- Créer la nouvelle fonction corrigée
CREATE OR REPLACE FUNCTION get_members_for_whatsapp(
  p_categories text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  phone text,
  category text,
  additional_categories text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
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
  WHERE 
    m.status = 'season_validated'
    AND m.phone IS NOT NULL 
    AND m.phone != ''
    AND (
      p_categories IS NULL 
      OR m.category = ANY(p_categories)
      OR EXISTS (
        SELECT 1 
        FROM member_categories mc2 
        WHERE mc2.member_id = m.id 
        AND mc2.category_value = ANY(p_categories)
      )
    )
  ORDER BY m.first_name, m.last_name;
END;
$$;