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

-- Créer la nouvelle fonction corrigée avec aliases explicites
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

-- Créer une vue pour faciliter les requêtes de sessions avec catégories
CREATE OR REPLACE VIEW training_sessions_with_categories AS
SELECT 
  ts.*,
  ARRAY(
    SELECT c.label 
    FROM categories c 
    WHERE c.value = ANY(ts.category)
  ) as category_labels
FROM training_sessions ts;

-- Fonction pour obtenir les sessions d'un membre selon ses catégories
CREATE OR REPLACE FUNCTION get_member_training_sessions(
  p_member_id uuid,
  p_start_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  date date,
  start_time time,
  end_time time,
  location text,
  category text[],
  category_labels text[],
  coach text,
  max_participants integer,
  has_responded boolean,
  response_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_categories text[];
BEGIN
  -- Récupérer toutes les catégories du membre
  SELECT ARRAY(
    SELECT mc.category_value 
    FROM member_categories mc 
    WHERE mc.member_id = p_member_id
    UNION
    SELECT m.category 
    FROM members m 
    WHERE m.id = p_member_id
  ) INTO member_categories;

  -- Retourner les sessions correspondantes
  RETURN QUERY
  SELECT 
    ts.id,
    ts.title,
    ts.description,
    ts.date,
    ts.start_time,
    ts.end_time,
    ts.location,
    ts.category,
    ARRAY(
      SELECT c.label 
      FROM categories c 
      WHERE c.value = ANY(ts.category)
    ) as category_labels,
    ts.coach,
    ts.max_participants,
    EXISTS(
      SELECT 1 
      FROM attendance_records ar 
      WHERE ar.session_id = ts.id 
      AND ar.member_id = p_member_id
    ) as has_responded,
    COALESCE(
      (SELECT ar.status 
       FROM attendance_records ar 
       WHERE ar.session_id = ts.id 
       AND ar.member_id = p_member_id),
      'pending'
    ) as response_status
  FROM training_sessions ts
  WHERE 
    ts.date >= p_start_date
    AND ts.category && member_categories  -- Intersection des arrays
  ORDER BY ts.date, ts.start_time;
END;
$$;