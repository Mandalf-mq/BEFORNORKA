/*
  # Système de catégories personnalisables

  1. Nouvelles tables
    - `categories` - Configuration des catégories personnalisées
    - `category_history` - Historique des modifications

  2. Modifications
    - Ajout de colonnes pour lier les membres aux catégories personnalisées
    - Triggers pour maintenir la cohérence des données

  3. Sécurité
    - RLS activé sur toutes les nouvelles tables
    - Politiques d'accès pour les administrateurs
*/

-- Table des catégories personnalisables
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text UNIQUE NOT NULL, -- Valeur technique (ne change jamais)
  label text NOT NULL, -- Nom affiché (modifiable)
  description text DEFAULT '',
  age_range text DEFAULT '',
  membership_fee integer DEFAULT 0,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  is_system boolean DEFAULT false, -- true pour les catégories par défaut
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table d'historique des modifications de catégories
CREATE TABLE IF NOT EXISTS category_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  action text CHECK (action IN ('created', 'updated', 'deleted', 'activated', 'deactivated')),
  old_values jsonb,
  new_values jsonb,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now()
);

-- Ajouter une colonne category_id aux membres pour référencer les catégories personnalisées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE members ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Activation de RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_history ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les catégories
CREATE POLICY "Tous peuvent lire les catégories actives"
  ON categories
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Administrateurs peuvent gérer les catégories"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur')
    )
  );

-- Politiques RLS pour l'historique
CREATE POLICY "Administrateurs peuvent voir l'historique"
  ON category_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur')
    )
  );

CREATE POLICY "Système peut créer l'historique"
  ON category_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insérer les catégories par défaut
INSERT INTO categories (value, label, description, age_range, membership_fee, color, is_system, display_order) VALUES
  ('baby', 'Baby Volley', 'Initiation au volleyball pour les plus petits', '≤6 ans', 120, '#3b82f6', true, 1),
  ('poussin', 'Poussin', 'Découverte du volleyball en s''amusant', '7-8 ans', 140, '#10b981', true, 2),
  ('benjamin', 'Benjamin', 'Apprentissage des bases techniques', '9-10 ans', 160, '#f59e0b', true, 3),
  ('minime', 'Minime', 'Perfectionnement technique et tactique', '11-12 ans', 180, '#8b5cf6', true, 4),
  ('cadet', 'Cadet', 'Développement du jeu collectif', '13-14 ans', 200, '#ef4444', true, 5),
  ('junior', 'Junior', 'Préparation à la compétition senior', '15-17 ans', 220, '#ec4899', true, 6),
  ('senior', 'Senior', 'Compétition et performance', '18-35 ans', 250, '#06b6d4', true, 7),
  ('veteran', 'Vétéran', 'Volleyball plaisir et convivialité', '>35 ans', 200, '#84cc16', true, 8)
ON CONFLICT (value) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  age_range = EXCLUDED.age_range,
  membership_fee = EXCLUDED.membership_fee,
  color = EXCLUDED.color,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Fonction pour créer l'historique automatiquement
CREATE OR REPLACE FUNCTION log_category_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO category_history (category_id, action, new_values, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO category_history (category_id, action, old_values, new_values, changed_by)
    VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO category_history (category_id, action, old_values, changed_by)
    VALUES (OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour l'historique
CREATE TRIGGER category_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION log_category_changes();

-- Fonction pour synchroniser les membres avec les nouvelles catégories
CREATE OR REPLACE FUNCTION sync_member_categories()
RETURNS void AS $$
BEGIN
  -- Mettre à jour category_id pour les membres existants
  UPDATE members 
  SET category_id = c.id
  FROM categories c
  WHERE members.category = c.value
  AND members.category_id IS NULL;
  
  RAISE NOTICE 'Synchronisation des catégories terminée';
END;
$$ LANGUAGE plpgsql;

-- Exécuter la synchronisation
SELECT sync_member_categories();

-- Fonction pour obtenir les catégories actives avec statistiques
CREATE OR REPLACE FUNCTION get_categories_with_stats()
RETURNS TABLE(
  id uuid,
  value text,
  label text,
  description text,
  age_range text,
  membership_fee integer,
  color text,
  is_active boolean,
  display_order integer,
  member_count bigint,
  total_revenue bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.value,
    c.label,
    c.description,
    c.age_range,
    c.membership_fee,
    c.color,
    c.is_active,
    c.display_order,
    COUNT(m.id) as member_count,
    COALESCE(SUM(m.membership_fee), 0) as total_revenue
  FROM categories c
  LEFT JOIN members m ON c.id = m.category_id
  WHERE c.is_active = true
  GROUP BY c.id, c.value, c.label, c.description, c.age_range, c.membership_fee, c.color, c.is_active, c.display_order
  ORDER BY c.display_order;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour valider qu'une catégorie peut être supprimée
CREATE OR REPLACE FUNCTION can_delete_category(category_id uuid)
RETURNS boolean AS $$
DECLARE
  member_count integer;
  is_system_category boolean;
BEGIN
  -- Vérifier si c'est une catégorie système
  SELECT is_system INTO is_system_category
  FROM categories
  WHERE id = category_id;
  
  IF is_system_category THEN
    RETURN false;
  END IF;
  
  -- Compter les membres dans cette catégorie
  SELECT COUNT(*) INTO member_count
  FROM members
  WHERE category_id = category_id;
  
  RETURN member_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_categories_value ON categories(value);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);
CREATE INDEX IF NOT EXISTS idx_category_history_category ON category_history(category_id);
CREATE INDEX IF NOT EXISTS idx_category_history_action ON category_history(action);
CREATE INDEX IF NOT EXISTS idx_members_category_id ON members(category_id);

-- Trigger pour updated_at
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vue pour faciliter les requêtes
CREATE OR REPLACE VIEW member_categories AS
SELECT 
  m.*,
  c.label as category_label,
  c.color as category_color,
  c.age_range as category_age_range
FROM members m
LEFT JOIN categories c ON m.category_id = c.id;

-- Contrainte pour éviter les doublons dans l'ordre d'affichage
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_order 
ON categories(display_order) 
WHERE is_active = true;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Système de catégories personnalisables créé avec succès !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables créées :';
  RAISE NOTICE '  - categories (configuration des catégories)';
  RAISE NOTICE '  - category_history (historique des modifications)';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 Modifications :';
  RAISE NOTICE '  - Colonne category_id ajoutée à members';
  RAISE NOTICE '  - Vue member_categories créée';
  RAISE NOTICE '  - Fonctions utilitaires ajoutées';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Prochaines étapes :';
  RAISE NOTICE '  1. Testez le gestionnaire de catégories';
  RAISE NOTICE '  2. Personnalisez vos noms de catégories';
  RAISE NOTICE '  3. Vérifiez la synchronisation des membres';
END $$;