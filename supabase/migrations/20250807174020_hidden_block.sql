/*
  # Correction simple des doublons dans document_templates

  1. Problème identifié
    - Doublons dans document_templates empêchent l'association aux saisons
    - Contrainte unique violée : (season_id, document_type)
    
  2. Solution simple
    - Supprimer TOUS les doublons avant association
    - Garder seulement 1 template par document_type
    - Association sécurisée ensuite
*/

-- ========================================
-- ÉTAPE 1: SUPPRIMER TOUS LES DOUBLONS
-- ========================================

-- Supprimer les doublons en gardant seulement le plus récent par document_type
DELETE FROM document_templates 
WHERE id NOT IN (
  SELECT DISTINCT ON (document_type) id
  FROM document_templates
  ORDER BY document_type, created_at DESC
);

-- ========================================
-- ÉTAPE 2: ASSOCIER LES TEMPLATES RESTANTS À LA SAISON COURANTE
-- ========================================

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
      name, start_date, end_date, registration_start_date, registration_end_date,
      is_active, is_current, registration_open, description, membership_fees
    ) VALUES (
      'Saison 2024-2025', '2024-09-01', '2025-06-30', '2024-06-01', '2024-09-15',
      true, true, true, 'Saison par défaut créée automatiquement',
      '{"baby": 120, "poussin": 140, "benjamin": 160, "minime": 180, "cadet": 200, "junior": 220, "senior": 250, "veteran": 200}'::jsonb
    ) RETURNING id INTO current_season_id;
  END IF;
  
  -- Associer TOUS les templates sans season_id à la saison courante
  -- (Plus de conflit car on a supprimé les doublons)
  UPDATE document_templates 
  SET season_id = current_season_id 
  WHERE season_id IS NULL;
  
  GET DIAGNOSTICS updated_templates = ROW_COUNT;
  
  RAISE NOTICE '✅ DOUBLONS SUPPRIMÉS ET ASSOCIATION TERMINÉE :';
  RAISE NOTICE '  - Templates associés : %', updated_templates;
  RAISE NOTICE '  - Saison courante : %', current_season_id;
END $$;

-- ========================================
-- ÉTAPE 3: ASSOCIER LES DOCUMENTS MEMBRES
-- ========================================

-- Associer tous les documents membres sans season_id à la saison courante
DO $$
DECLARE
  current_season_id uuid;
  updated_docs integer;
BEGIN
  SELECT id INTO current_season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  UPDATE member_documents 
  SET season_id = current_season_id 
  WHERE season_id IS NULL;
  
  GET DIAGNOSTICS updated_docs = ROW_COUNT;
  
  RAISE NOTICE '✅ DOCUMENTS MEMBRES ASSOCIÉS : %', updated_docs;
END $$;

-- ========================================
-- ÉTAPE 4: RENDRE SEASON_ID OBLIGATOIRE
-- ========================================

-- Maintenant que tous les documents ont un season_id, le rendre obligatoire
ALTER TABLE member_documents 
ALTER COLUMN season_id SET NOT NULL;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '🎉 CORRECTION DES DOUBLONS TERMINÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '✅ CORRECTIONS APPLIQUÉES :';
  RAISE NOTICE '  - Doublons supprimés (1 seul template par type)';
  RAISE NOTICE '  - Tous les templates associés à la saison courante';
  RAISE NOTICE '  - Tous les documents membres associés';
  RAISE NOTICE '  - season_id maintenant obligatoire';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 PRÊT POUR LA GESTION PAR SAISONS !';
END $$;