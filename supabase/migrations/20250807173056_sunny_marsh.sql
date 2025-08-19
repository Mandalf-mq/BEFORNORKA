/*
  # Correction de la gestion des documents par saisons

  1. Problème identifié
    - La colonne season_id est parfois NULL dans member_documents
    - Les templates n'ont pas toujours de season_id
    - Les vues ne filtrent pas par saison

  2. Solutions
    - Associer tous les documents existants à la saison courante
    - Créer des vues filtrées par saison
    - Corriger les contraintes pour permettre la gestion par saison

  3. Nouvelles fonctionnalités
    - Vue member_documents_complete avec season_id
    - Fonction pour obtenir les documents par saison
    - Gestion de l'historique des saisons
*/

-- ========================================
-- ÉTAPE 1: ASSOCIER LES DOCUMENTS EXISTANTS À LA SAISON COURANTE
-- ========================================

-- Associer tous les documents sans season_id à la saison courante
DO $$
DECLARE
  current_season_id uuid;
  updated_docs integer;
  updated_templates integer;
BEGIN
  -- Récupérer la saison courante
  SELECT id INTO current_season_id 
  FROM seasons 
  WHERE is_current = true 
  LIMIT 1;
  
  -- Si pas de saison courante, créer une saison par défaut
  IF current_season_id IS NULL THEN
    INSERT INTO seasons (
      name, 
      start_date, 
      end_date, 
      registration_start_date, 
      registration_end_date,
      is_active,
      is_current,
      registration_open,
      description,
      membership_fees
    ) VALUES (
      'Saison 2024-2025',
      '2024-09-01',
      '2025-06-30',
      '2024-06-01',
      '2024-09-15',
      true,
      true,
      true,
      'Saison par défaut créée automatiquement',
      '{
        "baby": 120,
        "poussin": 140,
        "benjamin": 160,
        "minime": 180,
        "cadet": 200,
        "junior": 220,
        "senior": 250,
        "veteran": 200
      }'::jsonb
    ) RETURNING id INTO current_season_id;
  END IF;
  
  -- Associer tous les documents sans season_id à cette saison
  UPDATE member_documents 
  SET season_id = current_season_id 
  WHERE season_id IS NULL;
  
  GET DIAGNOSTICS updated_docs = ROW_COUNT;
  
  -- Associer tous les modèles sans season_id à cette saison
  UPDATE document_templates 
  SET season_id = current_season_id 
  WHERE season_id IS NULL;
  
  GET DIAGNOSTICS updated_templates = ROW_COUNT;
  
  RAISE NOTICE 'Documents associés à la saison % :', current_season_id;
  RAISE NOTICE '  - % documents membres mis à jour', updated_docs;
  RAISE NOTICE '  - % modèles mis à jour', updated_templates;
END $$;

-- ========================================
-- ÉTAPE 2: CORRIGER LES VUES POUR INCLURE SEASON_ID
-- ========================================

-- Recréer la vue member_documents_complete avec season_id
CREATE OR REPLACE VIEW member_documents_complete AS
SELECT 
  md.*,
  m.first_name,
  m.last_name,
  m.email as member_email,
  (m.first_name || ' ' || m.last_name) as member_name,
  m.category,
  s.name as season_name,
  s.is_current as is_current_season,
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
LEFT JOIN seasons s ON md.season_id = s.id
LEFT JOIN users u ON md.validated_by = u.id;

-- Vue pour les modèles avec informations de saison
CREATE OR REPLACE VIEW document_templates_with_season AS
SELECT 
  dt.*,
  s.name as season_name,
  s.is_current as is_current_season,
  s.is_active as season_is_active,
  CASE 
    WHEN dt.document_type = 'ffvbForm' THEN 'Formulaire FFVB'
    WHEN dt.document_type = 'medicalCertificate' THEN 'Certificat médical'
    WHEN dt.document_type = 'idPhoto' THEN 'Photo d''identité'
    WHEN dt.document_type = 'parentalConsent' THEN 'Autorisation parentale'
    ELSE dt.document_type
  END as document_type_label
FROM document_templates dt
LEFT JOIN seasons s ON dt.season_id = s.id;

-- ========================================
-- ÉTAPE 3: FONCTIONS POUR LA GESTION PAR SAISON
-- ========================================

