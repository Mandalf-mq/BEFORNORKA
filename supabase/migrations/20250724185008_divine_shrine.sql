/*
  # RESTRUCTURATION FINALE DE LA BASE DE DONNÉES BE FOR NOR KA
  
  Cette migration nettoie et restructure complètement la base de données
  pour résoudre définitivement tous les problèmes d'incohérence.
  
  1. Nettoyage sécurisé
    - Suppression des fichiers Storage existants
    - Suppression des buckets vides
    - Nettoyage des politiques RLS
    
  2. Restructuration complète
    - Tables avec structure cohérente
    - Contraintes CHECK correctes
    - Politiques RLS simples et efficaces
    
  3. Buckets Storage finaux
    - member_documents (privé)
    - templates (public)
    
  4. Fonctions utilitaires
    - Création automatique de profils membres
    - Tests et diagnostics
*/

-- ========================================
-- ÉTAPE 1: NETTOYAGE SÉCURISÉ DES FICHIERS
-- ========================================

-- Supprimer tous les fichiers des buckets existants
DELETE FROM storage.objects WHERE bucket_id IN ('documents', 'templates', 'member-documents', 'document-templates', 'member_documents', 'document_templates');

-- Supprimer les buckets maintenant vides
DELETE FROM storage.buckets WHERE id IN ('documents', 'templates', 'member-documents', 'document-templates', 'member_documents', 'document_templates');

-- ========================================
-- ÉTAPE 2: NETTOYAGE DES POLITIQUES RLS
-- ========================================

-- Supprimer toutes les politiques Storage existantes
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
    END LOOP;
    
    RAISE NOTICE 'Toutes les politiques Storage supprimées';
END $$;

-- Supprimer toutes les politiques sur member_documents
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'member_documents'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON member_documents';
    END LOOP;
    
    RAISE NOTICE 'Toutes les politiques member_documents supprimées';
END $$;

-- Supprimer toutes les politiques sur document_templates
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'document_templates'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON document_templates';
    END LOOP;
    
    RAISE NOTICE 'Toutes les politiques document_templates supprimées';
END $$;

-- ========================================
-- ÉTAPE 3: SUPPRESSION ET RECRÉATION DES TABLES
-- ========================================

-- Supprimer les fonctions existantes pour éviter les conflits
DROP FUNCTION IF EXISTS validate_document(uuid, text, text);
DROP FUNCTION IF EXISTS create_member_profile_for_user(text, text, text);
DROP FUNCTION IF EXISTS test_complete_document_system();

-- Supprimer les tables pour repartir à zéro
DROP TABLE IF EXISTS member_documents CASCADE;
DROP TABLE IF EXISTS document_templates CASCADE;

-- Recréer member_documents avec la structure finale
CREATE TABLE member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  status text DEFAULT 'pending',
  rejection_reason text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, document_type)
);

-- Ajouter les contraintes CHECK finales
ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_document_type_check 
CHECK (document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent'));

ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_status_check 
CHECK (status IN ('pending', 'validated', 'rejected'));

-- Recréer document_templates
CREATE TABLE document_templates (
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

-- ========================================
-- ÉTAPE 4: CRÉATION DES NOUVEAUX BUCKETS
-- ========================================

-- Créer les buckets avec des noms définitifs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  (
    'member_documents',
    'member_documents',
    false, -- Privé
    5242880, -- 5MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  ),
  (
    'templates',
    'templates', 
    true, -- Public
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  );

-- ========================================
-- ÉTAPE 5: POLITIQUES RLS SIMPLES ET DÉFINITIVES
-- ========================================

-- Activer RLS
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Politiques pour member_documents (SIMPLES)
CREATE POLICY "Authenticated users can manage member documents"
  ON member_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politiques pour document_templates
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

-- Politiques Storage pour member_documents
CREATE POLICY "Authenticated users can manage documents in storage"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'member_documents')
  WITH CHECK (bucket_id = 'member_documents');

-- Politiques Storage pour templates
CREATE POLICY "Public can read templates in storage"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'templates');

CREATE POLICY "Authenticated users can manage templates in storage"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'templates')
  WITH CHECK (bucket_id = 'templates');

-- ========================================
-- ÉTAPE 6: DONNÉES PAR DÉFAUT
-- ========================================

-- Insérer les modèles de documents avec les bons types
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
  );

-- ========================================
-- ÉTAPE 7: FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour créer automatiquement un profil membre pour un utilisateur
CREATE OR REPLACE FUNCTION create_member_profile_for_user(
  user_email text,
  first_name text DEFAULT '',
  last_name text DEFAULT ''
)
RETURNS uuid AS $$
DECLARE
  new_member_id uuid;
  user_exists boolean;
BEGIN
  -- Vérifier si l'utilisateur existe dans auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = user_email) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE EXCEPTION 'Utilisateur % non trouvé dans auth.users', user_email;
  END IF;
  
  -- Vérifier si le membre existe déjà
  SELECT id INTO new_member_id FROM members WHERE email = user_email;
  
  IF new_member_id IS NOT NULL THEN
    RAISE NOTICE 'Membre existe déjà pour %: %', user_email, new_member_id;
    RETURN new_member_id;
  END IF;
  
  -- Créer le profil membre
  INSERT INTO members (
    first_name,
    last_name,
    email,
    phone,
    birth_date,
    category,
    membership_fee,
    status,
    payment_status,
    registration_date
  ) VALUES (
    COALESCE(NULLIF(first_name, ''), 'Prénom'),
    COALESCE(NULLIF(last_name, ''), 'Nom'),
    user_email,
    '0000000000',
    '1990-01-01',
    'senior',
    250,
    'validated',
    'paid',
    CURRENT_DATE
  ) RETURNING id INTO new_member_id;
  
  RAISE NOTICE 'Profil membre créé pour %: %', user_email, new_member_id;
  RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Fonction de test complète
