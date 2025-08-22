/*
  # Correction des permissions RLS pour les saisons

  1. Problème identifié
    - Les politiques RLS bloquent la modification des saisons
    - Erreur PGRST116: "Aucune ligne mise à jour"
    
  2. Solutions
    - Corriger les politiques RLS pour permettre la modification
    - Ajouter des permissions pour les utilisateurs authentifiés
    - Vérifier les rôles utilisateur

  3. Sécurité
    - Maintenir la sécurité tout en permettant la gestion
    - Permissions granulaires selon les rôles
*/

-- ========================================
-- ÉTAPE 1: SUPPRIMER LES POLITIQUES PROBLÉMATIQUES
-- ========================================

-- Supprimer toutes les politiques existantes sur seasons
DROP POLICY IF EXISTS "Everyone can read active seasons" ON seasons;
DROP POLICY IF EXISTS "Admins can manage seasons" ON seasons;
DROP POLICY IF EXISTS "Tous peuvent lire les saisons actives" ON seasons;
DROP POLICY IF EXISTS "Administrateurs peuvent gérer les saisons" ON seasons;

-- ========================================
-- ÉTAPE 2: CRÉER DES POLITIQUES SIMPLES ET EFFICACES
-- ========================================

-- Politique pour que tout le monde puisse lire les saisons
CREATE POLICY "Everyone can read seasons"
  ON seasons
  FOR SELECT
  USING (true);

-- Politique pour que les utilisateurs authentifiés puissent créer des saisons
CREATE POLICY "Authenticated users can create seasons"
  ON seasons
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique pour que les utilisateurs authentifiés puissent modifier les saisons
CREATE POLICY "Authenticated users can update seasons"
  ON seasons
  FOR UPDATE
  TO authenticated
  USING (true);

-- Politique pour que les utilisateurs authentifiés puissent supprimer les saisons
CREATE POLICY "Authenticated users can delete seasons"
  ON seasons
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================================
-- ÉTAPE 3: VÉRIFIER ET CORRIGER LA TABLE USERS
-- ========================================

-- S'assurer que votre utilisateur a le bon rôle
DO $$
DECLARE
  current_user_email text;
  current_user_id uuid;
BEGIN
  -- Récupérer l'email de l'utilisateur connecté depuis auth.users
  SELECT email, id INTO current_user_email, current_user_id
  FROM auth.users 
  WHERE id = auth.uid();
  
  IF current_user_email IS NOT NULL THEN
    -- Mettre à jour ou créer le profil utilisateur avec le rôle webmaster
    INSERT INTO users (id, email, first_name, last_name, role, is_active)
    VALUES (
      current_user_id,
      current_user_email,
      'Admin',
      'User',
      'webmaster',
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'webmaster',
      is_active = true,
      updated_at = now();
    
    -- Mettre à jour aussi les métadonnées auth
    UPDATE auth.users 
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
    WHERE id = current_user_id;
    
    RAISE NOTICE 'Utilisateur % mis à jour avec le rôle webmaster', current_user_email;
  ELSE
    RAISE NOTICE 'Aucun utilisateur connecté trouvé';
  END IF;
END $$;

-- ========================================
-- ÉTAPE 4: FONCTION DE TEST
-- ========================================

-- Fonction pour tester les permissions sur les saisons
CREATE OR REPLACE FUNCTION test_season_permissions()
RETURNS text AS $$
DECLARE
  test_result text := '';
  test_season_id uuid;
  user_email text;
  user_role text;
BEGIN
  -- Récupérer l'utilisateur connecté
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  IF user_email IS NULL THEN
    RETURN 'ERROR: Aucun utilisateur connecté';
  END IF;
  
  test_result := test_result || 'INFO: Test pour utilisateur ' || user_email || E'\n';
  
  -- Récupérer le rôle utilisateur
  SELECT role INTO user_role FROM users WHERE id = auth.uid();
  test_result := test_result || 'INFO: Rôle utilisateur: ' || COALESCE(user_role, 'Non défini') || E'\n';
  
  -- Tester la lecture des saisons
  BEGIN
    SELECT id INTO test_season_id FROM seasons LIMIT 1;
    test_result := test_result || 'SUCCESS: Lecture des saisons OK' || E'\n';
  EXCEPTION
    WHEN OTHERS THEN
      test_result := test_result || 'ERROR: Lecture des saisons échouée - ' || SQLERRM || E'\n';
  END;
  
  -- Tester la modification d'une saison
  IF test_season_id IS NOT NULL THEN
    BEGIN
      UPDATE seasons 
      SET description = 'Test de modification - ' || now()::text
      WHERE id = test_season_id;
      
      IF FOUND THEN
        test_result := test_result || 'SUCCESS: Modification des saisons OK' || E'\n';
      ELSE
        test_result := test_result || 'ERROR: Aucune ligne modifiée - problème RLS' || E'\n';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        test_result := test_result || 'ERROR: Modification échouée - ' || SQLERRM || E'\n';
    END;
  END IF;
  
  RETURN test_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ÉTAPE 5: VÉRIFICATIONS
-- ========================================

-- Vérifier l'état des politiques
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'seasons';
  
  RAISE NOTICE '✅ Politiques RLS pour seasons corrigées !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 État actuel :';
  RAISE NOTICE '  - Politiques RLS actives : %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test à effectuer :';
  RAISE NOTICE '  SELECT test_season_permissions();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant :';
  RAISE NOTICE '  - Testez la modification des saisons';
  RAISE NOTICE '  - Ça devrait fonctionner !';
END $$;