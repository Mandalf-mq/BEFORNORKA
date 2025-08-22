@@ .. @@
 /*
   # Création des comptes de démonstration

   1. Comptes de démonstration
     - Création des utilisateurs dans auth.users avec mots de passe
     - Insertion des profils correspondants dans public.users
     - Attribution des rôles appropriés

   2. Sécurité
     - Mots de passe hashés automatiquement par Supabase
     - Comptes immédiatement utilisables
     - Email confirmé par défaut

   Note: Ces comptes sont pour la démonstration uniquement.
   En production, supprimez cette migration ou changez les mots de passe.
 */

--- Fonction pour créer un utilisateur avec mot de passe
-CREATE OR REPLACE FUNCTION create_demo_user(
-  user_email text,
-  user_password text,
-  user_first_name text,
-  user_last_name text,
-  user_role text DEFAULT 'member'
-)
-RETURNS uuid
-LANGUAGE plpgsql
-SECURITY DEFINER
-AS $$
-DECLARE
-  user_id uuid;
-  encrypted_pw text;
-BEGIN
-  -- Générer un ID utilisateur
-  user_id := gen_random_uuid();
-  
-  -- Hasher le mot de passe (utilise la fonction interne de Supabase)
-  encrypted_pw := crypt(user_password, gen_salt('bf'));
-  
-  -- Insérer dans auth.users
-  INSERT INTO auth.users (
-    instance_id,
-    id,
-    aud,
-    role,
-    email,
-    encrypted_password,
-    email_confirmed_at,
-    created_at,
-    updated_at,
-    confirmation_token,
-    email_change,
-    email_change_token_new,
-    recovery_token
-  ) VALUES (
-    '00000000-0000-0000-0000-000000000000',
-    user_id,
-    'authenticated',
-    'authenticated',
-    user_email,
-    encrypted_pw,
-    NOW(),
-    NOW(),
-    NOW(),
-    '',
-    '',
-    '',
-    ''
-  );
-  
-  -- Insérer dans auth.identities
-  INSERT INTO auth.identities (
-    id,
-    user_id,
-    identity_data,
-    provider,
-    created_at,
-    updated_at
-  ) VALUES (
-    gen_random_uuid(),
-    user_id,
-    format('{"sub":"%s","email":"%s"}', user_id::text, user_email)::jsonb,
-    'email',
-    NOW(),
-    NOW()
-  );
-  
-  -- Insérer le profil dans public.users
-  INSERT INTO public.users (
-    id,
-    email,
-    first_name,
-    last_name,
-    role,
-    created_at,
-    updated_at
-  ) VALUES (
-    user_id,
-    user_email,
-    user_first_name,
-    user_last_name,
-    user_role,
-    NOW(),
-    NOW()
-  );
-  
-  RETURN user_id;
-END;
-$$;
-
--- Créer les comptes de démonstration
-DO $$
-BEGIN
-  -- Webmaster (accès complet)
-  PERFORM create_demo_user(
-    'webmaster@befornorka.fr',
-    'admin123',
-    'Web',
-    'Master',
-    'webmaster'
-  );
-  
-  -- Administrateur
-  PERFORM create_demo_user(
-    'admin@befornorka.fr',
-    'admin123',
-    'Admin',
-    'Système',
-    'admin'
-  );
-  
-  -- Trésorier
-  PERFORM create_demo_user(
-    'tresorier@befornorka.fr',
-    'tresor123',
-    'Trésorier',
-    'Club',
-    'treasurer'
-  );
-  
-  -- Entraîneur
-  PERFORM create_demo_user(
-    'coach@befornorka.fr',
-    'coach123',
-    'Coach',
-    'Principal',
-    'trainer'
-  );
-  
-  -- Membre simple
-  PERFORM create_demo_user(
-    'membre@email.com',
-    'membre123',
-    'Membre',
-    'Test',
-    'member'
-  );
-  
-  -- Utilisateur de test supplémentaire
-  PERFORM create_demo_user(
-    'test@befornorka.fr',
-    'test123',
-    'Test',
-    'User',
-    'member'
-  );
-END $$;
-
--- Supprimer la fonction temporaire
-DROP FUNCTION create_demo_user(text, text, text, text, text);
+-- IMPORTANT: Cette migration doit être exécutée MANUELLEMENT dans le dashboard Supabase
+-- car elle nécessite des privilèges administrateur pour créer des utilisateurs.
+
+-- Instructions pour créer les comptes de démonstration :
+-- 1. Allez dans Authentication > Users dans votre dashboard Supabase
+-- 2. Cliquez sur "Add user" pour chaque compte ci-dessous :
+
+-- COMPTE 1: Webmaster
+-- Email: webmaster@befornorka.fr
+-- Password: admin123
+-- Confirm email: OUI
+-- User metadata: {"first_name": "Web", "last_name": "Master", "role": "webmaster"}
+
+-- COMPTE 2: Administrateur  
+-- Email: admin@befornorka.fr
+-- Password: admin123
+-- Confirm email: OUI
+-- User metadata: {"first_name": "Admin", "last_name": "Système", "role": "admin"}
+
+-- COMPTE 3: Trésorier
+-- Email: tresorier@befornorka.fr
+-- Password: tresor123
+-- Confirm email: OUI
+-- User metadata: {"first_name": "Trésorier", "last_name": "Club", "role": "treasurer"}
+
+-- COMPTE 4: Entraîneur
+-- Email: coach@befornorka.fr
+-- Password: coach123
+-- Confirm email: OUI
+-- User metadata: {"first_name": "Coach", "last_name": "Principal", "role": "trainer"}
+
+-- COMPTE 5: Membre
+-- Email: membre@email.com
+-- Password: membre123
+-- Confirm email: OUI
+-- User metadata: {"first_name": "Membre", "last_name": "Test", "role": "member"}
+
+-- Après avoir créé ces utilisateurs dans le dashboard, 
+-- les profils seront automatiquement créés dans la table users
+-- grâce au trigger handle_new_user()
+
+-- Vérification que le trigger existe
+CREATE OR REPLACE FUNCTION handle_new_user()
+RETURNS trigger AS $$
+BEGIN
+  INSERT INTO public.users (id, email, first_name, last_name, role)
+  VALUES (
+    NEW.id,
+    NEW.email,
+    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
+    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
+    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
+  );
+  RETURN NEW;
+EXCEPTION
+  WHEN unique_violation THEN
+    -- L'utilisateur existe déjà, on ne fait rien
+    RETURN NEW;
+END;
+$$ LANGUAGE plpgsql SECURITY DEFINER;
+
+-- Recréer le trigger si nécessaire
+DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
+CREATE TRIGGER on_auth_user_created
+  AFTER INSERT ON auth.users
+  FOR EACH ROW EXECUTE FUNCTION handle_new_user();