/*
  # Fix ambiguous column reference in get_members_for_whatsapp function

  1. Problem
    - The 'id' column reference is ambiguous between members.id and member_categories.id
    - PostgreSQL cannot determine which 'id' column to use in the SELECT statement
    
  2. Solution
    - Drop the existing function completely
    - Recreate with proper table aliases and explicit column references
    - Use member_categories table for multiple categories support
*/

-- Drop the existing function completely
DROP FUNCTION IF EXISTS get_members_for_whatsapp(text[]);

-- Recreate the function with proper aliases and explicit column references
CREATE OR REPLACE FUNCTION get_members_for_whatsapp(p_categories text[] DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  category text,
  additional_categories text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    m.id,
    m.first_name,
    m.last_name,
    m.email,
    m.phone,
    m.category,
    ARRAY(
      SELECT mc.category_value 
      FROM member_categories mc 
      WHERE mc.member_id = m.id 
      AND mc.category_value != m.category
    ) as additional_categories
  FROM members m
  WHERE m.status = 'season_validated'
  AND m.phone IS NOT NULL 
  AND m.phone != ''
  AND (
    p_categories IS NULL 
    OR m.category = ANY(p_categories)
    OR EXISTS (
      SELECT 1 FROM member_categories mc2 
      WHERE mc2.member_id = m.id 
      AND mc2.category_value = ANY(p_categories)
    )
  )
  ORDER BY m.category, m.first_name, m.last_name;
END;
$$ LANGUAGE plpgsql;