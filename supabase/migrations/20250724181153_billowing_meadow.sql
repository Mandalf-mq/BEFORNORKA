/*
  # Correction du système d'upload de documents

  1. Vérification et création des buckets Storage
    - Bucket 'member-documents' pour les documents des membres
    - Bucket 'document-templates' pour les modèles

  2. Correction des politiques RLS Storage
    - Politiques pour l'upload par les membres
    - Politiques pour la consultation par les admins

  3. Vérification des tables
    - Table member_documents avec toutes les colonnes nécessaires
    - Table document_templates pour les modèles

  4. Correction des politiques RLS des tables
    - Accès sécurisé selon les rôles
    - Permissions d'upload et de validation
*/

-- ========================================
-- ÉTAPE 1: VÉRIFIER ET CRÉER LES BUCKETS
-- ========================================

-- Bucket pour les documents des membres (privé)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-documents',
  'member-documents',
  false, -- Privé, accès contrôlé
  5242880, -- 5MB max par fichier
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les modèles/templates (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  true, -- Public pour téléchargement
  10485760, -- 10MB max
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================================
-- ÉTAPE 2: CORRIGER LES POLITIQUES STORAGE
-- ========================================

-- Supprimer les anciennes politiques problématiques
DROP POLICY IF EXISTS "Members can upload their documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete their documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all member documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can download templates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage templates" ON storage.objects;

-- Nouvelles politiques pour member-documents
CREATE POLICY "Members can upload their documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'member-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Members can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'member-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Members can delete their documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'member-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all member documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'member-documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('webmaster', 'administrateur', 'admin')
  )
);

-- Politiques pour document-templates
CREATE POLICY "Public can download templates"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'document-templates');

CREATE POLICY "Admins can manage templates"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'document-templates' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('webmaster', 'administrateur', 'admin')
  )
);

-- ========================================
-- ÉTAPE 3: VÉRIFIER LES TABLES
-- ========================================

-- Table pour les documents des membres
CREATE TABLE IF NOT EXISTS member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('ffvb_form', 'id_photo', 'medical_certificate', 'parental_consent')),
  file_name text NOT NULL,
  file_path text NOT NULL, -- Chemin dans Supabase Storage
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  rejection_reason text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, document_type) -- Un seul document par type par membre
);

-- Table pour les modèles de documents
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL, -- Chemin dans le bucket templates
  file_size integer,
  is_active boolean DEFAULT true,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========================================
-- ÉTAPE 4: CORRIGER LES POLITIQUES RLS DES TABLES
-- ========================================

-- Activer RLS
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Members can view their own documents" ON member_documents;
DROP POLICY IF EXISTS "Members can upload their documents" ON member_documents;
DROP POLICY IF EXISTS "Members can update their documents" ON member_documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON member_documents;
DROP POLICY IF EXISTS "Everyone can view active templates" ON document_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON document_templates;

-- Nouvelles politiques pour member_documents
CREATE POLICY "Members can view their documents"
  ON member_documents
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    ) OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

CREATE POLICY "Members can upload documents"
  ON member_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can update their documents"
  ON member_documents
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    ) OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

CREATE POLICY "Members can delete their documents"
  ON member_documents
  FOR DELETE
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage all documents"
  ON member_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

-- Politiques pour document_templates
CREATE POLICY "Everyone can view active templates"
  ON document_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage templates"
  ON document_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

-- ========================================
-- ÉTAPE 5: INSÉRER LES MODÈLES PAR DÉFAUT
-- ========================================

-- Insérer les modèles de documents
INSERT INTO document_templates (name, description, document_type, file_name, file_path) VALUES
  (
    'Formulaire FFVB 2024-2025',
    'Formulaire officiel FFVB à compléter et signer. Obligatoire pour tous les membres.',
    'ffvb_form',
    'formulaire-ffvb-2024-2025.pdf',
    'formulaire-ffvb-2024-2025.pdf'
  ),
  (
    'Autorisation parentale',
    'Autorisation parentale pour les mineurs (moins de 18 ans). Obligatoire pour les U12, U15, U18.',
    'parental_consent',
    'autorisation-parentale-2024.pdf',
    'autorisation-parentale-2024.pdf'
  ),
  (
    'Guide photo d''identité',
    'Instructions pour prendre une photo d''identité conforme. Format JPEG/PNG, fond neutre.',
    'id_photo',
    'guide-photo-identite.pdf',
    'guide-photo-identite.pdf'
  ),
  (
    'Modèle certificat médical',
    'Modèle de certificat médical à faire remplir par votre médecin. Obligatoire pour tous.',
    'medical_certificate',
    'modele-certificat-medical.pdf',
    'modele-certificat-medical.pdf'
  )
ON CONFLICT DO NOTHING;

-- ========================================
-- ÉTAPE 6: INDEX ET TRIGGERS
-- ========================================

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_member_documents_member_id ON member_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_type ON member_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_member_documents_status ON member_documents(status);
CREATE INDEX IF NOT EXISTS idx_member_documents_uploaded_at ON member_documents(uploaded_at);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_member_documents_updated_at 
  BEFORE UPDATE ON member_documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_templates_updated_at 
  BEFORE UPDATE ON document_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Système d''upload de documents corrigé !';
  RAISE NOTICE '';
  RAISE NOTICE '📁 Buckets vérifiés :';
  RAISE NOTICE '  - member-documents (privé) : Documents des membres';
  RAISE NOTICE '  - document-templates (public) : Modèles à télécharger';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Tables vérifiées :';
  RAISE NOTICE '  - member_documents : Documents uploadés';
  RAISE NOTICE '  - document_templates : Modèles disponibles';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Politiques RLS corrigées :';
  RAISE NOTICE '  - Upload sécurisé par membre';
  RAISE NOTICE '  - Validation par les admins';
  RAISE NOTICE '  - Accès contrôlé aux fichiers';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant l''upload devrait fonctionner !';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tests à effectuer :';
  RAISE NOTICE '  1. Connectez-vous comme membre';
  RAISE NOTICE '  2. Allez dans "Mes Documents"';
  RAISE NOTICE '  3. Uploadez un fichier PDF/JPG';
  RAISE NOTICE '  4. Vérifiez qu''il apparaît dans l''admin';
  RAISE NOTICE '  5. Testez la validation/rejet';
END $$;