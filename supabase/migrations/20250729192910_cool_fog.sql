/*
  # Vérification et création de la table seasons

  1. Vérification de l'existence de la table seasons
  2. Création si elle n'existe pas
  3. Insertion d'une saison par défaut
  4. Configuration des politiques RLS
*/

-- ========================================
-- ÉTAPE 1: CRÉER LA TABLE SEASONS SI ELLE N'EXISTE PAS
-- ========================================

CREATE TABLE IF NOT EXISTS seasons (
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

-- ========================================
-- ÉTAPE 2: ACTIVER RLS ET CRÉER LES POLITIQUES
-- ========================================

-- Activer RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Everyone can read active seasons" ON seasons;
DROP POLICY IF EXISTS "Admins can manage seasons" ON seasons;

-- Politique pour que tout le monde puisse lire les saisons actives
CREATE POLICY "Everyone can read active seasons" 
  ON seasons 
  FOR SELECT 
  USING (is_active = true);

-- Politique pour que les admins puissent gérer les saisons
CREATE POLICY "Admins can manage seasons" 
  ON seasons 
  FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur')
    )
  );

-- ========================================
-- ÉTAPE 3: CONTRAINTES ET INDEX
-- ========================================

-- Contrainte pour une seule saison courante
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_unique_current 
ON seasons(is_current) 
WHERE is_current = true;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_registration ON seasons(registration_open);
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons(start_date, end_date);

-- ========================================
-- ÉTAPE 4: TRIGGER POUR UPDATED_AT
-- ========================================

-- Fonction pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_seasons_updated_at ON seasons;
CREATE TRIGGER update_seasons_updated_at 
  BEFORE UPDATE ON seasons 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ÉTAPE 5: INSÉRER UNE SAISON PAR DÉFAUT
-- ========================================

-- Insérer une saison par défaut si aucune saison n'existe
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
) 
SELECT 
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
WHERE NOT EXISTS (SELECT 1 FROM seasons);

-- ========================================
-- ÉTAPE 6: FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour s'assurer qu'une seule saison est courante
CREATE OR REPLACE FUNCTION ensure_single_current_season()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE seasons SET is_current = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour une seule saison courante
DROP TRIGGER IF EXISTS ensure_single_current_season_trigger ON seasons;
CREATE TRIGGER ensure_single_current_season_trigger
  BEFORE INSERT OR UPDATE ON seasons
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION ensure_single_current_season();

-- ========================================
-- ÉTAPE 7: FONCTION DE VÉRIFICATION
-- ========================================

-- Fonction pour vérifier l'état de la table seasons
CREATE OR REPLACE FUNCTION check_seasons_table()
RETURNS TABLE(
  table_exists boolean,
  season_count bigint,
  current_season_name text,
  has_policies boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'seasons') as table_exists,
    (SELECT COUNT(*) FROM seasons) as season_count,
    (SELECT name FROM seasons WHERE is_current = true LIMIT 1) as current_season_name,
    EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'seasons') as has_policies;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
DECLARE
  season_count integer;
  current_season_name text;
BEGIN
  -- Compter les saisons
  SELECT COUNT(*) INTO season_count FROM seasons;
  
  -- Récupérer la saison courante
  SELECT name INTO current_season_name FROM seasons WHERE is_current = true LIMIT 1;
  
  RAISE NOTICE '✅ TABLE SEASONS VÉRIFIÉE ET CONFIGURÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 État actuel :';
  RAISE NOTICE '  - Saisons en base : %', season_count;
  RAISE NOTICE '  - Saison courante : %', COALESCE(current_season_name, 'Aucune');
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sécurité :';
  RAISE NOTICE '  - RLS activé sur la table seasons';
  RAISE NOTICE '  - Politiques pour lecture publique et gestion admin';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test à effectuer :';
  RAISE NOTICE '  SELECT * FROM check_seasons_table();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant :';
  RAISE NOTICE '  - Allez dans l''onglet Saisons de votre app';
  RAISE NOTICE '  - Vous devriez voir la saison 2024-2025';
  RAISE NOTICE '  - L''inscription devrait fonctionner';
END $$;