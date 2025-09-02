// Utilitaires pour l'export et la synchronisation calendrier

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  coach: string;
  category_labels?: string;
}

// Générer un fichier .ics pour un membre
export const generateICSFile = (events: CalendarEvent[], memberName: string): string => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BE FOR NOR KA//Volleyball Training Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:BE FOR NOR KA - Entraînements',
    'X-WR-CALDESC:Calendrier des entraînements de volleyball pour ' + memberName,
    'X-WR-TIMEZONE:Europe/Paris'
  ];

  events.forEach(event => {
    // Créer les dates au format iCalendar (YYYYMMDDTHHMMSS)
    const eventDate = new Date(event.date + 'T00:00:00');
    const startDateTime = new Date(event.date + 'T' + event.start_time + ':00');
    const endDateTime = new Date(event.date + 'T' + event.end_time + ':00');
    
    const formatICSDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const formatICSDateLocal = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };

    // Construire la description
    let description = `🏐 Entraînement BE FOR NOR KA\\n\\n`;
    description += `👨‍🏫 Coach: ${event.coach}\\n`;
    if (event.category_labels) {
      description += `🏷️ Catégories: ${event.category_labels}\\n`;
    }
    if (event.description) {
      description += `\\n📝 ${event.description.replace(/\n/g, '\\n')}`;
    }
    description += `\\n\\n📱 Généré par BE FOR NOR KA`;

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:training-${event.id}@befornorka.fr`,
      `DTSTAMP:${timestamp}`,
      `DTSTART:${formatICSDateLocal(startDateTime)}`,
      `DTEND:${formatICSDateLocal(endDateTime)}`,
      `SUMMARY:🏐 ${event.title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${event.location}`,
      `ORGANIZER;CN=BE FOR NOR KA:mailto:contact@befornorka.fr`,
      `CATEGORIES:VOLLEYBALL,SPORT,ENTRAINEMENT`,
      `STATUS:CONFIRMED`,
      `TRANSP:OPAQUE`,
      // Rappels : 30 minutes et 2 heures avant
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:🏐 Entraînement dans 30 minutes !',
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:🏐 Entraînement dans 2 heures - Préparez vos affaires !',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');
  
  return icsContent.join('\r\n');
};

// Télécharger un fichier .ics
export const downloadICSFile = (icsContent: string, fileName: string) => {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

// Générer l'URL de synchronisation pour un membre
export const generateSyncURL = (calendarToken: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/calendar/${calendarToken}.ics`;
};

// Instructions pour ajouter à Google Calendar
export const getGoogleCalendarInstructions = (syncUrl: string): string => {
  return `📅 AJOUTER À GOOGLE CALENDAR :

1. Ouvrez Google Calendar (calendar.google.com)
2. Cliquez sur le "+" à côté de "Autres agendas"
3. Sélectionnez "À partir d'une URL"
4. Collez cette URL :
   ${syncUrl}
5. Cliquez sur "Ajouter l'agenda"

✅ Vos entraînements apparaîtront automatiquement !
🔄 Mise à jour automatique toutes les heures.`;
};

// Instructions pour autres calendriers
export const getCalendarInstructions = (syncUrl: string): string => {
  return `📅 SYNCHRONISATION CALENDRIER :

🔗 URL de synchronisation :
${syncUrl}

📱 APPLE CALENDAR (iPhone/Mac) :
1. Réglages > Calendrier > Comptes
2. Ajouter un compte > Autre
3. Ajouter un calendrier par abonnement
4. Coller l'URL ci-dessus

💻 OUTLOOK :
1. Fichier > Gestion des comptes
2. Paramètres du compte > Calendriers Internet
3. Nouveau > Coller l'URL

🌐 AUTRES CALENDRIERS :
Cherchez "Ajouter calendrier par URL" ou "Abonnement calendrier"

⚠️ IMPORTANT :
• Gardez cette URL secrète
• Mise à jour automatique toutes les 15min-1h
• Pour révoquer l'accès, demandez un nouveau lien`;
};

// Valider le format d'un fichier .ics
export const validateICSFormat = (icsContent: string): boolean => {
  const requiredLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'END:VCALENDAR'
  ];
  
  return requiredLines.every(line => icsContent.includes(line));
};