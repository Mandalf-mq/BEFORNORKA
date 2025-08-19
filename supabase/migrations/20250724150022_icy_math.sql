@@ .. @@
-- Insérer les modèles de documents par défaut
INSERT INTO document_templates (name, description, document_type, file_name, file_path) VALUES
  (
    'Formulaire FFVB 2024-2025',
    'Formulaire officiel FFVB à compléter et signer',
    'ffvbForm',
    'formulaire-ffvb-2024-2025.pdf',
-    'templates/formulaire-ffvb-2024-2025.pdf'
+    'formulaire-ffvb-2024-2025.pdf'
  ),
  (
    'Autorisation parentale',
    'Autorisation parentale pour les mineurs',
    'parentalConsent',
    'autorisation-parentale-2024.pdf',
-    'templates/autorisation-parentale-2024.pdf'
+    'autorisation-parentale-2024.pdf'
  ),
  (
    'Guide photo d''identité',
    'Instructions pour la photo d''identité numérique',
    'idPhoto',
    'guide-photo-identite.pdf',
-    'templates/guide-photo-identite.pdf'
+    'guide-photo-identite.pdf'
  ),
  (
    'Modèle certificat médical',
    'Modèle de certificat médical pour le médecin',
    'medicalCertificate',
    'modele-certificat-medical.pdf',
-    'templates/modele-certificat-medical.pdf'
+    'modele-certificat-medical.pdf'
  )
ON CONFLICT DO NOTHING;

+-- Correction des chemins existants (une seule fois)
+UPDATE document_templates 
+SET file_path = REPLACE(file_path, 'templates/', '') 
+WHERE file_path LIKE 'templates/%';