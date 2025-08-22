/*
  # Système de sondage WhatsApp automatique avec programmation

  1. Nouvelles tables
    - `whatsapp_polls` : Sondages d'entraînement
    - `whatsapp_poll_responses` : Réponses aux sondages
    - `whatsapp_scheduled_messages` : Messages programmés
    - `whatsapp_automation_rules` : Règles d'automatisation

  2. Fonctionnalités
    - Création automatique de sondages pour chaque entraînement
    - Synchronisation des réponses WhatsApp avec attendance_records
    - Programmation d'envois (matin pour entraînement du jour)
    - Gestion des réponses par mots-clés (OUI/NON/PEUT-ÊTRE)

  3. Automatisation
    - Envoi automatique selon planning
    - Rappels pour non-répondants
    - Synchronisation bidirectionnelle site ↔ WhatsApp
*/

-- Table pour les sondages WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  poll_title text NOT NULL,
  poll_message text NOT NULL,
  poll_options jsonb DEFAULT '["✅ PRÉSENT", "❌ ABSENT", "🤔 PEUT-ÊTRE"]',
  keywords_mapping jsonb DEFAULT '{"oui": "present", "présent": "present", "ok": "present", "✅": "present", "non": "absent", "absent": "absent", "❌": "absent", "peut-être": "maybe", "🤔": "maybe", "maybe": "maybe"}',
  is_active boolean DEFAULT true,
  sent_at timestamptz,
  scheduled_for timestamptz,
  auto_send boolean DEFAULT false,
  reminder_sent boolean DEFAULT false,
  reminder_scheduled_for timestamptz,
  total_sent integer DEFAULT 0,
  total_responses integer DEFAULT 0,
  response_rate numeric DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table pour les réponses aux sondages
CREATE TABLE IF NOT EXISTS whatsapp_poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES whatsapp_polls(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  response_text text NOT NULL, -- Texte original de la réponse
  response_status text NOT NULL CHECK (response_status IN ('present', 'absent', 'maybe')),
  confidence_score numeric DEFAULT 100, -- Confiance dans l'interprétation (0-100%)
  phone_number text,
  responded_at timestamptz DEFAULT now(),
  synced_to_attendance boolean DEFAULT false,
  sync_error text,
  created_at timestamptz DEFAULT now()
);

-- Table pour les messages programmés
CREATE TABLE IF NOT EXISTS whatsapp_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,
  poll_id uuid REFERENCES whatsapp_polls(id),
  message_type text DEFAULT 'poll' CHECK (message_type IN ('poll', 'reminder', 'update', 'cancellation')),
  scheduled_for timestamptz NOT NULL,
  message_content text NOT NULL,
  target_categories text[],
  is_sent boolean DEFAULT false,
  sent_at timestamptz,
  send_error text,
  auto_generated boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Table pour les règles d'automatisation
CREATE TABLE IF NOT EXISTS whatsapp_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('daily_training', 'reminder', 'match_day', 'custom')),
  trigger_condition jsonb NOT NULL, -- Conditions de déclenchement
  message_template text NOT NULL,
  target_categories text[],
  send_time_offset interval DEFAULT '-2 hours', -- Ex: 2h avant l'entraînement
  reminder_offset interval DEFAULT '-30 minutes', -- Rappel 30min avant
  is_active boolean DEFAULT true,
  last_executed timestamptz,
  execution_count integer DEFAULT 0,
  success_rate numeric DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE whatsapp_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Admins can manage polls"
  ON whatsapp_polls FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('webmaster', 'administrateur', 'entraineur')));

CREATE POLICY "Admins can view responses"
  ON whatsapp_poll_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('webmaster', 'administrateur', 'entraineur')));

CREATE POLICY "Admins can manage scheduled messages"
  ON whatsapp_scheduled_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('webmaster', 'administrateur', 'entraineur')));

CREATE POLICY "Admins can manage automation rules"
  ON whatsapp_automation_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('webmaster', 'administrateur', 'entraineur')));

