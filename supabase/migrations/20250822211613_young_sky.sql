/*
  # Améliorations complètes du gestionnaire WhatsApp

  1. Nouvelles tables
    - `whatsapp_contacts` : Gestion des contacts avec validation
    - `whatsapp_message_history` : Historique des envois
    - `whatsapp_templates_enhanced` : Templates avancés
    - `whatsapp_consent` : Gestion RGPD
    - `whatsapp_statistics` : Statistiques d'engagement

  2. Fonctionnalités
    - Validation des numéros de téléphone
    - Suivi des envois et réponses
    - Gestion des consentements RGPD
    - Templates intelligents avec variables
    - Statistiques d'engagement

  3. Sécurité
    - RLS activé sur toutes les tables
    - Politiques d'accès par rôle
    - Logs de traçabilité
*/

-- Table pour la gestion des contacts WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  formatted_phone text, -- Numéro formaté pour WhatsApp
  is_valid boolean DEFAULT false,
  validation_date timestamptz,
  last_message_sent timestamptz,
  total_messages_sent integer DEFAULT 0,
  has_consent boolean DEFAULT false,
  consent_date timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table pour l'historique des messages
CREATE TABLE IF NOT EXISTS whatsapp_message_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES training_sessions(id),
  contact_id uuid REFERENCES whatsapp_contacts(id),
  member_id uuid REFERENCES members(id),
  template_id uuid,
  message_content text NOT NULL,
  message_type text DEFAULT 'training' CHECK (message_type IN ('training', 'match', 'urgent', 'reminder', 'custom')),
  sent_at timestamptz DEFAULT now(),
  delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')),
  response_received boolean DEFAULT false,
  response_content text,
  response_at timestamptz,
  sent_by uuid REFERENCES users(id),
  season_id uuid REFERENCES seasons(id),
  created_at timestamptz DEFAULT now()
);

-- Table pour les templates avancés
CREATE TABLE IF NOT EXISTS whatsapp_templates_enhanced (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  message_template text NOT NULL,
  template_type text DEFAULT 'training' CHECK (template_type IN ('training', 'match', 'urgent', 'reminder', 'custom')),
  variables jsonb DEFAULT '{}', -- Variables personnalisées
  suggested_emojis text[],
  auto_suggest_conditions jsonb DEFAULT '{}', -- Conditions pour suggestion auto
  usage_count integer DEFAULT 0,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  season_id uuid REFERENCES seasons(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table pour les consentements RGPD
CREATE TABLE IF NOT EXISTS whatsapp_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  consent_given boolean DEFAULT false,
  consent_date timestamptz,
  consent_withdrawn boolean DEFAULT false,
  withdrawal_date timestamptz,
  consent_source text DEFAULT 'manual' CHECK (consent_source IN ('manual', 'form', 'verbal', 'implied')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id)
);

-- Table pour les statistiques d'engagement
CREATE TABLE IF NOT EXISTS whatsapp_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id),
  session_id uuid REFERENCES training_sessions(id),
  message_sent_at timestamptz,
  message_opened_at timestamptz,
  response_given_at timestamptz,
  response_type text CHECK (response_type IN ('present', 'absent', 'maybe', 'no_response')),
  engagement_score integer DEFAULT 0, -- Score d'engagement 0-100
  season_id uuid REFERENCES seasons(id),
  created_at timestamptz DEFAULT now()
);

-- Activer RLS sur toutes les nouvelles tables
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_statistics ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour whatsapp_contacts
CREATE POLICY "Admins can manage all contacts"
  ON whatsapp_contacts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('webmaster', 'administrateur', 'entraineur')
    )
  );

-- Politiques RLS pour whatsapp_message_history
CREATE POLICY "Admins can view message history"
  ON whatsapp_message_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('webmaster', 'administrateur', 'entraineur')
    )
  );

CREATE POLICY "Admins can insert messages"
  ON whatsapp_message_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('webmaster', 'administrateur', 'entraineur')
    )
  );

