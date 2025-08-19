@@ .. @@
 -- Fonction pour créer automatiquement un profil membre pour un utilisateur
+DROP FUNCTION IF EXISTS create_member_profile_for_user(text, text, text);
 CREATE OR REPLACE FUNCTION create_member_profile_for_user(
   user_email text,
   first_name text DEFAULT '',
   last_name text DEFAULT ''
 )
 RETURNS uuid AS $$