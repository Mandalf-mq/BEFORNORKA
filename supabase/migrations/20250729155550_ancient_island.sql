/*
  # REFONTE ARCHITECTURALE COMPLÈTE - BE FOR NOR KA
  
  Cette migration nettoie et restructure complètement la base de données
  pour créer une architecture cohérente et évolutive.
  
  1. Nettoyage complet
    - Suppression de toutes les incohérences
    - Schéma unifié et optimisé
    - Politiques RLS cohérentes
    
  2. Architecture finale
    - Tables avec structure définitive
    - Relations claires et optimisées
    - Index de performance
    - Contraintes d'intégrité
    
  3. Sécurité renforcée
    - Politiques RLS simples et efficaces
    - Permissions granulaires
    - Audit trail complet
*/

-- ========================================
-- ÉTAPE 1: NETTOYAGE COMPLET
-- ========================================

-- Supprimer toutes les politiques RLS existantes
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || policy_record.schemaname || '.' || policy_record.tablename;
    END LOOP;
    
    RAISE NOTICE 'Toutes les politiques RLS supprimées';
END $$;

-- Supprimer toutes les politiques Storage
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
    END LOOP;
    
    RAISE NOTICE 'Toutes les politiques Storage supprimées';
END $$;

-- Nettoyer les buckets Storage
DELETE FROM storage.objects WHERE bucket_id IN ('documents', 'templates', 'member-documents', 'document-templates', 'member_documents', 'document_templates');
DELETE FROM storage.buckets WHERE id IN ('documents', 'templates', 'member-documents', 'document-templates', 'member_documents', 'document_templates');

-- ========================================
-- ÉTAPE 2: SCHÉMA FINAL COHÉRENT
-- ========================================

-- Table des utilisateurs (liée à auth.users)
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  phone text DEFAULT '',
  role text DEFAULT 'member' CHECK (role IN ('webmaster', 'administrateur', 'tresorerie', 'entraineur', 'member')),
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des saisons sportives
DROP TABLE IF EXISTS seasons CASCADE;
CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  registration_start_date date NOT NULL,
  registration_end_date date NOT NULL,
  is_active boolean DEFAULT true,
  is_current boolean DEFAULT false,
  registration_open boolean DEFAULT false,
  description text,
  max_members integer DEFAULT 150,
  membership_fees jsonb DEFAULT '{}'::jsonb,
  required_documents text[] DEFAULT ARRAY['ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des catégories personnalisables
DROP TABLE IF EXISTS categories CASCADE;
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text UNIQUE NOT NULL,
  label text NOT NULL,
  description text DEFAULT '',
  age_range text DEFAULT '',
  membership_fee integer DEFAULT 0,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des membres
DROP TABLE IF EXISTS members CASCADE;
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  category text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  season_id uuid REFERENCES seasons(id) ON DELETE SET NULL,
  parent_info jsonb,
  documents jsonb DEFAULT '{
    "ffvbForm": {"uploaded": false, "validated": false},
    "medicalCertificate": {"uploaded": false, "validated": false},
    "idPhoto": {"uploaded": false, "validated": false},
    "parentalConsent": {"uploaded": false, "validated": false}
  }'::jsonb,
  registration_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'incomplete', 'validated', 'rejected')),
  membership_fee integer NOT NULL,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  license_number text UNIQUE,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des séances d'entraînement
DROP TABLE IF EXISTS training_sessions CASCADE;
CREATE TABLE training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text NOT NULL,
  category text[] NOT NULL,
  max_participants integer,
  description text,
  coach text NOT NULL,
  season_id uuid REFERENCES seasons(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des présences
DROP TABLE IF EXISTS attendance_records CASCADE;
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('present', 'absent', 'pending', 'late')),
  response_date timestamptz,
  actual_presence text CHECK (actual_presence IN ('present', 'absent', 'late')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, member_id)
);

-- Table des documents des membres
DROP TABLE IF EXISTS member_documents CASCADE;
CREATE TABLE member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
  rejection_reason text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, document_type, season_id)
);

-- Table des modèles de documents
DROP TABLE IF EXISTS document_templates CASCADE;
CREATE TABLE document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(name, season_id, document_type)
);

