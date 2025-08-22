/*
  # Fix missing role_permissions table
  
  This migration creates the role_permissions table that is required for the authentication system.
  
  1. Create role_permissions table if it doesn't exist
  2. Populate with default permissions for all roles
  3. Enable RLS and create policies
*/

-- Create the role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission)
);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Anyone can read role permissions" ON role_permissions;

-- Create policy for reading permissions
CREATE POLICY "Anyone can read role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Insert all role permissions (using ON CONFLICT DO NOTHING to avoid duplicates)
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

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Confirmation message
DO $$
BEGIN
  RAISE NOTICE '✅ TABLE ROLE_PERMISSIONS CRÉÉE ET PEUPLÉE !';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Permissions par rôle :';
  RAISE NOTICE '  - webmaster: 9 permissions (accès complet)';
  RAISE NOTICE '  - administrateur: 5 permissions';
  RAISE NOTICE '  - tresorerie: 3 permissions';
  RAISE NOTICE '  - entraineur: 3 permissions';
  RAISE NOTICE '  - member: 3 permissions';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 L''erreur "relation does not exist" devrait être corrigée !';
END $$;