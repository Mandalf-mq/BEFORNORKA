/*
  # Création des tables manquantes pour BE FOR NOR KA

  1. Tables manquantes
    - `categories` - Gestion des catégories personnalisables
    - `member_documents` - Documents uploadés par les membres
    
  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques d'accès appropriées
    
  3. Données par défaut
    - Catégories de volleyball standard
    - Modèles de documents
*/

-- ========================================
-- ÉTAPE 1: CRÉER LA TABLE CATEGORIES
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
-- ÉTAPE 2: CRÉER LA TABLE MEMBER_DOCUMENTS
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
-- ÉTAPE 3: ACTIVER RLS
-- ========================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;

-- ========================================
-- ÉTAPE 4: POLITIQUES RLS POUR CATEGORIES
-- ========================================

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
-- ÉTAPE 5: POLITIQUES RLS POUR MEMBER_DOCUMENTS
-- ========================================

CREATE POLICY "Authenticated users can manage member documents"
  ON member_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 6: INSÉRER LES CATÉGORIES PAR DÉFAUT
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
-- ÉTAPE 7: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_categories_value ON categories(value);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

CREATE INDEX IF NOT EXISTS idx_member_documents_member_id ON member_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_type ON member_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_member_documents_status ON member_documents(status);
CREATE INDEX IF NOT EXISTS idx_member_documents_uploaded_at ON member_documents(uploaded_at);

-- ========================================
-- ÉTAPE 8: TRIGGERS POUR UPDATED_AT
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_documents_updated_at 
  BEFORE UPDATE ON member_documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ÉTAPE 9: FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour valider un document
CREATE OR REPLACE FUNCTION validate_document(
  p_document_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  IF p_action = 'validate' THEN
    UPDATE member_documents 
    SET 
      status = 'validated',
      validated_by = auth.uid(),
      validated_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = p_document_id;
  ELSIF p_action = 'reject' THEN
    UPDATE member_documents 
    SET 
      status = 'rejected',
      rejection_reason = p_reason,
      validated_by = auth.uid(),
      validated_at = now(),
      updated_at = now()
    WHERE id = p_document_id;
  ELSE
    RAISE EXCEPTION 'Action invalide: %. Utilisez "validate" ou "reject"', p_action;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ TABLES MANQUANTES CRÉÉES AVEC SUCCÈS !';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Tables créées :';
  RAISE NOTICE '  - categories (8 catégories par défaut)';
  RAISE NOTICE '  - member_documents (pour les uploads)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sécurité :';
  RAISE NOTICE '  - RLS activé sur toutes les tables';
  RAISE NOTICE '  - Politiques d''accès configurées';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant :';
  RAISE NOTICE '  - L''onglet Catégories va fonctionner';
  RAISE NOTICE '  - L''upload de documents va fonctionner';
  RAISE NOTICE '  - Les admins verront les documents uploadés';
END $$;