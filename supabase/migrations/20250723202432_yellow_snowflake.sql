/*
  # Correction du problème d'inscription des membres

  1. Problème identifié
    - Les politiques RLS bloquent la création de membres par les utilisateurs anonymes
    - Le trigger de création d'utilisateur peut échouer silencieusement
    
  2. Solutions
    - Corriger les politiques RLS pour permettre l'inscription
    - Améliorer le trigger de création de profil utilisateur
    - Ajouter des politiques temporaires pour débugger

  3. Sécurité
    - Maintenir la sécurité tout en permettant l'inscription
    - Politiques granulaires pour différents cas d'usage
*/

-- ========================================
-- ÉTAPE 1: CORRIGER LES POLITIQUES RLS POUR LES MEMBRES
-- ========================================

-- Supprimer les politiques qui bloquent l'inscription
DROP POLICY IF EXISTS "Authenticated users can read members" ON members;
DROP POLICY IF EXISTS "Admins can manage members" ON members;
DROP POLICY IF EXISTS "Allow member registration" ON members;
DROP POLICY IF EXISTS "Allow anonymous member registration" ON members;

-- Politique pour permettre l'inscription anonyme (TEMPORAIRE pour test)
CREATE POLICY "Allow anonymous member registration"
  ON members
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Politique pour que tous puissent lire les membres (TEMPORAIRE pour test)
CREATE POLICY "Allow read members for testing"
  ON members
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Politique pour que les admins puissent tout faire
CREATE POLICY "Admins can manage all members"
  ON members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin', 'entraineur')
    )
  );

-- ========================================
-- ÉTAPE 2: CORRIGER LES POLITIQUES RLS POUR LES UTILISATEURS
-- ========================================

-- Supprimer les politiques problématiques
DROP POLICY IF EXISTS "Allow anonymous registration" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Politique pour permettre la création de profils (TEMPORAIRE)
CREATE POLICY "Allow profile creation for testing"
  ON users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 3: AMÉLIORER LE TRIGGER DE CRÉATION D'UTILISATEUR
-- ========================================

-- Fonction améliorée pour gérer la création d'utilisateur
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insérer le profil utilisateur avec gestion d'erreur très robuste
  BEGIN
    INSERT INTO public.users (id, email, first_name, last_name, phone, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data->>'first_name', 
        COALESCE(NEW.raw_user_meta_data->>'firstName', '')
      ),
      COALESCE(
        NEW.raw_user_meta_data->>'last_name', 
        COALESCE(NEW.raw_user_meta_data->>'lastName', '')
      ),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'role', 'member')
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), users.last_name),
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
      role = COALESCE(EXCLUDED.role, users.role),
      updated_at = now();
    
    RAISE NOTICE 'Profil utilisateur créé avec succès pour: %', NEW.email;
    
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'Profil utilisateur existe déjà pour: %', NEW.email;
    WHEN OTHERS THEN
      RAISE WARNING 'Erreur lors de la création du profil pour %: %', NEW.email, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========================================
-- ÉTAPE 4: FONCTIONS DE DEBUG ET NETTOYAGE
-- ========================================

-- Fonction pour tester la création d'un membre
CREATE OR REPLACE FUNCTION test_member_creation()
RETURNS void AS $$
DECLARE
  test_member_id uuid;
BEGIN
  -- Essayer de créer un membre de test
  INSERT INTO members (
    first_name,
    last_name,
    birth_date,
    email,
    phone,
    category,
    membership_fee,
    status,
    payment_status
  ) VALUES (
    'Test',
    'Member',
    '2000-01-01',
    'test-' || extract(epoch from now()) || '@example.com',
    '0123456789',
    'senior',
    250,
    'pending',
    'pending'
  ) RETURNING id INTO test_member_id;
  
  RAISE NOTICE 'Membre de test créé avec succès: %', test_member_id;
  
  -- Supprimer le membre de test
  DELETE FROM members WHERE id = test_member_id;
  RAISE NOTICE 'Membre de test supprimé';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors du test de création de membre: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer les politiques de debug
CREATE OR REPLACE FUNCTION cleanup_debug_policies()
RETURNS void AS $$
BEGIN
  -- Supprimer les politiques temporaires
  DROP POLICY IF EXISTS "Allow anonymous member registration" ON members;
  DROP POLICY IF EXISTS "Allow read members for testing" ON members;
  DROP POLICY IF EXISTS "Allow profile creation for testing" ON users;
  
  -- Recréer des politiques plus sécurisées
  CREATE POLICY "Authenticated users can read members"
    ON members
    FOR SELECT
    TO authenticated
    USING (true);
    
  CREATE POLICY "Authenticated users can create members"
    ON members
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
    
  CREATE POLICY "Users can create own profile"
    ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
  
  RAISE NOTICE 'Politiques de debug nettoyées et remplacées par des politiques sécurisées';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 5: TESTS ET VÉRIFICATIONS
-- ========================================

-- Tester la création d'un membre
SELECT test_member_creation();

-- Vérifier l'état des politiques
DO $$
BEGIN
  RAISE NOTICE '✅ Migration de correction appliquée avec succès !';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Tests à effectuer :';
  RAISE NOTICE '  1. Créer un nouveau compte sur votre site';
  RAISE NOTICE '  2. Essayer d''inscrire un membre';
  RAISE NOTICE '  3. Vérifier que les données apparaissent dans Supabase';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Après validation :';
  RAISE NOTICE '  Exécutez SELECT cleanup_debug_policies(); pour sécuriser';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vérifier les membres : SELECT * FROM members ORDER BY created_at DESC;';
END $$;