/*
  # Correction des colonnes manquantes dans la table members

  1. Ajout des colonnes manquantes
    - address (adresse)
    - postal_code (code postal)
    - city (ville)
    - emergency_contact (personne de contact)
    - emergency_phone (téléphone de contact)
    - ffvb_license (matricule FFVB)

  2. Index pour les performances
    - Index sur les nouvelles colonnes

  3. Mise à jour des contraintes
    - Contraintes de validation si nécessaire
*/

-- ========================================
-- ÉTAPE 1: AJOUTER LES COLONNES MANQUANTES
-- ========================================

-- Ajouter les colonnes d'adresse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'address'
  ) THEN
    ALTER TABLE members ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE members ADD COLUMN postal_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'city'
  ) THEN
    ALTER TABLE members ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE members ADD COLUMN emergency_contact text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'emergency_phone'
  ) THEN
    ALTER TABLE members ADD COLUMN emergency_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'ffvb_license'
  ) THEN
    ALTER TABLE members ADD COLUMN ffvb_license text UNIQUE;
  END IF;
END $$;

-- ========================================
-- ÉTAPE 2: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_members_postal_code ON members(postal_code);
CREATE INDEX IF NOT EXISTS idx_members_city ON members(city);
CREATE INDEX IF NOT EXISTS idx_members_ffvb_license ON members(ffvb_license);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Colonnes ajoutées à la table members !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Nouvelles colonnes :';
  RAISE NOTICE '  - address (adresse)';
  RAISE NOTICE '  - postal_code (code postal)';
  RAISE NOTICE '  - city (ville)';
  RAISE NOTICE '  - emergency_contact (personne de contact)';
  RAISE NOTICE '  - emergency_phone (téléphone de contact)';
  RAISE NOTICE '  - ffvb_license (matricule FFVB unique)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant "Mon Profil" devrait fonctionner !';
END $$;