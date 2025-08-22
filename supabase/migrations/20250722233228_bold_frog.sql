/*
  # Attribution automatique des catégories selon l'âge

  1. Fonction d'attribution automatique
    - Calcul précis de l'âge à partir de la date de naissance
    - Attribution de la catégorie correspondante
    - Mise à jour automatique du tarif de cotisation

  2. Trigger automatique
    - Se déclenche à chaque insertion/modification de membre
    - Met à jour category et membership_fee automatiquement
    - Utilise les catégories personnalisées si disponibles

  3. Fonctions utilitaires
    - Calcul d'âge précis
    - Attribution de catégorie
    - Calcul de cotisation
*/

-- Fonction pour calculer l'âge précis
CREATE OR REPLACE FUNCTION calculate_age(birth_date date)
RETURNS integer AS $$
DECLARE
  age integer;
BEGIN
  -- Calcul précis de l'âge
  age := EXTRACT(YEAR FROM age(CURRENT_DATE, birth_date));
  RETURN age;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour attribuer automatiquement la catégorie selon l'âge
CREATE OR REPLACE FUNCTION get_category_by_age(birth_date date)
RETURNS text AS $$
DECLARE
  member_age integer;
  category_value text;
BEGIN
  member_age := calculate_age(birth_date);
  
  -- Attribution selon l'âge (logique identique au frontend)
  IF member_age <= 6 THEN
    category_value := 'baby';
  ELSIF member_age <= 8 THEN
    category_value := 'poussin';
  ELSIF member_age <= 10 THEN
    category_value := 'benjamin';
  ELSIF member_age <= 12 THEN
    category_value := 'minime';
  ELSIF member_age <= 14 THEN
    category_value := 'cadet';
  ELSIF member_age <= 17 THEN
    category_value := 'junior';
  ELSIF member_age <= 35 THEN
    category_value := 'senior';
  ELSE
    category_value := 'veteran';
  END IF;
  
  RETURN category_value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour obtenir le tarif selon la catégorie
CREATE OR REPLACE FUNCTION get_membership_fee_by_category(category_value text)
RETURNS integer AS $$
DECLARE
  fee integer;
BEGIN
  -- Essayer d'abord avec les catégories personnalisées
  SELECT membership_fee INTO fee
  FROM categories
  WHERE value = category_value AND is_active = true
  LIMIT 1;
  
  -- Si pas trouvé, utiliser les tarifs par défaut
  IF fee IS NULL THEN
    CASE category_value
      WHEN 'baby' THEN fee := 120;
      WHEN 'poussin' THEN fee := 140;
      WHEN 'benjamin' THEN fee := 160;
      WHEN 'minime' THEN fee := 180;
      WHEN 'cadet' THEN fee := 200;
      WHEN 'junior' THEN fee := 220;
      WHEN 'senior' THEN fee := 250;
      WHEN 'veteran' THEN fee := 200;
      ELSE fee := 250; -- Tarif par défaut
    END CASE;
  END IF;
  
  RETURN fee;
END;
$$ LANGUAGE plpgsql;

-- Fonction trigger pour attribution automatique
CREATE OR REPLACE FUNCTION auto_assign_member_category()
RETURNS TRIGGER AS $$
DECLARE
  auto_category text;
  auto_fee integer;
  category_id_value uuid;
BEGIN
  -- Attribution automatique de la catégorie si pas déjà définie ou si date de naissance modifiée
  IF NEW.birth_date IS NOT NULL AND (OLD IS NULL OR OLD.birth_date != NEW.birth_date OR NEW.category IS NULL) THEN
    
    -- Calculer la catégorie automatique
    auto_category := get_category_by_age(NEW.birth_date);
    
    -- Mettre à jour la catégorie
    NEW.category := auto_category;
    
    -- Calculer le tarif correspondant
    auto_fee := get_membership_fee_by_category(auto_category);
    NEW.membership_fee := auto_fee;
    
    -- Essayer de lier à la catégorie personnalisée si elle existe
    SELECT id INTO category_id_value
    FROM categories
    WHERE value = auto_category AND is_active = true
    LIMIT 1;
    
    IF category_id_value IS NOT NULL THEN
      NEW.category_id := category_id_value;
    END IF;
    
    RAISE NOTICE 'Attribution automatique: âge %, catégorie %, tarif %€', 
      calculate_age(NEW.birth_date), auto_category, auto_fee;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour l'attribution automatique
DROP TRIGGER IF EXISTS auto_assign_category_trigger ON members;
CREATE TRIGGER auto_assign_category_trigger
  BEFORE INSERT OR UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_member_category();

-- Fonction pour recalculer toutes les catégories existantes
CREATE OR REPLACE FUNCTION recalculate_all_member_categories()
RETURNS void AS $$
DECLARE
  member_record RECORD;
  new_category text;
  new_fee integer;
  updated_count integer := 0;
BEGIN
  -- Parcourir tous les membres avec une date de naissance
  FOR member_record IN 
    SELECT id, birth_date, category, membership_fee 
    FROM members 
    WHERE birth_date IS NOT NULL
  LOOP
    -- Calculer la nouvelle catégorie
    new_category := get_category_by_age(member_record.birth_date);
    new_fee := get_membership_fee_by_category(new_category);
    
    -- Mettre à jour si différent
    IF member_record.category != new_category OR member_record.membership_fee != new_fee THEN
      UPDATE members 
      SET 
        category = new_category,
        membership_fee = new_fee,
        updated_at = now()
      WHERE id = member_record.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Recalcul terminé: % membres mis à jour', updated_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter le recalcul pour les membres existants
SELECT recalculate_all_member_categories();

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_members_birth_date ON members(birth_date);
CREATE INDEX IF NOT EXISTS idx_members_category_value ON members(category);

-- Vue pour faciliter les requêtes avec âge calculé
CREATE OR REPLACE VIEW members_with_age AS
SELECT 
  m.*,
  calculate_age(m.birth_date) as age,
  c.label as category_label,
  c.color as category_color,
  c.age_range as category_age_range
FROM members m
LEFT JOIN categories c ON m.category_id = c.id;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Système d''attribution automatique des catégories créé !';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Fonctionnalités ajoutées :';
  RAISE NOTICE '  - Attribution automatique selon l''âge';
  RAISE NOTICE '  - Calcul automatique des cotisations';
  RAISE NOTICE '  - Trigger sur insertion/modification';
  RAISE NOTICE '  - Recalcul des membres existants';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Maintenant :';
  RAISE NOTICE '  - Les catégories sont attribuées automatiquement';
  RAISE NOTICE '  - Les tarifs sont calculés automatiquement';
  RAISE NOTICE '  - Tout se synchronise en temps réel';
END $$;