-- Politiques RLS pour whatsapp_templates_enhanced
CREATE POLICY "Admins can manage templates"
  ON whatsapp_templates_enhanced
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('webmaster', 'administrateur', 'entraineur')
    )
  );

-- Politiques RLS pour whatsapp_consent
CREATE POLICY "Members can view own consent"
  ON whatsapp_consent
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT id FROM members WHERE email = auth.email()
    )
  );

CREATE POLICY "Admins can manage all consent"
  ON whatsapp_consent
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('webmaster', 'administrateur')
    )
  );

-- Politiques RLS pour whatsapp_statistics
CREATE POLICY "Admins can view statistics"
  ON whatsapp_statistics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('webmaster', 'administrateur', 'entraineur')
    )
  );

-- Fonction pour valider et formater les numéros de téléphone français
CREATE OR REPLACE FUNCTION validate_french_phone(phone_input text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  cleaned_phone text;
  formatted_phone text;
  is_valid boolean := false;
BEGIN
  -- Nettoyer le numéro (supprimer espaces, tirets, points, parenthèses)
  cleaned_phone := regexp_replace(phone_input, '[^0-9+]', '', 'g');
  
  -- Vérifier les formats français valides
  IF cleaned_phone ~ '^0[1-9][0-9]{8}$' THEN
    -- Format 0X XX XX XX XX
    formatted_phone := '33' || substring(cleaned_phone from 2);
    is_valid := true;
  ELSIF cleaned_phone ~ '^33[1-9][0-9]{8}$' THEN
    -- Format 33X XX XX XX XX
    formatted_phone := cleaned_phone;
    is_valid := true;
  ELSIF cleaned_phone ~ '^\+33[1-9][0-9]{8}$' THEN
    -- Format +33X XX XX XX XX
    formatted_phone := substring(cleaned_phone from 2);
    is_valid := true;
  END IF;
  
  RETURN jsonb_build_object(
    'original', phone_input,
    'cleaned', cleaned_phone,
    'formatted', formatted_phone,
    'is_valid', is_valid,
    'whatsapp_url', CASE 
      WHEN is_valid THEN 'https://wa.me/' || formatted_phone 
      ELSE null 
    END
  );
END;
$$;

-- Fonction pour obtenir les contacts WhatsApp avec validation
CREATE OR REPLACE FUNCTION get_whatsapp_contacts_validated(
  p_categories text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  member_id uuid,
  first_name text,
  last_name text,
  phone_original text,
  phone_formatted text,
  phone_valid boolean,
  whatsapp_url text,
  category text,
  additional_categories text[],
  has_consent boolean,
  last_message_sent timestamptz,
  total_messages_sent integer,
  engagement_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    wc.id,
    m.id as member_id,
    m.first_name,
    m.last_name,
    m.phone as phone_original,
    wc.formatted_phone as phone_formatted,
    wc.is_valid as phone_valid,
    CASE 
      WHEN wc.is_valid THEN 'https://wa.me/' || wc.formatted_phone 
      ELSE null 
    END as whatsapp_url,
    m.category,
    COALESCE(
      ARRAY(
        SELECT mc.category_value 
        FROM member_categories mc 
        WHERE mc.member_id = m.id 
        AND mc.is_primary = false
      ), 
      ARRAY[]::text[]
    ) as additional_categories,
    COALESCE(wcons.consent_given, false) as has_consent,
    wc.last_message_sent,
    wc.total_messages_sent,
    COALESCE(
      (SELECT AVG(engagement_score)::integer 
       FROM whatsapp_statistics ws 
       WHERE ws.member_id = m.id),
      0
    ) as engagement_score
  FROM members m
  LEFT JOIN whatsapp_contacts wc ON wc.member_id = m.id
  LEFT JOIN whatsapp_consent wcons ON wcons.member_id = m.id
  LEFT JOIN member_categories mc ON mc.member_id = m.id
  WHERE 
    m.status = 'season_validated'
    AND m.phone IS NOT NULL 
    AND m.phone != ''
    AND (wcons.consent_given = true OR wcons.consent_given IS NULL) -- Consentement donné ou pas encore demandé
    AND (
      p_categories IS NULL 
      OR m.category = ANY(p_categories)
      OR EXISTS (
        SELECT 1 
        FROM member_categories mc2 
        WHERE mc2.member_id = m.id 
        AND mc2.category_value = ANY(p_categories)
      )
    )
  ORDER BY m.first_name, m.last_name;
END;
$$;

-- Fonction pour enregistrer un envoi WhatsApp
CREATE OR REPLACE FUNCTION log_whatsapp_message(
  p_session_id uuid,
  p_member_ids uuid[],
  p_message_content text,
  p_template_id uuid DEFAULT NULL,
  p_message_type text DEFAULT 'training'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sent_count integer := 0;
  failed_count integer := 0;
  member_id uuid;
  contact_record record;
BEGIN
  -- Parcourir chaque membre
  FOREACH member_id IN ARRAY p_member_ids
  LOOP
    -- Récupérer les infos de contact
    SELECT * INTO contact_record
    FROM whatsapp_contacts wc
    WHERE wc.member_id = member_id;
    
    IF contact_record.is_valid THEN
      -- Enregistrer l'envoi
      INSERT INTO whatsapp_message_history (
        session_id,
        contact_id,
        member_id,
        template_id,
        message_content,
        message_type,
        sent_by
      ) VALUES (
        p_session_id,
        contact_record.id,
        member_id,
        p_template_id,
        p_message_content,
        p_message_type,
        auth.uid()
      );
      
      -- Mettre à jour les statistiques du contact
      UPDATE whatsapp_contacts 
      SET 
        last_message_sent = now(),
        total_messages_sent = total_messages_sent + 1,
        updated_at = now()
      WHERE id = contact_record.id;
      
      sent_count := sent_count + 1;
    ELSE
      failed_count := failed_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'sent_count', sent_count,
    'failed_count', failed_count,
    'total_attempted', array_length(p_member_ids, 1)
  );
END;
$$;

-- Fonction pour synchroniser les contacts depuis les membres
CREATE OR REPLACE FUNCTION sync_whatsapp_contacts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processed_count integer := 0;
  updated_count integer := 0;
  member_record record;
  phone_validation jsonb;
BEGIN
  -- Parcourir tous les membres avec téléphone
  FOR member_record IN 
    SELECT id, phone 
    FROM members 
    WHERE phone IS NOT NULL AND phone != ''
  LOOP
    -- Valider le numéro
    phone_validation := validate_french_phone(member_record.phone);
    
    -- Insérer ou mettre à jour le contact
    INSERT INTO whatsapp_contacts (
      member_id,
      phone_number,
      formatted_phone,
      is_valid,
      validation_date
    ) VALUES (
      member_record.id,
      member_record.phone,
      (phone_validation->>'formatted'),
      (phone_validation->>'is_valid')::boolean,
      CASE WHEN (phone_validation->>'is_valid')::boolean THEN now() ELSE NULL END
    )
    ON CONFLICT (member_id) 
    DO UPDATE SET
      phone_number = EXCLUDED.phone_number,
      formatted_phone = EXCLUDED.formatted_phone,
      is_valid = EXCLUDED.is_valid,
      validation_date = EXCLUDED.validation_date,
      updated_at = now();
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', processed_count,
    'message', 'Contacts WhatsApp synchronisés'
  );
END;
$$;

-- Fonction pour obtenir les statistiques WhatsApp
CREATE OR REPLACE FUNCTION get_whatsapp_stats(
  p_season_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_contacts integer;
  valid_contacts integer;
  consent_given integer;
  messages_sent integer;
  avg_engagement numeric;
  season_filter uuid;
BEGIN
  -- Utiliser la saison courante si non spécifiée
  IF p_season_id IS NULL THEN
    SELECT id INTO season_filter FROM seasons WHERE is_current = true LIMIT 1;
  ELSE
    season_filter := p_season_id;
  END IF;
  
  -- Calculer les statistiques
  SELECT COUNT(*) INTO total_contacts FROM whatsapp_contacts WHERE is_active = true;
  SELECT COUNT(*) INTO valid_contacts FROM whatsapp_contacts WHERE is_valid = true AND is_active = true;
  SELECT COUNT(*) INTO consent_given FROM whatsapp_consent WHERE consent_given = true;
  
  SELECT COUNT(*) INTO messages_sent 
  FROM whatsapp_message_history 
  WHERE season_id = season_filter OR season_filter IS NULL;
  
  SELECT AVG(engagement_score) INTO avg_engagement 
  FROM whatsapp_statistics 
  WHERE season_id = season_filter OR season_filter IS NULL;
  
  RETURN jsonb_build_object(
    'total_contacts', total_contacts,
    'valid_contacts', valid_contacts,
    'invalid_contacts', total_contacts - valid_contacts,
    'consent_given', consent_given,
    'consent_pending', total_contacts - consent_given,
    'messages_sent', messages_sent,
    'avg_engagement', COALESCE(avg_engagement, 0),
    'season_id', season_filter
  );
END;
$$;

-- Insérer des templates par défaut améliorés
INSERT INTO whatsapp_templates_enhanced (name, description, message_template, template_type, variables, suggested_emojis) VALUES
(
  'Appel entraînement standard',
  'Template standard pour les entraînements réguliers',
  '🏐 BE FOR NOR KA - Entraînement {titre}

📅 Date : {date}
⏰ Heure : {heure}
📍 Lieu : {lieu}
👨‍🏫 Coach : {coach}

{description}

Merci de confirmer votre présence en répondant :
✅ OUI pour présent
🤔 PEUT-ÊTRE si incertain
❌ NON pour absent

Sportivement,
L''équipe BE FOR NOR KA',
  'training',
  '{"weather": "Pensez à vérifier la météo", "equipment": "N''oubliez pas vos affaires de sport"}',
  ARRAY['🏐', '📅', '⏰', '📍', '👨‍🏫', '✅', '❌', '🤔']
),
(
  'Rappel urgent',
  'Pour les entraînements de dernière minute',
  '🚨 URGENT - BE FOR NOR KA

⚡ Entraînement exceptionnel : {titre}
📅 AUJOURD''HUI {date}
⏰ {heure}
📍 {lieu}

{description}

⚠️ Réponse RAPIDE demandée :
✅ PRÉSENT
❌ ABSENT

Coach : {coach}',
  'urgent',
  '{}',
  ARRAY['🚨', '⚡', '⚠️', '🏃‍♂️', '💨']
),
(
  'Match officiel',
  'Pour les convocations de match',
  '🏆 BE FOR NOR KA - MATCH OFFICIEL

🆚 Match : {titre}
📅 Date : {date}
⏰ Heure : {heure}
📍 Lieu : {lieu}
👨‍🏫 Coach : {coach}

{description}

⚠️ PRÉSENCE OBLIGATOIRE
Merci de confirmer RAPIDEMENT :
✅ PRÉSENT
❌ ABSENT (avec justification)

Bonne chance à tous ! 🏐',
  'match',
  '{"opponent": "Adversaire à préciser", "competition": "Championnat"}',
  ARRAY['🏆', '🆚', '⚠️', '🏐', '💪', '🔥']
);

-- Synchroniser les contacts existants
SELECT sync_whatsapp_contacts();

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_member_id ON whatsapp_contacts(member_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_valid ON whatsapp_contacts(is_valid) WHERE is_valid = true;
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_session ON whatsapp_message_history(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_member ON whatsapp_message_history(member_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_statistics_member ON whatsapp_statistics(member_id);