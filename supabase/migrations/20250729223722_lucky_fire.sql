/*
  # Correction de l'erreur season_id NOT NULL

  1. Problème identifié
    - La colonne season_id de document_templates a une contrainte NOT NULL
    - Mais on essaie d'insérer des templates sans season_id
    
  2. Solutions
    - Supprimer la contrainte NOT NULL sur season_id
    - Permettre des templates globaux (sans saison spécifique)
    - Corriger les politiques RLS
    
  3. Tables à vérifier/créer
    - categories (si manquante)
    - member_documents (si manquante)
    - document_templates (corriger contrainte)
*/

-- ========================================
-- ÉTAPE 1: CRÉER LA TABLE CATEGORIES SI MANQUANTE
-- ========================================

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

-- ========================================
-- ÉTAPE 2: CRÉER LA TABLE MEMBER_DOCUMENTS SI MANQUANTE
-- ========================================

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

-- ========================================
-- ÉTAPE 3: CORRIGER LA TABLE DOCUMENT_TEMPLATES
-- ========================================

-- Supprimer la contrainte NOT NULL sur season_id si elle existe
ALTER TABLE document_templates 
ALTER COLUMN season_id DROP NOT NULL;

-- ========================================
-- ÉTAPE 4: ACTIVER RLS SUR LES TABLES
-- ========================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- ========================================
-- ÉTAPE 5: SUPPRIMER LES POLITIQUES EXISTANTES POUR ÉVITER LES CONFLITS
-- ========================================

-- Supprimer les politiques existantes sur categories
DROP POLICY IF EXISTS "Everyone can read active categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

-- Supprimer les politiques existantes sur member_documents
DROP POLICY IF EXISTS "Authenticated users can manage member documents" ON member_documents;
DROP POLICY IF EXISTS "Members can view their documents" ON member_documents;

-- Supprimer les politiques existantes sur document_templates
DROP POLICY IF EXISTS "Everyone can read active templates" ON document_templates;
DROP POLICY IF EXISTS "Authenticated users can manage templates" ON document_templates;

-- ========================================
-- ÉTAPE 6: CRÉER LES NOUVELLES POLITIQUES RLS
-- ========================================

-- Politiques pour categories
CREATE POLICY "Public can read active categories"
  ON categories
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage categories"
  ON categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politiques pour member_documents
CREATE POLICY "Authenticated users can manage documents"
  ON member_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politiques pour document_templates
CREATE POLICY "Public can read active templates"
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
-- ÉTAPE 7: INSÉRER LES CATÉGORIES PAR DÉFAUT
-- ========================================

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

-- ========================================
-- ÉTAPE 8: INSÉRER LES MODÈLES DE DOCUMENTS (SANS season_id)
-- ========================================

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
-- ÉTAPE 9: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_categories_value ON categories(value);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_member_documents_member_id ON member_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_type ON member_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);

-- ========================================
-- ÉTAPE 10: TRIGGERS POUR UPDATED_AT
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

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ CORRECTION DE LA CONTRAINTE season_id TERMINÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Corrections appliquées :';
  RAISE NOTICE '  - Contrainte NOT NULL supprimée sur season_id';
  RAISE NOTICE '  - Tables créées si manquantes';
  RAISE NOTICE '  - Politiques RLS corrigées';
  RAISE NOTICE '  - Données par défaut insérées';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant les 3 problèmes devraient être résolus !';
END $$;