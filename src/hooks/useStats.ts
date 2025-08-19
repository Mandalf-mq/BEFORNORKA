import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalMembers: number;
  validatedMembers: number;
  pendingMembers: number;
  rejectedMembers: number;
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  membersByCategory: Array<{
    category: string;
    count: number;
    revenue: number;
  }>;
  recentMembers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    status: string;
    created_at: string;
  }>;
  documentStats: Array<{
    document_type: string;
    total_uploaded: number;
    total_validated: number;
    total_pending: number;
    completion_rate: number;
  }>;
}

export const useStats = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 [useStats] Début du chargement des statistiques...');
      
      // Chargement direct des membres
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('*');

      if (membersError) {
        console.error('❌ [useStats] Erreur membres:', membersError);
        throw membersError;
      }
      
      console.log('✅ [useStats] Membres chargés pour stats:', members?.length || 0);
      
      // Si aucun membre, retourner des stats vides mais valides
      if (!members || members.length === 0) {
        console.log('ℹ️ [useStats] Aucun membre trouvé, retour de stats vides');
        setStats({
          totalMembers: 0,
          validatedMembers: 0,
          pendingMembers: 0,
          rejectedMembers: 0,
          totalRevenue: 0,
          paidRevenue: 0,
          pendingRevenue: 0,
          membersByCategory: [],
          recentMembers: [],
          documentStats: []
        });
        return;
      }

      // Chargement des documents avec gestion d'erreur
      let documents = null;
      try {
        const { data: documentsData, error: documentsError } = await supabase
          .from('member_documents')
          .select('document_type, status');

        if (documentsError) {
          console.warn('⚠️ [useStats] Erreur documents (on continue):', documentsError);
        } else {
          documents = documentsData;
          console.log('✅ [useStats] Documents chargés:', documents?.length || 0);
        }
      } catch (docError) {
        console.warn('⚠️ [useStats] Erreur documents (on continue):', docError);
      }

      // Calculer les statistiques
      const totalMembers = members?.length || 0;
      const validatedMembers = members?.filter(m => m.status === 'validated').length || 0;
      const pendingMembers = members?.filter(m => m.status === 'pending').length || 0;
      const rejectedMembers = members?.filter(m => m.status === 'rejected').length || 0;

      const totalRevenue = members?.reduce((sum, m) => sum + (m.membership_fee || 0), 0) || 0;
      const paidRevenue = members?.filter(m => m.payment_status === 'paid')
        .reduce((sum, m) => sum + (m.membership_fee || 0), 0) || 0;
      const pendingRevenue = members?.filter(m => m.payment_status === 'pending')
        .reduce((sum, m) => sum + (m.membership_fee || 0), 0) || 0;

      // Statistiques par catégorie
      const categoryStats = members?.reduce((acc, member) => {
        const category = member.category || 'unknown';
        if (!acc[category]) {
          acc[category] = { count: 0, revenue: 0 };
        }
        acc[category].count++;
        acc[category].revenue += member.membership_fee || 0;
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>);

      const membersByCategory = Object.entries(categoryStats || {}).map(([category, data]) => ({
        category,
        count: data.count,
        revenue: data.revenue
      }));

      // Membres récents
      const recentMembers = members?.slice(0, 5).map(m => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        status: m.status,
        created_at: m.created_at
      })) || [];

      // Statistiques des documents
      const docStats = documents?.reduce((acc, doc) => {
        const type = doc.document_type;
        if (!acc[type]) {
          acc[type] = { total_uploaded: 0, total_validated: 0, total_pending: 0 };
        }
        acc[type].total_uploaded++;
        if (doc.status === 'validated') acc[type].total_validated++;
        if (doc.status === 'pending') acc[type].total_pending++;
        return acc;
      }, {} as Record<string, any>);

      const documentStats = Object.entries(docStats || {}).map(([document_type, data]) => ({
        document_type,
        total_uploaded: data.total_uploaded,
        total_validated: data.total_validated,
        total_pending: data.total_pending,
        completion_rate: Math.round((data.total_validated / data.total_uploaded) * 100) || 0
      }));

      setStats({
        totalMembers,
        validatedMembers,
        pendingMembers,
        rejectedMembers,
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        membersByCategory,
        recentMembers,
        documentStats
      });

      console.log('✅ [useStats] Statistiques calculées avec succès');
    } catch (err: any) {
      console.error('❌ [useStats] Erreur finale:', err);
      // Ne pas définir d'erreur pour éviter les boucles, juste logger
      console.warn('Statistiques non disponibles:', err.message);
      setStats({
        totalMembers: 0,
        validatedMembers: 0,
        pendingMembers: 0,
        rejectedMembers: 0,
        totalRevenue: 0,
        paidRevenue: 0,
        pendingRevenue: 0,
        membersByCategory: [],
        recentMembers: [],
        documentStats: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Optionnel : rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []); // Exécuter une seule fois au montage puis toutes les 30s

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
};