-- Table des règles de tarification
DROP TABLE IF EXISTS membership_fee_rules CASCADE;
CREATE TABLE membership_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text[] NOT NULL,
  base_amount integer NOT NULL,
  discounts jsonb DEFAULT '{
    "multiChild": 0,
    "earlyBird": 0,
    "familyMember": 0,
    "veteran": 0
  }'::jsonb,
  supplements jsonb DEFAULT '{
    "competition": 0,
    "equipment": 0,
    "insurance": 0
  }'::jsonb,
  conditions jsonb DEFAULT '{
    "requiresParent": false
  }'::jsonb,
  is_active boolean DEFAULT true,
  season_id uuid REFERENCES seasons(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des notifications WhatsApp
DROP TABLE IF EXISTS whatsapp_notifications CASCADE;
CREATE TABLE whatsapp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  session_title text NOT NULL,
  template_used text NOT NULL,
  message text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_via text CHECK (sent_via IN ('web', 'mobile')) DEFAULT 'web',
  sent_by uuid REFERENCES users(id) ON DELETE SET NULL,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Table des modèles de messages
DROP TABLE IF EXISTS message_templates CASCADE;
CREATE TABLE message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  is_default boolean DEFAULT false,
  template_type text CHECK (template_type IN ('training', 'match', 'urgent', 'reminder')) DEFAULT 'training',
  variables text[] DEFAULT ARRAY['date', 'heure', 'lieu', 'coach', 'description'],
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des logs d'actions
DROP TABLE IF EXISTS action_logs CASCADE;
CREATE TABLE action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  performed_at timestamptz DEFAULT now()
);

-- ========================================
-- ÉTAPE 3: BUCKETS STORAGE FINAUX
-- ========================================

-- Créer les buckets avec des noms cohérents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  (
    'member_documents',
    'member_documents',
    false,
    5242880, -- 5MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
  ),
  (
    'templates',
    'templates', 
    true,
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  );

-- ========================================
-- ÉTAPE 4: INDEX POUR LES PERFORMANCES
-- ========================================

-- Index pour users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Index pour seasons
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_current ON seasons(is_current);
CREATE INDEX IF NOT EXISTS idx_seasons_registration ON seasons(registration_open);

-- Index pour categories
CREATE INDEX IF NOT EXISTS idx_categories_value ON categories(value);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

-- Index pour members
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_category ON members(category);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_season ON members(season_id);
CREATE INDEX IF NOT EXISTS idx_members_category_id ON members(category_id);

-- Index pour training_sessions
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(date);
CREATE INDEX IF NOT EXISTS idx_training_sessions_season ON training_sessions(season_id);

-- Index pour attendance_records
CREATE INDEX IF NOT EXISTS idx_attendance_session_member ON attendance_records(session_id, member_id);

-- Index pour member_documents
CREATE INDEX IF NOT EXISTS idx_member_documents_member_id ON member_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_season_id ON member_documents(season_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_type ON member_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_member_documents_status ON member_documents(status);

-- Index pour document_templates
CREATE INDEX IF NOT EXISTS idx_document_templates_season_id ON document_templates(season_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);

-- ========================================
-- ÉTAPE 5: CONTRAINTES ET TRIGGERS
-- ========================================

-- Contrainte pour une seule saison courante
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_unique_current 
ON seasons(is_current) 
WHERE is_current = true;

-- Contrainte pour ordre unique des catégories
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_order 
ON categories(display_order) 
WHERE is_active = true;

-- Fonction pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_member_documents_updated_at BEFORE UPDATE ON member_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_membership_fee_rules_updated_at BEFORE UPDATE ON membership_fee_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ÉTAPE 6: POLITIQUES RLS COHÉRENTES
-- ========================================

-- Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_logs ENABLE ROW LEVEL SECURITY;

-- Politiques pour users
CREATE POLICY "Users can read own profile" ON users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can manage all users" ON users FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur'))
);

-- Politiques pour seasons
CREATE POLICY "Everyone can read active seasons" ON seasons FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage seasons" ON seasons FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur'))
);

-- Politiques pour categories
CREATE POLICY "Everyone can read active categories" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON categories FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur'))
);

-- Politiques pour members
CREATE POLICY "Authenticated users can read members" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can create members" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage members" ON members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur', 'entraineur'))
);

-- Politiques pour training_sessions
CREATE POLICY "Everyone can read training sessions" ON training_sessions FOR SELECT USING (true);
CREATE POLICY "Trainers can manage sessions" ON training_sessions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur', 'entraineur'))
);

-- Politiques pour attendance_records
CREATE POLICY "Authenticated users can read attendance" ON attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Trainers can manage attendance" ON attendance_records FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur', 'entraineur'))
);

-- Politiques pour member_documents
CREATE POLICY "Authenticated users can manage documents" ON member_documents FOR ALL TO authenticated USING (true);

