/*
  # Système de catégories multiples pour les membres

  1. Table de liaison member_categories
    - Relation many-to-many entre membres et catégories
    - Un membre peut appartenir à plusieurs catégories d'entraînement

  2. Fonctions utilitaires
    - Gestion des catégories multiples
    - Migration des données existantes

  3. Sécurité
    - RLS activé avec politiques appropriées
*/

-- ========================================
-- ÉTAPE 1: CRÉER LA TABLE DE LIAISON MEMBER_CATEGORIES
-- ========================================

-- Table de liaison pour les catégories multiples
CREATE TABLE IF NOT EXISTS member_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category_value text NOT NULL,
  is_primary boolean DEFAULT false, -- Une catégorie principale pour l'affichage
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, category_value)
);

-- ========================================
-- ÉTAPE 2: ACTIVER RLS ET CRÉER LES POLITIQUES
-- ========================================

-- Activer RLS
ALTER TABLE member_categories ENABLE ROW LEVEL SECURITY;

-- Politique pour que tous puissent lire les catégories des membres
CREATE POLICY "Everyone can read member categories"
  ON member_categories
  FOR SELECT
  USING (true);

-- Politique pour que les utilisateurs authentifiés puissent gérer
CREATE POLICY "Authenticated users can manage member categories"
  ON member_categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 3: MIGRER LES DONNÉES EXISTANTES
-- ========================================

-- Migrer les catégories existantes vers la nouvelle table
INSERT INTO member_categories (member_id, category_value, is_primary)
SELECT 
  id as member_id,
  category as category_value,
  true as is_primary
FROM members 
WHERE category IS NOT NULL
ON CONFLICT (member_id, category_value) DO NOTHING;

-- ========================================
-- ÉTAPE 4: FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour obtenir les catégories d'un membre
CREATE OR REPLACE FUNCTION get_member_categories(p_member_id uuid)
RETURNS text[] AS $$
DECLARE
  categories text[];
BEGIN
  SELECT ARRAY_AGG(category_value ORDER BY is_primary DESC, category_value) 
  INTO categories
  FROM member_categories 
  WHERE member_id = p_member_id;
  
  RETURN COALESCE(categories, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir la catégorie principale d'un membre
CREATE OR REPLACE FUNCTION get_member_primary_category(p_member_id uuid)
RETURNS text AS $$
DECLARE
  primary_category text;
BEGIN
  SELECT category_value INTO primary_category
  FROM member_categories 
  WHERE member_id = p_member_id AND is_primary = true
  LIMIT 1;
  
  -- Si pas de catégorie principale, prendre la première
  IF primary_category IS NULL THEN
    SELECT category_value INTO primary_category
    FROM member_categories 
    WHERE member_id = p_member_id
    ORDER BY created_at
    LIMIT 1;
  END IF;
  
  RETURN COALESCE(primary_category, 'senior');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les catégories d'un membre
CREATE OR REPLACE FUNCTION update_member_categories(
  p_member_id uuid,
  p_categories text[],
  p_primary_category text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  category_value text;
BEGIN
  -- Supprimer les anciennes catégories
  DELETE FROM member_categories WHERE member_id = p_member_id;
  
  -- Ajouter les nouvelles catégories
  FOREACH category_value IN ARRAY p_categories
  LOOP
    INSERT INTO member_categories (member_id, category_value, is_primary)
    VALUES (
      p_member_id, 
      category_value, 
      (category_value = COALESCE(p_primary_category, p_categories[1]))
    );
  END LOOP;
  
  -- Mettre à jour la catégorie principale dans la table members pour compatibilité
  UPDATE members 
  SET category = COALESCE(p_primary_category, p_categories[1])
  WHERE id = p_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 5: VUE POUR LES MEMBRES AVEC CATÉGORIES MULTIPLES
-- ========================================

-- Vue pour les membres avec leurs catégories multiples
CREATE OR REPLACE VIEW members_with_multiple_categories AS
SELECT 
  m.*,
  get_member_categories(m.id) as all_categories,
  get_member_primary_category(m.id) as primary_category,
  calculate_age(m.birth_date) as age
FROM members m;

-- ========================================
-- ÉTAPE 6: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_member_categories_member_id ON member_categories(member_id);
CREATE INDEX IF NOT EXISTS idx_member_categories_category ON member_categories(category_value);
CREATE INDEX IF NOT EXISTS idx_member_categories_primary ON member_categories(is_primary);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ SYSTÈME DE CATÉGORIES MULTIPLES CRÉÉ !';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Table créée :';
  RAISE NOTICE '  - member_categories (liaison many-to-many)';
  RAISE NOTICE '  - Migration des données existantes effectuée';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions disponibles :';
  RAISE NOTICE '  - get_member_categories(member_id) → text[]';
  RAISE NOTICE '  - get_member_primary_category(member_id) → text';
  RAISE NOTICE '  - update_member_categories(member_id, categories[], primary)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vue disponible :';
  RAISE NOTICE '  - members_with_multiple_categories';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant un membre peut avoir plusieurs catégories !';
END $$;