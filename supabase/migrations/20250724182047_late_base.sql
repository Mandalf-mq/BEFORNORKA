/*
  # Correction des contraintes de types de documents

  1. Problème identifié
    - La contrainte CHECK sur document_type ne correspond pas aux types utilisés dans le frontend
    - Erreur: "violates check constraint member_documents_document_type_check"
    
  2. Solutions
    - Mettre à jour la contrainte pour accepter les bons types
    - Harmoniser avec les types utilisés dans l'application
    
  3. Types de documents
    - ffvbForm (Formulaire FFVB)
    - medicalCertificate (Certificat médical)
    - idPhoto (Photo d'identité)
    - parentalConsent (Autorisation parentale)
*/

-- ========================================
-- ÉTAPE 1: SUPPRIMER L'ANCIENNE CONTRAINTE
-- ========================================

-- Supprimer la contrainte existante qui cause le problème
ALTER TABLE member_documents DROP CONSTRAINT IF EXISTS member_documents_document_type_check;

-- ========================================
-- ÉTAPE 2: CRÉER LA NOUVELLE CONTRAINTE AVEC LES BONS TYPES
-- ========================================

-- Ajouter la nouvelle contrainte avec les types corrects
ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_document_type_check 
CHECK (document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent'));

-- ========================================
-- ÉTAPE 3: METTRE À JOUR LES DONNÉES EXISTANTES SI NÉCESSAIRE
-- ========================================

-- Convertir les anciens types vers les nouveaux (si des données existent)
UPDATE member_documents 
SET document_type = CASE 
  WHEN document_type = 'ffvb_form' THEN 'ffvbForm'
  WHEN document_type = 'medical_certificate' THEN 'medicalCertificate'
  WHEN document_type = 'id_photo' THEN 'idPhoto'
  WHEN document_type = 'parental_consent' THEN 'parentalConsent'
  ELSE document_type
END
WHERE document_type IN ('ffvb_form', 'medical_certificate', 'id_photo', 'parental_consent');

-- ========================================
-- ÉTAPE 4: METTRE À JOUR LES MODÈLES AUSSI
-- ========================================

-- Mettre à jour la table document_templates pour cohérence
UPDATE document_templates 
SET document_type = CASE 
  WHEN document_type = 'ffvb_form' THEN 'ffvbForm'
  WHEN document_type = 'medical_certificate' THEN 'medicalCertificate'
  WHEN document_type = 'id_photo' THEN 'idPhoto'
  WHEN document_type = 'parental_consent' THEN 'parentalConsent'
  ELSE document_type
END
WHERE document_type IN ('ffvb_form', 'medical_certificate', 'id_photo', 'parental_consent');

-- ========================================
-- ÉTAPE 5: FONCTION DE TEST
-- ========================================

-- Fonction pour tester l'insertion avec les nouveaux types
CREATE OR REPLACE FUNCTION test_document_types()
RETURNS text AS $$
DECLARE
  test_result text;
  test_member_id uuid;
  test_doc_id uuid;
BEGIN
  -- Récupérer un membre existant pour le test
  SELECT id INTO test_member_id FROM members LIMIT 1;
  
  IF test_member_id IS NULL THEN
    RETURN 'ERROR: Aucun membre trouvé pour le test';
  END IF;
  
  -- Tester l'insertion avec chaque type de document
  BEGIN
    -- Test ffvbForm
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type
    ) VALUES (
      test_member_id, 'ffvbForm', 'test-ffvb.pdf', 'test/ffvb.pdf', 1024, 'application/pdf'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    
    -- Test medicalCertificate
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type
    ) VALUES (
      test_member_id, 'medicalCertificate', 'test-medical.pdf', 'test/medical.pdf', 1024, 'application/pdf'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    
    -- Test idPhoto
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type
    ) VALUES (
      test_member_id, 'idPhoto', 'test-photo.jpg', 'test/photo.jpg', 1024, 'image/jpeg'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    
    -- Test parentalConsent
    INSERT INTO member_documents (
      member_id, document_type, file_name, file_path, file_size, mime_type
    ) VALUES (
      test_member_id, 'parentalConsent', 'test-consent.pdf', 'test/consent.pdf', 1024, 'application/pdf'
    ) RETURNING id INTO test_doc_id;
    
    DELETE FROM member_documents WHERE id = test_doc_id;
    
    test_result := 'SUCCESS: Tous les types de documents sont acceptés';
  EXCEPTION
    WHEN OTHERS THEN
      test_result := 'ERROR: ' || SQLERRM;
  END;
  
  RETURN test_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Contraintes de types de documents corrigées !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Corrections appliquées :';
  RAISE NOTICE '  - Contrainte CHECK mise à jour';
  RAISE NOTICE '  - Types harmonisés: ffvbForm, medicalCertificate, idPhoto, parentalConsent';
  RAISE NOTICE '  - Données existantes converties';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test à effectuer :';
  RAISE NOTICE '  SELECT test_document_types();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant l''upload devrait fonctionner !';
END $$;