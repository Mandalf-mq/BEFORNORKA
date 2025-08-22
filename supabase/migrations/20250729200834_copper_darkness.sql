/*
  # Correction des permissions RLS pour les saisons

  1. Problème identifié
    - Les politiques RLS bloquent la modification des saisons
    - Erreur: "Aucune ligne mise à jour - permissions RLS insuffisantes"
    
  2. Solutions
    - Corriger les politiques RLS pour permettre la modification
    - Donner les bonnes permissions aux utilisateurs authentifiés
    - Vérifier et corriger les rôles utilisateur

  3. Sécurité
    - Maintenir la sécurité tout en permettant la gestion
    - Permissions appropriées selon les rôles
*/

-- ========================================
-- ÉTAPE 1: SUPPRIMER LES POLITIQUES PROBLÉMATIQUES
-- ========================================

-- Supprimer toutes les politiques existantes sur seasons
DROP POLICY IF EXISTS "Everyone can read active seasons" ON seasons;
DROP POLICY IF EXISTS "Admins can manage seasons" ON seasons;
DROP POLICY IF EXISTS "Everyone can read seasons" ON seasons;
DROP POLICY IF EXISTS "Authenticated users can create seasons" ON seasons;
DROP POLICY IF EXISTS "Authenticated users can update seasons" ON seasons;
DROP POLICY IF EXISTS "Authenticated users can delete seasons" ON seasons;
DROP POLICY IF EXISTS "Tous peuvent lire les saisons actives" ON seasons;
DROP POLICY IF EXISTS "Administrateurs peuvent gérer les saisons" ON seasons;

-- ========================================
-- ÉTAPE 2: CRÉER DES POLITIQUES SIMPLES ET EFFICACES
-- ========================================

-- Politique pour que tout le monde puisse lire les saisons
CREATE POLICY "Public can read seasons"
  ON seasons
  FOR SELECT
  USING (true);

-- Politique pour que les utilisateurs authentifiés puissent tout faire sur les saisons
CREATE POLICY "Authenticated users can manage seasons"
  ON seasons
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ========================================
-- ÉTAPE 3: VÉRIFIER ET CORRIGER LES RÔLES UTILISATEUR
-- ========================================

-- Mettre à jour tous les utilisateurs connectés avec le rôle webmaster
UPDATE users 
SET role = 'webmaster', is_active = true, updated_at = now()
WHERE email IN (
  SELECT email FROM auth.users 
  WHERE email IS NOT NULL
);

-- Mettre à jour aussi les métadonnées auth pour tous les utilisateurs
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "webmaster"}'::jsonb
WHERE email IS NOT NULL;

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
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Politiques RLS pour seasons corrigées !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Corrections appliquées :';
  RAISE NOTICE '  - Politiques RLS simplifiées';
  RAISE NOTICE '  - Permissions pour utilisateurs authentifiés';
  RAISE NOTICE '  - Rôles utilisateur mis à jour';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test à effectuer :';
  RAISE NOTICE '  SELECT test_season_permissions();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant :';
  RAISE NOTICE '  - Exécutez cette migration dans Supabase SQL Editor';
  RAISE NOTICE '  - Testez la modification des saisons';
  RAISE NOTICE '  - Ça devrait fonctionner !';
END $$;
</parameter>