/*
  # WORKFLOW COMPLET DE VALIDATION - BE FOR NOR KA
  
  Implémentation du workflow de validation avec renouvellement par saison :
  
  1. Nouveaux statuts membres
    - pending → validated → documents_pending → documents_validated → season_validated
    - rejected (à n'importe quelle étape)
    
  2. Logique documents selon l'âge
    - 3 documents obligatoires pour tous
    - Autorisation parentale obligatoire si mineur
    
  3. Gestion des saisons
    - Réinitialisation automatique lors du changement de saison
    - Documents et validations liés à chaque saison
    
  4. Automatisations
    - Transition automatique documents_validated → season_validated
    - Ajout automatique aux listes d'entraînement
    - Vérification âge pour documents obligatoires
*/

-- ========================================
-- ÉTAPE 1: MISE À JOUR DES STATUTS MEMBRES
-- ========================================

-- Supprimer l'ancienne contrainte de statut
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;

-- Ajouter la nouvelle contrainte avec tous les statuts du workflow
ALTER TABLE members 
ADD CONSTRAINT members_status_check 
CHECK (status IN (
  'pending',           -- Nouveau membre, attend validation admin
  'validated',         -- Profil validé par admin, peut uploader docs
  'documents_pending', -- Documents uploadés, attendent validation admin
  'documents_validated', -- Tous documents validés
  'season_validated',  -- Validé pour la saison, dans les listes d'entraînement
  'rejected',          -- Rejeté à n'importe quelle étape
  'archived'           -- Archivé (ancien membre)
));

-- ========================================
-- ÉTAPE 2: FONCTION POUR DÉTERMINER LES DOCUMENTS OBLIGATOIRES
-- ========================================

-- Fonction pour obtenir les documents obligatoires selon l'âge
CREATE OR REPLACE FUNCTION get_required_documents_for_member(p_member_id uuid)
RETURNS text[] AS $$
DECLARE
  member_age integer;
  required_docs text[];
BEGIN
  -- Calculer l'âge du membre
  SELECT calculate_age(birth_date) INTO member_age
  FROM members WHERE id = p_member_id;
  
  -- Documents obligatoires pour tous
  required_docs := ARRAY['ffvbForm', 'medicalCertificate', 'idPhoto'];
  
  -- Ajouter autorisation parentale si mineur
  IF member_age < 18 THEN
    required_docs := required_docs || ARRAY['parentalConsent'];
  END IF;
  
  RETURN required_docs;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si tous les documents obligatoires sont validés
CREATE OR REPLACE FUNCTION check_all_required_documents_validated(p_member_id uuid, p_season_id uuid)
RETURNS boolean AS $$
DECLARE
  required_docs text[];
  validated_docs text[];
  doc_type text;
BEGIN
  -- Obtenir les documents obligatoires pour ce membre
  required_docs := get_required_documents_for_member(p_member_id);
  
  -- Obtenir les documents validés pour cette saison
  SELECT ARRAY_AGG(document_type) INTO validated_docs
  FROM member_documents 
  WHERE member_id = p_member_id 
  AND season_id = p_season_id 
  AND status = 'validated';
  
  -- Vérifier que tous les documents obligatoires sont validés
  FOREACH doc_type IN ARRAY required_docs
  LOOP
    IF NOT (doc_type = ANY(COALESCE(validated_docs, ARRAY[]::text[]))) THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 3: TRIGGERS POUR TRANSITIONS AUTOMATIQUES
-- ========================================

-- Trigger pour passer automatiquement en documents_pending quand un document est uploadé
CREATE OR REPLACE FUNCTION auto_update_member_status_on_document_upload()
RETURNS TRIGGER AS $$
DECLARE
  member_status text;
BEGIN
  -- Récupérer le statut actuel du membre
  SELECT status INTO member_status FROM members WHERE id = NEW.member_id;
  
  -- Si le membre est validé et upload son premier document, passer en documents_pending
  IF member_status = 'validated' THEN
    UPDATE members 
    SET status = 'documents_pending', updated_at = now()
    WHERE id = NEW.member_id;
    
    RAISE NOTICE 'Membre % passé en documents_pending après upload', NEW.member_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour passer automatiquement en documents_validated puis season_validated
CREATE OR REPLACE FUNCTION auto_update_member_status_on_document_validation()
RETURNS TRIGGER AS $$
DECLARE
  member_status text;
  season_id uuid;
  all_docs_validated boolean;
