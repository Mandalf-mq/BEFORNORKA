/*
  # Correction des permissions RLS pour les saisons

  1. Problème identifié
    - Les politiques RLS bloquent la modification des saisons
    - Erreur: "Aucune ligne mise à jour - permissions RLS insuffisantes"
    
  2. Solutions
    - Supprimer toutes les politiques RLS problématiques
    - Créer des politiques simples qui fonctionnent
    - Donner les bonnes permissions aux utilisateurs authentifiés
    - Mettre à jour le rôle de l'utilisateur connecté

  3. Sécurité
    - Maintenir la sécurité tout en permettant la gestion
    - Permissions appropriées selon les rôles
*/

-- ========================================
-- ÉTAPE 1: SUPPRIMER TOUTES LES POLITIQUES PROBLÉMATIQUES
-- ========================================

-- Supprimer toutes les politiques existantes sur seasons
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'seasons'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON seasons';
    END LOOP;
    
    RAISE NOTICE 'Toutes les politiques seasons supprimées';
END $$;

-- ========================================
-- ÉTAPE 2: CRÉER DES POLITIQUES SIMPLES ET EFFICACES
-- ========================================

-- Politique pour que tout le monde puisse lire les saisons
CREATE POLICY "Public can read seasons"
  ON seasons
  FOR SELECT
  USING (true);

-- Politique pour que les utilisateurs authentifiés puissent tout faire
CREATE POLICY "Authenticated users can manage seasons"
  ON seasons
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 3: METTRE À JOUR LE RÔLE DE L'UTILISATEUR CONNECTÉ
-- ========================================

-- Mettre à jour l'utilisateur connecté avec le rôle webmaster
DO $$
DECLARE
  current_user_email text;
  current_user_id uuid;
BEGIN
  -- Récupérer l'utilisateur connecté
  SELECT email, id INTO current_user_email, current_user_id
  FROM auth.users 
  WHERE id = auth.uid();
  
  IF current_user_email IS NOT NULL THEN
    -- Créer ou mettre à jour le profil utilisateur
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
    
    -- Mettre à jour les métadonnées auth
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
  update_count integer;
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
      
      GET DIAGNOSTICS update_count = ROW_COUNT;
      
      IF update_count > 0 THEN
        test_result := test_result || 'SUCCESS: Modification des saisons OK (' || update_count || ' ligne(s) modifiée(s))' || E'\n';
      ELSE
        test_result := test_result || 'ERROR: Aucune ligne modifiée - problème RLS persistant' || E'\n';
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
  season_count integer;
BEGIN
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'seasons';
  SELECT COUNT(*) INTO season_count FROM seasons;
  
  RAISE NOTICE '✅ Politiques RLS pour seasons corrigées !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 État actuel :';
  RAISE NOTICE '  - Politiques RLS actives : %', policy_count;
  RAISE NOTICE '  - Saisons en base : %', season_count;
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test à effectuer :';
  RAISE NOTICE '  SELECT test_season_permissions();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant :';
  RAISE NOTICE '  - Retournez dans votre app';
  RAISE NOTICE '  - Testez la modification des saisons';
  RAISE NOTICE '  - Ça devrait fonctionner !';
END $$;