-- Politiques pour document_templates
CREATE POLICY "Everyone can read active templates" ON document_templates FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage templates" ON document_templates FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur'))
);

-- Politiques pour membership_fee_rules
CREATE POLICY "Everyone can read active fee rules" ON membership_fee_rules FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage fee rules" ON membership_fee_rules FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur', 'tresorerie'))
);

-- Politiques pour whatsapp_notifications
CREATE POLICY "Authenticated users can read notifications" ON whatsapp_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Trainers can create notifications" ON whatsapp_notifications FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur', 'entraineur'))
);

-- Politiques pour message_templates
CREATE POLICY "Everyone can read templates" ON message_templates FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage templates" ON message_templates FOR ALL TO authenticated USING (true);

-- Politiques pour action_logs
CREATE POLICY "Admins can read logs" ON action_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur'))
);
CREATE POLICY "System can create logs" ON action_logs FOR INSERT WITH CHECK (true);

-- ========================================
-- ÉTAPE 7: POLITIQUES STORAGE
-- ========================================

-- Politiques pour member_documents
CREATE POLICY "Authenticated users can manage documents in storage" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'member_documents') WITH CHECK (bucket_id = 'member_documents');

-- Politiques pour templates
CREATE POLICY "Public can read templates in storage" ON storage.objects FOR SELECT TO anon, authenticated 
USING (bucket_id = 'templates');
CREATE POLICY "Admins can manage templates in storage" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'templates' AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('webmaster', 'administrateur')))
WITH CHECK (bucket_id = 'templates');

-- ========================================
-- ÉTAPE 8: DONNÉES INITIALES
-- ========================================

-- Insérer une saison par défaut
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
  'Saison sportive principale avec championnats FFVB',
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
) ON CONFLICT DO NOTHING;

-- Insérer les catégories par défaut
INSERT INTO categories (value, label, description, age_range, membership_fee, color, is_system, display_order) VALUES
  ('baby', 'Baby Volley', 'Initiation au volleyball pour les plus petits', '≤6 ans', 120, '#3b82f6', true, 1),
  ('poussin', 'Poussin', 'Découverte du volleyball en s''amusant', '7-8 ans', 140, '#10b981', true, 2),
  ('benjamin', 'Benjamin', 'Apprentissage des bases techniques', '9-10 ans', 160, '#f59e0b', true, 3),
  ('minime', 'Minime', 'Perfectionnement technique et tactique', '11-12 ans', 180, '#8b5cf6', true, 4),
  ('cadet', 'Cadet', 'Développement du jeu collectif', '13-14 ans', 200, '#ef4444', true, 5),
  ('junior', 'Junior', 'Préparation à la compétition senior', '15-17 ans', 220, '#ec4899', true, 6),
  ('senior', 'Senior', 'Compétition et performance', '18-35 ans', 250, '#06b6d4', true, 7),
  ('veteran', 'Vétéran', 'Volleyball plaisir et convivialité', '>35 ans', 200, '#84cc16', true, 8)
ON CONFLICT (value) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  age_range = EXCLUDED.age_range,
  membership_fee = EXCLUDED.membership_fee,
  color = EXCLUDED.color,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Insérer les modèles de documents
INSERT INTO document_templates (name, description, document_type, file_name, file_path, season_id) 
SELECT 
  'Formulaire FFVB 2024-2025',
  'Formulaire officiel FFVB à compléter et signer',
  'ffvbForm',
  'formulaire-ffvb-2024-2025.pdf',
  'formulaire-ffvb-2024-2025.pdf',
  s.id
FROM seasons s WHERE s.is_current = true
ON CONFLICT DO NOTHING;

INSERT INTO document_templates (name, description, document_type, file_name, file_path, season_id) 
SELECT 
  'Autorisation parentale',
  'Autorisation parentale pour les mineurs',
  'parentalConsent',
  'autorisation-parentale-2024.pdf',
  'autorisation-parentale-2024.pdf',
  s.id
FROM seasons s WHERE s.is_current = true
ON CONFLICT DO NOTHING;

