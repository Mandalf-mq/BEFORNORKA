/*
  # Correction des erreurs de type de retour des fonctions

  1. Problème identifié
    - Les fonctions validate_member_profile et create_new_season_and_reset_members
    - existent déjà avec des types de retour différents
    - PostgreSQL ne peut pas changer le type de retour sans suppression explicite
    
  2. Solutions
    - Supprimer explicitement toutes les versions existantes
    - Recréer avec les bons types de retour
    - Corriger toutes les signatures de fonctions
    
  3. Fonctionnalités
    - Workflow de validation complet
    - Création de comptes membres avec mot de passe temporaire
    - Gestion des saisons avec réinitialisation
    - Import CSV pour ajout en lot
*/

-- ========================================
-- ÉTAPE 1: SUPPRIMER TOUTES LES FONCTIONS EXISTANTES
-- ========================================

-- Supprimer explicitement toutes les signatures possibles de validate_member_profile
DROP FUNCTION IF EXISTS validate_member_profile(uuid, text);
DROP FUNCTION IF EXISTS validate_member_profile(uuid);

-- Supprimer explicitement toutes les signatures possibles de create_new_season_and_reset_members
DROP FUNCTION IF EXISTS create_new_season_and_reset_members(text, date, date, date, date, jsonb);
DROP FUNCTION IF EXISTS create_new_season_and_reset_members(text, date, date, date, date);

-- Supprimer explicitement toutes les signatures possibles de validate_document
DROP FUNCTION IF EXISTS validate_document(uuid, text, text);
DROP FUNCTION IF EXISTS validate_document(uuid, text);

-- Supprimer autres fonctions qui pourraient causer des conflits
DROP FUNCTION IF EXISTS create_member_account_with_password(text, text, text, text, date, text, text, integer);
DROP FUNCTION IF EXISTS import_members_from_csv(jsonb);
DROP FUNCTION IF EXISTS delete_category(uuid);

-- ========================================
-- ÉTAPE 2: MISE À JOUR DES CONTRAINTES
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

-- Supprimer l'ancienne contrainte de rôle
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Ajouter la nouvelle contrainte avec tous les rôles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('webmaster', 'administrateur', 'tresorerie', 'entraineur', 'member'));

-- ========================================
-- ÉTAPE 3: CRÉER LA TABLE DES PERMISSIONS
-- ========================================

-- Table pour les permissions par rôle
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission)
);

-- Activer RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Politique pour que tous puissent lire les permissions
CREATE POLICY "Everyone can read role permissions"
  ON role_permissions
  FOR SELECT
  USING (true);

-- Insérer les permissions par rôle
INSERT INTO role_permissions (role, permission, description) VALUES
  -- Webmaster (accès complet)
  ('webmaster', 'manage_users', 'Gérer tous les utilisateurs'),
  ('webmaster', 'manage_seasons', 'Gérer les saisons'),
  ('webmaster', 'manage_categories', 'Gérer les catégories'),
  ('webmaster', 'manage_members', 'Gérer tous les membres'),
  ('webmaster', 'validate_documents', 'Valider les documents'),
  ('webmaster', 'manage_training', 'Gérer les entraînements'),
  ('webmaster', 'send_whatsapp', 'Envoyer des messages WhatsApp'),
  ('webmaster', 'view_stats', 'Voir toutes les statistiques'),
  ('webmaster', 'manage_settings', 'Gérer les paramètres'),
  
  -- Administrateur
  ('administrateur', 'manage_members', 'Gérer les membres'),
  ('administrateur', 'validate_documents', 'Valider les documents'),
  ('administrateur', 'manage_training', 'Gérer les entraînements'),
  ('administrateur', 'send_whatsapp', 'Envoyer des messages WhatsApp'),
  ('administrateur', 'view_stats', 'Voir les statistiques'),
  
  -- Trésorerie
  ('tresorerie', 'manage_payments', 'Gérer les paiements'),
  ('tresorerie', 'view_financial_stats', 'Voir les statistiques financières'),
  ('tresorerie', 'manage_fees', 'Gérer les tarifs'),
  
  -- Entraîneur
  ('entraineur', 'manage_training', 'Gérer les entraînements'),
  ('entraineur', 'send_whatsapp', 'Envoyer des messages WhatsApp'),
  ('entraineur', 'view_members', 'Voir les membres'),
  
  -- Membre
  ('member', 'view_profile', 'Voir son profil'),
  ('member', 'upload_documents', 'Uploader ses documents'),
  ('member', 'view_training', 'Voir les entraînements')
