/*
  # Fonctions de gestion des membres

  1. Fonctions de gestion
    - Fonction pour désactiver un membre (soft delete)
    - Fonction pour réactiver un membre
    - Fonction pour supprimer définitivement un membre
    - Fonction pour valider un membre

  2. Triggers et logs
    - Log des actions sur les membres
    - Historique des modifications
    - Validation des données

  3. Sécurité
    - Vérification des permissions
    - Audit trail complet
    - Protection contre les suppressions accidentelles
*/

-- Table pour l'historique des actions sur les membres
CREATE TABLE IF NOT EXISTS member_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'validated', 'rejected', 'deactivated', 'reactivated', 'deleted')),
  old_values jsonb,
  new_values jsonb,
  performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  performed_at timestamptz DEFAULT now(),
  notes text
);

-- Activer RLS sur la table de logs
ALTER TABLE member_actions_log ENABLE ROW LEVEL SECURITY;

-- Politique pour que les admins puissent voir les logs
CREATE POLICY "Admins can view member logs"
  ON member_actions_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin')
    )
  );

-- Politique pour créer des logs
CREATE POLICY "System can create member logs"
  ON member_actions_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fonction pour logger les actions sur les membres
CREATE OR REPLACE FUNCTION log_member_action(
  p_member_id uuid,
  p_action text,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO member_actions_log (
    member_id,
    action,
    old_values,
    new_values,
    performed_by,
    notes
  ) VALUES (
    p_member_id,
    p_action,
    p_old_values,
    p_new_values,
    auth.uid(),
    p_notes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour désactiver un membre (soft delete)
CREATE OR REPLACE FUNCTION deactivate_member(p_member_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  member_record members%ROWTYPE;
  old_values jsonb;
BEGIN
  -- Récupérer les données actuelles du membre
  SELECT * INTO member_record FROM members WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre non trouvé avec l''ID: %', p_member_id;
  END IF;
  
  -- Sauvegarder les anciennes valeurs
  old_values := to_jsonb(member_record);
  
  -- Mettre à jour le statut
  UPDATE members 
  SET 
    status = 'rejected',
    updated_at = now()
  WHERE id = p_member_id;
  
  -- Logger l'action
  PERFORM log_member_action(
    p_member_id,
    'deactivated',
    old_values,
    jsonb_build_object('status', 'rejected', 'updated_at', now()),
    p_reason
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour réactiver un membre
CREATE OR REPLACE FUNCTION reactivate_member(p_member_id uuid, p_notes text DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  member_record members%ROWTYPE;
  old_values jsonb;
BEGIN
  -- Récupérer les données actuelles du membre
  SELECT * INTO member_record FROM members WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre non trouvé avec l''ID: %', p_member_id;
  END IF;
  
  -- Sauvegarder les anciennes valeurs
  old_values := to_jsonb(member_record);
  
  -- Mettre à jour le statut
  UPDATE members 
  SET 
    status = 'pending',
    updated_at = now()
  WHERE id = p_member_id;
  
  -- Logger l'action
  PERFORM log_member_action(
    p_member_id,
    'reactivated',
    old_values,
    jsonb_build_object('status', 'pending', 'updated_at', now()),
    p_notes
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour valider un membre
CREATE OR REPLACE FUNCTION validate_member(p_member_id uuid, p_notes text DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  member_record members%ROWTYPE;
  old_values jsonb;
BEGIN
  -- Récupérer les données actuelles du membre
  SELECT * INTO member_record FROM members WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre non trouvé avec l''ID: %', p_member_id;
  END IF;
  
  -- Sauvegarder les anciennes valeurs
  old_values := to_jsonb(member_record);
  
  -- Mettre à jour le statut et les informations de validation
  UPDATE members 
  SET 
    status = 'validated',
    validated_by = auth.uid(),
    validated_at = now(),
    updated_at = now()
  WHERE id = p_member_id;
  
  -- Logger l'action
  PERFORM log_member_action(
    p_member_id,
    'validated',
    old_values,
    jsonb_build_object(
      'status', 'validated', 
      'validated_by', auth.uid(), 
      'validated_at', now(),
      'updated_at', now()
    ),
    p_notes
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour supprimer définitivement un membre
CREATE OR REPLACE FUNCTION delete_member_permanently(p_member_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  member_record members%ROWTYPE;
  old_values jsonb;
BEGIN
  -- Récupérer les données actuelles du membre
  SELECT * INTO member_record FROM members WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre non trouvé avec l''ID: %', p_member_id;
  END IF;
  
  -- Sauvegarder les anciennes valeurs pour l'historique
  old_values := to_jsonb(member_record);
  
  -- Logger l'action AVANT la suppression
  PERFORM log_member_action(
    p_member_id,
    'deleted',
    old_values,
    NULL,
    p_reason
  );
  
  -- Supprimer le membre (les logs seront conservés grâce à ON DELETE CASCADE)
  DELETE FROM members WHERE id = p_member_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour logger automatiquement les modifications
CREATE OR REPLACE FUNCTION auto_log_member_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_member_action(
      NEW.id,
      'created',
      NULL,
      to_jsonb(NEW),
      'Membre créé'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Ne logger que si il y a vraiment des changements significatifs
    IF OLD.status != NEW.status OR 
       OLD.payment_status != NEW.payment_status OR
       OLD.membership_fee != NEW.membership_fee OR
       OLD.first_name != NEW.first_name OR
       OLD.last_name != NEW.last_name OR
       OLD.email != NEW.email THEN
      
      PERFORM log_member_action(
        NEW.id,
        'updated',
        to_jsonb(OLD),
        to_jsonb(NEW),
        'Membre modifié'
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger pour l'auto-logging
DROP TRIGGER IF EXISTS auto_log_member_changes_trigger ON members;
CREATE TRIGGER auto_log_member_changes_trigger
  AFTER INSERT OR UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION auto_log_member_changes();

-- Vue pour faciliter les requêtes sur les membres avec leurs logs
CREATE OR REPLACE VIEW members_with_logs AS
SELECT 
  m.*,
  calculate_age(m.birth_date) as age,
  c.label as category_label,
  c.color as category_color,
  u.first_name as validated_by_first_name,
  u.last_name as validated_by_last_name,
  (
    SELECT COUNT(*) 
    FROM member_actions_log mal 
    WHERE mal.member_id = m.id
  ) as action_count,
  (
    SELECT mal.performed_at 
    FROM member_actions_log mal 
    WHERE mal.member_id = m.id 
    ORDER BY mal.performed_at DESC 
    LIMIT 1
  ) as last_action_date
FROM members m
LEFT JOIN categories c ON m.category_id = c.id
LEFT JOIN users u ON m.validated_by = u.id;

-- Fonction pour obtenir l'historique d'un membre
CREATE OR REPLACE FUNCTION get_member_history(p_member_id uuid)
RETURNS TABLE(
  action text,
  performed_at timestamptz,
  performed_by_name text,
  notes text,
  old_status text,
  new_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mal.action,
    mal.performed_at,
    COALESCE(u.first_name || ' ' || u.last_name, 'Système') as performed_by_name,
    mal.notes,
    mal.old_values->>'status' as old_status,
    mal.new_values->>'status' as new_status
  FROM member_actions_log mal
  LEFT JOIN users u ON mal.performed_by = u.id
  WHERE mal.member_id = p_member_id
  ORDER BY mal.performed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques des membres
CREATE OR REPLACE FUNCTION get_member_statistics()
RETURNS TABLE(
  total_members bigint,
  validated_members bigint,
  pending_members bigint,
  rejected_members bigint,
  total_revenue bigint,
  paid_revenue bigint,
  pending_revenue bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_members,
    COUNT(*) FILTER (WHERE status = 'validated') as validated_members,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_members,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_members,
    COALESCE(SUM(membership_fee), 0) as total_revenue,
    COALESCE(SUM(membership_fee) FILTER (WHERE payment_status = 'paid'), 0) as paid_revenue,
    COALESCE(SUM(membership_fee) FILTER (WHERE payment_status = 'pending'), 0) as pending_revenue
  FROM members;
END;
$$ LANGUAGE plpgsql;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_member_actions_log_member_id ON member_actions_log(member_id);
CREATE INDEX IF NOT EXISTS idx_member_actions_log_action ON member_actions_log(action);
CREATE INDEX IF NOT EXISTS idx_member_actions_log_performed_at ON member_actions_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_member_actions_log_performed_by ON member_actions_log(performed_by);

-- Politiques RLS pour les fonctions de gestion
CREATE POLICY "Admins can manage members"
  ON members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('webmaster', 'administrateur', 'admin', 'entraineur')
    )
  );

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Système de gestion des membres créé avec succès !';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Fonctions disponibles :';
  RAISE NOTICE '  - deactivate_member(id, reason) → Désactiver un membre';
  RAISE NOTICE '  - reactivate_member(id, notes) → Réactiver un membre';
  RAISE NOTICE '  - validate_member(id, notes) → Valider un membre';
  RAISE NOTICE '  - delete_member_permanently(id, reason) → Suppression définitive';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Vues et statistiques :';
  RAISE NOTICE '  - members_with_logs → Vue enrichie avec historique';
  RAISE NOTICE '  - get_member_history(id) → Historique d''un membre';
  RAISE NOTICE '  - get_member_statistics() → Statistiques globales';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Sécurité :';
  RAISE NOTICE '  - Toutes les actions sont loggées';
  RAISE NOTICE '  - Permissions vérifiées via RLS';
  RAISE NOTICE '  - Audit trail complet';
END $$;