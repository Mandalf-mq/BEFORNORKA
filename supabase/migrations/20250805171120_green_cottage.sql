/*
  # CORRECTION SIMPLE DES ERREURS DE FONCTIONS
  
  Suppression explicite des fonctions problématiques puis recréation
  avec les bons types de retour.
*/

-- ========================================
-- ÉTAPE 1: SUPPRESSION EXPLICITE DES FONCTIONS PROBLÉMATIQUES
-- ========================================

-- Supprimer les fonctions avec leurs signatures exactes
DROP FUNCTION IF EXISTS get_required_documents_for_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_all_required_documents_validated(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS validate_member_profile(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS validate_document(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS create_new_season_and_reset_members(text, date, date, date, date, jsonb) CASCADE;
DROP FUNCTION IF EXISTS create_member_account_with_password(text, text, text, text, date, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS import_members_from_csv(jsonb) CASCADE;
DROP FUNCTION IF EXISTS delete_category(uuid) CASCADE;
DROP FUNCTION IF EXISTS diagnose_validation_workflow() CASCADE;

-- ========================================
-- ÉTAPE 2: RECRÉER LES FONCTIONS AVEC LES BONS TYPES
-- ========================================

-- Fonction pour obtenir les documents obligatoires selon l'âge
CREATE FUNCTION get_required_documents_for_member(p_member_id uuid)
RETURNS text[] AS $$
DECLARE
  member_age integer;
  required_docs text[];
BEGIN
  SELECT calculate_age(birth_date) INTO member_age
  FROM members WHERE id = p_member_id;
  
  required_docs := ARRAY['ffvbForm', 'medicalCertificate', 'idPhoto'];
  
  IF member_age < 18 THEN
    required_docs := required_docs || ARRAY['parentalConsent'];
  END IF;
  
  RETURN required_docs;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si tous les documents obligatoires sont validés
CREATE FUNCTION check_all_required_documents_validated(p_member_id uuid, p_season_id uuid)
RETURNS boolean AS $$
DECLARE
  required_docs text[];
  validated_docs text[];
  doc_type text;
BEGIN
  required_docs := get_required_documents_for_member(p_member_id);
  
  SELECT ARRAY_AGG(document_type) INTO validated_docs
  FROM member_documents 
  WHERE member_id = p_member_id 
  AND season_id = p_season_id 
  AND status = 'validated';
  
  FOREACH doc_type IN ARRAY required_docs
  LOOP
    IF NOT (doc_type = ANY(COALESCE(validated_docs, ARRAY[]::text[]))) THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour valider un membre (retour jsonb)
CREATE FUNCTION validate_member_profile(
  p_member_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  current_status text;
BEGIN
  SELECT status INTO current_status FROM members WHERE id = p_member_id;
  
  IF current_status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le membre doit être en statut "pending" pour être validé'
    );
  END IF;
  
  UPDATE members 
  SET 
    status = 'validated',
    validated_by = auth.uid(),
    validated_at = now(),
    notes = COALESCE(p_notes, 'Profil validé par admin'),
    updated_at = now()
  WHERE id = p_member_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membre validé avec succès'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour valider un document (retour jsonb)
CREATE FUNCTION validate_document(
  p_document_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  doc_record member_documents%ROWTYPE;
  season_id uuid;
  all_docs_validated boolean;
  result jsonb;
BEGIN
  SELECT * INTO doc_record FROM member_documents WHERE id = p_document_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document non trouvé');
  END IF;
  
  SELECT id INTO season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  IF p_action = 'validate' THEN
    UPDATE member_documents 
    SET 
      status = 'validated',
      validated_by = auth.uid(),
      validated_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = p_document_id;
    
    all_docs_validated := check_all_required_documents_validated(doc_record.member_id, season_id);
    
    IF all_docs_validated THEN
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
        'message', 'Document validé, en attente des autres documents'
      );
    END IF;
    
  ELSIF p_action = 'reject' THEN
    UPDATE member_documents 
    SET 
      status = 'rejected',
      rejection_reason = p_rejection_reason,
      validated_by = auth.uid(),
      validated_at = now(),
      updated_at = now()
    WHERE id = p_document_id;
    
    result := jsonb_build_object('success', true, 'action', 'rejected', 'message', 'Document rejeté');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Action invalide');
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créer une nouvelle saison (retour jsonb)
CREATE FUNCTION create_new_season_and_reset_members(
  p_season_name text,
  p_start_date date,
  p_end_date date,
  p_registration_start date,
  p_registration_end date,
  p_membership_fees jsonb DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  new_season_id uuid;
  member_count integer;
BEGIN
  UPDATE seasons SET is_current = false WHERE is_current = true;
  
  INSERT INTO seasons (
    name, start_date, end_date, registration_start_date, registration_end_date,
    is_active, is_current, registration_open, membership_fees, description
  ) VALUES (
    p_season_name, p_start_date, p_end_date, p_registration_start, p_registration_end,
    true, true, true, 
    COALESCE(p_membership_fees, '{"baby": 120, "poussin": 140, "benjamin": 160, "minime": 180, "cadet": 200, "junior": 220, "senior": 250, "veteran": 200}'::jsonb),
    'Nouvelle saison créée'
  ) RETURNING id INTO new_season_id;
  
  UPDATE members 
  SET status = 'pending', season_id = new_season_id, payment_status = 'pending', updated_at = now()
  WHERE status IN ('validated', 'documents_pending', 'documents_validated', 'season_validated');
  
  GET DIAGNOSTICS member_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'season_id', new_season_id,
    'season_name', p_season_name,
    'members_reset', member_count,
    'message', 'Nouvelle saison créée et membres réinitialisés'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créer un compte membre avec mot de passe
CREATE FUNCTION create_member_account_with_password(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birth_date date,
  p_category text,
  p_temporary_password text,
  p_membership_fee integer DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  new_user_id uuid;
  new_member_id uuid;
  calculated_fee integer;
BEGIN
  calculated_fee := COALESCE(p_membership_fee, get_membership_fee_by_category(p_category));
  new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', p_email,
    crypt(p_temporary_password, gen_salt('bf')), NOW(),
    jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'role', 'member', 'must_change_password', true),
    NOW(), NOW(), '', '', '', ''
  );
  
  INSERT INTO auth.identities (id, user_id, identity_data, provider, created_at, updated_at) VALUES (
    gen_random_uuid(), new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email, 'first_name', p_first_name, 'last_name', p_last_name),
    'email', NOW(), NOW()
  );
  
  INSERT INTO users (id, email, first_name, last_name, phone, role, is_active) VALUES (
    new_user_id, p_email, p_first_name, p_last_name, p_phone, 'member', true
  );
  
  INSERT INTO members (
    first_name, last_name, email, phone, birth_date, category, membership_fee,
    status, payment_status, registration_date, season_id
  ) VALUES (
    p_first_name, p_last_name, p_email, p_phone, p_birth_date, p_category, calculated_fee,
    'pending', 'pending', CURRENT_DATE, (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
  ) RETURNING id INTO new_member_id;
  
  RETURN jsonb_build_object(
    'success', true, 'user_id', new_user_id, 'member_id', new_member_id,
    'email', p_email, 'temporary_password', p_temporary_password,
    'message', 'Compte membre créé avec succès'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte avec cet email existe déjà');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour importer des membres depuis CSV
CREATE FUNCTION import_members_from_csv(p_csv_data jsonb)
RETURNS jsonb AS $$
DECLARE
  member_data jsonb;
  imported_count integer := 0;
  error_count integer := 0;
  errors text[] := ARRAY[]::text[];
  current_season_id uuid;
  calculated_fee integer;
  auto_category text;
BEGIN
  SELECT id INTO current_season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  FOR member_data IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    BEGIN
      auto_category := get_category_by_age((member_data->>'birth_date')::date);
      calculated_fee := get_membership_fee_by_category(auto_category);
      
      INSERT INTO members (
        first_name, last_name, email, phone, birth_date, category, membership_fee,
        status, payment_status, registration_date, season_id
      ) VALUES (
        member_data->>'first_name', member_data->>'last_name', member_data->>'email', member_data->>'phone',
        (member_data->>'birth_date')::date, auto_category, calculated_fee,
        'pending', 'pending', CURRENT_DATE, current_season_id
      );
      
      imported_count := imported_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || (member_data->>'email' || ': ' || SQLERRM);
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true, 'imported_count', imported_count, 'error_count', error_count, 'errors', errors,
    'message', 'Import terminé: ' || imported_count || ' membres importés, ' || error_count || ' erreurs'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour supprimer une catégorie
CREATE FUNCTION delete_category(p_category_id uuid)
RETURNS jsonb AS $$
DECLARE
  category_record categories%ROWTYPE;
  member_count integer;
BEGIN
  SELECT * INTO category_record FROM categories WHERE id = p_category_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Catégorie non trouvée');
  END IF;
  
  IF category_record.is_system THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer une catégorie système');
  END IF;
  
  SELECT COUNT(*) INTO member_count FROM members WHERE category_id = p_category_id;
  
  IF member_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer une catégorie qui contient des membres (' || member_count || ' membres)');
  END IF;
  
  DELETE FROM categories WHERE id = p_category_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Catégorie "' || category_record.label || '" supprimée avec succès');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de diagnostic du workflow
CREATE FUNCTION diagnose_validation_workflow()
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

-- Recréer la vue members_workflow_status
CREATE VIEW members_workflow_status AS
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

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ FONCTIONS CORRIGÉES AVEC APPROCHE CIBLÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Corrections appliquées :';
  RAISE NOTICE '  - Fonctions supprimées avec CASCADE puis recréées';
  RAISE NOTICE '  - Types de retour corrigés (jsonb)';
  RAISE NOTICE '  - Vue members_workflow_status recréée';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant toutes les fonctionnalités devraient marcher !';
END $$;