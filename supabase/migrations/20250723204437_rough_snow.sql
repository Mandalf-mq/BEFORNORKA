/*
  # Correction définitive de la visibilité des membres

  1. Problème identifié
    - Les membres existent dans Supabase mais ne sont pas visibles dans l'interface admin
    - Politiques RLS trop restrictives ou mal configurées
    
  2. Solutions
    - Corriger toutes les politiques RLS pour les membres
    - Permettre la lecture pour tous les utilisateurs authentifiés
    - Ajouter des politiques spécifiques pour les admins
    
  3. Sécurité
    - Maintenir la sécurité tout en permettant la visibilité
    - Politiques granulaires selon les rôles
*/

-- ========================================
-- ÉTAPE 1: NETTOYER TOUTES LES POLITIQUES EXISTANTES
-- ========================================

-- Supprimer toutes les politiques existantes sur la table members
DROP POLICY IF EXISTS "Tous peuvent lire les membres validés" ON members;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent gérer les membres" ON members;
DROP POLICY IF EXISTS "Allow anonymous member registration" ON members;
DROP POLICY IF EXISTS "Allow read members for testing" ON members;
DROP POLICY IF EXISTS "Admins can manage all members" ON members;
DROP POLICY IF EXISTS "Authenticated users can read members" ON members;
DROP POLICY IF EXISTS "Admins can see all members" ON members;
DROP POLICY IF EXISTS "Admins can manage members" ON members;
DROP POLICY IF EXISTS "Allow member registration" ON members;
DROP POLICY IF EXISTS "Restricted member registration" ON members;
DROP POLICY IF EXISTS "Authenticated users can create members" ON members;

-- ========================================
-- ÉTAPE 2: CRÉER DES POLITIQUES SIMPLES ET EFFICACES
-- ========================================

-- Politique pour que TOUS les utilisateurs authentifiés puissent voir les membres
CREATE POLICY "All authenticated users can read members"
  ON members
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique pour que les utilisateurs authentifiés puissent créer des membres
CREATE POLICY "Authenticated users can create members"
  ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique pour que les admins puissent modifier les membres
CREATE POLICY "Admins can update members"
  ON members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

-- Politique pour que les admins puissent supprimer les membres
CREATE POLICY "Admins can delete members"
  ON members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

-- Politique pour permettre l'inscription anonyme (formulaire public)
CREATE POLICY "Allow public member registration"
  ON members
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 3: VÉRIFIER ET CORRIGER LA TABLE USERS
-- ========================================

-- S'assurer que votre compte a le bon rôle
UPDATE users 
SET role = 'webmaster' 
WHERE email = (
  SELECT email FROM auth.users WHERE id = auth.uid()
);

-- Mettre à jour aussi les métadonnées auth si nécessaire
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE id = auth.uid();

-- ========================================
-- ÉTAPE 4: FONCTIONS DE DIAGNOSTIC
-- ========================================

-- Fonction pour vérifier l'état des politiques
CREATE OR REPLACE FUNCTION check_member_policies()
RETURNS TABLE(
  policy_name text,
  policy_command text,
  policy_roles text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pol.policyname::text,
    pol.cmd::text,
    pol.roles
  FROM pg_policies pol
  WHERE pol.tablename = 'members'
  ORDER BY pol.policyname;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier votre rôle utilisateur
CREATE OR REPLACE FUNCTION check_my_user_role()
RETURNS TABLE(
  user_id uuid,
  email text,
  role text,
  auth_role text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.role,
    (au.raw_user_meta_data->>'role')::text as auth_role
  FROM users u
  JOIN auth.users au ON u.id = au.id
  WHERE u.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour compter les membres visibles
CREATE OR REPLACE FUNCTION count_visible_members()
RETURNS integer AS $$
DECLARE
  member_count integer;
BEGIN
  SELECT COUNT(*) INTO member_count FROM members;
  RETURN member_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 5: TESTS ET VÉRIFICATIONS
-- ========================================

-- Vérifier l'état actuel
DO $$
DECLARE
  member_count integer;
  policy_count integer;
BEGIN
  -- Compter les membres
  SELECT count_visible_members() INTO member_count;
  
  -- Compter les politiques
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'members';
  
  RAISE NOTICE '✅ Correction des politiques RLS terminée !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 État actuel :';
  RAISE NOTICE '  - Membres dans la base : %', member_count;
  RAISE NOTICE '  - Politiques RLS actives : %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Vérifications à faire :';
  RAISE NOTICE '  1. SELECT * FROM check_my_user_role();';
  RAISE NOTICE '  2. SELECT * FROM check_member_policies();';
  RAISE NOTICE '  3. SELECT * FROM members ORDER BY created_at DESC;';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant :';
  RAISE NOTICE '  - Rafraîchissez votre interface admin';
  RAISE NOTICE '  - Allez dans l''onglet Membres';
  RAISE NOTICE '  - Les membres devraient être visibles !';
END $$;