BEGIN
  -- Récupérer le statut du membre et la saison courante
  SELECT m.status, s.id INTO member_status, season_id
  FROM members m, seasons s
  WHERE m.id = NEW.member_id AND s.is_current = true;
  
  -- Si un document vient d'être validé et le membre est en documents_pending
  IF NEW.status = 'validated' AND OLD.status != 'validated' AND member_status = 'documents_pending' THEN
    
    -- Vérifier si tous les documents obligatoires sont maintenant validés
    all_docs_validated := check_all_required_documents_validated(NEW.member_id, season_id);
    
    IF all_docs_validated THEN
      -- Passer en documents_validated
      UPDATE members 
      SET status = 'documents_validated', updated_at = now()
      WHERE id = NEW.member_id;
      
      RAISE NOTICE 'Membre % passé en documents_validated', NEW.member_id;
      
      -- Puis automatiquement en season_validated
      UPDATE members 
      SET status = 'season_validated', updated_at = now()
      WHERE id = NEW.member_id;
      
      RAISE NOTICE 'Membre % passé en season_validated automatiquement', NEW.member_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS auto_status_on_document_upload ON member_documents;
CREATE TRIGGER auto_status_on_document_upload
  AFTER INSERT ON member_documents
  FOR EACH ROW EXECUTE FUNCTION auto_update_member_status_on_document_upload();

DROP TRIGGER IF EXISTS auto_status_on_document_validation ON member_documents;
CREATE TRIGGER auto_status_on_document_validation
  AFTER UPDATE ON member_documents
  FOR EACH ROW EXECUTE FUNCTION auto_update_member_status_on_document_validation();

-- ========================================
-- ÉTAPE 4: FONCTION DE CHANGEMENT DE SAISON
-- ========================================

