@@ .. @@
 -- Fonction pour valider un document
+DROP FUNCTION IF EXISTS validate_document(uuid, text, text);
 CREATE OR REPLACE FUNCTION validate_document(
   p_document_id uuid,
   p_action text,
   p_rejection_reason text DEFAULT NULL
 )
 RETURNS boolean AS $$
 BEGIN
   IF p_action = 'validate' THEN
     UPDATE member_documents 
     SET 
       status = 'validated',
       validated_by = auth.uid(),
       validated_at = now(),
       rejection_reason = NULL,
       updated_at = now()
     WHERE id = p_document_id;
   ELSIF p_action = 'reject' THEN
     UPDATE member_documents 
     SET 
       status = 'rejected',
       rejection_reason = p_rejection_reason,
       validated_by = auth.uid(),
       validated_at = now(),
       updated_at = now()
     WHERE id = p_document_id;
   ELSE
     RAISE EXCEPTION 'Action invalide: %. Utilisez "validate" ou "reject"', p_action;
   END IF;
   
   RETURN true;
 END;
 $$ LANGUAGE plpgsql SECURITY DEFINER;