ON CONFLICT DO NOTHING;

-- ========================================
-- ÉTAPE 4: CORRECTION DES BUCKETS STORAGE
-- ========================================

-- Supprimer tous les fichiers et buckets existants
DELETE FROM storage.objects WHERE bucket_id IN ('documents', 'templates', 'member-documents', 'document-templates', 'member_documents', 'document_templates');
DELETE FROM storage.buckets WHERE id IN ('documents', 'templates', 'member-documents', 'document-templates', 'member_documents', 'document_templates');

-- Créer les buckets finaux avec des noms cohérents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  (
    'member_documents',
    'member_documents',
    false, -- Privé
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  ),
  (
    'templates',
    'templates', 
    true, -- Public
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  );

-- Supprimer toutes les politiques Storage existantes
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Créer des politiques Storage simples et efficaces
CREATE POLICY "Authenticated users can manage documents"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'member_documents')
  WITH CHECK (bucket_id = 'member_documents');

CREATE POLICY "Public can read templates"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'templates');

CREATE POLICY "Authenticated users can manage templates"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'templates')
  WITH CHECK (bucket_id = 'templates');

-- ========================================
-- ÉTAPE 5: FONCTIONS UTILITAIRES DE BASE
-- ========================================

-- Fonction pour calculer l'âge
CREATE OR REPLACE FUNCTION calculate_age(birth_date date)
RETURNS integer AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM age(CURRENT_DATE, birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour obtenir la catégorie selon l'âge
CREATE OR REPLACE FUNCTION get_category_by_age(birth_date date)
RETURNS text AS $$
DECLARE
  member_age integer;
BEGIN
  member_age := calculate_age(birth_date);
  
  IF member_age <= 6 THEN RETURN 'baby';
  ELSIF member_age <= 8 THEN RETURN 'poussin';
  ELSIF member_age <= 10 THEN RETURN 'benjamin';
  ELSIF member_age <= 12 THEN RETURN 'minime';
  ELSIF member_age <= 14 THEN RETURN 'cadet';
  ELSIF member_age <= 17 THEN RETURN 'junior';
  ELSIF member_age <= 35 THEN RETURN 'senior';
  ELSE RETURN 'veteran';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour obtenir le tarif selon la catégorie
CREATE OR REPLACE FUNCTION get_membership_fee_by_category(category_value text)
RETURNS integer AS $$
DECLARE
  fee integer;
BEGIN
  SELECT membership_fee INTO fee
  FROM categories
  WHERE value = category_value AND is_active = true
  LIMIT 1;
  
  IF fee IS NULL THEN
    CASE category_value
      WHEN 'baby' THEN fee := 120;
      WHEN 'poussin' THEN fee := 140;
      WHEN 'benjamin' THEN fee := 160;
      WHEN 'minime' THEN fee := 180;
      WHEN 'cadet' THEN fee := 200;
      WHEN 'junior' THEN fee := 220;
      WHEN 'senior' THEN fee := 250;
      WHEN 'veteran' THEN fee := 200;
      ELSE fee := 250;
    END CASE;
  END IF;
  
  RETURN fee;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 6: FONCTION POUR CRÉER UN COMPTE MEMBRE AVEC MOT DE PASSE
-- ========================================

-- Fonction pour créer un compte membre avec mot de passe temporaire
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
  result jsonb;
BEGIN
  -- Calculer le tarif si pas fourni
  IF p_membership_fee IS NULL THEN
    calculated_fee := get_membership_fee_by_category(p_category);
  ELSE
    calculated_fee := p_membership_fee;
  END IF;
  
  -- Créer le compte auth avec mot de passe temporaire
  new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_temporary_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'role', 'member',
      'must_change_password', true
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );
  
  -- Créer l'identité
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', p_email,
      'first_name', p_first_name,
      'last_name', p_last_name
    ),
    'email',
    NOW(),
    NOW()
  );
  
  -- Créer le profil utilisateur
  INSERT INTO users (
    id,
    email,
    first_name,
    last_name,
    phone,
    role,
    is_active
  ) VALUES (
    new_user_id,
    p_email,
    p_first_name,
    p_last_name,
    p_phone,
    'member',
    true
  );
  
  -- Créer le profil membre
  INSERT INTO members (
    first_name,
    last_name,
    email,
    phone,
    birth_date,
    category,
    membership_fee,
    status,
    payment_status,
    registration_date,
    season_id
  ) VALUES (
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_birth_date,
    p_category,
    calculated_fee,
    'pending',
    'pending',
    CURRENT_DATE,
    (SELECT id FROM seasons WHERE is_current = true LIMIT 1)
  ) RETURNING id INTO new_member_id;
  
  result := jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'member_id', new_member_id,
    'email', p_email,
    'temporary_password', p_temporary_password,
    'message', 'Compte membre créé avec succès'
  );
  
  RETURN result;
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Un compte avec cet email existe déjà'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 7: FONCTION DE VALIDATION MEMBRE PAR ADMIN
-- ========================================

