import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { generateMemberCalendar } from '../../api/calendar';

export const CalendarAPI: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    const handleCalendarRequest = async () => {
      if (!token) {
        // Token manquant
        document.body.innerHTML = `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc2626;">❌ Token manquant</h1>
            <p>URL invalide pour la synchronisation calendrier.</p>
          </div>
        `;
        return;
      }

      // Extraire le token du nom de fichier (supprimer .ics)
      const cleanToken = token.replace('.ics', '');
      
      try {
        console.log('📅 [CalendarAPI] Requête calendrier pour token:', cleanToken);
        
        const icsContent = await generateMemberCalendar(cleanToken);
        
        if (!icsContent) {
          // Token invalide ou membre non trouvé
          document.body.innerHTML = `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #dc2626;">🔒 Accès refusé</h1>
              <p>Token de calendrier invalide ou membre non validé.</p>
              <p style="font-size: 12px; color: #666; margin-top: 20px;">
                Si vous êtes membre de BE FOR NOR KA, contactez un administrateur.
              </p>
            </div>
          `;
          return;
        }

        // Servir le fichier .ics
        const blob = new Blob([icsContent], { 
          type: 'text/calendar; charset=utf-8' 
        });
        
        // Créer une URL pour le blob
        const url = URL.createObjectURL(blob);
        
        // Déclencher le téléchargement
        const link = document.createElement('a');
        link.href = url;
        link.download = `BE_FOR_NOR_KA_Entrainements.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Nettoyer
        URL.revokeObjectURL(url);
        
        // Afficher un message de succès
        document.body.innerHTML = `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #059669;">✅ Calendrier généré !</h1>
            <p>Votre calendrier d'entraînements a été téléchargé.</p>
            <p style="margin-top: 20px;">
              <strong>🏐 BE FOR NOR KA</strong><br>
              Calendrier des entraînements personnalisé
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Ce calendrier se met à jour automatiquement.<br>
              Ajoutez l'URL de cette page à votre application calendrier pour la synchronisation.
            </p>
          </div>
        `;
        
        console.log('✅ [CalendarAPI] Calendrier servi avec succès');
        
      } catch (error) {
        console.error('❌ [CalendarAPI] Erreur génération calendrier:', error);
        
        document.body.innerHTML = `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc2626;">❌ Erreur</h1>
            <p>Impossible de générer le calendrier.</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}
            </p>
          </div>
        `;
      }
    };

    handleCalendarRequest();
  }, [token]);

  // Affichage de chargement pendant la génération
  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      textAlign: 'center', 
      padding: '50px',
      background: 'linear-gradient(135deg, #fdf2f8 0%, #f0fdf4 50%, #fffbeb 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '400px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #ec4899',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }}></div>
        <h1 style={{ color: '#1f2937', marginBottom: '10px' }}>
          🏐 BE FOR NOR KA
        </h1>
        <p style={{ color: '#6b7280' }}>
          Génération de votre calendrier d'entraînements...
        </p>
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '20px' }}>
          Veuillez patienter quelques secondes
        </p>
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};