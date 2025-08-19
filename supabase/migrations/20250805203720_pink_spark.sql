/*
  # Création de la table role_permissions manquante

  1. Problème identifié
    - La table role_permissions n'existe pas dans la base de données
    - Erreur 42P01: relation "public.role_permissions" does not exist
    
  2. Solution
    - Créer la table role_permissions avec la structure correcte
    - Activer RLS avec les bonnes politiques
    - Insérer toutes les permissions par rôle
    
  3. Sécurité
    - RLS activé pour protéger les données
    - Politique de lecture publique pour l'authentification
*/

-- ========================================
-- ÉTAPE 1: CRÉER LA TABLE ROLE_PERMISSIONS
-- ========================================

-- Créer la table role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission)
);

-- ========================================
-- ÉTAPE 2: ACTIVER RLS ET CRÉER LES POLITIQUES
-- ========================================

-- Activer RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Supprimer la politique existante si elle existe
DROP POLICY IF EXISTS "Anyone can read role permissions" ON role_permissions;

-- Créer la politique pour que tout le monde puisse lire les permissions
CREATE POLICY "Anyone can read role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- ========================================
-- ÉTAPE 3: INSÉRER TOUTES LES PERMISSIONS PAR RÔLE
-- ========================================

-- Insérer les permissions pour chaque rôle
INSERT INTO role_permissions (role, permission, description) VALUES
  -- Webmaster (accès complet)
  ('webmaster', 'manage_users', 'Gérer tous les utilisateurs'),
  ('webmaster', 'manage_seasons', 'Gérer les saisons'),
  ('webmaster', 'manage_categories', 'Gérer les catégories'),
  ('webmaster', 'manage_members', 'Gérer tous les membres'),
  ('webmaster', 'validate_documents', 'Valider les documents'),
  ('webmaster', 'manage_training', 'Gérer les entraînements'),
  ('webmaster', 'send_whatsapp', 'Envoyer des messages WhatsApp'),
  ('webmaster', 'view_stats', 'Voir toutes les statistiques'),
  ('webmaster', 'manage_settings', 'Gérer les paramètres'),
  
  -- Administrateur
  ('administrateur', 'manage_members', 'Gérer les membres'),
  ('administrateur', 'validate_documents', 'Valider les documents'),
  ('administrateur', 'manage_training', 'Gérer les entraînements'),
  ('administrateur', 'send_whatsapp', 'Envoyer des messages WhatsApp'),
  ('administrateur', 'view_stats', 'Voir les statistiques'),
  
  -- Trésorerie
  ('tresorerie', 'manage_payments', 'Gérer les paiements'),
  ('tresorerie', 'view_financial_stats', 'Voir les statistiques financières'),
  ('tresorerie', 'manage_fees', 'Gérer les tarifs'),
  
  -- Entraîneur
  ('entraineur', 'manage_training', 'Gérer les entraînements'),
  ('entraineur', 'send_whatsapp', 'Envoyer des messages WhatsApp'),
  ('entraineur', 'view_members', 'Voir les membres'),
  
  -- Membre
  ('member', 'view_profile', 'Voir son profil'),
  ('member', 'upload_documents', 'Uploader ses documents'),
  ('member', 'view_training', 'Voir les entraînements')
ON CONFLICT (role, permission) DO NOTHING;

-- ========================================
-- ÉTAPE 4: CRÉER UN INDEX POUR LES PERFORMANCES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ TABLE ROLE_PERMISSIONS CRÉÉE AVEC SUCCÈS !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Permissions créées pour :';
  RAISE NOTICE '  - webmaster: 9 permissions (accès complet)';
  RAISE NOTICE '  - administrateur: 5 permissions';
  RAISE NOTICE '  - tresorerie: 3 permissions';
  RAISE NOTICE '  - entraineur: 3 permissions';
  RAISE NOTICE '  - member: 3 permissions';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 L''erreur "relation does not exist" est maintenant corrigée !';
END $$;