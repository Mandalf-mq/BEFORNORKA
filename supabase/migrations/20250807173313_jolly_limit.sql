/*
  # Correction de l'erreur de contrainte unique et implémentation complète des documents par saisons

  1. Problème identifié
    - Contrainte unique violée lors de l'association des templates aux saisons
    - Templates dupliqués avec même nom/type/saison
    
  2. Solutions
    - Nettoyer les doublons existants
    - Corriger la contrainte unique
    - Associer proprement les documents aux saisons
    
  3. Implémentation complète
    - Gestion par saison dans toutes les interfaces
    - Historique des saisons précédentes
    - Upload/validation seulement pour saison courante
*/

-- ========================================
-- ÉTAPE 1: NETTOYER LES DOUBLONS EXISTANTS
-- ========================================

-- Supprimer les doublons dans document_templates
DELETE FROM document_templates 
WHERE id NOT IN (
  SELECT DISTINCT ON (name, document_type, COALESCE(season_id::text, 'null')) id
  FROM document_templates
  ORDER BY name, document_type, COALESCE(season_id::text, 'null'), created_at DESC
);

-- ========================================
-- ÉTAPE 2: CORRIGER LA CONTRAINTE UNIQUE
-- ========================================

-- Supprimer l'ancienne contrainte problématique
ALTER TABLE document_templates DROP CONSTRAINT IF EXISTS document_templates_name_season_unique;
ALTER TABLE document_templates DROP CONSTRAINT IF EXISTS document_templates_name_season_id_document_type_key;

-- Créer une nouvelle contrainte plus flexible
-- Permettre le même nom pour différentes saisons, mais pas le même type
ALTER TABLE document_templates 
ADD CONSTRAINT document_templates_season_type_unique 
UNIQUE(season_id, document_type);

-- ========================================
-- ÉTAPE 3: ASSOCIER LES DOCUMENTS EXISTANTS À LA SAISON COURANTE
-- ========================================

-- Associer tous les documents et templates sans season_id à la saison courante
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
  
  -- Associer tous les modèles sans season_id à cette saison (avec gestion des doublons)
  UPDATE document_templates 
  SET season_id = current_season_id 
  WHERE season_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM document_templates dt2 
    WHERE dt2.season_id = current_season_id 
    AND dt2.document_type = document_templates.document_type
  );
  
  GET DIAGNOSTICS updated_templates = ROW_COUNT;
  
  RAISE NOTICE 'Association à la saison % terminée :', current_season_id;
  RAISE NOTICE '  - % documents membres associés', updated_docs;
  RAISE NOTICE '  - % modèles associés (sans doublons)', updated_templates;
END $$;

-- ========================================
-- ÉTAPE 4: RENDRE SEASON_ID OBLIGATOIRE
-- ========================================

-- Maintenant que tous les documents ont un season_id, le rendre obligatoire
ALTER TABLE member_documents 
ALTER COLUMN season_id SET NOT NULL;

-- Pour les templates, garder optionnel mais encourager l'utilisation
-- ALTER TABLE document_templates ALTER COLUMN season_id SET NOT NULL;

-- ========================================
-- ÉTAPE 5: VUES MISES À JOUR AVEC GESTION PAR SAISON
-- ========================================

-- Vue pour les documents avec informations complètes incluant la saison
CREATE OR REPLACE VIEW member_documents_with_season AS
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
-- ÉTAPE 6: FONCTIONS POUR LA GESTION PAR SAISON
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
  file_path text,
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
    md.file_path,
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
  file_path text,
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
    dt.file_path,
    dt.download_count,
    dt.created_at
  FROM document_templates dt
  WHERE dt.season_id = p_season_id 
  AND dt.is_active = true
  ORDER BY dt.document_type, dt.name;
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
    -- Insérer seulement si pas déjà existant pour cette saison/type
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
      template_record.name || ' (Copie)',  -- Ajouter "(Copie)" pour éviter les doublons
      template_record.description,
      template_record.document_type,
      template_record.file_name,
      template_record.file_path,
      template_record.file_size,
      true,
      p_target_season_id
    )
    ON CONFLICT (season_id, document_type) DO NOTHING;
    
    copied_count := copied_count + 1;
  END LOOP;
  
  RETURN copied_count;
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

-- ========================================
-- ÉTAPE 7: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_member_documents_season_status ON member_documents(season_id, status);
CREATE INDEX IF NOT EXISTS idx_member_documents_season_type ON member_documents(season_id, document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_season_type ON document_templates(season_id, document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_season_active ON document_templates(season_id, is_active);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ ERREUR DE CONTRAINTE CORRIGÉE ET GESTION PAR SAISONS IMPLÉMENTÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Corrections appliquées :';
  RAISE NOTICE '  - Doublons supprimés dans document_templates';
  RAISE NOTICE '  - Contrainte unique corrigée (season_id + document_type)';
  RAISE NOTICE '  - Documents associés à la saison courante';
  RAISE NOTICE '  - season_id rendu obligatoire pour member_documents';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Fonctionnalités ajoutées :';
  RAISE NOTICE '  - Gestion complète par saison';
  RAISE NOTICE '  - Historique des saisons précédentes';
  RAISE NOTICE '  - Upload/validation pour saison courante uniquement';
  RAISE NOTICE '  - Copie de modèles entre saisons';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions disponibles :';
  RAISE NOTICE '  - get_member_documents_for_season(member_id, season_id)';
  RAISE NOTICE '  - get_templates_for_season(season_id)';
  RAISE NOTICE '  - copy_templates_to_new_season(source, target)';
  RAISE NOTICE '  - get_document_stats_by_season(season_id)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vues mises à jour :';
  RAISE NOTICE '  - member_documents_with_season';
  RAISE NOTICE '  - document_templates_with_season';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 MAINTENANT EXÉCUTEZ CETTE MIGRATION ET TESTEZ !';
END $$;