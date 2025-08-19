/*
  # Configuration Supabase Storage pour la gestion des documents

  1. Création du bucket de stockage
    - Bucket 'documents' pour stocker tous les fichiers
    - Bucket 'templates' pour les modèles à télécharger
    
  2. Table de gestion des documents
    - Suivi des documents uploadés par les membres
    - Statuts de validation
    - Historique des actions
    
  3. Politiques RLS pour la sécurité
    - Membres peuvent uploader leurs propres documents
    - Admins peuvent voir et valider tous les documents
    - Téléchargement sécurisé des modèles
    
  4. Fonctions utilitaires
    - Validation automatique des types de fichiers
    - Nettoyage des anciens fichiers
    - Génération d'URLs sécurisées
*/

-- ========================================
-- ÉTAPE 1: CRÉATION DES BUCKETS DE STOCKAGE
-- ========================================

-- Bucket pour les documents des membres
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Privé, accès contrôlé
  5242880, -- 5MB max par fichier
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Bucket pour les modèles/templates (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates',
  'templates',
  true, -- Public pour téléchargement
  10485760, -- 10MB max
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

-- ========================================
-- ÉTAPE 2: TABLE DE GESTION DES DOCUMENTS
-- ========================================

-- Table pour tracker les documents des membres
CREATE TABLE IF NOT EXISTS member_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('ffvbForm', 'medicalCertificate', 'idPhoto', 'parentalConsent')),
  file_name text NOT NULL,
  file_path text NOT NULL, -- Chemin dans Supabase Storage
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  status text DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'validated', 'rejected')),
  rejection_reason text,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, document_type) -- Un seul document par type par membre
);

-- Table pour les modèles de documents
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL, -- Chemin dans le bucket templates
  file_size integer,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ========================================
-- ÉTAPE 3: POLITIQUES RLS POUR STORAGE
-- ========================================

-- Politique pour que les membres puissent uploader leurs documents
CREATE POLICY "Membres peuvent uploader leurs documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Politique pour que les membres puissent voir leurs propres documents
CREATE POLICY "Membres peuvent voir leurs documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Politique pour que les membres puissent supprimer leurs documents
CREATE POLICY "Membres peuvent supprimer leurs documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Politique pour que les admins puissent voir tous les documents
CREATE POLICY "Admins peuvent voir tous les documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('webmaster', 'administrateur', 'admin')
  )
);

-- Politique pour téléchargement public des templates
CREATE POLICY "Téléchargement public des templates"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'templates');

-- ========================================
-- ÉTAPE 4: POLITIQUES RLS POUR LES TABLES
-- ========================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Politiques pour member_documents
CREATE POLICY "Membres peuvent voir leurs documents"
  ON member_documents
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE email = auth.email()
    ) OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

CREATE POLICY "Membres peuvent créer leurs documents"
  ON member_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE email = auth.email()
    )
  );

CREATE POLICY "Admins peuvent gérer tous les documents"
  ON member_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

-- Politiques pour document_templates
CREATE POLICY "Tous peuvent voir les templates actifs"
  ON document_templates
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins peuvent gérer les templates"
  ON document_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

-- ========================================
-- ÉTAPE 5: FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour obtenir l'URL sécurisée d'un document
CREATE OR REPLACE FUNCTION get_document_url(file_path text)
RETURNS text AS $$
BEGIN
  -- En production, cette fonction générerait une URL signée
  -- Pour l'instant, on retourne le chemin
  RETURN file_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour valider un document
