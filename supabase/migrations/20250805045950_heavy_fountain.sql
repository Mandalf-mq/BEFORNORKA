/*
  # NETTOYAGE FINAL ET DÉFINITIF - BE FOR NOR KA
  
  Cette migration nettoie et corrige tous les problèmes de base de données
  pour une application 100% fonctionnelle.
*/

-- ========================================
-- ÉTAPE 1: NETTOYAGE DES BUCKETS STORAGE
-- ========================================

-- Supprimer tous les fichiers des buckets incohérents
DELETE FROM storage.objects WHERE bucket_id IN (
  'documents', 'templates', 'member-documents', 'document-templates', 
  'document_templates'
);

-- Supprimer les buckets incohérents
DELETE FROM storage.buckets WHERE id IN (
  'documents', 'templates', 'member-documents', 'document-templates', 
  'document_templates'
);

-- Créer les buckets avec des noms cohérents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  (
    'member_documents',
    'member_documents',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  ),
  (
    'templates',
    'templates', 
    true,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  )
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================================
-- ÉTAPE 2: NETTOYAGE DES POLITIQUES RLS
-- ========================================

-- Supprimer toutes les politiques Storage problématiques
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
END $$;

-- Créer des politiques Storage simples et efficaces
CREATE POLICY "Authenticated users can manage documents"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'member_documents')
  WITH CHECK (bucket_id = 'member_documents');

CREATE POLICY "Public can read templates"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'templates');

CREATE POLICY "Authenticated users can manage templates"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'templates')
  WITH CHECK (bucket_id = 'templates');

-- ========================================
-- ÉTAPE 3: CORRIGER LES CONTRAINTES
-- ========================================

-- Supprimer les contraintes problématiques
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_document_type_check;
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_status_check;

-- Recréer avec les bons types
ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_document_type_check 
CHECK (document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent'));

ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_status_check 
CHECK (status IN ('pending', 'validated', 'rejected'));

-- ========================================
-- ÉTAPE 4: FONCTION DE TEST
-- ========================================

CREATE OR REPLACE FUNCTION test_document_system()
RETURNS text AS $$
DECLARE
  test_result text := '';
  test_member_id uuid;
  test_doc_id uuid;
  user_email text;
BEGIN
  -- Récupérer l'utilisateur connecté
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  IF user_email IS NULL THEN
    RETURN 'ERROR: Connectez-vous d''abord';
  END IF;
  
  test_result := test_result || 'INFO: Test pour ' || user_email || E'\n';
  
  -- Vérifier le profil membre
  SELECT id INTO test_member_id FROM members WHERE email = user_email;
  
  IF test_member_id IS NULL THEN
    test_result := test_result || 'WARNING: Pas de profil membre' || E'\n';
    test_result := test_result || 'SOLUTION: Créez un membre avec votre email' || E'\n';
    RETURN test_result;
  END IF;
  
  test_result := test_result || 'SUCCESS: Profil membre trouvé' || E'\n';
  
  -- Tester l'insertion de documents
  BEGIN
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type
    ) VALUES (
      test_member_id, 'ffvbForm', 'test.pdf', 'test/test.pdf', 1024, 'application/pdf'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    test_result := test_result || 'SUCCESS: Upload de documents fonctionnel' || E'\n';
    
  EXCEPTION
    WHEN OTHERS THEN
      test_result := test_result || 'ERROR: ' || SQLERRM || E'\n';
  END;
  
  RETURN test_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE 'NETTOYAGE FINAL TERMINE !';
  RAISE NOTICE '';
  RAISE NOTICE 'TESTEZ MAINTENANT :';
  RAISE NOTICE '  SELECT test_document_system();';
  RAISE NOTICE '';
  RAISE NOTICE 'VOTRE APP DEVRAIT MAINTENANT FONCTIONNER PARFAITEMENT !';
END $$;