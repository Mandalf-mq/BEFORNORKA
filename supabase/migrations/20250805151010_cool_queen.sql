/*
  Correction de la contrainte season_id NOT NULL sur document_templates
  
  1. Probleme identifie
    - La colonne season_id de document_templates a une contrainte NOT NULL
    - Mais on essaie d'inserer des templates sans season_id
    
  2. Solutions
    - Supprimer la contrainte NOT NULL sur season_id
    - Permettre des templates globaux sans saison specifique
    - Corriger la fonction validate_document
    
  3. Tables a verifier/creer
    - categories si manquante
    - member_documents si manquante
    - document_templates corriger contrainte
*/

-- Supprimer la contrainte NOT NULL sur season_id pour document_templates
ALTER TABLE document_templates ALTER COLUMN season_id DROP NOT NULL;

-- Supprimer toutes les versions existantes de la fonction validate_document
DROP FUNCTION IF EXISTS validate_document(uuid, text, text);
DROP FUNCTION IF EXISTS validate_document(uuid, text);

-- Recreer la fonction avec le bon type de retour
CREATE OR REPLACE FUNCTION validate_document(
  p_document_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
END;
$$;

-- Vue member_documents_complete requise par DocumentsManager
CREATE OR REPLACE VIEW member_documents_complete AS
SELECT 
  md.id,
  md.member_id,
  md.document_type,
  md.file_name,
  md.file_path,
  md.file_size,
  md.mime_type,
  md.status,
  md.rejection_reason,
  md.validated_by,
  md.validated_at,
  md.uploaded_at,
  md.created_at,
  md.updated_at,
  m.email as member_email,
  (m.first_name || ' ' || m.last_name) as member_name,
  m.first_name,
  m.last_name,
  m.category,
  u.first_name as validated_by_first_name,
  u.last_name as validated_by_last_name,
  CASE 
    WHEN md.document_type = 'ffvbForm' THEN 'Formulaire FFVB'
    WHEN md.document_type = 'medicalCertificate' THEN 'Certificat medical'
    WHEN md.document_type = 'idPhoto' THEN 'Photo d identite'
    WHEN md.document_type = 'parentalConsent' THEN 'Autorisation parentale'
    ELSE md.document_type
  END as document_type_label
FROM member_documents md
LEFT JOIN members m ON md.member_id = m.id
LEFT JOIN users u ON md.validated_by = u.id;

-- Vue members_with_stats pour les statistiques
CREATE OR REPLACE VIEW members_with_stats AS
SELECT 
  m.*,
  COALESCE(doc_stats.total_documents, 0) as total_documents,
  COALESCE(doc_stats.validated_documents, 0) as validated_documents,
  COALESCE(doc_stats.pending_documents, 0) as pending_documents,
  COALESCE(doc_stats.rejected_documents, 0) as rejected_documents,
  CASE 
    WHEN COALESCE(doc_stats.total_documents, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(doc_stats.validated_documents, 0)::decimal / doc_stats.total_documents) * 100, 1)
  END as validation_percentage
FROM members m
LEFT JOIN (
  SELECT 
    member_id,
    COUNT(*) as total_documents,
    COUNT(*) FILTER (WHERE status = 'validated') as validated_documents,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_documents,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_documents
  FROM member_documents
  GROUP BY member_id
) doc_stats ON m.id = doc_stats.member_id;

-- Inserer des modeles de documents par defaut SANS season_id car maintenant optionnel
INSERT INTO document_templates (name, description, document_type, file_name, file_path) VALUES
  (
    'Formulaire FFVB 2024-2025',
    'Formulaire officiel FFVB a completer et signer',
    'ffvbForm',
    'formulaire-ffvb-2024-2025.pdf',
    'formulaire-ffvb-2024-2025.pdf'
  ),
  (
    'Certificat medical',
    'Modele de certificat medical pour la pratique du volley-ball',
    'medicalCertificate',
    'certificat-medical.pdf',
    'certificat-medical.pdf'
  ),
  (
    'Autorisation parentale',
    'Autorisation parentale pour les mineurs',
    'parentalConsent',
    'autorisation-parentale.pdf',
    'autorisation-parentale.pdf'
  ),
  (
    'Guide photo d identite',
    'Instructions pour la photo d identite',
    'idPhoto',
    'guide-photo-identite.pdf',
    'guide-photo-identite.pdf'
  )
ON CONFLICT DO NOTHING;

-- Inserer des seances d entrainement d exemple
INSERT INTO training_sessions (title, description, date, start_time, end_time, location, category, coach) VALUES
  (
    'Entrainement Seniors',
    'Entrainement technique et physique pour les seniors',
    CURRENT_DATE + INTERVAL '1 day',
    '19:00',
    '21:00',
    'Gymnase Municipal',
    ARRAY['senior'],
    'Coach Principal'
  ),
  (
    'Entrainement Jeunes',
    'Initiation et perfectionnement pour les jeunes',
    CURRENT_DATE + INTERVAL '2 days',
    '17:00',
    '18:30',
    'Gymnase Municipal',
    ARRAY['benjamin', 'minime', 'cadet'],
    'Coach Jeunes'
  ),
  (
    'Entrainement Loisir',
    'Volley detente et plaisir',
    CURRENT_DATE + INTERVAL '3 days',
    '20:00',
    '21:30',
    'Gymnase Municipal',
    ARRAY['veteran'],
    'Coach Loisir'
  )
ON CONFLICT DO NOTHING;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(date);