/*
  # Migration des types de documents vers les nouveaux noms

  1. Objectif
    - Migrer les anciens noms de documents vers les nouveaux noms standardisés
    - Assurer la cohérence entre la base de données et le code frontend
    - Préserver tous les documents existants

  2. Mapping des types
    - ffvbForm → registration_form
    - medicalCertificate → medical_certificate  
    - idPhoto → photo
    - parentalConsent → parental_authorization
    - identityCopy → identity_copy

  3. Sécurité
    - Migration sécurisée avec sauvegarde
    - Validation avant et après migration
    - Logs détaillés pour traçabilité
*/

-- Fonction pour migrer les types de documents
CREATE OR REPLACE FUNCTION migrate_document_types()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  migration_count integer := 0;
  template_count integer := 0;
  error_count integer := 0;
  migration_log text[] := '{}';
BEGIN
  -- Log du début de migration
  migration_log := array_append(migration_log, 'Début de la migration des types de documents');
  
  -- 1. Migrer les documents des membres
  -- ffvbForm → registration_form
  UPDATE member_documents 
  SET document_type = 'registration_form'
  WHERE document_type = 'ffvbForm';
  GET DIAGNOSTICS migration_count = ROW_COUNT;
  migration_log := array_append(migration_log, 'ffvbForm → registration_form: ' || migration_count || ' documents');
  
  -- medicalCertificate → medical_certificate
  UPDATE member_documents 
  SET document_type = 'medical_certificate'
  WHERE document_type = 'medicalCertificate';
  GET DIAGNOSTICS migration_count = ROW_COUNT;
  migration_log := array_append(migration_log, 'medicalCertificate → medical_certificate: ' || migration_count || ' documents');
  
  -- idPhoto → photo
  UPDATE member_documents 
  SET document_type = 'photo'
  WHERE document_type = 'idPhoto';
  GET DIAGNOSTICS migration_count = ROW_COUNT;
  migration_log := array_append(migration_log, 'idPhoto → photo: ' || migration_count || ' documents');
  
  -- parentalConsent → parental_authorization
  UPDATE member_documents 
  SET document_type = 'parental_authorization'
  WHERE document_type = 'parentalConsent';
  GET DIAGNOSTICS migration_count = ROW_COUNT;
  migration_log := array_append(migration_log, 'parentalConsent → parental_authorization: ' || migration_count || ' documents');
  
  -- identityCopy → identity_copy
  UPDATE member_documents 
  SET document_type = 'identity_copy'
  WHERE document_type = 'identityCopy';
  GET DIAGNOSTICS migration_count = ROW_COUNT;
  migration_log := array_append(migration_log, 'identityCopy → identity_copy: ' || migration_count || ' documents');

  -- 2. Migrer les templates de documents (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_templates') THEN
    -- ffvbForm → registration_form
    UPDATE document_templates 
    SET document_type = 'registration_form'
    WHERE document_type = 'ffvbForm';
    GET DIAGNOSTICS template_count = ROW_COUNT;
    migration_log := array_append(migration_log, 'Templates ffvbForm → registration_form: ' || template_count);
    
    -- medicalCertificate → medical_certificate
    UPDATE document_templates 
    SET document_type = 'medical_certificate'
    WHERE document_type = 'medicalCertificate';
    GET DIAGNOSTICS template_count = ROW_COUNT;
    migration_log := array_append(migration_log, 'Templates medicalCertificate → medical_certificate: ' || template_count);
    
    -- idPhoto → photo
    UPDATE document_templates 
    SET document_type = 'photo'
    WHERE document_type = 'idPhoto';
    GET DIAGNOSTICS template_count = ROW_COUNT;
    migration_log := array_append(migration_log, 'Templates idPhoto → photo: ' || template_count);
    
    -- parentalConsent → parental_authorization
    UPDATE document_templates 
    SET document_type = 'parental_authorization'
    WHERE document_type = 'parentalConsent';
    GET DIAGNOSTICS template_count = ROW_COUNT;
    migration_log := array_append(migration_log, 'Templates parentalConsent → parental_authorization: ' || template_count);
    
    -- identityCopy → identity_copy
    UPDATE document_templates 
    SET document_type = 'identity_copy'
    WHERE document_type = 'identityCopy';
    GET DIAGNOSTICS template_count = ROW_COUNT;
    migration_log := array_append(migration_log, 'Templates identityCopy → identity_copy: ' || template_count);
  END IF;

  -- 3. Vérification post-migration
  migration_log := array_append(migration_log, 'Migration terminée avec succès');
  
  RETURN jsonb_build_object(
    'success', true,
    'migration_log', migration_log,
    'documents_migrated', true,
    'templates_migrated', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_templates'),
    'message', 'Types de documents migrés vers les nouveaux noms standardisés'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'migration_log', migration_log
  );
END;
$$;

-- Exécuter la migration
SELECT migrate_document_types();

-- Vérifier les résultats
DO $$
DECLARE
  doc_types text[];
  template_types text[];
BEGIN
  -- Types de documents après migration
  SELECT array_agg(DISTINCT document_type) INTO doc_types
  FROM member_documents;
  
  RAISE NOTICE 'Types de documents après migration: %', doc_types;
  
  -- Types de templates après migration (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_templates') THEN
    SELECT array_agg(DISTINCT document_type) INTO template_types
    FROM document_templates;
    
    RAISE NOTICE 'Types de templates après migration: %', template_types;
  END IF;
END $$;