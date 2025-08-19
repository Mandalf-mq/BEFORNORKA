/*
  # Ajout des tables manquantes pour les nouvelles fonctionnalités

  1. Nouvelles tables
    - `users` - Comptes administrateurs avec rôles
    - `seasons` - Gestion des saisons sportives
    - `membership_fee_rules` - Configuration des tarifs de cotisation
    - `whatsapp_notifications` - Historique des notifications WhatsApp
    - `user_sessions` - Sessions utilisateur pour l'authentification

  2. Sécurité
    - Activation de RLS sur toutes les nouvelles tables
    - Politiques d'accès appropriées pour chaque table
    - Contraintes de données pour assurer l'intégrité

  3. Modifications
    - Ajout de colonnes manquantes aux tables existantes
    - Index pour améliorer les performances
    - Triggers pour la mise à jour automatique des timestamps
*/

-- Table des utilisateurs administrateurs
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('webmaster', 'administrateur', 'tresorerie', 'entraineur')),
  is_active boolean DEFAULT true,
  password_hash text,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des saisons sportives
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  registration_start_date date NOT NULL,
  registration_end_date date NOT NULL,
  is_active boolean DEFAULT false,
  is_current boolean DEFAULT false,
  registration_open boolean DEFAULT false,
  description text,
  max_members integer DEFAULT 150,
  membership_fees jsonb DEFAULT '{}'::jsonb,
  required_documents text[] DEFAULT ARRAY['ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des règles de tarification
CREATE TABLE IF NOT EXISTS membership_fee_rules (
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
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
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

-- Table des réponses aux notifications
CREATE TABLE IF NOT EXISTS notification_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES whatsapp_notifications(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  response text CHECK (response IN ('present', 'absent', 'maybe')) NOT NULL,
  response_date timestamptz DEFAULT now(),
  actual_attendance text CHECK (actual_attendance IN ('present', 'absent', 'late')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, member_id)
);

-- Table des modèles de messages WhatsApp
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  is_default boolean DEFAULT false,
  template_type text CHECK (template_type IN ('training', 'match', 'urgent', 'reminder')) DEFAULT 'training',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des sessions utilisateur (pour l'authentification)
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Ajout de colonnes manquantes aux tables existantes
DO $$
BEGIN
  -- Ajouter season_id aux membres si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'season_id'
  ) THEN
    ALTER TABLE members ADD COLUMN season_id uuid REFERENCES seasons(id) ON DELETE SET NULL;
  END IF;

  -- Ajouter created_by aux séances d'entraînement
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_sessions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE training_sessions ADD COLUMN created_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Ajouter des champs supplémentaires aux membres
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'validated_by'
  ) THEN
    ALTER TABLE members ADD COLUMN validated_by uuid REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE members ADD COLUMN validated_at timestamptz;
    ALTER TABLE members ADD COLUMN notes text;
  END IF;
END $$;

-- Activation de RLS sur toutes les nouvelles tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les utilisateurs
CREATE POLICY "Utilisateurs peuvent voir leur propre profil"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Webmasters peuvent gérer tous les utilisateurs"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'webmaster'
    )
  );

-- Politiques RLS pour les saisons
CREATE POLICY "Tous peuvent lire les saisons actives"
  ON seasons
  FOR SELECT
  USING (is_active = true OR registration_open = true);

CREATE POLICY "Administrateurs peuvent gérer les saisons"
  ON seasons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('webmaster', 'administrateur')
    )
  );

-- Politiques RLS pour les règles de tarification
CREATE POLICY "Tous peuvent lire les règles actives"
  ON membership_fee_rules
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Trésorerie peut gérer les règles de tarification"
  ON membership_fee_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role IN ('webmaster', 'administrateur', 'tresorerie')
    )
  );

-- Politiques RLS pour les notifications WhatsApp
CREATE POLICY "Utilisateurs peuvent voir les notifications"
  ON whatsapp_notifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des notifications"
  ON whatsapp_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (sent_by::text = auth.uid()::text);

-- Politiques RLS pour les réponses aux notifications
CREATE POLICY "Utilisateurs peuvent voir toutes les réponses"
  ON notification_responses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent gérer les réponses"
  ON notification_responses
  FOR ALL
  TO authenticated
  USING (true);

-- Politiques RLS pour les modèles de messages
CREATE POLICY "Tous peuvent lire les modèles"
  ON message_templates
  FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent gérer les modèles"
  ON message_templates
  FOR ALL
  TO authenticated
  USING (true);

-- Politiques RLS pour les sessions utilisateur
CREATE POLICY "Utilisateurs peuvent voir leurs propres sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id::text = auth.uid()::text);

CREATE POLICY "Utilisateurs peuvent gérer leurs propres sessions"
  ON user_sessions
  FOR ALL
  TO authenticated
  USING (user_id::text = auth.uid()::text);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_current ON seasons(is_current);