-- Fonction pour créer un sondage automatique pour un entraînement
CREATE OR REPLACE FUNCTION create_training_poll(
  p_session_id uuid,
  p_auto_schedule boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record record;
  poll_id uuid;
  scheduled_time timestamptz;
  poll_message text;
BEGIN
  -- Récupérer les infos de la session
  SELECT * INTO session_record
  FROM training_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session non trouvée');
  END IF;
  
  -- Calculer l'heure d'envoi (2h avant l'entraînement)
  scheduled_time := (session_record.date::text || ' ' || session_record.start_time::text)::timestamptz - interval '2 hours';
  
  -- Générer le message de sondage
  poll_message := format('🏐 BE FOR NOR KA - Sondage Entraînement

📅 %s à %s
📍 %s
👨‍🏫 Coach: %s

%s

⚡ RÉPONDEZ RAPIDEMENT :
✅ PRÉSENT (tapez: OUI ou ✅)
❌ ABSENT (tapez: NON ou ❌)  
🤔 PEUT-ÊTRE (tapez: PEUT-ÊTRE ou 🤔)

Merci ! 🏐',
    to_char(session_record.date, 'DD/MM/YYYY'),
    session_record.start_time,
    session_record.location,
    session_record.coach,
    COALESCE(session_record.description, 'Entraînement régulier')
  );
  
  -- Créer le sondage
  INSERT INTO whatsapp_polls (
    session_id,
    poll_title,
    poll_message,
    scheduled_for,
    auto_send,
    created_by
  ) VALUES (
    p_session_id,
    session_record.title,
    poll_message,
    CASE WHEN p_auto_schedule THEN scheduled_time ELSE NULL END,
    p_auto_schedule,
    auth.uid()
  ) RETURNING id INTO poll_id;
  
  -- Programmer l'envoi si demandé
  IF p_auto_schedule THEN
    INSERT INTO whatsapp_scheduled_messages (
      session_id,
      poll_id,
      message_type,
      scheduled_for,
      message_content,
      target_categories,
      auto_generated,
      created_by
    ) VALUES (
      p_session_id,
      poll_id,
      'poll',
      scheduled_time,
      poll_message,
      session_record.category,
      true,
      auth.uid()
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'poll_id', poll_id,
    'scheduled_for', scheduled_time,
    'message', 'Sondage créé et programmé avec succès'
  );
END;
$$;

-- Fonction pour traiter une réponse WhatsApp
CREATE OR REPLACE FUNCTION process_whatsapp_response(
  p_phone_number text,
  p_response_text text,
  p_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_record record;
  poll_record record;
  response_status text;
  confidence_score numeric := 0;
  response_lower text;
BEGIN
  -- Nettoyer et normaliser la réponse
  response_lower := lower(trim(p_response_text));
  
  -- Analyser la réponse avec intelligence
  IF response_lower ~ '(oui|présent|ok|✅|👍|yes|y|1)' THEN
    response_status := 'present';
    confidence_score := 95;
  ELSIF response_lower ~ '(non|absent|❌|👎|no|n|0)' THEN
    response_status := 'absent';
    confidence_score := 95;
  ELSIF response_lower ~ '(peut-être|maybe|🤔|incertain|pas sûr)' THEN
    response_status := 'maybe';
    confidence_score := 90;
  ELSE
    -- Analyse plus fine avec mots-clés
    IF response_lower LIKE '%présent%' OR response_lower LIKE '%viens%' OR response_lower LIKE '%serai là%' THEN
      response_status := 'present';
      confidence_score := 80;
    ELSIF response_lower LIKE '%absent%' OR response_lower LIKE '%peux pas%' OR response_lower LIKE '%indisponible%' THEN
      response_status := 'absent';
      confidence_score := 80;
    ELSE
      response_status := 'maybe';
      confidence_score := 50;
    END IF;
  END IF;
  
  -- Trouver le membre par numéro de téléphone
  SELECT m.* INTO member_record
  FROM members m
  LEFT JOIN whatsapp_contacts wc ON wc.member_id = m.id
  WHERE wc.formatted_phone = p_phone_number 
     OR wc.phone_number = p_phone_number
     OR m.phone = p_phone_number
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membre non trouvé pour ce numéro');
  END IF;
  
  -- Trouver le sondage actif (le plus récent si pas spécifié)
  IF p_session_id IS NULL THEN
    SELECT wp.* INTO poll_record
    FROM whatsapp_polls wp
    JOIN training_sessions ts ON ts.id = wp.session_id
    WHERE wp.is_active = true
      AND ts.date >= CURRENT_DATE
      AND (ts.category && ARRAY[member_record.category] OR EXISTS(
        SELECT 1 FROM member_categories mc 
        WHERE mc.member_id = member_record.id 
        AND mc.category_value = ANY(ts.category)
      ))
    ORDER BY ts.date, ts.start_time
    LIMIT 1;
  ELSE
    SELECT wp.* INTO poll_record
    FROM whatsapp_polls wp
    WHERE wp.session_id = p_session_id AND wp.is_active = true;
  END IF;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun sondage actif trouvé');
  END IF;
  
  -- Enregistrer la réponse au sondage
  INSERT INTO whatsapp_poll_responses (
    poll_id,
    member_id,
    session_id,
    response_text,
    response_status,
    confidence_score,
    phone_number
  ) VALUES (
    poll_record.id,
    member_record.id,
    poll_record.session_id,
    p_response_text,
    response_status,
    confidence_score,
    p_phone_number
  )
  ON CONFLICT (poll_id, member_id) 
  DO UPDATE SET
    response_text = EXCLUDED.response_text,
    response_status = EXCLUDED.response_status,
    confidence_score = EXCLUDED.confidence_score,
    responded_at = now();
  
  -- Synchroniser avec attendance_records
  INSERT INTO attendance_records (
    session_id,
    member_id,
    status,
    response_date,
    notes
  ) VALUES (
    poll_record.session_id,
    member_record.id,
    response_status,
    now(),
    'Réponse via WhatsApp: ' || p_response_text
  )
  ON CONFLICT (session_id, member_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    response_date = EXCLUDED.response_date,
    notes = EXCLUDED.notes;
  
  -- Mettre à jour les statistiques du sondage
  UPDATE whatsapp_polls 
  SET 
    total_responses = (
      SELECT COUNT(*) 
      FROM whatsapp_poll_responses 
      WHERE poll_id = poll_record.id
    ),
    response_rate = (
      SELECT COUNT(*)::numeric / NULLIF(total_sent, 0) * 100
      FROM whatsapp_poll_responses 
      WHERE poll_id = poll_record.id
    ),
    updated_at = now()
  WHERE id = poll_record.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'member_name', member_record.first_name || ' ' || member_record.last_name,
    'response_status', response_status,
    'confidence_score', confidence_score,
    'session_title', poll_record.poll_title,
    'message', 'Réponse enregistrée et synchronisée'
  );
END;
$$;

-- Fonction pour programmer les sondages automatiques
CREATE OR REPLACE FUNCTION schedule_daily_training_polls()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record record;
  scheduled_count integer := 0;
  poll_id uuid;
  send_time timestamptz;
BEGIN
  -- Parcourir les entraînements des 7 prochains jours
  FOR session_record IN 
    SELECT * FROM training_sessions 
    WHERE date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM whatsapp_polls 
      WHERE session_id = training_sessions.id
    )
  LOOP
    -- Calculer l'heure d'envoi (8h le matin pour entraînement du jour, ou 2h avant)
    IF session_record.date = CURRENT_DATE THEN
      -- Entraînement aujourd'hui : envoyer à 8h ou maintenant si après 8h
      send_time := GREATEST(
        session_record.date + time '08:00:00',
        now()
      );
    ELSE
      -- Entraînement futur : envoyer à 8h le matin du jour J
      send_time := session_record.date + time '08:00:00';
    END IF;
    
    -- Créer le sondage programmé
    SELECT poll_id INTO poll_id FROM create_training_poll(session_record.id, true);
    
    -- Mettre à jour l'heure de programmation
    UPDATE whatsapp_polls 
    SET scheduled_for = send_time
    WHERE id = poll_id;
    
    UPDATE whatsapp_scheduled_messages
    SET scheduled_for = send_time
    WHERE poll_id = poll_id;
    
    scheduled_count := scheduled_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'scheduled_count', scheduled_count,
    'message', 'Sondages programmés pour les 7 prochains jours'
  );
END;
$$;

-- Fonction pour envoyer les messages programmés (à appeler via cron)
CREATE OR REPLACE FUNCTION send_scheduled_whatsapp_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_record record;
  sent_count integer := 0;
  error_count integer := 0;
BEGIN
  -- Parcourir les messages à envoyer
  FOR message_record IN 
    SELECT * FROM whatsapp_scheduled_messages 
    WHERE scheduled_for <= now() 
    AND is_sent = false
    ORDER BY scheduled_for
  LOOP
    BEGIN
      -- Marquer comme envoyé
      UPDATE whatsapp_scheduled_messages 
      SET 
        is_sent = true,
        sent_at = now()
      WHERE id = message_record.id;
      
      -- Mettre à jour le sondage associé
      IF message_record.poll_id IS NOT NULL THEN
        UPDATE whatsapp_polls 
        SET sent_at = now()
        WHERE id = message_record.poll_id;
      END IF;
      
      sent_count := sent_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Enregistrer l'erreur
      UPDATE whatsapp_scheduled_messages 
      SET send_error = SQLERRM
      WHERE id = message_record.id;
      
      error_count := error_count + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'sent_count', sent_count,
    'error_count', error_count,
    'message', 'Messages programmés traités'
  );
