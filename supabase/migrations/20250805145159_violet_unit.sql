/*
  # Create missing database views and functions

  1. Views
    - `member_documents_complete` - Complete view of member documents with member info
    - `members_with_stats` - Members with document and payment statistics
  
  2. Functions
    - `validate_document` - Function to validate/reject documents
    
  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create member_documents_complete view
CREATE OR REPLACE VIEW member_documents_complete AS
SELECT 
  md.id,
  md.member_id,
  md.document_type,
  md.file_name,
  md.status,
  md.uploaded_at,
  md.validated_at,
  md.rejection_reason,
  m.email as member_email,
  m.first_name || ' ' || m.last_name as member_name
FROM member_documents md
JOIN members m ON md.member_id = m.id;

-- Create members_with_stats view
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

-- Create validate_document function
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
      validated_at = now(),
      rejection_reason = NULL
    WHERE id = p_document_id;
  ELSIF p_action = 'reject' THEN
    UPDATE member_documents 
    SET 
      status = 'rejected',
      validated_at = now(),
      rejection_reason = p_rejection_reason
    WHERE id = p_document_id;
  ELSE
    RAISE EXCEPTION 'Invalid action. Use "validate" or "reject".';
  END IF;
END;
$$;

-- Ensure document_templates table exists
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text,
  is_active boolean DEFAULT true,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on document_templates
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for document_templates
CREATE POLICY "Anyone can read active templates"
  ON document_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Insert some default document templates
INSERT INTO document_templates (name, description, document_type, file_name) VALUES
  ('Formulaire FFVB', 'Formulaire officiel de la Fédération Française de Volley-Ball', 'ffvbForm', 'formulaire_ffvb.pdf'),
  ('Certificat médical', 'Modèle de certificat médical pour la pratique du volley-ball', 'medicalCertificate', 'certificat_medical.pdf'),
  ('Autorisation parentale', 'Autorisation parentale pour les mineurs', 'parentalConsent', 'autorisation_parentale.pdf')
ON CONFLICT DO NOTHING;

-- Create training_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  category text,
  max_participants integer,
  current_participants integer DEFAULT 0,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on training_sessions
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for training_sessions
CREATE POLICY "Authenticated users can read training sessions"
  ON training_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage training sessions"
  ON training_sessions
  FOR ALL
  TO authenticated
  USING (true);

-- Insert some sample training sessions
INSERT INTO training_sessions (title, description, date, start_time, end_time, location, category) VALUES
  ('Entraînement Seniors', 'Entraînement technique et physique', CURRENT_DATE + INTERVAL '1 day', '19:00', '21:00', 'Gymnase Municipal', 'seniors'),
  ('Entraînement Jeunes', 'Initiation et perfectionnement', CURRENT_DATE + INTERVAL '2 days', '17:00', '18:30', 'Gymnase Municipal', 'jeunes'),
  ('Entraînement Loisir', 'Volley détente et plaisir', CURRENT_DATE + INTERVAL '3 days', '20:00', '21:30', 'Gymnase Municipal', 'loisir')
ON CONFLICT DO NOTHING;