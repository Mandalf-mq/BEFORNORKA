// API pour servir les calendriers .ics des membres

import { supabase } from '../lib/supabase';
import { generateICSFile } from '../utils/calendarExport';

// Fonction pour récupérer et générer le calendrier d'un membre
export const generateMemberCalendar = async (calendarToken: string): Promise<string | null> => {
  try {
    console.log('📅 [Calendar API] Génération calendrier pour token:', calendarToken);
    
    // Récupérer les entraînements du membre via son token
    const { data: sessions, error } = await supabase.rpc('get_member_training_calendar', {
      p_calendar_token: calendarToken
    });

    if (error) {
      console.error('❌ [Calendar API] Erreur récupération sessions:', error);
      return null;
    }

    if (!sessions || sessions.length === 0) {
      console.log('⚠️ [Calendar API] Aucune session trouvée pour ce token');
      // Retourner un calendrier vide mais valide
      return generateICSFile([], 'Membre inconnu');
    }

    console.log('✅ [Calendar API] Sessions trouvées:', sessions.length);
    
    // Utiliser le nom du premier entraînement pour identifier le membre
    const memberName = sessions[0]?.member_name || 'Membre BE FOR NOR KA';
    
    // Convertir les données pour le générateur .ics
    const calendarEvents = sessions.map(session => ({
      id: session.id,
      title: session.title,
      description: session.description || '',
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      location: session.location,
      coach: session.coach,
      category_labels: session.category_labels || ''
    }));

    // Générer le fichier .ics
    const icsContent = generateICSFile(calendarEvents, memberName);
    
    console.log('✅ [Calendar API] Calendrier généré avec succès');
    return icsContent;

  } catch (error) {
    console.error('❌ [Calendar API] Erreur génération calendrier:', error);
    return null;
  }
};

// Fonction pour valider un token de calendrier
export const validateCalendarToken = async (calendarToken: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('id')
      .eq('calendar_token', calendarToken)
      .eq('status', 'season_validated')
      .maybeSingle();

    if (error) {
      console.error('❌ [Calendar API] Erreur validation token:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('❌ [Calendar API] Erreur validation token:', error);
    return false;
  }
};