import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UseTrainingRealtimeProps {
  onSessionsChange: () => void;
  enabled?: boolean;
}

export const useTrainingRealtime = ({ onSessionsChange, enabled = true }: UseTrainingRealtimeProps) => {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    console.log('🔄 [useTrainingRealtime] Initialisation des subscriptions temps réel');

    // Créer le canal de subscription
    channelRef.current = supabase
      .channel('training_sessions_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_sessions'
        },
        (payload) => {
          console.log('🔄 [useTrainingRealtime] Changement détecté:', payload.eventType, payload.new?.title || payload.old?.title);
          
          // Délai court pour permettre à la base de données de se synchroniser
          setTimeout(() => {
            onSessionsChange();
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_categories'
        },
        (payload) => {
          console.log('🔄 [useTrainingRealtime] Changement catégories membre détecté:', payload.eventType);
          
          // Recharger aussi quand les catégories des membres changent
          setTimeout(() => {
            onSessionsChange();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        console.log('🔌 [useTrainingRealtime] Fermeture des subscriptions');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, onSessionsChange]);

  return {
    cleanup: () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  };
};