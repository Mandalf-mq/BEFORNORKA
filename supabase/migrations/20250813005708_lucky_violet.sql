/*
  # Fonctions pour la gestion des familles

  1. Ajout des colonnes familiales
    - is_family_head (boolean) - Indique si le membre est chef de famille
    - family_head_id (uuid) - Référence vers le chef de famille

  2. Fonctions RPC
    - create_family_link - Créer un lien familial
    - unlink_member_from_family - Délier un membre de sa famille
    - get_family_stats - Statistiques familiales

  3. Vue enrichie
    - members_with_family_info - Membres avec informations familiales
*/

-- ========================================
-- ÉTAPE 1: AJOUTER LES COLONNES FAMILIALES
-- ========================================

-- Ajouter les colonnes familiales si elles n'existent pas
DO $$
BEGIN
  -- Colonne pour marquer les chefs de famille
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'is_family_head'
  ) THEN
    ALTER TABLE members ADD COLUMN is_family_head boolean DEFAULT false;
  END IF;

  -- Colonne pour référencer le chef de famille
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'family_head_id'
  ) THEN
    ALTER TABLE members ADD COLUMN family_head_id uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================================
-- ÉTAPE 2: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_members_family_head ON members(is_family_head);
CREATE INDEX IF NOT EXISTS idx_members_family_head_id ON members(family_head_id);

-- ========================================
-- ÉTAPE 3: FONCTION POUR CRÉER UN LIEN FAMILIAL
-- ========================================

CREATE OR REPLACE FUNCTION create_family_link(
  p_parent_id uuid,
  p_children_ids uuid[]
)
RETURNS jsonb AS $$
DECLARE
  parent_record members%ROWTYPE;
  child_id uuid;
  children_count integer := 0;
  family_discount numeric := 0;
BEGIN
  -- Récupérer les données du parent
  SELECT * INTO parent_record FROM members WHERE id = p_parent_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent non trouvé'
    );
  END IF;
  
  -- Vérifier que le parent est majeur
  IF calculate_age(parent_record.birth_date) < 18 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le chef de famille doit être majeur'
    );
  END IF;
  
  -- Marquer le parent comme chef de famille
  UPDATE members 
  SET 
    is_family_head = true,
    updated_at = now()
  WHERE id = p_parent_id;
  
  -- Lier chaque enfant au parent
  FOREACH child_id IN ARRAY p_children_ids
  LOOP
    -- Vérifier que l'enfant est mineur
    IF EXISTS (
      SELECT 1 FROM members 
      WHERE id = child_id 
      AND calculate_age(birth_date) < 18
    ) THEN
      UPDATE members 
      SET 
        family_head_id = p_parent_id,
        is_family_head = false,
        updated_at = now()
      WHERE id = child_id;
      
      children_count := children_count + 1;
    END IF;
  END LOOP;
  
  -- Calculer la réduction familiale (10% à partir du 2ème enfant)
  IF children_count > 1 THEN
    SELECT SUM(membership_fee * 0.1) INTO family_discount
    FROM members 
    WHERE family_head_id = p_parent_id
    AND id != ANY(p_children_ids[1:1]); -- Exclure le premier enfant
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'parent_name', parent_record.first_name || ' ' || parent_record.last_name,
    'children_count', children_count,
    'family_discount', ROUND(family_discount, 2)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 4: FONCTION POUR DÉLIER UN MEMBRE
-- ========================================

CREATE OR REPLACE FUNCTION unlink_member_from_family(
  p_member_id uuid
)
RETURNS jsonb AS $$
DECLARE
  member_record members%ROWTYPE;
  family_head_id uuid;
  remaining_children integer;
BEGIN
  -- Récupérer les données du membre
  SELECT * INTO member_record FROM members WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Membre non trouvé'
    );
  END IF;
  
  family_head_id := member_record.family_head_id;
  
  -- Délier le membre
  UPDATE members 
  SET 
    family_head_id = NULL,
    is_family_head = false,
    updated_at = now()
  WHERE id = p_member_id;
  
  -- Si c'était un chef de famille, délier tous ses enfants
  IF member_record.is_family_head THEN
    UPDATE members 
    SET 
      family_head_id = NULL,
      updated_at = now()
    WHERE family_head_id = p_member_id;
  END IF;
  
  -- Vérifier s'il reste des enfants pour le chef de famille
  IF family_head_id IS NOT NULL THEN
    SELECT COUNT(*) INTO remaining_children
    FROM members 
    WHERE family_head_id = family_head_id;
    
    -- Si plus d'enfants, retirer le statut de chef de famille
    IF remaining_children = 0 THEN
      UPDATE members 
      SET is_family_head = false, updated_at = now()
      WHERE id = family_head_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membre délié avec succès'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 5: VUE POUR LES MEMBRES AVEC INFOS FAMILIALES
-- ========================================

CREATE OR REPLACE VIEW members_with_family_info AS
SELECT 
  m.*,
  calculate_age(m.birth_date) as age,
  CASE 
    WHEN m.is_family_head THEN m.first_name || ' ' || m.last_name
    WHEN m.family_head_id IS NOT NULL THEN 
      (SELECT p.first_name || ' ' || p.last_name FROM members p WHERE p.id = m.family_head_id)
    ELSE NULL
  END as family_head_name
FROM members m
ORDER BY 
  CASE WHEN m.is_family_head THEN 0 ELSE 1 END,
  m.family_head_id NULLS LAST,
  m.birth_date;

-- ========================================
-- ÉTAPE 6: FONCTION POUR CALCULER L'ÂGE (SI MANQUANTE)
-- ========================================

CREATE OR REPLACE FUNCTION calculate_age(birth_date date)
RETURNS integer AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(CURRENT_DATE, birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ FONCTIONS FAMILIALES CRÉÉES !';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Colonnes ajoutées :';
  RAISE NOTICE '  - is_family_head (boolean)';
  RAISE NOTICE '  - family_head_id (uuid)';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions RPC disponibles :';
  RAISE NOTICE '  - create_family_link(parent_id, children_ids[])';
  RAISE NOTICE '  - unlink_member_from_family(member_id)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vue disponible :';
  RAISE NOTICE '  - members_with_family_info';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Gestion des familles maintenant fonctionnelle !';
END $$;