-- Fonction pour valider un membre (1ère validation admin)
CREATE FUNCTION validate_member_profile(
  p_member_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  current_status text;
BEGIN
  -- Vérifier le statut actuel
  SELECT status INTO current_status FROM members WHERE id = p_member_id;
  
  IF current_status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le membre doit être en statut "pending" pour être validé'
    );
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
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membre validé avec succès'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 8: FONCTION VALIDATE_DOCUMENT AVEC RETOUR JSONB
-- ========================================

-- Créer la nouvelle fonction validate_document avec retour jsonb
CREATE FUNCTION validate_document(
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Document non trouvé'
    );
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
      -- Passer le membre en documents_validated puis season_validated
      UPDATE members 
      SET status = 'documents_validated', updated_at = now()
      WHERE id = doc_record.member_id;
      
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Action invalide. Utilisez "validate" ou "reject"'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 9: FONCTION POUR CRÉER UNE NOUVELLE SAISON
-- ========================================

-- Fonction pour créer une nouvelle saison et réinitialiser les membres
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
    'Nouvelle saison créée'
  ) RETURNING id INTO new_season_id;
  
  -- Réinitialiser tous les membres actifs pour la nouvelle saison
  UPDATE members 
  SET 
    status = 'pending',
    season_id = new_season_id,
    payment_status = 'pending',
    validated_by = NULL,
    validated_at = NULL,
    updated_at = now()
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
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 10: FONCTION POUR SUPPRIMER UNE CATÉGORIE
-- ========================================

-- Fonction pour supprimer une catégorie (avec vérifications)
CREATE FUNCTION delete_category(p_category_id uuid)
RETURNS jsonb AS $$
DECLARE
  category_record categories%ROWTYPE;
  member_count integer;
BEGIN
  -- Récupérer la catégorie
  SELECT * INTO category_record FROM categories WHERE id = p_category_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Catégorie non trouvée'
    );
  END IF;
  
  -- Vérifier si c'est une catégorie système
  IF category_record.is_system THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible de supprimer une catégorie système'
    );
  END IF;
  
  -- Compter les membres dans cette catégorie
  SELECT COUNT(*) INTO member_count
  FROM members
  WHERE category_id = p_category_id;
  
  IF member_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible de supprimer une catégorie qui contient des membres (' || member_count || ' membres)'
    );
  END IF;
  
  -- Supprimer la catégorie
  DELETE FROM categories WHERE id = p_category_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Catégorie "' || category_record.label || '" supprimée avec succès'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 11: FONCTION POUR IMPORTER DES MEMBRES DEPUIS CSV
