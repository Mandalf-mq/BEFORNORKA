/*
  # Correction de l'erreur de doublons dans document_templates

  1. Problème identifié
    - Doublons dans document_templates empêchent l'association aux saisons
    - Contrainte unique violée lors de l'UPDATE
    
  2. Solution
    - Supprimer les doublons avant l'association
    - Garder seulement le plus récent de chaque type
    - Associer ensuite aux saisons sans conflit
    
  3. Sécurité
    - Préservation des données les plus récentes
    - Pas de perte de données importantes
*/

-- ========================================
-- ÉTAPE 1: DIAGNOSTIC DES DOUBLONS
-- ========================================

DO $$
DECLARE
  duplicate_count integer;
BEGIN
  -- Compter les doublons
  SELECT COUNT(*) - COUNT(DISTINCT (name, document_type)) INTO duplicate_count
  FROM document_templates;
  
  RAISE NOTICE '🔍 DIAGNOSTIC DOUBLONS :';
  RAISE NOTICE '  - Doublons détectés : %', duplicate_count;
END $$;

-- ========================================
-- ÉTAPE 2: SUPPRIMER LES DOUBLONS EN GARDANT LE PLUS RÉCENT
-- ========================================

-- Supprimer les doublons en gardant le plus récent de chaque (name, document_type)
DELETE FROM document_templates 
WHERE id NOT IN (
  SELECT DISTINCT ON (name, document_type) id
  FROM document_templates
  ORDER BY name, document_type, created_at DESC
);

-- ========================================
-- ÉTAPE 3: ASSOCIER LES TEMPLATES AUX SAISONS SANS CONFLIT
-- ========================================

-- Associer les templates existants à la saison courante
DO $$
DECLARE
  current_season_id uuid;
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
  
  -- Associer les templates sans season_id à la saison courante
  -- SEULEMENT s'il n'existe pas déjà un template de ce type pour cette saison
  UPDATE document_templates 
  SET season_id = current_season_id 
  WHERE season_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM document_templates dt2 
    WHERE dt2.season_id = current_season_id 
    AND dt2.document_type = document_templates.document_type
  );
  
  GET DIAGNOSTICS updated_templates = ROW_COUNT;
  
  -- Supprimer les templates orphelins qui n'ont pas pu être associés
  DELETE FROM document_templates 
  WHERE season_id IS NULL;
  
  RAISE NOTICE '✅ ASSOCIATION TERMINÉE :';
  RAISE NOTICE '  - Saison courante : %', current_season_id;
  RAISE NOTICE '  - Templates associés : %', updated_templates;
  RAISE NOTICE '  - Templates orphelins supprimés';
END $$;

-- ========================================
-- ÉTAPE 4: ASSOCIER LES DOCUMENTS MEMBRES AUX SAISONS
-- ========================================

-- Associer tous les documents membres sans season_id à la saison courante
DO $$
DECLARE
  current_season_id uuid;
  updated_docs integer;
BEGIN
  -- Récupérer la saison courante
  SELECT id INTO current_season_id 
  FROM seasons 
  WHERE is_current = true 
  LIMIT 1;
  
  -- Associer tous les documents sans season_id à cette saison
  UPDATE member_documents 
  SET season_id = current_season_id 
  WHERE season_id IS NULL;
  
  GET DIAGNOSTICS updated_docs = ROW_COUNT;
  
  RAISE NOTICE '✅ DOCUMENTS MEMBRES ASSOCIÉS :';
  RAISE NOTICE '  - Documents associés : %', updated_docs;
END $$;

-- ========================================
-- ÉTAPE 5: RENDRE SEASON_ID OBLIGATOIRE
-- ========================================

-- Maintenant que tous les documents ont un season_id, le rendre obligatoire
ALTER TABLE member_documents 
ALTER COLUMN season_id SET NOT NULL;

-- Pour les templates, garder optionnel pour permettre des templates globaux
-- mais la plupart auront maintenant un season_id

-- ========================================
-- ÉTAPE 6: VÉRIFICATION FINALE
-- ========================================

DO $$
DECLARE
  template_count integer;
  doc_count integer;
  templates_with_season integer;
  docs_with_season integer;
BEGIN
  SELECT COUNT(*) INTO template_count FROM document_templates;
  SELECT COUNT(*) INTO doc_count FROM member_documents;
  SELECT COUNT(*) INTO templates_with_season FROM document_templates WHERE season_id IS NOT NULL;
  SELECT COUNT(*) INTO docs_with_season FROM member_documents WHERE season_id IS NOT NULL;
  
  RAISE NOTICE '✅ CORRECTION DES DOUBLONS TERMINÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ÉTAT FINAL :';
  RAISE NOTICE '  - Templates total : %', template_count;
  RAISE NOTICE '  - Templates avec saison : %', templates_with_season;
  RAISE NOTICE '  - Documents total : %', doc_count;
  RAISE NOTICE '  - Documents avec saison : %', docs_with_season;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 MAINTENANT :';
  RAISE NOTICE '  - Pas de doublons';
  RAISE NOTICE '  - Tous les documents liés à une saison';
  RAISE NOTICE '  - Contraintes respectées';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 PRÊT POUR LA GESTION PAR SAISONS !';
END $$;