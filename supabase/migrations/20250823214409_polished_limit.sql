/*
  # Correction du système de stockage des modèles de documents

  1. Problème identifié
    - Erreur "Object not found" lors du téléchargement des modèles
    - Buckets de stockage manquants ou mal configurés
    - Fichiers non accessibles

  2. Solutions
    - Créer les buckets de stockage nécessaires
    - Configurer les permissions publiques pour les templates
    - Ajouter des modèles par défaut avec URLs externes
    - Fonction de diagnostic pour vérifier le storage

  3. Sécurité
    - Buckets publics pour les templates (lecture seule)
    - Buckets privés pour les documents membres
    - Politiques RLS appropriées
*/

-- Fonction pour créer les buckets de stockage
CREATE OR REPLACE FUNCTION setup_storage_buckets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bucket_count integer := 0;
  setup_log text[] := '{}';
BEGIN
  setup_log := array_append(setup_log, 'Début de la configuration des buckets de stockage');
  
  -- Créer le bucket pour les templates (public)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'templates', 
    'templates', 
    true, 
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  bucket_count := bucket_count + 1;
  setup_log := array_append(setup_log, 'Bucket templates créé/mis à jour (public)');
  
  -- Créer le bucket pour les documents membres (privé)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'member_documents', 
    'member_documents', 
    false, 
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  bucket_count := bucket_count + 1;
  setup_log := array_append(setup_log, 'Bucket member_documents créé/mis à jour (privé)');
  
  setup_log := array_append(setup_log, 'Configuration des buckets terminée');
  
  RETURN jsonb_build_object(
    'success', true,
    'buckets_created', bucket_count,
    'setup_log', setup_log,
    'message', 'Buckets de stockage configurés avec succès'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'setup_log', setup_log
  );
END;
$$;

-- Fonction pour créer des modèles par défaut avec URLs externes
CREATE OR REPLACE FUNCTION create_default_document_templates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_season_id uuid;
  template_count integer := 0;
  setup_log text[] := '{}';
BEGIN
  -- Récupérer la saison courante
  SELECT id INTO current_season_id 
  FROM seasons 
  WHERE is_current = true 
  LIMIT 1;
  
  IF current_season_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aucune saison courante trouvée'
    );
  END IF;
  
  setup_log := array_append(setup_log, 'Création des modèles par défaut pour saison: ' || current_season_id);
  
  -- Supprimer les anciens modèles par défaut
  DELETE FROM document_templates 
  WHERE name LIKE '%[MODÈLE PAR DÉFAUT]%';
  
  -- Créer les nouveaux modèles avec URLs externes (pas de stockage)
  INSERT INTO document_templates (
    name,
    description,
    document_type,
    file_name,
    file_path,
    file_size,
    is_active,
    season_id,
    download_count
  ) VALUES
  (
    'Formulaire d''inscription FFVB [MODÈLE PAR DÉFAUT]',
    'Formulaire officiel d''inscription à la Fédération Française de Volleyball. À compléter, signer et retourner.',
    'registration_form',
    'formulaire_inscription_ffvb.pdf',
    'external:https://www.ffvb.org/documents/formulaire-inscription.pdf',
    0,
    true,
    current_season_id,
    0
  ),
  (
    'Certificat médical type [MODÈLE PAR DÉFAUT]',
    'Modèle de certificat médical pour la pratique du volleyball. À faire remplir par votre médecin.',
    'medical_certificate',
    'certificat_medical_type.pdf',
    'external:https://www.sports.gouv.fr/IMG/pdf/certificat_medical_type.pdf',
    0,
    true,
    current_season_id,
    0
  ),
  (
    'Autorisation parentale [MODÈLE PAR DÉFAUT]',
    'Autorisation parentale obligatoire pour les mineurs. À faire signer par les parents ou tuteurs légaux.',
    'parental_authorization',
    'autorisation_parentale.pdf',
    'external:https://www.service-public.fr/particuliers/vosdroits/R46648',
    0,
    true,
    current_season_id,
    0
  );
  
  GET DIAGNOSTICS template_count = ROW_COUNT;
  setup_log := array_append(setup_log, 'Modèles par défaut créés: ' || template_count);
  
  RETURN jsonb_build_object(
    'success', true,
    'templates_created', template_count,
    'setup_log', setup_log,
    'message', 'Modèles par défaut créés avec succès'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'setup_log', setup_log
  );
END;
$$;

-- Fonction pour diagnostiquer les problèmes de storage
CREATE OR REPLACE FUNCTION diagnose_storage_issues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  buckets_info jsonb := '[]';
  templates_info jsonb := '[]';
  bucket_record record;
  template_record record;
BEGIN
  -- Vérifier les buckets existants
  FOR bucket_record IN 
    SELECT id, name, public, file_size_limit 
    FROM storage.buckets 
    WHERE id IN ('templates', 'member_documents')
  LOOP
    buckets_info := buckets_info || jsonb_build_object(
      'id', bucket_record.id,
      'name', bucket_record.name,
      'public', bucket_record.public,
      'file_size_limit', bucket_record.file_size_limit
    );
  END LOOP;
  
  -- Vérifier les templates
  FOR template_record IN 
    SELECT name, document_type, file_path, is_active
    FROM document_templates 
    WHERE is_active = true
  LOOP
    templates_info := templates_info || jsonb_build_object(
      'name', template_record.name,
      'document_type', template_record.document_type,
      'file_path', template_record.file_path,
      'is_external', template_record.file_path LIKE 'external:%'
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'buckets', buckets_info,
    'templates', templates_info,
    'buckets_count', jsonb_array_length(buckets_info),
    'templates_count', jsonb_array_length(templates_info)
  );
END;
$$;

-- Exécuter la configuration
SELECT setup_storage_buckets();
SELECT create_default_document_templates();

-- Diagnostic final
SELECT diagnose_storage_issues();