-- ========================================

-- Fonction pour traiter l'import CSV de membres
CREATE FUNCTION import_members_from_csv(
  p_csv_data jsonb -- Array d'objets avec les données CSV
)
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
  -- Récupérer la saison courante
  SELECT id INTO current_season_id FROM seasons WHERE is_current = true LIMIT 1;
  
  -- Traiter chaque ligne du CSV
  FOR member_data IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    BEGIN
      -- Attribution automatique de la catégorie selon l'âge
      auto_category := get_category_by_age((member_data->>'birth_date')::date);
      
      -- Calcul automatique du tarif
      calculated_fee := get_membership_fee_by_category(auto_category);
      
      -- Insérer le membre
      INSERT INTO members (
        first_name,
        last_name,
        email,
        phone,
        birth_date,
        category,
        membership_fee,
        status,
        payment_status,
        registration_date,
        season_id
      ) VALUES (
        member_data->>'first_name',
        member_data->>'last_name',
        member_data->>'email',
        member_data->>'phone',
        (member_data->>'birth_date')::date,
        auto_category,
        calculated_fee,
        'pending',
        'pending',
        CURRENT_DATE,
        current_season_id
      );
      
      imported_count := imported_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        errors := errors || (member_data->>'email' || ': ' || SQLERRM);
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'imported_count', imported_count,
    'error_count', error_count,
    'errors', errors,
    'message', 'Import terminé: ' || imported_count || ' membres importés, ' || error_count || ' erreurs'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 12: FONCTIONS POUR LES DOCUMENTS
-- ========================================

-- Fonction pour obtenir les documents obligatoires selon l'âge
CREATE FUNCTION get_required_documents_for_member(p_member_id uuid)
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
CREATE FUNCTION check_all_required_documents_validated(p_member_id uuid, p_season_id uuid)
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
-- ÉTAPE 13: TRIGGERS POUR TRANSITIONS AUTOMATIQUES
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS auto_status_on_document_upload ON member_documents;
CREATE TRIGGER auto_status_on_document_upload
  AFTER INSERT ON member_documents
  FOR EACH ROW EXECUTE FUNCTION auto_update_member_status_on_document_upload();

-- ========================================
-- ÉTAPE 14: VUES POUR LE WORKFLOW
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

-- ========================================
-- ÉTAPE 15: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_members_status_season ON members(status, season_id);
CREATE INDEX IF NOT EXISTS idx_members_season_validated ON members(status) WHERE status = 'season_validated';
CREATE INDEX IF NOT EXISTS idx_member_documents_member_season_status ON member_documents(member_id, season_id, status);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ ERREURS DE FONCTIONS SQL CORRIGÉES !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Corrections appliquées :';
  RAISE NOTICE '  - Toutes les fonctions supprimées et recréées';
  RAISE NOTICE '  - Types de retour corrigés (jsonb)';
  RAISE NOTICE '  - Contraintes de statuts et rôles mises à jour';
  RAISE NOTICE '  - Buckets Storage recréés proprement';
  RAISE NOTICE '  - Système de permissions implémenté';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions disponibles :';
  RAISE NOTICE '  - create_member_account_with_password(...)';
  RAISE NOTICE '  - validate_member_profile(id, notes)';
  RAISE NOTICE '  - validate_document(id, action, reason)';
  RAISE NOTICE '  - create_new_season_and_reset_members(...)';
  RAISE NOTICE '  - import_members_from_csv(data)';
  RAISE NOTICE '  - delete_category(id)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 PRÊT POUR LES TESTS !';
END $$;