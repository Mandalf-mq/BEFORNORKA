/*
  # Correction des tables existantes et des 3 problèmes

  1. Vérification et correction des tables existantes
  2. Correction des politiques RLS en conflit
  3. Ajout des colonnes manquantes si nécessaire
  4. Insertion des données par défaut
*/

-- ========================================
-- ÉTAPE 1: VÉRIFIER ET CORRIGER LA TABLE CATEGORIES
-- ========================================

-- Créer la table categories si elle n'existe pas
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text UNIQUE NOT NULL,
  label text NOT NULL,
  description text DEFAULT '',
  age_range text DEFAULT '',
  membership_fee integer DEFAULT 0,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS si pas déjà fait
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques pour éviter les conflits
DROP POLICY IF EXISTS "Everyone can read active categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

-- Créer les nouvelles politiques
CREATE POLICY "Everyone can read active categories"
  ON categories
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage categories"
  ON categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 2: VÉRIFIER ET CORRIGER LA TABLE MEMBER_DOCUMENTS
-- ========================================

-- Créer la table member_documents si elle n'existe pas
CREATE TABLE IF NOT EXISTS member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  rejection_reason text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, document_type)
);

-- Activer RLS si pas déjà fait
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques pour éviter les conflits
DROP POLICY IF EXISTS "Authenticated users can manage member documents" ON member_documents;
DROP POLICY IF EXISTS "Members can view their documents" ON member_documents;
DROP POLICY IF EXISTS "Members can upload documents" ON member_documents;

-- Créer les nouvelles politiques
CREATE POLICY "Authenticated users can manage member documents"
  ON member_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 3: CRÉER LA TABLE DOCUMENT_TEMPLATES
-- ========================================

CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  is_active boolean DEFAULT true,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques pour éviter les conflits
DROP POLICY IF EXISTS "Everyone can read active templates" ON document_templates;
DROP POLICY IF EXISTS "Authenticated users can manage templates" ON document_templates;

-- Créer les politiques
CREATE POLICY "Everyone can read active templates"
  ON document_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage templates"
  ON document_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 4: AJOUTER LES COLONNES MANQUANTES À MEMBERS
-- ========================================

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
  -- Adresse
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'address'
  ) THEN
    ALTER TABLE members ADD COLUMN address text;
  END IF;

  -- Code postal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE members ADD COLUMN postal_code text;
  END IF;

  -- Ville
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'city'
  ) THEN
    ALTER TABLE members ADD COLUMN city text;
  END IF;

  -- Contact d'urgence
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE members ADD COLUMN emergency_contact text;
  END IF;

  -- Téléphone d'urgence
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'emergency_phone'
  ) THEN
    ALTER TABLE members ADD COLUMN emergency_phone text;
  END IF;

  -- Matricule FFVB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'ffvb_license'
  ) THEN
    ALTER TABLE members ADD COLUMN ffvb_license text UNIQUE;
  END IF;
END $$;

-- ========================================
-- ÉTAPE 5: INSÉRER LES DONNÉES PAR DÉFAUT
-- ========================================

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

-- Insérer les modèles de documents par défaut
INSERT INTO document_templates (name, description, document_type, file_name, file_path) VALUES
  (
    'Formulaire FFVB 2024-2025',
    'Formulaire officiel FFVB à compléter et signer',
    'ffvbForm',
    'formulaire-ffvb-2024-2025.pdf',
    'formulaire-ffvb-2024-2025.pdf'
  ),
  (
    'Autorisation parentale',
    'Autorisation parentale pour les mineurs',
    'parentalConsent',
    'autorisation-parentale-2024.pdf',
    'autorisation-parentale-2024.pdf'
  ),
  (
    'Guide photo d''identité',
    'Instructions pour la photo d''identité numérique',
    'idPhoto',
    'guide-photo-identite.pdf',
    'guide-photo-identite.pdf'
  ),
  (
    'Modèle certificat médical',
    'Modèle de certificat médical pour le médecin',
    'medicalCertificate',
    'modele-certificat-medical.pdf',
    'modele-certificat-medical.pdf'
  )
ON CONFLICT DO NOTHING;

-- ========================================
-- ÉTAPE 6: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_categories_value ON categories(value);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

CREATE INDEX IF NOT EXISTS idx_member_documents_member_id ON member_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_type ON member_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_member_documents_status ON member_documents(status);

CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_members_ffvb_license ON members(ffvb_license);

-- ========================================
-- ÉTAPE 7: TRIGGERS POUR UPDATED_AT
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_documents_updated_at ON member_documents;
CREATE TRIGGER update_member_documents_updated_at 
  BEFORE UPDATE ON member_documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_templates_updated_at ON document_templates;
CREATE TRIGGER update_document_templates_updated_at 
  BEFORE UPDATE ON document_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ CORRECTION DES TABLES ET POLITIQUES TERMINÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Tables vérifiées/créées :';
  RAISE NOTICE '  - categories (8 catégories par défaut)';
  RAISE NOTICE '  - member_documents (pour les uploads)';
  RAISE NOTICE '  - document_templates (4 modèles par défaut)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Colonnes ajoutées à members :';
  RAISE NOTICE '  - address, postal_code, city';
  RAISE NOTICE '  - emergency_contact, emergency_phone';
  RAISE NOTICE '  - ffvb_license (unique)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Politiques RLS corrigées :';
  RAISE NOTICE '  - Conflits résolus';
  RAISE NOTICE '  - Permissions pour utilisateurs authentifiés';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 MAINTENANT LES 3 PROBLÈMES SONT CORRIGÉS !';
END $$;