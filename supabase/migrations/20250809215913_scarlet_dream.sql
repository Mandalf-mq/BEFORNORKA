/*
  # Création de la table club_settings pour les paramètres du club

  1. Table club_settings
    - Stockage des paramètres généraux du club
    - Structure singleton (un seul enregistrement avec id=1)
    - Tous les champs nécessaires pour la configuration

  2. Fonction RPC
    - create_club_settings_table() pour initialiser la table
    - Insertion automatique des valeurs par défaut

  3. Sécurité
    - RLS activé sur la table
    - Politiques pour lecture publique et modification admin
*/

-- ========================================
-- ÉTAPE 1: CRÉATION DE LA TABLE CLUB_SETTINGS
-- ========================================

-- Créer la table club_settings
CREATE TABLE IF NOT EXISTS club_settings (
  id integer PRIMARY KEY DEFAULT 1,
  club_name text DEFAULT 'BE FOR NOR KA',
  club_description text DEFAULT 'Association de volleyball affiliée FFVB',
  contact_email text DEFAULT 'contact@befornorka.fr',
  contact_phone text DEFAULT '01 23 45 67 89',
  address text DEFAULT '123 Rue du Volleyball',
  city text DEFAULT 'Paris',
  postal_code text DEFAULT '75001',
  logo_url text DEFAULT '/logo b4NK.png',
  website_url text DEFAULT 'https://befornorka.fr',
  facebook_url text DEFAULT '',
  instagram_url text DEFAULT '',
  twitter_url text DEFAULT '',
  primary_color text DEFAULT '#ec4899',
  secondary_color text DEFAULT '#22c55e',
  accent_color text DEFAULT '#f59e0b',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT club_settings_singleton CHECK (id = 1)
);

-- ========================================
-- ÉTAPE 2: ACTIVER RLS ET CRÉER LES POLITIQUES
-- ========================================

-- Activer RLS
ALTER TABLE club_settings ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Everyone can read club settings" ON club_settings;
DROP POLICY IF EXISTS "Admins can manage club settings" ON club_settings;

-- Politique pour que tout le monde puisse lire les paramètres du club
CREATE POLICY "Everyone can read club settings"
  ON club_settings
  FOR SELECT
  USING (true);

-- Politique pour que les admins puissent modifier les paramètres
CREATE POLICY "Admins can manage club settings"
  ON club_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur')
    )
  );

-- ========================================
-- ÉTAPE 3: FONCTION RPC POUR INITIALISER LA TABLE
-- ========================================

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS create_club_settings_table();

-- Fonction RPC pour créer la table et insérer les valeurs par défaut
CREATE OR REPLACE FUNCTION create_club_settings_table()
RETURNS jsonb AS $$
DECLARE
  settings_exist boolean;
  result jsonb;
BEGIN
  -- Vérifier si des paramètres existent déjà
  SELECT EXISTS(SELECT 1 FROM club_settings WHERE id = 1) INTO settings_exist;
  
  -- Si aucun paramètre n'existe, insérer les valeurs par défaut
  IF NOT settings_exist THEN
    INSERT INTO club_settings (
      id,
      club_name,
      club_description,
      contact_email,
      contact_phone,
      address,
      city,
      postal_code,
      logo_url,
      website_url,
      primary_color,
      secondary_color,
      accent_color
    ) VALUES (
      1,
      'BE FOR NOR KA',
      'Association de volleyball affiliée FFVB',
      'contact@befornorka.fr',
      '01 23 45 67 89',
      '123 Rue du Volleyball',
      'Paris',
      '75001',
      '/logo b4NK.png',
      'https://befornorka.fr',
      '#ec4899',
      '#22c55e',
      '#f59e0b'
    );
    
    result := jsonb_build_object(
      'success', true,
      'message', 'Table club_settings créée et paramètres par défaut insérés'
    );
  ELSE
    result := jsonb_build_object(
      'success', true,
      'message', 'Table club_settings existe déjà'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 4: TRIGGER POUR UPDATED_AT
-- ========================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_club_settings_updated_at ON club_settings;
CREATE TRIGGER update_club_settings_updated_at 
  BEFORE UPDATE ON club_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ÉTAPE 5: INSÉRER LES PARAMÈTRES PAR DÉFAUT
-- ========================================

-- Insérer les paramètres par défaut si ils n'existent pas
INSERT INTO club_settings (
  id,
  club_name,
  club_description,
  contact_email,
  contact_phone,
  address,
  city,
  postal_code,
  logo_url,
  website_url,
  primary_color,
  secondary_color,
  accent_color
) VALUES (
  1,
  'BE FOR NOR KA',
  'Association de volleyball affiliée FFVB',
  'contact@befornorka.fr',
  '01 23 45 67 89',
  '123 Rue du Volleyball',
  'Paris',
  '75001',
  '/logo b4NK.png',
  'https://befornorka.fr',
  '#ec4899',
  '#22c55e',
  '#f59e0b'
) ON CONFLICT (id) DO NOTHING;

-- ========================================
-- ÉTAPE 6: INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_club_settings_id ON club_settings(id);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ TABLE CLUB_SETTINGS CRÉÉE AVEC SUCCÈS !';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Table créée :';
  RAISE NOTICE '  - club_settings (paramètres généraux du club)';
  RAISE NOTICE '  - Structure singleton (id=1 unique)';
  RAISE NOTICE '  - Tous les champs nécessaires';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sécurité :';
  RAISE NOTICE '  - RLS activé';
  RAISE NOTICE '  - Lecture publique des paramètres';
  RAISE NOTICE '  - Modification réservée aux admins';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonction RPC :';
  RAISE NOTICE '  - create_club_settings_table() disponible';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant les paramètres devraient persister !';
END $$;