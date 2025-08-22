/*
  # Individualisation des documents par membre et par saison

  1. Modifications des tables
    - Ajout de season_id aux documents des membres
    - Ajout de season_id aux modèles de documents
    - Contraintes pour éviter les doublons par saison

  2. Nouvelles fonctionnalités
    - Un membre peut avoir des documents différents par saison
    - Les modèles sont spécifiques à chaque saison
    - Historique complet des documents par saison

  3. Sécurité
    - Maintien des politiques RLS existantes
    - Nouvelles contraintes d'intégrité
*/

-- ========================================
-- ÉTAPE 1: MODIFICATION DE LA TABLE MEMBER_DOCUMENTS
-- ========================================

-- Ajouter la colonne season_id aux documents des membres
ALTER TABLE member_documents 
ADD COLUMN season_id uuid REFERENCES seasons(id) ON DELETE CASCADE;

-- Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_member_documents_season_id ON member_documents(season_id);

-- Modifier la contrainte d'unicité pour inclure la saison
-- Un membre peut avoir le même type de document pour différentes saisons
ALTER TABLE member_documents 
DROP CONSTRAINT IF EXISTS member_documents_member_id_document_type_key;

-- Nouvelle contrainte : unique par membre, type de document ET saison
ALTER TABLE member_documents 
ADD CONSTRAINT member_documents_member_season_type_unique 
UNIQUE(member_id, document_type, season_id);

-- ========================================
-- ÉTAPE 2: MODIFICATION DE LA TABLE DOCUMENT_TEMPLATES
-- ========================================

-- Ajouter la colonne season_id aux modèles de documents
ALTER TABLE document_templates 
ADD COLUMN season_id uuid REFERENCES seasons(id) ON DELETE CASCADE;

-- Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_document_templates_season_id ON document_templates(season_id);

-- Modifier la contrainte pour permettre le même modèle pour différentes saisons
-- Un modèle peut exister pour plusieurs saisons avec des versions différentes
ALTER TABLE document_templates 
ADD CONSTRAINT document_templates_name_season_unique 
UNIQUE(name, season_id, document_type);

-- ========================================
-- ÉTAPE 3: MISE À JOUR DES DONNÉES EXISTANTES
-- ========================================

-- Associer les documents existants à la saison courante
DO $$
DECLARE
  current_season_id uuid;
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
      description
    ) VALUES (
      'Saison 2024-2025',
      '2024-09-01',
      '2025-06-30',
      '2024-06-01',
      '2024-09-15',
      true,
      true,
      true,
      'Saison par défaut créée lors de la migration'
    ) RETURNING id INTO current_season_id;
  END IF;
  
  -- Associer tous les documents existants à cette saison
  UPDATE member_documents 
  SET season_id = current_season_id 
  WHERE season_id IS NULL;
  
  -- Associer tous les modèles existants à cette saison
  UPDATE document_templates 
  SET season_id = current_season_id 
  WHERE season_id IS NULL;
  
  RAISE NOTICE 'Documents associés à la saison: %', current_season_id;
END $$;

-- Rendre season_id obligatoire maintenant que toutes les données sont mises à jour
ALTER TABLE member_documents 
ALTER COLUMN season_id SET NOT NULL;

ALTER TABLE document_templates 
ALTER COLUMN season_id SET NOT NULL;

-- ========================================
-- ÉTAPE 4: NOUVELLES VUES POUR FACILITER LES REQUÊTES
-- ========================================

-- Vue pour les documents avec informations complètes incluant la saison
CREATE OR REPLACE VIEW member_documents_with_season AS
SELECT 
  md.*,
  m.first_name,
  m.last_name,
  m.email as member_email,
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
-- ÉTAPE 5: FONCTIONS UTILITAIRES
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
  validated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id,
    md.document_type,
    md.file_name,
    md.status,
    md.uploaded_at,
    md.validated_at
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
  download_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id,
    dt.name,
    dt.description,
    dt.document_type,
    dt.file_name,
    dt.download_count
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
    );
    
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
-- ÉTAPE 6: MISE À JOUR DES POLITIQUES RLS
-- ========================================

-- Les politiques existantes restent valides car elles utilisent déjà des conditions générales
-- Pas besoin de modification pour le moment

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ INDIVIDUALISATION DES DOCUMENTS PAR SAISON TERMINÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Nouvelles fonctionnalités :';
  RAISE NOTICE '  - Documents individualisés par membre ET par saison';
  RAISE NOTICE '  - Modèles de documents classifiés par saison';
  RAISE NOTICE '  - Contraintes d''unicité adaptées';
  RAISE NOTICE '  - Vues enrichies avec informations de saison';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions utilitaires créées :';
  RAISE NOTICE '  - get_member_documents_for_season(member_id, season_id)';
  RAISE NOTICE '  - get_templates_for_season(season_id)';
  RAISE NOTICE '  - copy_templates_to_new_season(source, target)';
  RAISE NOTICE '  - get_document_stats_by_season(season_id)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Avantages :';
  RAISE NOTICE '  - Un membre peut avoir des documents différents par saison';
  RAISE NOTICE '  - Chaque saison peut avoir ses propres modèles';
  RAISE NOTICE '  - Historique complet conservé';
  RAISE NOTICE '  - Statistiques par saison disponibles';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Prêt pour l''implémentation frontend !';
END $$;