/*
  # Amélioration de la table members pour la gestion complète

  1. Nouveaux champs
    - license_number (numéro de licence obligatoire)
    - profile_photo_url (URL de la photo de profil)
    - member_status (statut du membre)
    - age_category (catégorie d'âge)
    - member_role (rôle dans l'association)

  2. Modifications
    - Mise à jour des contraintes et index
    - Ajout de nouvelles politiques RLS si nécessaire

  3. Sécurité
    - Maintien de la sécurité existante
    - Nouvelles contraintes de validation
*/

-- Ajouter les nouveaux champs à la table members
DO $$
BEGIN
  -- Numéro de licence (obligatoire et unique)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'license_number'
  ) THEN
    ALTER TABLE members ADD COLUMN license_number text UNIQUE NOT NULL DEFAULT '';
  END IF;

  -- URL de la photo de profil (optionnel)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE members ADD COLUMN profile_photo_url text;
  END IF;

  -- Statut du membre (remplace l'ancien status)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'member_status'
  ) THEN
    ALTER TABLE members ADD COLUMN member_status text DEFAULT 'En attente' 
    CHECK (member_status IN ('Actif', 'Inactif', 'En attente'));
  END IF;

  -- Catégorie d'âge (remplace l'ancien category)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'age_category'
  ) THEN
    ALTER TABLE members ADD COLUMN age_category text DEFAULT 'Sénior'
    CHECK (age_category IN ('U12', 'U15', 'U18', 'Sénior'));
  END IF;

  -- Rôle dans l'association
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'member_role'
  ) THEN
    ALTER TABLE members ADD COLUMN member_role text DEFAULT 'Membre'
    CHECK (member_role IN ('Membre', 'Bénévole', 'Coach', 'Administrateur', 'Trésorerie'));
  END IF;
END $$;

-- Mettre à jour les contraintes existantes pour être plus flexibles
ALTER TABLE members ALTER COLUMN license_number DROP DEFAULT;

-- Créer des index pour améliorer les performances des recherches et filtres
CREATE INDEX IF NOT EXISTS idx_members_license_number ON members(license_number);
CREATE INDEX IF NOT EXISTS idx_members_member_status ON members(member_status);
CREATE INDEX IF NOT EXISTS idx_members_age_category ON members(age_category);
CREATE INDEX IF NOT EXISTS idx_members_member_role ON members(member_role);
CREATE INDEX IF NOT EXISTS idx_members_first_name ON members(first_name);
CREATE INDEX IF NOT EXISTS idx_members_last_name ON members(last_name);

-- Fonction pour générer automatiquement un numéro de licence unique
CREATE OR REPLACE FUNCTION generate_license_number()
RETURNS text AS $$
DECLARE
  new_license text;
  counter integer := 1;
BEGIN
  LOOP
    new_license := 'LIC' || LPAD(counter::text, 6, '0');
    
    -- Vérifier si ce numéro existe déjà
    IF NOT EXISTS (SELECT 1 FROM members WHERE license_number = new_license) THEN
      RETURN new_license;
    END IF;
    
    counter := counter + 1;
    
    -- Sécurité : éviter une boucle infinie
    IF counter > 999999 THEN
      RAISE EXCEPTION 'Impossible de générer un numéro de licence unique';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer automatiquement le numéro de licence si vide
CREATE OR REPLACE FUNCTION auto_generate_license_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le numéro de licence est vide, en générer un automatiquement
  IF NEW.license_number IS NULL OR NEW.license_number = '' THEN
    NEW.license_number := generate_license_number();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS auto_license_number_trigger ON members;
CREATE TRIGGER auto_license_number_trigger
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_license_number();

-- Mettre à jour les membres existants avec des numéros de licence
DO $$
DECLARE
  member_record RECORD;
BEGIN
  FOR member_record IN 
    SELECT id FROM members WHERE license_number IS NULL OR license_number = ''
  LOOP
    UPDATE members 
    SET license_number = generate_license_number()
    WHERE id = member_record.id;
  END LOOP;
END $$;

-- Vue pour faciliter les requêtes avec toutes les informations
CREATE OR REPLACE VIEW members_complete_view AS
SELECT 
  m.*,
  calculate_age(m.birth_date) as calculated_age,
  c.label as category_label,
  c.color as category_color,
  u.first_name as validated_by_first_name,
  u.last_name as validated_by_last_name,
  (
    SELECT COUNT(*) 
    FROM member_documents md 
    WHERE md.member_id = m.id
  ) as total_documents,
  (
    SELECT COUNT(*) 
    FROM member_documents md 
    WHERE md.member_id = m.id AND md.status = 'validated'
  ) as validated_documents,
  (
    SELECT COUNT(*) 
    FROM member_documents md 
    WHERE md.member_id = m.id AND md.status = 'uploaded'
  ) as pending_documents
FROM members m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN users u ON m.validated_by = u.id;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Table members améliorée avec succès !';
  RAISE NOTICE '';
  RAISE NOTICE '🆕 Nouveaux champs ajoutés :';
  RAISE NOTICE '  - license_number (numéro de licence unique)';
  RAISE NOTICE '  - profile_photo_url (photo de profil)';
  RAISE NOTICE '  - member_status (Actif/Inactif/En attente)';
  RAISE NOTICE '  - age_category (U12/U15/U18/Sénior)';
  RAISE NOTICE '  - member_role (Membre/Bénévole/Coach/etc.)';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Fonctionnalités ajoutées :';
  RAISE NOTICE '  - Génération automatique des numéros de licence';
  RAISE NOTICE '  - Index pour recherche et filtrage rapides';
  RAISE NOTICE '  - Vue complète avec statistiques documents';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vue disponible : members_complete_view';
END $$;