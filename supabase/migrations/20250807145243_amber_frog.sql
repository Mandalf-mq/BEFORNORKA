@@ .. @@
 -- ÉTAPE 3: VÉRIFIER LES CONTRAINTES
 SELECT 
   'CONTRAINTES SUR USERS' as info,
-  constraint_name,
+  tc.constraint_name,
   constraint_type,
   check_clause
 FROM information_schema.table_constraints tc
-LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
+LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
 WHERE tc.table_name = 'users' 
   AND tc.table_schema = 'public';