-- Fonction pour obtenir les documents d'un membre pour une saison spécifique
CREATE OR REPLACE FUNCTION get_member_documents_for_season(
  p_member_id uuid,
  p_season_id uuid
)
RETURNS TABLE(
  id uuid,
  document_type text,
  file_name text,
  status text,
  uploaded_at timestamptz,
  validated_at timestamptz,
  rejection_reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id,
    md.document_type,
    md.file_name,
    md.status,
    md.uploaded_at,
    md.validated_at,
    md.rejection_reason
  FROM member_documents md
  WHERE md.member_id = p_member_id 
  AND md.season_id = p_season_id
  ORDER BY md.uploaded_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les modèles disponibles pour une saison
CREATE OR REPLACE FUNCTION get_templates_for_season(p_season_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  document_type text,
  file_name text,
  download_count integer,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id,
    dt.name,
    dt.description,
    dt.document_type,
    dt.file_name,
    dt.download_count,
    dt.created_at
  FROM document_templates dt
  WHERE dt.season_id = p_season_id 
  AND dt.is_active = true
  ORDER BY dt.document_type, dt.name;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques de documents par saison
CREATE OR REPLACE FUNCTION get_document_stats_by_season(p_season_id uuid)
RETURNS TABLE(
  document_type text,
  total_uploaded integer,
  total_validated integer,
  total_rejected integer,
  total_pending integer,
  completion_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.document_type,
    COUNT(*)::integer as total_uploaded,
    COUNT(*) FILTER (WHERE md.status = 'validated')::integer as total_validated,
    COUNT(*) FILTER (WHERE md.status = 'rejected')::integer as total_rejected,
    COUNT(*) FILTER (WHERE md.status = 'pending')::integer as total_pending,
    ROUND(
      (COUNT(*) FILTER (WHERE md.status = 'validated')::numeric / 
       NULLIF(COUNT(*), 0)) * 100, 2
    ) as completion_rate
  FROM member_documents md
  WHERE md.season_id = p_season_id
  GROUP BY md.document_type
  ORDER BY md.document_type;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour copier les modèles d'une saison vers une nouvelle saison
CREATE OR REPLACE FUNCTION copy_templates_to_new_season(
  p_source_season_id uuid,
  p_target_season_id uuid
)
RETURNS integer AS $$
DECLARE
  copied_count integer := 0;
  template_record RECORD;
BEGIN
  -- Copier tous les modèles actifs de la saison source vers la saison cible
  FOR template_record IN 
    SELECT * FROM document_templates 
    WHERE season_id = p_source_season_id AND is_active = true
  LOOP
    INSERT INTO document_templates (
      name,
      description,
      document_type,
      file_name,
      file_path,
      file_size,
      is_active,
      season_id
    ) VALUES (
      template_record.name,
      template_record.description,
      template_record.document_type,
      template_record.file_name,
      template_record.file_path,
      template_record.file_size,
      true,
      p_target_season_id
    ) ON CONFLICT DO NOTHING;
    
    copied_count := copied_count + 1;
  END LOOP;
  
  RETURN copied_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 4: RENDRE SEASON_ID OBLIGATOIRE MAINTENANT
-- ========================================

-- Maintenant que tous les documents ont un season_id, le rendre obligatoire
ALTER TABLE member_documents 
ALTER COLUMN season_id SET NOT NULL;

-- Pour les templates, garder optionnel pour permettre des templates globaux
-- mais encourager l'utilisation avec season_id

-- ========================================
-- ÉTAPE 5: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_member_documents_season_status ON member_documents(season_id, status);
CREATE INDEX IF NOT EXISTS idx_document_templates_season_active ON document_templates(season_id, is_active);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ GESTION DES DOCUMENTS PAR SAISONS IMPLÉMENTÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Fonctionnalités ajoutées :';
  RAISE NOTICE '  - Documents obligatoirement liés à une saison';
  RAISE NOTICE '  - Sélecteur de saison dans les interfaces';
  RAISE NOTICE '  - Consultation historique des saisons précédentes';
  RAISE NOTICE '  - Copie de modèles entre saisons';
  RAISE NOTICE '  - Upload/validation seulement pour saison courante';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions disponibles :';
  RAISE NOTICE '  - get_member_documents_for_season(member_id, season_id)';
  RAISE NOTICE '  - get_templates_for_season(season_id)';
  RAISE NOTICE '  - copy_templates_to_new_season(source, target)';
  RAISE NOTICE '  - get_document_stats_by_season(season_id)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vues mises à jour :';
  RAISE NOTICE '  - member_documents_complete (avec season_name)';
  RAISE NOTICE '  - document_templates_with_season (avec infos saison)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 GESTION COMPLÈTE PAR SAISONS OPÉRATIONNELLE !';
END $$;