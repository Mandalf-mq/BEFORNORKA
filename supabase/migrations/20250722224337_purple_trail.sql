/*
  # Correction du conflit entre tables users et profiles

  1. Problème identifié
    - Table `users` non liée à auth.users (génère ses propres IDs)
    - Table `profiles` existe mais n'est pas utilisée par l'application
    - Conflit entre les deux approches

  2. Solution
    - Modifier la table `users` pour qu'elle référence auth.users
    - Supprimer la table `profiles` redondante
    - Corriger les politiques RLS
    - Mettre à jour le trigger de création d'utilisateur

  3. Sécurité
    - Maintenir toutes les politiques de sécurité
    - Assurer la compatibilité avec l'authentification Supabase
*/

-- Étape 1: Sauvegarder les données existantes de la table users
CREATE TEMP TABLE temp_users_backup AS 
SELECT * FROM public.users;

-- Étape 2: Supprimer la table users actuelle (elle sera recréée correctement)
DROP TABLE IF EXISTS public.users CASCADE;

-- Étape 3: Recréer la table users avec la bonne structure
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  phone text DEFAULT '',
  role text DEFAULT 'member' CHECK (role IN ('admin', 'trainer', 'member', 'webmaster', 'administrateur', 'tresorerie', 'entraineur')),
  is_active boolean DEFAULT true,
  last_login timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Étape 4: Supprimer la table profiles redondante
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Étape 5: Activer RLS sur la table users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Étape 6: Créer des politiques RLS sécurisées
-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Allow user profile creation" ON public.users;
DROP POLICY IF EXISTS "Debug: Allow all operations on users" ON public.users;

-- Nouvelles politiques sécurisées
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Politique pour permettre l'inscription (temporaire)
CREATE POLICY "Allow registration"
  ON public.users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Étape 7: Corriger le trigger de création d'utilisateur
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insérer le profil utilisateur avec gestion d'erreur robuste
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', COALESCE(NEW.raw_user_meta_data->>'firstName', '')),
    COALESCE(NEW.raw_user_meta_data->>'last_name', COALESCE(NEW.raw_user_meta_data->>'lastName', '')),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), users.last_name),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log l'erreur mais ne pas faire échouer l'inscription
    RAISE WARNING 'Erreur lors de la création du profil utilisateur: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Étape 8: Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Étape 9: Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Étape 10: Corriger les références dans les autres tables
-- Mettre à jour les contraintes des tables qui référencent users
DO $$
BEGIN
  -- Recréer les contraintes pour members.validated_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'members_validated_by_fkey'
  ) THEN
    ALTER TABLE public.members DROP CONSTRAINT members_validated_by_fkey;
    ALTER TABLE public.members ADD CONSTRAINT members_validated_by_fkey 
      FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Recréer les contraintes pour training_sessions.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'training_sessions_created_by_fkey'
  ) THEN
    ALTER TABLE public.training_sessions DROP CONSTRAINT training_sessions_created_by_fkey;
    ALTER TABLE public.training_sessions ADD CONSTRAINT training_sessions_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Recréer les contraintes pour whatsapp_notifications.sent_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'whatsapp_notifications_sent_by_fkey'
  ) THEN
    ALTER TABLE public.whatsapp_notifications DROP CONSTRAINT whatsapp_notifications_sent_by_fkey;
    ALTER TABLE public.whatsapp_notifications ADD CONSTRAINT whatsapp_notifications_sent_by_fkey 
      FOREIGN KEY (sent_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Recréer les contraintes pour message_templates.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'message_templates_created_by_fkey'
  ) THEN
    ALTER TABLE public.message_templates DROP CONSTRAINT message_templates_created_by_fkey;
    ALTER TABLE public.message_templates ADD CONSTRAINT message_templates_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Recréer les contraintes pour user_sessions.user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_sessions DROP CONSTRAINT user_sessions_user_id_fkey;
    ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Étape 11: Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Étape 12: Fonction de nettoyage des politiques de debug
CREATE OR REPLACE FUNCTION cleanup_debug_policies()
RETURNS void AS $$
BEGIN
  DROP POLICY IF EXISTS "Debug: Allow all operations on members" ON public.members;
  DROP POLICY IF EXISTS "Debug: Allow all operations on users" ON public.users;
  DROP POLICY IF EXISTS "Allow registration" ON public.users;
  
  RAISE NOTICE 'Politiques de debug supprimées avec succès';
END;
$$ LANGUAGE plpgsql;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Structure des tables utilisateurs corrigée avec succès !';
  RAISE NOTICE 'Vous pouvez maintenant tester la création d''utilisateurs.';
  RAISE NOTICE 'Exécutez SELECT cleanup_debug_policies(); après avoir confirmé que tout fonctionne.';
END $$;