-- Fonction pour créer une nouvelle saison et réinitialiser les membres
CREATE OR REPLACE FUNCTION create_new_season_and_reset_members(
  p_season_name text,
  p_start_date date,
  p_end_date date,
  p_registration_start date,
  p_registration_end date,
  p_membership_fees jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_season_id uuid;
  member_count integer;
BEGIN
  -- Désactiver l'ancienne saison courante
  UPDATE seasons SET is_current = false WHERE is_current = true;
  
  -- Créer la nouvelle saison
  INSERT INTO seasons (
    name,
    start_date,
    end_date,
    registration_start_date,
    registration_end_date,
    is_active,
    is_current,
    registration_open,
    membership_fees,
    description
  ) VALUES (
    p_season_name,
    p_start_date,
    p_end_date,
    p_registration_start,
    p_registration_end,
    true,
    true,
    true,
    COALESCE(p_membership_fees, '{
      "baby": 120,
      "poussin": 140,
      "benjamin": 160,
      "minime": 180,
      "cadet": 200,
      "junior": 220,
      "senior": 250,
      "veteran": 200
    }'::jsonb),
    'Nouvelle saison créée automatiquement'
  ) RETURNING id INTO new_season_id;
  
  -- Réinitialiser tous les membres actifs pour la nouvelle saison
  UPDATE members 
  SET 
    status = 'pending',
    season_id = new_season_id,
    payment_status = 'pending',
    updated_at = now()
  WHERE status IN ('validated', 'documents_pending', 'documents_validated', 'season_validated');
  
  GET DIAGNOSTICS member_count = ROW_COUNT;
  
  -- Copier les modèles de documents de l'ancienne saison vers la nouvelle
  INSERT INTO document_templates (
    name, description, document_type, file_name, file_path, 
    file_size, is_active, season_id
  )
  SELECT 
    name, description, document_type, file_name, file_path,
    file_size, is_active, new_season_id
  FROM document_templates 
  WHERE season_id != new_season_id AND is_active = true
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Nouvelle saison créée: % (ID: %)', p_season_name, new_season_id;
  RAISE NOTICE '% membres réinitialisés pour la nouvelle saison', member_count;
  
  RETURN new_season_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 5: FONCTION DE VALIDATION MEMBRE PAR ADMIN
-- ========================================

-- Fonction pour valider un membre (1ère validation admin)
CREATE OR REPLACE FUNCTION validate_member_profile(
  p_member_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  current_status text;
BEGIN
  -- Vérifier le statut actuel
  SELECT status INTO current_status FROM members WHERE id = p_member_id;
  
  IF current_status != 'pending' THEN
    RAISE EXCEPTION 'Le membre doit être en statut "pending" pour être validé. Statut actuel: %', current_status;
  END IF;
  
  -- Passer en validated
  UPDATE members 
  SET 
    status = 'validated',
    validated_by = auth.uid(),
    validated_at = now(),
    notes = COALESCE(p_notes, 'Profil validé par admin'),
    updated_at = now()
  WHERE id = p_member_id;
  
  -- Logger l'action
  PERFORM log_member_action(
    p_member_id,
    'profile_validated',
    jsonb_build_object('old_status', 'pending'),
    jsonb_build_object('new_status', 'validated', 'validated_by', auth.uid()),
    p_notes
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 6: FONCTION POUR OBTENIR LE STATUT COMPLET D'UN MEMBRE
-- ========================================

-- Fonction pour obtenir le statut détaillé d'un membre
CREATE OR REPLACE FUNCTION get_member_validation_status(p_member_id uuid)
RETURNS TABLE(
  member_id uuid,
  current_status text,
  required_documents text[],
  uploaded_documents text[],
  validated_documents text[],
  missing_documents text[],
  can_proceed_to_next_step boolean,
  next_step text,
  completion_percentage numeric
) AS $$
DECLARE
  current_season_id uuid;
  member_age integer;
  required_docs text[];
  uploaded_docs text[];
  validated_docs text[];
  missing_docs text[];
  member_status text;
BEGIN
  -- Récupérer la saison courante
  SELECT id INTO current_season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  -- Récupérer les infos du membre
  SELECT status, calculate_age(birth_date) 
  INTO member_status, member_age
  FROM members WHERE id = p_member_id;
  
  -- Documents obligatoires selon l'âge
  required_docs := ARRAY['ffvbForm', 'medicalCertificate', 'idPhoto'];
  IF member_age < 18 THEN
    required_docs := required_docs || ARRAY['parentalConsent'];
  END IF;
  
  -- Documents uploadés
  SELECT ARRAY_AGG(document_type) INTO uploaded_docs
  FROM member_documents 
  WHERE member_id = p_member_id AND season_id = current_season_id;
  
  -- Documents validés
  SELECT ARRAY_AGG(document_type) INTO validated_docs
  FROM member_documents 
  WHERE member_id = p_member_id AND season_id = current_season_id AND status = 'validated';
  
  -- Documents manquants
  SELECT ARRAY(
    SELECT unnest(required_docs) 
    EXCEPT 
    SELECT unnest(COALESCE(uploaded_docs, ARRAY[]::text[]))
  ) INTO missing_docs;
  
  RETURN QUERY
  SELECT 
    p_member_id,
    member_status,
    required_docs,
    COALESCE(uploaded_docs, ARRAY[]::text[]),
    COALESCE(validated_docs, ARRAY[]::text[]),
    missing_docs,
    CASE 
      WHEN member_status = 'pending' THEN true -- Peut être validé par admin
      WHEN member_status = 'validated' AND array_length(missing_docs, 1) = 0 THEN true -- Peut uploader docs
      WHEN member_status = 'documents_pending' THEN true -- Admin peut valider docs
      ELSE false
    END as can_proceed,
    CASE 
      WHEN member_status = 'pending' THEN 'Validation admin du profil'
      WHEN member_status = 'validated' THEN 'Upload des documents obligatoires'
      WHEN member_status = 'documents_pending' THEN 'Validation admin des documents'
      WHEN member_status = 'documents_validated' THEN 'Validation automatique pour la saison'
      WHEN member_status = 'season_validated' THEN 'Membre validé pour la saison'
      ELSE 'Statut inconnu'
    END as next_step,
    CASE 
      WHEN array_length(required_docs, 1) = 0 THEN 100
      ELSE ROUND((array_length(COALESCE(validated_docs, ARRAY[]::text[]), 1)::numeric / array_length(required_docs, 1)) * 100, 1)
    END as completion_percentage;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 7: FONCTION POUR VALIDER UN DOCUMENT
-- ========================================

-- Mise à jour de la fonction validate_document pour gérer les transitions
CREATE OR REPLACE FUNCTION validate_document(
  p_document_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  doc_record member_documents%ROWTYPE;
  member_status text;
  season_id uuid;
  all_docs_validated boolean;
  result jsonb;
BEGIN
  -- Récupérer le document
  SELECT * INTO doc_record FROM member_documents WHERE id = p_document_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document non trouvé avec l''ID: %', p_document_id;
  END IF;
  
  -- Récupérer la saison courante
  SELECT id INTO season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  IF p_action = 'validate' THEN
    -- Valider le document
    UPDATE member_documents 
    SET 
      status = 'validated',
      validated_by = auth.uid(),
      validated_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = p_document_id;
    
    -- Vérifier si tous les documents obligatoires sont maintenant validés
    all_docs_validated := check_all_required_documents_validated(doc_record.member_id, season_id);
    
    IF all_docs_validated THEN
      -- Passer le membre en documents_validated
      UPDATE members 
      SET status = 'documents_validated', updated_at = now()
      WHERE id = doc_record.member_id;
      
      -- Puis automatiquement en season_validated
      UPDATE members 
      SET status = 'season_validated', updated_at = now()
      WHERE id = doc_record.member_id;
      
      result := jsonb_build_object(
        'success', true,
        'action', 'validated',
        'member_status_updated', 'season_validated',
        'message', 'Document validé et membre automatiquement validé pour la saison'
      );
    ELSE
      result := jsonb_build_object(
        'success', true,
        'action', 'validated',
        'member_status_updated', 'documents_pending',
        'message', 'Document validé, en attente des autres documents'
      );
    END IF;
    
  ELSIF p_action = 'reject' THEN
    -- Rejeter le document
    UPDATE member_documents 
    SET 
      status = 'rejected',
      rejection_reason = p_rejection_reason,
      validated_by = auth.uid(),
      validated_at = now(),
      updated_at = now()
    WHERE id = p_document_id;
    
    result := jsonb_build_object(
      'success', true,
      'action', 'rejected',
      'message', 'Document rejeté'
    );
    
  ELSE
    RAISE EXCEPTION 'Action invalide: %. Utilisez "validate" ou "reject"', p_action;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 8: VUES POUR LE WORKFLOW
-- ========================================

-- Vue pour les membres avec leur progression dans le workflow
CREATE OR REPLACE VIEW members_workflow_status AS
SELECT 
  m.*,
  s.name as season_name,
  s.is_current as is_current_season,
  calculate_age(m.birth_date) as age,
  get_required_documents_for_member(m.id) as required_documents,
  (
    SELECT ARRAY_AGG(document_type) 
    FROM member_documents md 
    WHERE md.member_id = m.id AND md.season_id = m.season_id
  ) as uploaded_documents,
  (
    SELECT ARRAY_AGG(document_type) 
    FROM member_documents md 
    WHERE md.member_id = m.id AND md.season_id = m.season_id AND md.status = 'validated'
  ) as validated_documents,
  CASE 
    WHEN m.status = 'pending' THEN 'En attente de validation admin'
    WHEN m.status = 'validated' THEN 'Peut uploader ses documents'
    WHEN m.status = 'documents_pending' THEN 'Documents en attente de validation'
    WHEN m.status = 'documents_validated' THEN 'Documents validés'
    WHEN m.status = 'season_validated' THEN 'Validé pour la saison'
    WHEN m.status = 'rejected' THEN 'Dossier rejeté'
    ELSE m.status
  END as status_label,
  CASE 
    WHEN m.status = 'season_validated' THEN 100
    WHEN m.status = 'documents_validated' THEN 90
    WHEN m.status = 'documents_pending' THEN 70
    WHEN m.status = 'validated' THEN 40
    WHEN m.status = 'pending' THEN 10
    ELSE 0
  END as workflow_progress
FROM members m
LEFT JOIN seasons s ON m.season_id = s.id;

-- Vue pour les membres prêts pour les entraînements
CREATE OR REPLACE VIEW members_ready_for_training AS
SELECT 
  m.*,
  c.label as category_label,
  c.color as category_color
FROM members m
LEFT JOIN categories c ON m.category = c.value
WHERE m.status = 'season_validated'
AND m.season_id IN (SELECT id FROM seasons WHERE is_current = true)
ORDER BY m.category, m.first_name, m.last_name;

-- ========================================
-- ÉTAPE 9: FONCTION POUR OBTENIR LES MEMBRES PAR CATÉGORIE POUR WHATSAPP
-- ========================================

-- Fonction pour obtenir les membres validés par catégorie pour WhatsApp
CREATE OR REPLACE FUNCTION get_members_for_whatsapp(p_categories text[] DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  category text,
  category_label text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.first_name,
    m.last_name,
    m.email,
    m.phone,
    m.category,
    COALESCE(c.label, m.category) as category_label
  FROM members m
  LEFT JOIN categories c ON m.category = c.value
  WHERE m.status = 'season_validated'
  AND m.season_id IN (SELECT id FROM seasons WHERE is_current = true)
  AND (p_categories IS NULL OR m.category = ANY(p_categories))
  AND m.phone IS NOT NULL 
  AND m.phone != ''
  ORDER BY m.category, m.first_name, m.last_name;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 10: FONCTION DE DIAGNOSTIC DU WORKFLOW
-- ========================================

-- Fonction pour diagnostiquer l'état du workflow
CREATE OR REPLACE FUNCTION diagnose_validation_workflow()
RETURNS TABLE(
  status text,
  member_count bigint,
  percentage numeric,
  description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.status,
    COUNT(*) as member_count,
    ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM members WHERE status != 'archived')) * 100, 1) as percentage,
    CASE 
      WHEN m.status = 'pending' THEN 'Nouveaux membres en attente de validation admin'
      WHEN m.status = 'validated' THEN 'Profils validés, peuvent uploader documents'
      WHEN m.status = 'documents_pending' THEN 'Documents uploadés, attendent validation admin'
      WHEN m.status = 'documents_validated' THEN 'Documents validés, en cours de validation saison'
      WHEN m.status = 'season_validated' THEN 'Membres validés pour la saison, dans les listes'
      WHEN m.status = 'rejected' THEN 'Dossiers rejetés'
      ELSE 'Statut inconnu'
    END as description
  FROM members m
  WHERE m.status != 'archived'
  GROUP BY m.status
  ORDER BY 
    CASE m.status
      WHEN 'pending' THEN 1
      WHEN 'validated' THEN 2
      WHEN 'documents_pending' THEN 3
      WHEN 'documents_validated' THEN 4
      WHEN 'season_validated' THEN 5
      WHEN 'rejected' THEN 6
      ELSE 7
    END;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 11: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_members_status_season ON members(status, season_id);
CREATE INDEX IF NOT EXISTS idx_members_season_validated ON members(status) WHERE status = 'season_validated';
CREATE INDEX IF NOT EXISTS idx_member_documents_member_season_status ON member_documents(member_id, season_id, status);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '🎉 WORKFLOW COMPLET DE VALIDATION IMPLÉMENTÉ !';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 STATUTS MEMBRES :';
  RAISE NOTICE '  1. pending → En attente validation admin';
  RAISE NOTICE '  2. validated → Peut uploader documents';
  RAISE NOTICE '  3. documents_pending → Documents en attente validation';
  RAISE NOTICE '  4. documents_validated → Tous documents OK';
  RAISE NOTICE '  5. season_validated → Validé pour saison, dans listes';
  RAISE NOTICE '  6. rejected → Rejeté à n''importe quelle étape';
  RAISE NOTICE '';
  RAISE NOTICE '📄 DOCUMENTS SELON ÂGE :';
  RAISE NOTICE '  - Toujours : ffvbForm, medicalCertificate, idPhoto';
  RAISE NOTICE '  - Si mineur : + parentalConsent';
  RAISE NOTICE '';
  RAISE NOTICE '🤖 AUTOMATISATIONS :';
  RAISE NOTICE '  - Upload doc → documents_pending';
  RAISE NOTICE '  - Tous docs validés → documents_validated → season_validated';
  RAISE NOTICE '  - Changement saison → Réinitialisation workflow';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ FONCTIONS DISPONIBLES :';
  RAISE NOTICE '  - validate_member_profile(id, notes)';
  RAISE NOTICE '  - validate_document(id, action, reason)';
  RAISE NOTICE '  - get_member_validation_status(id)';
  RAISE NOTICE '  - create_new_season_and_reset_members(...)';
  RAISE NOTICE '  - get_members_for_whatsapp(categories[])';
  RAISE NOTICE '';
  RAISE NOTICE '📊 VUES DISPONIBLES :';
  RAISE NOTICE '  - members_workflow_status';
  RAISE NOTICE '  - members_ready_for_training';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 DIAGNOSTIC :';
  RAISE NOTICE '  SELECT * FROM diagnose_validation_workflow();';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 WORKFLOW PRÊT POUR IMPLÉMENTATION FRONTEND !';
END $$;