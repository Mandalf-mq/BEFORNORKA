/*
  # Intégration calendrier pour les membres

  1. Nouvelles fonctionnalités
    - Token unique par membre pour synchronisation calendrier
    - Génération de fichiers .ics personnalisés
    - Filtrage automatique selon les catégories du membre
    - Sécurité par token secret

  2. Tables modifiées
    - members : Ajout de calendar_token pour sécurité
    - Fonction de génération .ics

  3. Sécurité
    - Token unique et secret par membre
    - Accès sécurisé sans authentification
    - Révocation possible du token
*/

-- Ajouter la colonne calendar_token à la table members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'members' AND column_name = 'calendar_token'
  ) THEN
    ALTER TABLE members ADD COLUMN calendar_token uuid DEFAULT gen_random_uuid();
    COMMENT ON COLUMN members.calendar_token IS 'Token unique pour synchronisation calendrier';
  END IF;
END $$;

-- Générer des tokens pour les membres existants qui n'en ont pas
UPDATE members 
SET calendar_token = gen_random_uuid() 
WHERE calendar_token IS NULL;

-- Fonction pour régénérer le token calendrier d'un membre
CREATE OR REPLACE FUNCTION regenerate_calendar_token(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token uuid;
BEGIN
  -- Générer un nouveau token
  new_token := gen_random_uuid();
  
  -- Mettre à jour le membre
  UPDATE members 
  SET 
    calendar_token = new_token,
    updated_at = now()
  WHERE id = p_member_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'new_token', new_token,
    'message', 'Token calendrier régénéré avec succès'
  );
END;
$$;

-- Fonction pour obtenir les entraînements d'un membre via son token
CREATE OR REPLACE FUNCTION get_member_training_calendar(p_calendar_token uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  date date,
  start_time time,
  end_time time,
  location text,
  coach text,
  category_labels text,
  member_email text,
  member_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_record record;
  member_categories text[];
BEGIN
  -- Vérifier que le token existe et récupérer le membre
  SELECT m.* INTO member_record
  FROM members m
  WHERE m.calendar_token = p_calendar_token
  AND m.status = 'season_validated';
  
  IF NOT FOUND THEN
    -- Retourner une table vide si token invalide
    RETURN;
  END IF;
  
  -- Récupérer toutes les catégories du membre
  SELECT ARRAY(
    SELECT mc.category_value 
    FROM member_categories mc 
    WHERE mc.member_id = member_record.id
    UNION
    SELECT member_record.category 
    WHERE member_record.category IS NOT NULL
  ) INTO member_categories;
  
  -- Retourner les sessions futures du membre
  RETURN QUERY
  SELECT 
    ts.id,
    ts.title,
    ts.description,
    ts.date,
    ts.start_time,
    ts.end_time,
    ts.location,
    ts.coach,
    string_agg(c.label, ', ') as category_labels,
    member_record.email as member_email,
    member_record.first_name || ' ' || member_record.last_name as member_name
  FROM training_sessions ts
  LEFT JOIN categories c ON c.value = ANY(ts.category)
  WHERE 
    ts.date >= CURRENT_DATE - interval '7 days' -- Inclure la semaine passée
    AND ts.category && member_categories  -- Intersection des arrays
  GROUP BY ts.id, ts.title, ts.description, ts.date, ts.start_time, ts.end_time, ts.location, ts.coach, member_record.email, member_record.first_name, member_record.last_name
  ORDER BY ts.date, ts.start_time;
END;
$$;