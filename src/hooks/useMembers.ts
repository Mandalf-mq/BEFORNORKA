import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface MemberCategory {
  id: string;
  category_value: string;
  is_primary: boolean;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  category: string;
  status: string;
  payment_status: string;
  membership_fee: number;
  season_id?: string;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
  updated_at: string;
  additional_categories?: string[];
  member_categories?: MemberCategory[];
}

interface ValidationStatus {
  member_id: string;
  current_status: string;
  required_documents: string[];
  uploaded_documents: string[];
  validated_documents: string[];
  missing_documents: string[];
  can_proceed_to_next_step: boolean;
  next_step: string;
  completion_percentage: number;
}

export const useMembers = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
  try {
    setLoading(true);
    setError(null);

    // 1. Charger les membres avec leurs catégories
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select(`
        *,
        member_categories (
          id,
          category_value,
          is_primary
        )
      `)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (membersError) throw membersError;

    // 2. Charger toutes les catégories pour faire le mapping
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true);

    if (categoriesError) throw categoriesError;

    // 3. Enrichir les données avec les labels
    const enrichedMembers = membersData?.map(member => ({
      ...member,
      member_categories: member.member_categories?.map(mc => {
        const categoryInfo = categoriesData?.find(cat => cat.value === mc.category_value);
        return {
          ...mc,
          categories: categoryInfo || { label: mc.category_value, value: mc.category_value }
        };
      })
    }));

    setMembers(enrichedMembers || []);
  } catch (err: any) {
    setError(err.message || 'Erreur lors du chargement des membres');
  } finally {
    setLoading(false);
  }
};

  const validateMemberProfile = async (memberId: string, notes?: string) => {
    try {
      const { error } = await supabase.rpc('validate_member_profile', {
        p_member_id: memberId,
        p_notes: notes
      });

      if (error) throw error;
      await fetchMembers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const rejectMember = async (memberId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({
          status: 'rejected',
          notes: reason,
          validated_by: (await supabase.auth.getUser()).data.user?.id,
          validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', memberId);

      if (error) throw error;
      await fetchMembers();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getMemberValidationStatus = async (memberId: string): Promise<ValidationStatus | null> => {
    try {
      const { data, error } = await supabase.rpc('get_member_validation_status', {
        p_member_id: memberId
      });

      if (error) throw error;
      return data?.[0] || null;
    } catch (err: any) {
      console.error('Erreur lors du chargement du statut:', err);
      return null;
    }
  };

  const getWorkflowDiagnostic = async () => {
    try {
      const { data, error } = await supabase.rpc('diagnose_validation_workflow');
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('Erreur diagnostic:', err);
      return [];
    }
  };

  const getMembersByStatus = (status: string) => {
    return members.filter(member => member.status === status);
  };

  const getWorkflowStats = () => {
    const total = members.length;
    const pending = members.filter(m => m.status === 'pending').length;
    const validated = members.filter(m => m.status === 'validated').length;
    const documentsPending = members.filter(m => m.status === 'documents_pending').length;
    const documentsValidated = members.filter(m => m.status === 'documents_validated').length;
    const seasonValidated = members.filter(m => m.status === 'season_validated').length;
    const rejected = members.filter(m => m.status === 'rejected').length;

    return {
      total,
      pending,
      validated,
      documentsPending,
      documentsValidated,
      seasonValidated,
      rejected,
      readyForTraining: seasonValidated
    };
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  return {
    members,
    loading,
    error,
    refetch: fetchMembers,
    validateMemberProfile,
    rejectMember,
    getMemberValidationStatus,
    getWorkflowDiagnostic,
    getMembersByStatus,
    getWorkflowStats
  };
};