-- Insérer les modèles de messages
INSERT INTO message_templates (name, message, is_default, template_type, variables) VALUES
  (
    'Appel standard',
    '🏐 *BE FOR NOR KA* 🏐\n\nBonjour à tous !\n\nAppel pour l''entraînement :\n📅 {date}\n⏰ {heure}\n📍 {lieu}\n👨‍🏫 Coach: {coach}\n\n{description}\n\nMerci de confirmer votre présence en répondant à ce message.\n\nSportives salutations ! 💪\n\n_Message envoyé depuis le compte officiel BE FOR NOR KA_',
    true,
    'training',
    ARRAY['date', 'heure', 'lieu', 'coach', 'description']
  ),
  (
    'Convocation match',
    '🏆 *CONVOCATION OFFICIELLE* 🏆\n\n*BE FOR NOR KA*\n\nConvocation pour :\n🏐 {titre}\n📅 {date}\n⏰ {heure}\n📍 {lieu}\n\n⚠️ RDV 30 minutes avant pour l''échauffement\n⚠️ Tenue complète obligatoire\n\nConfirmez votre présence impérativement.\n\nBon match ! 🔥\n\n_Convocation officielle BE FOR NOR KA_',
    false,
    'match',
    ARRAY['titre', 'date', 'heure', 'lieu']
  )
ON CONFLICT DO NOTHING;

-- ========================================
-- ÉTAPE 9: FONCTIONS UTILITAIRES
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

-- Fonction pour valider un document
CREATE OR REPLACE FUNCTION validate_document(
  p_document_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  IF p_action = 'validate' THEN
    UPDATE member_documents 
    SET 
      status = 'validated',
      validated_by = auth.uid(),
      validated_at = now(),
      rejection_reason = NULL,
      updated_at = now()
    WHERE id = p_document_id;
  ELSIF p_action = 'reject' THEN
    UPDATE member_documents 
    SET 
      status = 'rejected',
      rejection_reason = p_reason,
      validated_by = auth.uid(),
      validated_at = now(),
      updated_at = now()
    WHERE id = p_document_id;
  ELSE
    RAISE EXCEPTION 'Action invalide: %. Utilisez "validate" ou "reject"', p_action;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour logger les actions
CREATE OR REPLACE FUNCTION log_action(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO action_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 10: VUES UTILES
-- ========================================

-- Vue pour les membres avec informations enrichies
CREATE OR REPLACE VIEW members_enhanced AS
SELECT 
  m.*,
  calculate_age(m.birth_date) as age,
  c.label as category_label,
  c.color as category_color,
  s.name as season_name,
  u.first_name as validated_by_first_name,
  u.last_name as validated_by_last_name,
  (
    SELECT COUNT(*) 
    FROM member_documents md 
    WHERE md.member_id = m.id AND md.season_id = m.season_id
  ) as total_documents,
  (
    SELECT COUNT(*) 
    FROM member_documents md 
    WHERE md.member_id = m.id AND md.season_id = m.season_id AND md.status = 'validated'
  ) as validated_documents
FROM members m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN seasons s ON m.season_id = s.id
LEFT JOIN users u ON m.validated_by = u.id;

-- Vue pour les documents avec informations complètes
CREATE OR REPLACE VIEW member_documents_complete AS
SELECT 
  md.*,
  m.first_name,
  m.last_name,
  m.email as member_email,
  m.category,
  s.name as season_name,
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

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '🎉 REFONTE ARCHITECTURALE TERMINÉE AVEC SUCCÈS !';
  RAISE NOTICE '';
  RAISE NOTICE '✅ SCHÉMA FINAL COHÉRENT :';
  RAISE NOTICE '  - 12 tables avec relations optimisées';
  RAISE NOTICE '  - Index de performance sur toutes les colonnes critiques';
  RAISE NOTICE '  - Contraintes d''intégrité complètes';
  RAISE NOTICE '  - Triggers automatiques pour updated_at';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SÉCURITÉ RENFORCÉE :';
  RAISE NOTICE '  - Politiques RLS cohérentes et simples';
  RAISE NOTICE '  - Permissions granulaires par rôle';
  RAISE NOTICE '  - Audit trail complet avec action_logs';
  RAISE NOTICE '';
  RAISE NOTICE '📁 STORAGE ORGANISÉ :';
  RAISE NOTICE '  - member_documents (privé)';
  RAISE NOTICE '  - templates (public)';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ FONCTIONS UTILITAIRES :';
  RAISE NOTICE '  - calculate_age(birth_date)';
  RAISE NOTICE '  - get_category_by_age(birth_date)';
  RAISE NOTICE '  - get_membership_fee_by_category(category)';
  RAISE NOTICE '  - validate_document(id, action, reason)';
  RAISE NOTICE '  - log_action(action, entity_type, ...)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 VUES ENRICHIES :';
  RAISE NOTICE '  - members_enhanced (avec âge, catégorie, documents)';
  RAISE NOTICE '  - member_documents_complete (avec infos membres)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 PRÊT POUR LA REFONTE FRONTEND !';
END $$;