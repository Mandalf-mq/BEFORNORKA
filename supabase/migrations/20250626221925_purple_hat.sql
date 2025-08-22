/*
  # Schéma initial pour l'application de gestion d'association de volleyball

  1. Nouvelles tables
    - `members` - Stockage des informations des membres
    - `training_sessions` - Stockage des séances d'entraînement
    - `attendance_records` - Stockage des présences aux entraînements

  2. Sécurité
    - Activation de RLS sur toutes les tables
    - Politiques pour les utilisateurs authentifiés
*/

-- Table des membres
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  category text NOT NULL CHECK (category IN ('baby', 'poussin', 'benjamin', 'minime', 'cadet', 'junior', 'senior', 'veteran')),
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des séances d'entraînement
CREATE TABLE IF NOT EXISTS training_sessions (
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des présences
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('present', 'absent', 'pending')),
  response_date timestamptz,
  actual_presence text CHECK (actual_presence IN ('present', 'absent', 'late')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, member_id)
);

-- Activation de RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les membres
CREATE POLICY "Tous peuvent lire les membres validés"
  ON members
  FOR SELECT
  USING (status = 'validated');

CREATE POLICY "Utilisateurs authentifiés peuvent gérer les membres"
  ON members
  FOR ALL
  TO authenticated
  USING (true);

-- Politiques RLS pour les séances d'entraînement
CREATE POLICY "Tous peuvent lire les séances"
  ON training_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent gérer les séances"
  ON training_sessions
  FOR ALL
  TO authenticated
  USING (true);

-- Politiques RLS pour les présences
CREATE POLICY "Utilisateurs peuvent voir leurs propres présences"
  ON attendance_records
  FOR SELECT
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent gérer les présences"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (true);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_category ON members(category);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(date);
CREATE INDEX IF NOT EXISTS idx_attendance_session_member ON attendance_records(session_id, member_id);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_sessions_updated_at BEFORE UPDATE ON training_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();