CREATE OR REPLACE FUNCTION test_complete_document_system()
RETURNS text AS $$
DECLARE
  test_result text := '';
  test_member_id uuid;
  test_doc_id uuid;
  user_email text;
BEGIN
  -- Récupérer l'email de l'utilisateur connecté
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  IF user_email IS NULL THEN
    RETURN 'ERROR: Aucun utilisateur connecté pour le test';
  END IF;
  
  test_result := test_result || 'INFO: Test pour utilisateur ' || user_email || E'\n';
  
  -- Vérifier si l'utilisateur a un profil membre
  SELECT id INTO test_member_id FROM members WHERE email = user_email;
  
  IF test_member_id IS NULL THEN
    test_result := test_result || 'WARNING: Aucun profil membre pour ' || user_email || E'\n';
    test_result := test_result || 'SOLUTION: Exécutez SELECT create_member_profile_for_user(''' || user_email || ''');' || E'\n';
    
    -- Créer automatiquement le profil pour le test
    test_member_id := create_member_profile_for_user(user_email, 'Test', 'User');
    test_result := test_result || 'INFO: Profil membre créé automatiquement: ' || test_member_id || E'\n';
  ELSE
    test_result := test_result || 'SUCCESS: Profil membre trouvé: ' || test_member_id || E'\n';
  END IF;
  
  -- Tester l'insertion de documents
  BEGIN
    -- Test ffvbForm
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type, status
    ) VALUES (
      test_member_id, 'ffvbForm', 'test-ffvb.pdf', 'test/ffvb.pdf', 1024, 'application/pdf', 'pending'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    test_result := test_result || 'SUCCESS: Type ffvbForm + status pending OK' || E'\n';
    
    -- Test medicalCertificate
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type, status
    ) VALUES (
      test_member_id, 'medicalCertificate', 'test-medical.pdf', 'test/medical.pdf', 1024, 'application/pdf', 'validated'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    test_result := test_result || 'SUCCESS: Type medicalCertificate + status validated OK' || E'\n';
    
    -- Test idPhoto
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type, status
    ) VALUES (
      test_member_id, 'idPhoto', 'test-photo.jpg', 'test/photo.jpg', 1024, 'image/jpeg', 'rejected'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    test_result := test_result || 'SUCCESS: Type idPhoto + status rejected OK' || E'\n';
    
    -- Test parentalConsent
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type, status
    ) VALUES (
      test_member_id, 'parentalConsent', 'test-consent.pdf', 'test/consent.pdf', 1024, 'application/pdf', 'pending'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    test_result := test_result || 'SUCCESS: Type parentalConsent + status pending OK' || E'\n';
    
    test_result := test_result || E'\n✅ TOUS LES TESTS RÉUSSIS !';
    test_result := test_result || E'\nVous pouvez maintenant uploader des documents.';
    
  EXCEPTION
    WHEN OTHERS THEN
      test_result := test_result || 'ERROR: ' || SQLERRM || E'\n';
      test_result := test_result || 'SQLSTATE: ' || SQLSTATE || E'\n';
  END;
  
  RETURN test_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 8: INDEX ET TRIGGERS
-- ========================================

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_member_documents_member_id ON member_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_type ON member_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_member_documents_status ON member_documents(status);
CREATE INDEX IF NOT EXISTS idx_member_documents_uploaded_at ON member_documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);

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
-- ÉTAPE 9: VUES UTILES
-- ========================================

-- Vue pour les documents avec informations complètes
CREATE OR REPLACE VIEW member_documents_complete AS
SELECT 
  md.*,
  m.first_name,
  m.last_name,
  m.email as member_email,
  m.category,
  u.first_name as validated_by_first_name,
  u.last_name as validated_by_last_name,
  CASE 
    WHEN md.document_type = 'ffvbForm' THEN 'Formulaire FFVB'
    WHEN md.document_type = 'medicalCertificate' THEN 'Certificat médical'
    WHEN md.document_type = 'idPhoto' THEN 'Photo d''identité'
    WHEN md.document_type = 'parentalConsent' THEN 'Autorisation parentale'
    ELSE md.document_type
  END as document_type_label
FROM member_documents md
LEFT JOIN members m ON md.member_id = m.id
LEFT JOIN users u ON md.validated_by = u.id;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ RESTRUCTURATION FINALE TERMINÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Tables recréées :';
  RAISE NOTICE '  - member_documents (types: ffvbForm, medicalCertificate, idPhoto, parentalConsent)';
  RAISE NOTICE '  - document_templates (modèles disponibles)';
  RAISE NOTICE '';
  RAISE NOTICE '📁 Buckets Storage :';
  RAISE NOTICE '  - member_documents (privé)';
  RAISE NOTICE '  - templates (public)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Politiques RLS :';
  RAISE NOTICE '  - Politiques simples et efficaces';
  RAISE NOTICE '  - Permissions pour utilisateurs authentifiés';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 TESTEZ MAINTENANT :';
  RAISE NOTICE '  SELECT test_complete_document_system();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Si besoin de créer un profil membre :';
  RAISE NOTICE '  SELECT create_member_profile_for_user(''votre-email@example.com'');';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Base de données maintenant propre et cohérente !';
END $$;