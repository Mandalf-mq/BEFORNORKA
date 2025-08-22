/*
  # Ajout du statut 'maybe' aux réponses de présence

  1. Modifications
    - Mise à jour de la contrainte CHECK sur attendance_records.status
    - Ajout de 'maybe' aux valeurs autorisées
    - Conservation des valeurs existantes : 'present', 'absent', 'pending'

  2. Sécurité
    - Migration sécurisée avec gestion d'erreur
    - Pas d'impact sur les données existantes
*/

-- Supprimer l'ancienne contrainte
ALTER TABLE attendance_records 
DROP CONSTRAINT IF EXISTS attendance_records_status_check;

-- Ajouter la nouvelle contrainte avec 'maybe'
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_status_check 
CHECK (status IN ('present', 'absent', 'pending', 'late', 'maybe'));

-- Commentaire pour documentation
COMMENT ON COLUMN attendance_records.status IS 'Statut de présence: present, absent, pending, late, maybe';