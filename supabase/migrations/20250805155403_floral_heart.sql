/*
  # Ajout du statut "archived" pour les membres

  1. Modification de la contrainte CHECK
    - Ajout du statut "archived" aux statuts possibles
    - Permet d'archiver les membres sans les supprimer

  2. Fonctions utilitaires
    - Fonction pour archiver un membre
    - Fonction pour restaurer un membre archivé
    - Vue pour les membres actifs seulement

  3. Sécurité
    - Maintien des politiques RLS existantes
    - Audit trail des actions d'archivage
*/

-- ========================================
-- ÉTAPE 1: MODIFIER LA CONTRAINTE STATUS
-- ========================================

-- Supprimer l'ancienne contrainte
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;

-- Ajouter la nouvelle contrainte avec "archived"
ALTER TABLE members 
ADD CONSTRAINT members_status_check 
CHECK (status IN ('pending', 'incomplete', 'validated', 'rejected', 'archived'));

-- ========================================
-- ÉTAPE 2: FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour archiver un membre
CREATE OR REPLACE FUNCTION archive_member(
  p_member_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  member_record members%ROWTYPE;
BEGIN
  -- Récupérer les données du membre
  SELECT * INTO member_record FROM members WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre non trouvé avec l''ID: %', p_member_id;
  END IF;
  
  -- Archiver le membre
  UPDATE members 
  SET 
    status = 'archived',
    notes = COALESCE(notes, '') || CASE 
      WHEN notes IS NOT NULL AND notes != '' THEN E'\n' 
      ELSE '' 
    END || 'Archivé le ' || now()::date || CASE 
      WHEN p_reason IS NOT NULL THEN ' - Raison: ' || p_reason 
      ELSE '' 
    END,
    updated_at = now()
  WHERE id = p_member_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour restaurer un membre archivé
CREATE OR REPLACE FUNCTION restore_member(
  p_member_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  UPDATE members 
  SET 
    status = 'validated',
    notes = COALESCE(notes, '') || CASE 
      WHEN notes IS NOT NULL AND notes != '' THEN E'\n' 
      ELSE '' 
    END || 'Restauré le ' || now()::date || CASE 
      WHEN p_notes IS NOT NULL THEN ' - ' || p_notes 
      ELSE '' 
    END,
    updated_at = now()
  WHERE id = p_member_id AND status = 'archived';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 3: VUES UTILES
-- ========================================

-- Vue pour les membres actifs seulement (non archivés)
CREATE OR REPLACE VIEW members_active AS
SELECT * FROM members 
WHERE status != 'archived'
ORDER BY created_at DESC;

-- Vue pour les membres archivés
CREATE OR REPLACE VIEW members_archived AS
SELECT * FROM members 
WHERE status = 'archived'
ORDER BY updated_at DESC;

-- ========================================
-- ÉTAPE 4: FONCTION DE STATISTIQUES MISE À JOUR
-- ========================================

-- Fonction pour obtenir les statistiques incluant les archivés
CREATE OR REPLACE FUNCTION get_member_statistics_complete()
RETURNS TABLE(
  total_members bigint,
  active_members bigint,
  validated_members bigint,
  pending_members bigint,
  rejected_members bigint,
  archived_members bigint,
  total_revenue bigint,
  paid_revenue bigint,
  pending_revenue bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_members,
    COUNT(*) FILTER (WHERE status != 'archived') as active_members,
    COUNT(*) FILTER (WHERE status = 'validated') as validated_members,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_members,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_members,
    COUNT(*) FILTER (WHERE status = 'archived') as archived_members,
    COALESCE(SUM(membership_fee), 0) as total_revenue,
    COALESCE(SUM(membership_fee) FILTER (WHERE payment_status = 'paid'), 0) as paid_revenue,
    COALESCE(SUM(membership_fee) FILTER (WHERE payment_status = 'pending'), 0) as pending_revenue
  FROM members;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ STATUT "ARCHIVED" AJOUTÉ AVEC SUCCÈS !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Fonctionnalités ajoutées :';
  RAISE NOTICE '  - Statut "archived" pour archiver les membres';
  RAISE NOTICE '  - Fonction archive_member(id, reason)';
  RAISE NOTICE '  - Fonction restore_member(id, notes)';
  RAISE NOTICE '  - Vue members_active (membres non archivés)';
  RAISE NOTICE '  - Vue members_archived (membres archivés)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vues disponibles :';
  RAISE NOTICE '  - SELECT * FROM members_active;';
  RAISE NOTICE '  - SELECT * FROM members_archived;';
  RAISE NOTICE '  - SELECT * FROM get_member_statistics_complete();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant vous pouvez archiver les membres !';
END $$;