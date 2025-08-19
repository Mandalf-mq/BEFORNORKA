/*
  # Correction finale des contraintes member_documents

  1. Problème identifié
    - Contrainte document_type rejette "ffvbForm"
    - Contrainte status rejette les valeurs par défaut
    
  2. Solutions
    - Supprimer toutes les contraintes problématiques
    - Recréer avec les bons types et statuts
    - Vérifier la cohérence avec le frontend
    
  3. Types corrects
    - document_type: ffvbForm, medicalCertificate, idPhoto, parentalConsent
    - status: pending, validated, rejected
*/

-- ========================================
-- ÉTAPE 1: DIAGNOSTIC DES CONTRAINTES ACTUELLES
-- ========================================

-- Afficher toutes les contraintes actuelles pour diagnostic
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  RAISE NOTICE '🔍 Contraintes actuelles sur member_documents :';
  
  FOR constraint_record IN 
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'member_documents'::regclass
    AND contype = 'c' -- CHECK constraints
  LOOP
    RAISE NOTICE '  - %: %', constraint_record.conname, constraint_record.definition;
  END LOOP;
END $$;

-- ========================================
-- ÉTAPE 2: SUPPRIMER TOUTES LES CONTRAINTES CHECK PROBLÉMATIQUES
-- ========================================

-- Supprimer toutes les contraintes CHECK existantes
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_document_type_check;
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_document_type_check1;
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_document_type_check2;
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_status_check;
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_status_check1;
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_status_check2;

-- ========================================
-- ÉTAPE 3: CRÉER LES NOUVELLES CONTRAINTES CORRECTES
-- ========================================

-- Contrainte pour document_type avec les types exacts du frontend
ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_document_type_check 
CHECK (document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent'));

-- Contrainte pour status avec les statuts corrects
ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_status_check 
CHECK (status IN ('pending', 'validated', 'rejected'));

-- ========================================
-- ÉTAPE 4: VÉRIFIER LA STRUCTURE DE LA TABLE
-- ========================================

-- S'assurer que la table a la bonne structure
DO $$
BEGIN
  -- Vérifier que la colonne document_type existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_documents' AND column_name = 'document_type'
  ) THEN
    RAISE EXCEPTION 'Colonne document_type manquante dans member_documents';
  END IF;
  
  -- Vérifier que la colonne status existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_documents' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'Colonne status manquante dans member_documents';
  END IF;
  
  RAISE NOTICE '✅ Structure de la table member_documents vérifiée';
END $$;

-- ========================================
-- ÉTAPE 5: FONCTION DE TEST COMPLÈTE
-- ========================================

-- Fonction pour tester l'insertion avec tous les types et statuts
CREATE OR REPLACE FUNCTION test_all_document_constraints()
RETURNS text AS $$
DECLARE
  test_result text := '';
  test_member_id uuid;
  test_doc_id uuid;
  doc_type text;
  doc_status text;
BEGIN
  -- Récupérer un membre existant pour le test
  SELECT id INTO test_member_id FROM members LIMIT 1;
  
  IF test_member_id IS NULL THEN
    RETURN 'ERROR: Aucun membre trouvé pour le test';
  END IF;
  
  -- Tester chaque type de document
  FOR doc_type IN SELECT unnest(ARRAY['ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent'])
  LOOP
    -- Tester chaque statut
    FOR doc_status IN SELECT unnest(ARRAY['pending', 'validated', 'rejected'])
    LOOP
      BEGIN
        INSERT INTO member_documents (
          member_id, 
          document_type, 
          file_name, 
          file_path, 
          file_size, 
          mime_type,
          status
        ) VALUES (
          test_member_id, 
          doc_type, 
          'test-' || doc_type || '.pdf', 
          'test/' || doc_type || '.pdf', 
          1024, 
          'application/pdf',
          doc_status
        ) RETURNING id INTO test_doc_id;
        
        -- Nettoyer immédiatement
        DELETE FROM member_documents WHERE id = test_doc_id;
        
        test_result := test_result || '✅ ' || doc_type || ' + ' || doc_status || ' OK' || E'\n';
        
      EXCEPTION
        WHEN OTHERS THEN
          test_result := test_result || '❌ ' || doc_type || ' + ' || doc_status || ' FAILED: ' || SQLERRM || E'\n';
      END;
    END LOOP;
  END LOOP;
  
  RETURN test_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 6: NETTOYER LES DONNÉES EXISTANTES INCOMPATIBLES
-- ========================================

-- Convertir les anciens types vers les nouveaux si des données existent
UPDATE member_documents 
SET document_type = CASE 
  WHEN document_type = 'ffvb_form' THEN 'ffvbForm'
  WHEN document_type = 'medical_certificate' THEN 'medicalCertificate'
  WHEN document_type = 'id_photo' THEN 'idPhoto'
  WHEN document_type = 'parental_consent' THEN 'parentalConsent'
  ELSE document_type
END
WHERE document_type IN ('ffvb_form', 'medical_certificate', 'id_photo', 'parental_consent');

-- Convertir les anciens statuts si nécessaire
UPDATE member_documents 
SET status = CASE 
  WHEN status = 'uploaded' THEN 'pending'
  ELSE status
END
WHERE status = 'uploaded';

-- ========================================
-- ÉTAPE 7: AFFICHER LES NOUVELLES CONTRAINTES
-- ========================================

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  RAISE NOTICE '✅ Nouvelles contraintes sur member_documents :';
  
  FOR constraint_record IN 
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint 
    WHERE conrelid = 'member_documents'::regclass
    AND contype = 'c' -- CHECK constraints
  LOOP
    RAISE NOTICE '  - %: %', constraint_record.conname, constraint_record.definition;
  END LOOP;
END $$;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Contraintes member_documents corrigées !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Types de documents autorisés :';
  RAISE NOTICE '  - ffvbForm';
  RAISE NOTICE '  - medicalCertificate';
  RAISE NOTICE '  - idPhoto';
  RAISE NOTICE '  - parentalConsent';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Statuts autorisés :';
  RAISE NOTICE '  - pending';
  RAISE NOTICE '  - validated';
  RAISE NOTICE '  - rejected';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test à effectuer :';
  RAISE NOTICE '  SELECT test_all_document_constraints();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant l''upload devrait fonctionner !';
END $$;