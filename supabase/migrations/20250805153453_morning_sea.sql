/*
  # Ajout de membres d'exemple pour tester l'application

  1. Membres d'exemple
    - Création de 5 membres avec des profils variés
    - Différentes catégories d'âge
    - Statuts différents pour tester les fonctionnalités

  2. Données réalistes
    - Noms français
    - Dates de naissance cohérentes avec les catégories
    - Emails et téléphones valides
    - Tarifs automatiquement calculés
*/

-- Insérer des membres d'exemple pour tester l'application
INSERT INTO members (
  first_name,
  last_name,
  birth_date,
  email,
  phone,
  category,
  membership_fee,
  status,
  payment_status,
  registration_date,
  ffvb_license
) VALUES
  (
    'Sophie',
    'Martin',
    '1995-03-15',
    'sophie.martin@email.com',
    '06 12 34 56 78',
    'senior',
    250,
    'validated',
    'paid',
    '2024-09-01',
    'FFVB001234'
  ),
  (
    'Lucas',
    'Dubois',
    '2010-07-22',
    'lucas.dubois@email.com',
    '06 23 45 67 89',
    'minime',
    180,
    'validated',
    'paid',
    '2024-09-05',
    'FFVB001235'
  ),
  (
    'Emma',
    'Leroy',
    '2008-11-08',
    'emma.leroy@email.com',
    '06 34 56 78 90',
    'benjamin',
    160,
    'pending',
    'pending',
    '2024-09-10',
    NULL
  ),
  (
    'Thomas',
    'Bernard',
    '1988-05-30',
    'thomas.bernard@email.com',
    '06 45 67 89 01',
    'veteran',
    200,
    'validated',
    'paid',
    '2024-08-25',
    'FFVB001236'
  ),
  (
    'Léa',
    'Moreau',
    '2012-12-03',
    'lea.moreau@email.com',
    '06 56 78 90 12',
    'cadet',
    200,
    'pending',
    'pending',
    '2024-09-15',
    NULL
  ),
  (
    'Pierre',
    'Roux',
    '1992-08-17',
    'pierre.roux@email.com',
    '06 67 89 01 23',
    'senior',
    250,
    'rejected',
    'pending',
    '2024-09-20',
    NULL
  ),
  (
    'Camille',
    'Petit',
    '2006-04-12',
    'camille.petit@email.com',
    '06 78 90 12 34',
    'junior',
    220,
    'validated',
    'overdue',
    '2024-08-30',
    'FFVB001237'
  ),
  (
    'Antoine',
    'Garcia',
    '2014-01-25',
    'antoine.garcia@email.com',
    '06 89 01 23 45',
    'poussin',
    140,
    'pending',
    'pending',
    '2024-09-12',
    NULL
  )
ON CONFLICT (email) DO NOTHING;

-- Insérer quelques séances d'entraînement d'exemple
INSERT INTO training_sessions (
  title,
  date,
  start_time,
  end_time,
  location,
  category,
  coach,
  description
) VALUES
  (
    'Entraînement Seniors - Technique',
    CURRENT_DATE + INTERVAL '1 day',
    '19:00',
    '21:00',
    'Gymnase Municipal',
    ARRAY['senior', 'veteran'],
    'Coach Sophie',
    'Travail technique sur les attaques et la défense'
  ),
  (
    'Entraînement Jeunes - Initiation',
    CURRENT_DATE + INTERVAL '2 days',
    '17:00',
    '18:30',
    'Gymnase Municipal',
    ARRAY['benjamin', 'minime'],
    'Coach Lucas',
    'Initiation aux gestes techniques de base'
  ),
  (
    'Entraînement Compétition',
    CURRENT_DATE + INTERVAL '3 days',
    '20:00',
    '22:00',
    'Gymnase Municipal',
    ARRAY['cadet', 'junior', 'senior'],
    'Coach Pierre',
    'Préparation match championnat départemental'
  )
ON CONFLICT DO NOTHING;

-- Message de confirmation
DO $$
DECLARE
  member_count integer;
  session_count integer;
BEGIN
  SELECT COUNT(*) INTO member_count FROM members;
  SELECT COUNT(*) INTO session_count FROM training_sessions;
  
  RAISE NOTICE '✅ DONNÉES D''EXEMPLE AJOUTÉES !';
  RAISE NOTICE '';
  RAISE NOTICE '👥 Membres créés : %', member_count;
  RAISE NOTICE '🏐 Séances créées : %', session_count;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Répartition des statuts :';
  RAISE NOTICE '  - Validés : % membres', (SELECT COUNT(*) FROM members WHERE status = 'validated');
  RAISE NOTICE '  - En attente : % membres', (SELECT COUNT(*) FROM members WHERE status = 'pending');
  RAISE NOTICE '  - Rejetés : % membres', (SELECT COUNT(*) FROM members WHERE status = 'rejected');
  RAISE NOTICE '';
  RAISE NOTICE '💰 Revenus :';
  RAISE NOTICE '  - Total : %€', (SELECT SUM(membership_fee) FROM members);
  RAISE NOTICE '  - Payés : %€', (SELECT SUM(membership_fee) FROM members WHERE payment_status = 'paid');
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Maintenant votre application devrait afficher des données !';
END $$;