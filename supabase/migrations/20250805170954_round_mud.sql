@@ .. @@
 -- ========================================
 -- ÉTAPE 1: SUPPRESSION AVEC CASCADE DE TOUTES LES FONCTIONS ET VUES
 -- ========================================
 
 -- Supprimer toutes les vues qui dépendent des fonctions
 DROP VIEW IF EXISTS members_workflow_status CASCADE;
 DROP VIEW IF EXISTS members_ready_for_training CASCADE;
 DROP VIEW IF EXISTS members_enhanced CASCADE;
 DROP VIEW IF EXISTS member_documents_complete CASCADE;
 DROP VIEW IF EXISTS members_with_stats CASCADE;
 DROP VIEW IF EXISTS members_with_logs CASCADE;
 DROP VIEW IF EXISTS member_categories CASCADE;
 DROP VIEW IF EXISTS members_active CASCADE;
 DROP VIEW IF EXISTS members_archived CASCADE;
 
 -- Supprimer toutes les fonctions avec CASCADE
 DROP FUNCTION IF EXISTS get_required_documents_for_member(uuid) CASCADE;
 DROP FUNCTION IF EXISTS check_all_required_documents_validated(uuid, uuid) CASCADE;
 DROP FUNCTION IF EXISTS validate_member_profile(uuid, text) CASCADE;
 DROP FUNCTION IF EXISTS validate_member_profile(uuid) CASCADE;
 DROP FUNCTION IF EXISTS validate_document(uuid, text, text) CASCADE;
 DROP FUNCTION IF EXISTS validate_document(uuid, text) CASCADE;
 DROP FUNCTION IF EXISTS create_new_season_and_reset_members(text, date, date, date, date, jsonb) CASCADE;
 DROP FUNCTION IF EXISTS create_new_season_and_reset_members(text, date, date, date, date) CASCADE;
 DROP FUNCTION IF EXISTS create_member_account_with_password(text, text, text, text, date, text, text, integer) CASCADE;
 DROP FUNCTION IF EXISTS create_member_account_with_password(text, text, text, text, date, text, text) CASCADE;
 DROP FUNCTION IF EXISTS import_members_from_csv(jsonb) CASCADE;
 DROP FUNCTION IF EXISTS delete_category(uuid) CASCADE;
 DROP FUNCTION IF EXISTS get_membership_fee_by_category(text) CASCADE;
 DROP FUNCTION IF EXISTS get_category_by_age(date) CASCADE;
 DROP FUNCTION IF EXISTS calculate_age(date) CASCADE;
+DROP FUNCTION IF EXISTS diagnose_validation_workflow() CASCADE;
+DROP FUNCTION IF EXISTS get_member_validation_status(uuid) CASCADE;
+DROP FUNCTION IF EXISTS get_members_for_whatsapp(text[]) CASCADE;
+DROP FUNCTION IF EXISTS auto_update_member_status_on_document_upload() CASCADE;
+DROP FUNCTION IF EXISTS ensure_single_current_season() CASCADE;
+DROP FUNCTION IF EXISTS update_member_fees_from_season() CASCADE;
+DROP FUNCTION IF EXISTS log_member_action(uuid, text, jsonb, jsonb, text) CASCADE;
+DROP FUNCTION IF EXISTS auto_log_member_changes() CASCADE;
+DROP FUNCTION IF EXISTS deactivate_member(uuid, text) CASCADE;
+DROP FUNCTION IF EXISTS reactivate_member(uuid, text) CASCADE;
+DROP FUNCTION IF EXISTS validate_member(uuid, text) CASCADE;
+DROP FUNCTION IF EXISTS delete_member_permanently(uuid, text) CASCADE;
+DROP FUNCTION IF EXISTS get_member_history(uuid) CASCADE;
+DROP FUNCTION IF EXISTS get_member_statistics() CASCADE;
+DROP FUNCTION IF EXISTS get_member_statistics_complete() CASCADE;
+DROP FUNCTION IF EXISTS archive_member(uuid, text) CASCADE;
+DROP FUNCTION IF EXISTS restore_member(uuid, text) CASCADE;
+DROP FUNCTION IF EXISTS can_delete_category(uuid) CASCADE;
+DROP FUNCTION IF EXISTS get_categories_with_stats() CASCADE;
+DROP FUNCTION IF EXISTS sync_member_categories() CASCADE;
+DROP FUNCTION IF EXISTS log_category_changes() CASCADE;
+DROP FUNCTION IF EXISTS auto_assign_member_category() CASCADE;
+DROP FUNCTION IF EXISTS recalculate_all_member_categories() CASCADE;
+DROP FUNCTION IF EXISTS get_member_documents_for_season(uuid, uuid) CASCADE;
+DROP FUNCTION IF EXISTS get_templates_for_season(uuid) CASCADE;
+DROP FUNCTION IF EXISTS copy_templates_to_new_season(uuid, uuid) CASCADE;
+DROP FUNCTION IF EXISTS get_document_stats_by_season(uuid) CASCADE;
+
+-- Supprimer tous les triggers qui dépendent des fonctions
+DROP TRIGGER IF EXISTS auto_status_on_document_upload ON member_documents;
+DROP TRIGGER IF EXISTS ensure_single_current_season_trigger ON seasons;
+DROP TRIGGER IF EXISTS update_member_fees_trigger ON members;
+DROP TRIGGER IF EXISTS auto_log_member_changes_trigger ON members;
+DROP TRIGGER IF EXISTS category_changes_trigger ON categories;
+DROP TRIGGER IF EXISTS auto_assign_category_trigger ON members;