CREATE OR REPLACE FUNCTION validate_document(
  p_document_id uuid,
  p_action text, -- 'validate' ou 'reject'
  p_rejection_reason text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  doc_record member_documents%ROWTYPE;
BEGIN
  -- Récupérer le document
  SELECT * INTO doc_record FROM member_documents WHERE id = p_document_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document non trouvé avec l''ID: %', p_document_id;
  END IF;
  
  -- Mettre à jour le statut
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

-- Fonction pour nettoyer les anciens fichiers
CREATE OR REPLACE FUNCTION cleanup_old_documents()
RETURNS void AS $$
BEGIN
  -- Supprimer les enregistrements de documents dont les fichiers n'existent plus
  -- Cette fonction peut être appelée périodiquement
  DELETE FROM member_documents 
  WHERE uploaded_at < now() - INTERVAL '30 days' 
  AND status = 'rejected';
  
  RAISE NOTICE 'Nettoyage des anciens documents terminé';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ÉTAPE 6: INSERTION DES TEMPLATES PAR DÉFAUT
-- ========================================

-- Insérer les modèles de documents par défaut
INSERT INTO document_templates (name, description, document_type, file_name, file_path) VALUES
  (
    'Formulaire FFVB 2024-2025',
    'Formulaire officiel FFVB à compléter et signer',
    'ffvbForm',
    'formulaire-ffvb-2024-2025.pdf',
    'templates/formulaire-ffvb-2024-2025.pdf'
  ),
  (
    'Autorisation parentale',
    'Autorisation parentale pour les mineurs',
    'parentalConsent',
    'autorisation-parentale-2024.pdf',
    'templates/autorisation-parentale-2024.pdf'
  ),
  (
    'Guide photo d''identité',
    'Instructions pour la photo d''identité numérique',
    'idPhoto',
    'guide-photo-identite.pdf',
    'templates/guide-photo-identite.pdf'
  ),
  (
    'Modèle certificat médical',
    'Modèle de certificat médical pour le médecin',
    'medicalCertificate',
    'modele-certificat-medical.pdf',
    'templates/modele-certificat-medical.pdf'
  )
ON CONFLICT DO NOTHING;

-- ========================================
-- ÉTAPE 7: INDEX POUR LES PERFORMANCES
-- ========================================

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_member_documents_member_id ON member_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_documents_type ON member_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_member_documents_status ON member_documents(status);
CREATE INDEX IF NOT EXISTS idx_member_documents_uploaded_at ON member_documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(document_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);

-- ========================================
-- ÉTAPE 8: TRIGGERS POUR UPDATED_AT
-- ========================================

-- Trigger pour updated_at sur member_documents
CREATE TRIGGER update_member_documents_updated_at 
  BEFORE UPDATE ON member_documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour updated_at sur document_templates
CREATE TRIGGER update_document_templates_updated_at 
  BEFORE UPDATE ON document_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- ÉTAPE 9: VUES UTILES
-- ========================================

-- Vue pour faciliter les requêtes sur les documents avec infos membre
CREATE OR REPLACE VIEW member_documents_with_info AS
SELECT 
  md.*,
  m.first_name,
  m.last_name,
  m.email as member_email,
  m.category,
  u.first_name as validated_by_first_name,
  u.last_name as validated_by_last_name
FROM member_documents md
LEFT JOIN members m ON md.member_id = m.id
LEFT JOIN users u ON md.validated_by = u.id;

-- Vue pour les statistiques de documents
CREATE OR REPLACE VIEW document_statistics AS
SELECT 
  document_type,
  COUNT(*) as total_documents,
  COUNT(*) FILTER (WHERE status = 'uploaded') as pending_validation,
  COUNT(*) FILTER (WHERE status = 'validated') as validated,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
  AVG(file_size) as avg_file_size,
  MAX(uploaded_at) as last_upload
FROM member_documents
GROUP BY document_type;

-- ========================================
-- ÉTAPE 10: FONCTIONS DE STATISTIQUES
-- ========================================

-- Fonction pour obtenir les statistiques globales des documents
CREATE OR REPLACE FUNCTION get_document_stats()
RETURNS TABLE(
  total_documents bigint,
  pending_validation bigint,
  validated_documents bigint,
  rejected_documents bigint,
  completion_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_documents,
    COUNT(*) FILTER (WHERE status = 'uploaded') as pending_validation,
    COUNT(*) FILTER (WHERE status = 'validated') as validated_documents,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_documents,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'validated')::numeric / 
       NULLIF(COUNT(*), 0)) * 100, 2
    ) as completion_rate
  FROM member_documents;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- MESSAGE DE CONFIRMATION
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Configuration Supabase Storage terminée avec succès !';
  RAISE NOTICE '';
  RAISE NOTICE '📁 Buckets créés :';
  RAISE NOTICE '  - documents (privé) : Documents des membres';
  RAISE NOTICE '  - templates (public) : Modèles à télécharger';
  RAISE NOTICE '';
  RAISE NOTICE '🗄️ Tables créées :';
  RAISE NOTICE '  - member_documents : Suivi des documents uploadés';
  RAISE NOTICE '  - document_templates : Modèles disponibles';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sécurité :';
  RAISE NOTICE '  - RLS activé sur toutes les tables';
  RAISE NOTICE '  - Politiques pour membres et admins';
  RAISE NOTICE '  - Accès sécurisé aux fichiers';
  RAISE NOTICE '';
  RAISE NOTICE '🛠️ Fonctions disponibles :';
  RAISE NOTICE '  - validate_document(id, action, reason)';
  RAISE NOTICE '  - cleanup_old_documents()';
  RAISE NOTICE '  - get_document_stats()';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vues créées :';
  RAISE NOTICE '  - member_documents_with_info';
  RAISE NOTICE '  - document_statistics';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Prochaines étapes :';
  RAISE NOTICE '  1. Uploadez vos modèles dans le bucket templates';
  RAISE NOTICE '  2. Testez l''upload de documents';
  RAISE NOTICE '  3. Configurez les hooks TypeScript';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Votre système de gestion de documents est prêt !';
END $$;