CREATE INDEX IF NOT EXISTS idx_seasons_registration ON seasons(registration_open);

CREATE INDEX IF NOT EXISTS idx_fee_rules_active ON membership_fee_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_fee_rules_season ON membership_fee_rules(season_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_session ON whatsapp_notifications(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sent_by ON whatsapp_notifications(sent_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sent_at ON whatsapp_notifications(sent_at);

CREATE INDEX IF NOT EXISTS idx_responses_notification ON notification_responses(notification_id);
CREATE INDEX IF NOT EXISTS idx_responses_member ON notification_responses(member_id);

CREATE INDEX IF NOT EXISTS idx_templates_type ON message_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_default ON message_templates(is_default);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_members_season ON members(season_id);
CREATE INDEX IF NOT EXISTS idx_members_validated_by ON members(validated_by);

-- Triggers pour updated_at sur les nouvelles tables
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seasons_updated_at 
  BEFORE UPDATE ON seasons 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_rules_updated_at 
  BEFORE UPDATE ON membership_fee_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responses_updated_at 
  BEFORE UPDATE ON notification_responses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at 
  BEFORE UPDATE ON message_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion de données de démonstration

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
    "benjamin": 160,
    "minime": 180,
    "cadet": 200,
    "junior": 220,
    "senior": 250,
    "veteran": 200
  }'::jsonb
) ON CONFLICT DO NOTHING;

-- Insérer des utilisateurs de démonstration
INSERT INTO users (email, first_name, last_name, role, password_hash) VALUES
  ('webmaster@befornorka.fr', 'Web', 'Master', 'webmaster', '$2a$10$dummy.hash.for.demo'),
  ('admin@befornorka.fr', 'Admin', 'Principal', 'administrateur', '$2a$10$dummy.hash.for.demo'),
  ('tresorier@befornorka.fr', 'Jean', 'Martin', 'tresorerie', '$2a$10$dummy.hash.for.demo'),
  ('coach@befornorka.fr', 'Sophie', 'Bernard', 'entraineur', '$2a$10$dummy.hash.for.demo')
ON CONFLICT (email) DO NOTHING;

-- Insérer des modèles de messages par défaut
INSERT INTO message_templates (name, message, is_default, template_type) VALUES
  (
    'Appel standard',
    '🏐 *BE FOR NOR KA* 🏐

Bonjour à tous !

Appel pour l''entraînement :
📅 {date}
⏰ {heure}
📍 {lieu}
👨‍🏫 Coach: {coach}

{description}

Merci de confirmer votre présence en répondant à ce message.

Sportives salutations ! 💪

_Message envoyé depuis le compte officiel BE FOR NOR KA_',
    true,
    'training'
  ),
  (
    'Convocation match',
    '🏆 *CONVOCATION OFFICIELLE* 🏆

*BE FOR NOR KA*

Convocation pour :
🏐 {titre}
📅 {date}
⏰ {heure}
📍 {lieu}

⚠️ RDV 30 minutes avant pour l''échauffement
⚠️ Tenue complète obligatoire

Confirmez votre présence impérativement.

Bon match ! 🔥

_Convocation officielle BE FOR NOR KA_',
    false,
    'match'
  ),
  (
    'Appel urgent',
    '🚨 *URGENT - BE FOR NOR KA* 🚨

ATTENTION : Changement de dernière minute !

🏐 {titre}
📅 {date}
⏰ {heure}
📍 {lieu}

Merci de confirmer votre présence RAPIDEMENT !

_Message urgent du club BE FOR NOR KA_',
    false,
    'urgent'
  )
ON CONFLICT DO NOTHING;

-- Fonction pour nettoyer les sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Fonction pour s'assurer qu'une seule saison peut être courante
CREATE OR REPLACE FUNCTION ensure_single_current_season()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE seasons SET is_current = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_current_season_trigger
  BEFORE INSERT OR UPDATE ON seasons
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION ensure_single_current_season();

-- Fonction pour mettre à jour automatiquement les frais de cotisation des membres
CREATE OR REPLACE FUNCTION update_member_fees_from_season()
RETURNS TRIGGER AS $$
DECLARE
  season_fees jsonb;
  member_category text;
  calculated_fee integer;
BEGIN
  -- Récupérer les tarifs de la saison courante
  SELECT membership_fees INTO season_fees
  FROM seasons 
  WHERE is_current = true 
  LIMIT 1;
  
  -- Si on a des tarifs et une catégorie pour le membre
  IF season_fees IS NOT NULL AND NEW.category IS NOT NULL THEN
    calculated_fee := (season_fees ->> NEW.category)::integer;
    
    -- Mettre à jour le tarif si trouvé
    IF calculated_fee IS NOT NULL THEN
      NEW.membership_fee := calculated_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_member_fees_trigger
  BEFORE INSERT OR UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_member_fees_from_season();