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
    categoryLabel: string;
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
      
      // 1. Charger les catégories depuis la DB
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('value, label, color')
        .eq('is_active', true);

      if (categoriesError) {
        console.error('❌ [useStats] Erreur catégories:', categoriesError);
        throw categoriesError;
      }

      console.log('✅ [useStats] Catégories chargées:', categoriesData?.length || 0);
      
      // 2. Chargement des membres avec leurs catégories
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select(`
          *,
          member_categories (
            category_value,
            is_primary
          )
        `);

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

      // 3. Chargement des documents avec gestion d'erreur
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

      // 4. Calculer les statistiques de base
      const totalMembers = members?.length || 0;
      const validatedMembers = members?.filter(m => m.status === 'validated').length || 0;
      const pendingMembers = members?.filter(m => m.status === 'pending').length || 0;
      const rejectedMembers = members?.filter(m => m.status === 'rejected').length || 0;

      // 5. Calculer les revenus avec validation
      const totalRevenue = members?.reduce((sum, m) => {
        const fee = typeof m.membership_fee === 'number' ? m.membership_fee : 0;
        return sum + fee;
      }, 0) || 0;
      
      const paidRevenue = members?.filter(m => m.payment_status === 'paid')
        .reduce((sum, m) => {
          const fee = typeof m.membership_fee === 'number' ? m.membership_fee : 0;
          return sum + fee;
        }, 0) || 0;
        
      const pendingRevenue = members?.filter(m => m.payment_status === 'pending')
        .reduce((sum, m) => {
          const fee = typeof m.membership_fee === 'number' ? m.membership_fee : 0;
          return sum + fee;
        }, 0) || 0;

      // 6. Statistiques par catégorie avec support des catégories multiples
      const categoryStats = new Map<string, { count: number; revenue: number; label: string }>();
      
      members?.forEach(member => {
        // Récupérer toutes les catégories du membre
        const memberCategories = [];
        
        // Catégorie principale
        if (member.category) {
          memberCategories.push(member.category);
        }
        
        // Catégories supplémentaires
        if (member.member_categories?.length > 0) {
          member.member_categories.forEach(mc => {
            if (!memberCategories.includes(mc.category_value)) {
              memberCategories.push(mc.category_value);
            }
          });
        }
        
        // Si aucune catégorie, utiliser 'unknown'
        if (memberCategories.length === 0) {
          memberCategories.push('unknown');
        }
        
        // Compter pour chaque catégorie (un membre peut être compté plusieurs fois)
        memberCategories.forEach(categoryValue => {
          if (!categoryStats.has(categoryValue)) {
            const categoryInfo = categoriesData?.find(cat => cat.value === categoryValue);
            categoryStats.set(categoryValue, {
              count: 0,
              revenue: 0,
              label: categoryInfo?.label || categoryValue
            });
          }
          
          const stats = categoryStats.get(categoryValue)!;
          stats.count++;
          stats.revenue += typeof member.membership_fee === 'number' ? member.membership_fee : 0;
        });
      });

      // 7. Convertir en array pour l'affichage
      const membersByCategory = Array.from(categoryStats.entries()).map(([category, data]) => ({
        category,
        categoryLabel: data.label,
        count: data.count,
        revenue: data.revenue
      })).sort((a, b) => b.count - a.count); // Trier par nombre de membres

      // 8. Membres récents (les 5 derniers)
      const recentMembers = members?.slice(0, 5).map(m => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        status: m.status,
        created_at: m.created_at
      })) || [];

      // 9. Statistiques des documents avec gestion d'erreur
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

      // 10. Validation finale des données
      const finalStats = {
        totalMembers,
        validatedMembers,
        pendingMembers,
        rejectedMembers,
        totalRevenue: Math.round(totalRevenue * 100) / 100, // Arrondir à 2 décimales
        paidRevenue: Math.round(paidRevenue * 100) / 100,
        pendingRevenue: Math.round(pendingRevenue * 100) / 100,
        membersByCategory,
        recentMembers,
        documentStats
      };
      
      console.log('✅ [useStats] Statistiques calculées:', {
        totalMembers: finalStats.totalMembers,
        categories: finalStats.membersByCategory.length,
        revenue: finalStats.totalRevenue
      });
      
      setStats({
        ...finalStats
      });

    } catch (err: any) {
      console.error('❌ [useStats] Erreur critique:', err);
      setError(`Erreur lors du chargement des statistiques: ${err.message}`);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Rafraîchir toutes les 60 secondes (moins agressif)
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []); // Exécuter une seule fois au montage puis toutes les 60s

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
};