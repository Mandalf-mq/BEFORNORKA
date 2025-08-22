/*
  # Fix ambiguous column reference in get_members_for_whatsapp function

  1. Problem
    - The 'id' column reference is ambiguous between members.id and categories.id
    - PostgreSQL cannot determine which 'id' column to use in the SELECT statement
    
  2. Solution
    - Explicitly alias the members.id column as 'id' in the SELECT statement
    - This resolves the ambiguity and clarifies which id column should be returned
*/

-- Drop and recreate the function with explicit column aliasing
DROP FUNCTION IF EXISTS get_members_for_whatsapp(text[]);

CREATE OR REPLACE FUNCTION get_members_for_whatsapp(p_categories text[] DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  category text,
  category_label text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS id,  -- Explicitly alias to resolve ambiguity
    m.first_name,
    m.last_name,
    m.email,
    m.phone,
    m.category,
    COALESCE(c.label, m.category) as category_label
  FROM members m
  LEFT JOIN categories c ON m.category = c.value
  WHERE m.status = 'season_validated'
  AND m.season_id IN (SELECT id FROM seasons WHERE is_current = true)
  AND (p_categories IS NULL OR m.category = ANY(p_categories))
  AND m.phone IS NOT NULL 
  AND m.phone != ''
  ORDER BY m.category, m.first_name, m.last_name;
END;
$$ LANGUAGE plpgsql;