END;
$$;

-- Fonction pour obtenir le message de sondage formaté
CREATE OR REPLACE FUNCTION get_poll_message_for_session(
  p_session_id uuid,
  p_template_type text DEFAULT 'standard'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record record;
  poll_message text;
  category_labels text;
BEGIN
  -- Récupérer les infos de la session
  SELECT 
    ts.*,
    string_agg(c.label, ', ') as category_names
  INTO session_record
  FROM training_sessions ts
  LEFT JOIN categories c ON c.value = ANY(ts.category)
  WHERE ts.id = p_session_id
  GROUP BY ts.id, ts.title, ts.description, ts.date, ts.start_time, ts.end_time, ts.location, ts.category, ts.coach, ts.max_participants, ts.season_id, ts.created_by, ts.created_at, ts.updated_at;
  
  IF NOT FOUND THEN
    RETURN 'Session non trouvée';
  END IF;
  
  -- Template selon le type
  CASE p_template_type
    WHEN 'urgent' THEN
      poll_message := format('🚨 URGENT - BE FOR NOR KA

⚡ Entraînement: %s
📅 AUJOURD''HUI %s à %s
📍 %s
👨‍🏫 %s

%s

⚠️ RÉPONSE RAPIDE DEMANDÉE:
✅ PRÉSENT (OUI)
❌ ABSENT (NON)
🤔 PEUT-ÊTRE

Merci! 🏐',
        session_record.title,
        to_char(session_record.date, 'DD/MM'),
        session_record.start_time,
        session_record.location,
        session_record.coach,
        COALESCE(session_record.description, '')
      );
    
    WHEN 'match' THEN
      poll_message := format('🏆 BE FOR NOR KA - MATCH OFFICIEL

🆚 %s
📅 %s à %s
📍 %s
👨‍🏫 %s

%s

⚠️ PRÉSENCE OBLIGATOIRE
Confirmez RAPIDEMENT:
✅ PRÉSENT (OUI)
❌ ABSENT + justification

Allez-y les champions! 🏐💪',
        session_record.title,
        to_char(session_record.date, 'DD/MM/YYYY'),
        session_record.start_time,
        session_record.location,
        session_record.coach,
        COALESCE(session_record.description, '')
      );
    
    ELSE -- 'standard'
      poll_message := format('🏐 BE FOR NOR KA - Entraînement

📅 %s à %s
📍 %s
👨‍🏫 %s
🏷️ %s

%s

Confirmez votre présence:
✅ PRÉSENT (OUI)
❌ ABSENT (NON)
🤔 PEUT-ÊTRE

Sportivement! 🏐',
        to_char(session_record.date, 'DD/MM/YYYY'),
        session_record.start_time,
        session_record.location,
        session_record.coach,
        COALESCE(session_record.category_names, 'Toutes catégories'),
        COALESCE(session_record.description, 'Entraînement régulier')
      );
  END CASE;
  
  RETURN poll_message;
END;
$$;

-- Fonction pour obtenir les statistiques des sondages
CREATE OR REPLACE FUNCTION get_poll_statistics(
  p_session_id uuid DEFAULT NULL,
  p_date_from date DEFAULT CURRENT_DATE - interval '30 days',
  p_date_to date DEFAULT CURRENT_DATE + interval '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_polls integer;
  total_responses integer;
  avg_response_rate numeric;
  response_breakdown jsonb;
BEGIN
  -- Statistiques générales
  SELECT 
    COUNT(*),
    SUM(total_responses),
    AVG(response_rate)
  INTO total_polls, total_responses, avg_response_rate
  FROM whatsapp_polls wp
  JOIN training_sessions ts ON ts.id = wp.session_id
  WHERE 
    (p_session_id IS NULL OR wp.session_id = p_session_id)
    AND ts.date BETWEEN p_date_from AND p_date_to;
  
  -- Répartition des réponses
  SELECT jsonb_object_agg(
    response_status,
    count
  ) INTO response_breakdown
  FROM (
    SELECT 
      response_status,
      COUNT(*) as count
    FROM whatsapp_poll_responses wpr
    JOIN whatsapp_polls wp ON wp.id = wpr.poll_id
    JOIN training_sessions ts ON ts.id = wp.session_id
    WHERE 
      (p_session_id IS NULL OR wp.session_id = p_session_id)
      AND ts.date BETWEEN p_date_from AND p_date_to
    GROUP BY response_status
  ) stats;
  
  RETURN jsonb_build_object(
    'total_polls', COALESCE(total_polls, 0),
    'total_responses', COALESCE(total_responses, 0),
    'avg_response_rate', COALESCE(avg_response_rate, 0),
    'response_breakdown', COALESCE(response_breakdown, '{}'),
    'period', jsonb_build_object(
      'from', p_date_from,
      'to', p_date_to
    )
  );
END;
$$;

-- Insérer des règles d'automatisation par défaut
INSERT INTO whatsapp_automation_rules (
  rule_name,
  rule_type,
  trigger_condition,
  message_template,
  send_time_offset,
  reminder_offset,
  created_by
) VALUES
(
  'Sondage entraînement quotidien',
  'daily_training',
  '{"trigger": "training_scheduled", "time": "08:00", "days_ahead": 0}',
  'Template automatique - voir fonction get_poll_message_for_session',
  '-2 hours',
  '-30 minutes',
  (SELECT id FROM users WHERE role = 'webmaster' LIMIT 1)
),
(
  'Rappel non-répondants',
  'reminder',
  '{"trigger": "no_response", "time_before": "30 minutes"}',
  '⏰ RAPPEL - Entraînement dans 30 minutes!

Vous n''avez pas encore confirmé votre présence.
Répondez vite: ✅ OUI ou ❌ NON

Merci! 🏐',
  '-30 minutes',
  NULL,
  (SELECT id FROM users WHERE role = 'webmaster' LIMIT 1)
);

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_whatsapp_polls_session ON whatsapp_polls(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_polls_scheduled ON whatsapp_polls(scheduled_for) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_poll_responses_poll ON whatsapp_poll_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_poll_responses_member ON whatsapp_poll_responses(member_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_pending ON whatsapp_scheduled_messages(scheduled_for) WHERE is_sent = false;

-- Trigger pour créer automatiquement un sondage quand un entraînement est créé
CREATE OR REPLACE FUNCTION auto_create_training_poll()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Créer automatiquement un sondage pour le nouvel entraînement
  PERFORM create_training_poll(NEW.id, true);
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_auto_create_poll ON training_sessions;
CREATE TRIGGER trigger_auto_create_poll
  AFTER INSERT ON training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_training_poll();