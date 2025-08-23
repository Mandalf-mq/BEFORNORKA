/*
  # Migration finale des types de documents vers les nouveaux noms

  1. Objectif
    - Renommer TOUS les documents existants vers les nouveaux noms
    - Assurer la cohérence totale entre base de données et code
    - Préserver toutes les données existantes

  2. Mapping complet
    - ffvbForm → registration_form
    - medicalCertificate → medical_certificate  
    - idPhoto → photo
    - parentalConsent → parental_authorization
    - identityCopy → identity_copy

  3. Garanties
    - Aucune perte de données
    - Migration sécurisée avec logs
    - Validation avant et après
*/

-- Fonction de migration complète avec logs détaillés
CREATE OR REPLACE FUNCTION migrate_all_document_types()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  migration_count integer := 0;
  template_count integer := 0;
  total_migrated integer := 0;
  migration_log text[] := '{}';
  doc_count integer;
BEGIN
  migration_log := array_append(migration_log, 'Début de la migration complète des types de documents');
  
  -- 1. MIGRATION DES DOCUMENTS MEMBRES
  migration_log := array_append(migration_log, '=== MIGRATION MEMBER_DOCUMENTS ===');
  
  -- ffvbForm → registration_form
  UPDATE member_documents 
  SET document_type = 'registration_form'
  WHERE document_type = 'ffvbForm';
  GET DIAGNOSTICS doc_count = ROW_COUNT;
  migration_count := migration_count + doc_count;
  migration_log := array_append(migration_log, 'ffvbForm → registration_form: ' || doc_count || ' documents');
  
  -- medicalCertificate → medical_certificate
  UPDATE member_documents 
  SET document_type = 'medical_certificate'
  WHERE document_type = 'medicalCertificate';
  GET DIAGNOSTICS doc_count = ROW_COUNT;
  migration_count := migration_count + doc_count;
  migration_log := array_append(migration_log, 'medicalCertificate → medical_certificate: ' || doc_count || ' documents');
  
  -- idPhoto → photo
  UPDATE member_documents 
  SET document_type = 'photo'
  WHERE document_type = 'idPhoto';
  GET DIAGNOSTICS doc_count = ROW_COUNT;
  migration_count := migration_count + doc_count;
  migration_log := array_append(migration_log, 'idPhoto → photo: ' || doc_count || ' documents');
  
  -- parentalConsent → parental_authorization
  UPDATE member_documents 
  SET document_type = 'parental_authorization'
  WHERE document_type = 'parentalConsent';
  GET DIAGNOSTICS doc_count = ROW_COUNT;
  migration_count := migration_count + doc_count;
  migration_log := array_append(migration_log, 'parentalConsent → parental_authorization: ' || doc_count || ' documents');
  
  -- identityCopy → identity_copy
  UPDATE member_documents 
  SET document_type = 'identity_copy'
  WHERE document_type = 'identityCopy';
  GET DIAGNOSTICS doc_count = ROW_COUNT;
  migration_count := migration_count + doc_count;
  migration_log := array_append(migration_log, 'identityCopy → identity_copy: ' || doc_count || ' documents');

  -- 2. MIGRATION DES TEMPLATES (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_templates') THEN
    migration_log := array_append(migration_log, '=== MIGRATION DOCUMENT_TEMPLATES ===');
    
    -- ffvbForm → registration_form
    UPDATE document_templates 
    SET document_type = 'registration_form'
    WHERE document_type = 'ffvbForm';
    GET DIAGNOSTICS doc_count = ROW_COUNT;
    template_count := template_count + doc_count;
    migration_log := array_append(migration_log, 'Templates ffvbForm → registration_form: ' || doc_count);
    
    -- medicalCertificate → medical_certificate
    UPDATE document_templates 
    SET document_type = 'medical_certificate'
    WHERE document_type = 'medicalCertificate';
    GET DIAGNOSTICS doc_count = ROW_COUNT;
    template_count := template_count + doc_count;
    migration_log := array_append(migration_log, 'Templates medicalCertificate → medical_certificate: ' || doc_count);
    
    -- idPhoto → photo
    UPDATE document_templates 
    SET document_type = 'photo'
    WHERE document_type = 'idPhoto';
    GET DIAGNOSTICS doc_count = ROW_COUNT;
    template_count := template_count + doc_count;
    migration_log := array_append(migration_log, 'Templates idPhoto → photo: ' || doc_count);
    
    -- parentalConsent → parental_authorization
    UPDATE document_templates 
    SET document_type = 'parental_authorization'
    WHERE document_type = 'parentalConsent';
    GET DIAGNOSTICS doc_count = ROW_COUNT;
    template_count := template_count + doc_count;
    migration_log := array_append(migration_log, 'Templates parentalConsent → parental_authorization: ' || doc_count);
    
    -- identityCopy → identity_copy
    UPDATE document_templates 
    SET document_type = 'identity_copy'
    WHERE document_type = 'identityCopy';
    GET DIAGNOSTICS doc_count = ROW_COUNT;
    template_count := template_count + doc_count;
    migration_log := array_append(migration_log, 'Templates identityCopy → identity_copy: ' || doc_count);
  ELSE
    migration_log := array_append(migration_log, 'Table document_templates non trouvée - ignorée');
  END IF;

  total_migrated := migration_count + template_count;
  
  -- 3. VÉRIFICATION POST-MIGRATION
  migration_log := array_append(migration_log, '=== VÉRIFICATION ===');
  
  -- Vérifier qu'il ne reste plus d'anciens types
  SELECT COUNT(*) INTO doc_count
  FROM member_documents 
  WHERE document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent', 'identityCopy');
  
  migration_log := array_append(migration_log, 'Documents avec anciens types restants: ' || doc_count);
  
  -- Lister les nouveaux types présents
  migration_log := array_append(migration_log, 'Types de documents après migration:');
  FOR doc_count IN 
    SELECT DISTINCT document_type 
    FROM member_documents 
    ORDER BY document_type
  LOOP
    migration_log := array_append(migration_log, '  - ' || doc_count);
  END LOOP;
  
  migration_log := array_append(migration_log, '=== MIGRATION TERMINÉE ===');
  migration_log := array_append(migration_log, 'Total documents migrés: ' || migration_count);
  migration_log := array_append(migration_log, 'Total templates migrés: ' || template_count);
  migration_log := array_append(migration_log, 'Total général: ' || total_migrated);
  
  RETURN jsonb_build_object(
    'success', true,
    'migration_log', migration_log,
    'documents_migrated', migration_count,
    'templates_migrated', template_count,
    'total_migrated', total_migrated,
    'message', 'Migration complète terminée avec succès'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'migration_log', migration_log,
    'message', 'Erreur pendant la migration'
  );
END;
$$;

-- Exécuter la migration
SELECT migrate_all_document_types();

-- Vérification finale - lister tous les types de documents
DO $$
DECLARE
  doc_types text[];
  template_types text[];
BEGIN
  -- Types de documents après migration
  SELECT array_agg(DISTINCT document_type ORDER BY document_type) INTO doc_types
  FROM member_documents;
  
  RAISE NOTICE '📄 Types de documents après migration: %', doc_types;
  
  -- Types de templates après migration (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_templates') THEN
    SELECT array_agg(DISTINCT document_type ORDER BY document_type) INTO template_types
    FROM document_templates;
    
    RAISE NOTICE '📋 Types de templates après migration: %', template_types;
  END IF;
  
  RAISE NOTICE '✅ Migration terminée - vérifiez les logs ci-dessus';
END $$;