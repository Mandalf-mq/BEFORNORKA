import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, FileText, Users, ArrowRight, AlertCircle, Eye, UserCheck, XCircle, Download, RotateCcw } from 'lucide-react';
import { useMembers } from '../../hooks/useMembers';
import { supabase } from '../../lib/supabase';

interface MemberDocument {
  id: string;
  member_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  mime_type?: string;
  status: string;
  uploaded_at: string;
  rejection_reason?: string;
  member_email: string;
  member_name: string;
  document_type_label: string;
}

export const ValidationWorkflow: React.FC = () => {
  const { members, loading, validateMemberProfile, rejectMember, getWorkflowStats } = useMembers();
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedMemberDocs, setSelectedMemberDocs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [submittedDocs, setSubmittedDocs] = useState<MemberDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'workflow' | 'documents'>('workflow');
  const [currentSeason, setCurrentSeason] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('current');
  const [allSeasons, setAllSeasons] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchSeasons();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (currentSeason) {
      fetchSubmittedDocuments();
    }
  }, [currentSeason, selectedSeason]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      setCategories([]);
    }
  };

  const getCategoryLabel = (categoryValue: string) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category?.label || categoryValue;
  };

  const getMemberCategoriesDisplay = (member: any) => {
    if (member.member_categories?.length > 0) {
      const primaryCategory = member.member_categories.find(mc => mc.is_primary);
      const additionalCategories = member.member_categories.filter(mc => !mc.is_primary);
      
      return (
        <div className="space-y-1">
          <div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              ⭐ {getCategoryLabel(primaryCategory?.category_value || member.category)}
            </span>
          </div>
          {additionalCategories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {additionalCategories.map((mc, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  {getCategoryLabel(mc.category_value)}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {getCategoryLabel(member.category)}
        </span>
      );
    }
  };
  const fetchSeasons = async () => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setAllSeasons(data || []);
      const current = data?.find(s => s.is_current);
      setCurrentSeason(current);
    } catch (error) {
      console.error('Erreur lors du chargement des saisons:', error);
    }
  };

  const fetchSubmittedDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('member_documents_complete')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setSubmittedDocs(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des documents soumis:', error);
    }
  };

  const fetchMemberDocuments = async (memberId: string) => {
    try {
      const { data, error } = await supabase
        .from('member_documents')
        .select('*')
        .eq('member_id', memberId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setSelectedMemberDocs(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des documents du membre:', error);
      setSelectedMemberDocs([]);
    }
  };

  const validateDocument = async (documentId: string, action: 'validate' | 'reject', reason?: string) => {
    try {
      const { error } = await supabase.rpc('validate_document', {
        p_document_id: documentId,
        p_action: action,
        p_rejection_reason: reason
      });

      if (error) throw error;
      await fetchSubmittedDocuments();
      
      const actionText = action === 'validate' ? 'validé' : 'rejeté';
      alert(`✅ Document ${actionText} avec succès !`);
    } catch (error: any) {
      console.error('Erreur lors de la validation:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const unvalidateDocument = async (documentId: string) => {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir annuler la validation de ce document ?\n\nIl repassera en statut "En attente".')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('member_documents')
        .update({
          status: 'pending',
          rejection_reason: null,
          validated_by: null,
          validated_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;
      
      await fetchSubmittedDocuments();
      alert('🔄 Document remis en attente de validation');
    } catch (error: any) {
      console.error('Erreur lors de l\'annulation:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const calculateMemberProgress = (member: any) => {
    // Étapes du workflow avec leurs poids
    const workflowSteps = {
      'pending': 0,           // 0% - Inscription en attente
      'validated': 25,        // 25% - Profil validé
      'documents_pending': 50, // 50% - Documents en cours d'upload
      'documents_validated': 75, // 75% - Documents validés
      'season_validated': 100  // 100% - Validé pour la saison
    };

    const baseProgress = workflowSteps[member.status] || 0;
    
    // Si le membre est en phase documents, calculer le pourcentage de documents validés
    if (member.status === 'documents_pending' || member.status === 'documents_validated') {
      // Récupérer les documents du membre depuis submittedDocs
      const memberDocs = submittedDocs.filter(doc => doc.member_email === member.email);
      const validatedDocs = memberDocs.filter(doc => doc.status === 'validated');
      
      if (memberDocs.length > 0) {
        const docProgress = (validatedDocs.length / memberDocs.length) * 25; // 25% pour la phase documents
        return Math.min(100, baseProgress + docProgress);
      }
    }
    
    return baseProgress;
  };
  const stats = getWorkflowStats();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'validated':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'documents_pending':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'documents_validated':
        return 'bg-indigo-100 text-indigo-700 border-indigo-300';
      case 'season_validated':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente validation';
      case 'validated':
        return 'Peut uploader docs';
      case 'documents_pending':
        return 'Docs en attente';
      case 'documents_validated':
        return 'Docs validés';
      case 'season_validated':
        return 'Validé saison';
      case 'rejected':
        return 'Rejeté';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'validated':
        return <UserCheck className="w-4 h-4" />;
      case 'documents_pending':
        return <FileText className="w-4 h-4" />;
      case 'documents_validated':
        return <CheckCircle className="w-4 h-4" />;
      case 'season_validated':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleValidateMember = async (memberId: string) => {
    try {
      setActionLoading(memberId);
      const result = await validateMemberProfile(memberId, 'Profil validé par admin');
      
      if (result.success) {
        alert('✅ Membre validé ! Il peut maintenant uploader ses documents.');
      } else {
        alert(`❌ Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur validation:', error);
      alert('❌ Erreur lors de la validation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectMember = async (memberId: string) => {
    const reason = prompt('Raison du rejet:');
    if (!reason) return;

    try {
      setActionLoading(memberId);
      const result = await rejectMember(memberId, reason);
      
      if (result.success) {
        alert('❌ Membre rejeté');
      } else {
        alert(`❌ Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur rejet:', error);
      alert('❌ Erreur lors du rejet');
    } finally {
      setActionLoading(null);
    }
  };

  const viewDocument = async (doc: MemberDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('member_documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        throw new Error('Impossible de générer l\'URL du document');
      }
    } catch (error: any) {
      console.error('Erreur lors de la visualisation:', error);
      alert(`❌ Erreur lors de la visualisation: ${error.message}`);
    }
  };

  const downloadDocument = async (doc: MemberDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('member_documents')
        .download(doc.file_path);

      if (error) throw error;

      const blob = new Blob([data], { type: doc.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      alert(`❌ Erreur lors du téléchargement: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement du workflow...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          🔄 Workflow de Validation
        </h2>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'workflow'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Validation Membres</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'documents'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documents Soumis ({submittedDocs.length})</span>
          </button>
        </div>

        {/* Statistiques du workflow */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-xs text-yellow-600">En attente</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">{stats.validated}</div>
            <div className="text-xs text-blue-600">Validés</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-700">{stats.documentsPending}</div>
            <div className="text-xs text-purple-600">Docs pending</div>
          </div>
          <div className="text-center p-3 bg-indigo-50 rounded-lg">
            <div className="text-2xl font-bold text-indigo-700">{stats.documentsValidated}</div>
            <div className="text-xs text-indigo-600">Docs validés</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{stats.seasonValidated}</div>
            <div className="text-xs text-green-600">Saison OK</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
            <div className="text-xs text-red-600">Rejetés</div>
          </div>
        </div>

        {/* Workflow visuel */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">📋 Étapes du workflow</h3>
          <div className="flex items-center space-x-2 text-sm overflow-x-auto">
            <div className="flex items-center space-x-1 bg-yellow-100 px-3 py-1 rounded-full">
              <span>1. Pending</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center space-x-1 bg-blue-100 px-3 py-1 rounded-full">
              <span>2. Validated</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center space-x-1 bg-purple-100 px-3 py-1 rounded-full">
              <span>3. Docs Pending</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center space-x-1 bg-indigo-100 px-3 py-1 rounded-full">
              <span>4. Docs Validated</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div className="flex items-center space-x-1 bg-green-100 px-3 py-1 rounded-full">
              <span>5. Season Validated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu selon l'onglet */}
      {activeTab === 'workflow' && (
        <div className="space-y-4">
          {members.map((member) => (
            <div key={member.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold text-sm">
                      {member.first_name[0]}{member.last_name[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {member.first_name} {member.last_name}
                    </h3>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <div className="mt-1">
                      {getMemberCategoriesDisplay(member)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium border ${getStatusColor(member.status)}`}>
                      {getStatusIcon(member.status)}
                      <span>{getStatusLabel(member.status)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Progression: {calculateMemberProgress(member)}%
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        fetchMemberDocuments(member.id);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {member.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleValidateMember(member.id)}
                          disabled={actionLoading === member.id}
                          className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                          title="Valider le profil"
                        >
                          {actionLoading === member.id ? (
                            <div className="w-4 h-4 border border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRejectMember(member.id)}
                          disabled={actionLoading === member.id}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Rejeter le membre"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${calculateMemberProgress(member)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Inscription</span>
                  <span>Validation</span>
                  <span>Documents</span>
                  <span>Saison</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">📄 Documents uploadés par les membres</h4>
            <p className="text-sm text-blue-700">
              Validez ou rejetez les documents soumis par les membres pour la saison : 
              <strong> {selectedSeason === 'current' ? currentSeason?.name : allSeasons.find(s => s.id === selectedSeason)?.name}</strong>
            </p>
          </div>

          {submittedDocs.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucun document soumis
              </h3>
              <p className="text-gray-600">
                Aucun document uploadé pour cette saison.
              </p>
            </div>
          ) : (
            submittedDocs.map(doc => (
              <div key={doc.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <div>
                      <h4 className="font-semibold text-gray-900">{doc.file_name}</h4>
                      <p className="text-sm text-gray-600">
                        {doc.document_type_label} - {doc.member_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Uploadé le {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => viewDocument(doc)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Visualiser le document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="Télécharger le document"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-center">
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium border ${getStatusColor(doc.status)}`}>
                        {getStatusIcon(doc.status)}
                        <span>
                          {doc.status === 'validated' ? 'Validé' : 
                           doc.status === 'pending' ? 'En attente' : 'Rejeté'}
                        </span>
                      </div>
                      {doc.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">{doc.rejection_reason}</p>
                      )}
                    </div>

                    {doc.status === 'pending' && selectedSeason === 'current' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => validateDocument(doc.id, 'validate')}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Valider</span>
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Raison du rejet:');
                            if (reason) validateDocument(doc.id, 'reject', reason);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Rejeter</span>
                        </button>
                      </div>
                    )}

                    {(doc.status === 'validated' || doc.status === 'rejected') && selectedSeason === 'current' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => unvalidateDocument(doc.id)}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                          title="Annuler la validation et remettre en attente"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Annuler</span>
                        </button>
                        
                        {doc.status === 'validated' && (
                          <button
                            onClick={() => {
                              const reason = prompt('Raison du rejet:');
                              if (reason) validateDocument(doc.id, 'reject', reason);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Rejeter</span>
                          </button>
                        )}
                        
                        {doc.status === 'rejected' && (
                          <button
                            onClick={() => validateDocument(doc.id, 'validate')}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Valider</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de détails */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                📋 Détails du workflow - {selectedMember.first_name} {selectedMember.last_name}
              </h3>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">📊 Statut actuel</h4>
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium border ${getStatusColor(selectedMember.status)}`}>
                    {getStatusIcon(selectedMember.status)}
                    <span>{getStatusLabel(selectedMember.status)}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Progression: {(selectedMember as any).workflow_progress || 0}%
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">📄 Documents requis</h4>
                <div className="space-y-2">
            {['medical_certificate', 'photo', 'registration_form', 'parental_authorization', 'identity_copy'].map((docType: string) => {
                    const memberDoc = selectedMemberDocs.find(doc => doc.document_type === docType);
                    const isUploaded = !!memberDoc;
                    const isValidated = memberDoc?.status === 'validated';
                    const isPending = memberDoc?.status === 'pending';
                    const isRejected = memberDoc?.status === 'rejected';
                    
                    return (
                      <div key={docType} className="flex items-center justify-between p-2 bg-white rounded">
                        <span className="text-sm text-gray-700">
                         {docType === 'medical_certificate' ? '🏥 Certificat médical' :
                          docType === 'photo' ? '📷 Photo d\'identité' :
                          docType === 'registration_form' ? '📋 Formulaire d\'inscription' :
                          docType === 'parental_authorization' ? '👨‍👩‍👧‍👦 Autorisation parentale' :
                          docType === 'identity_copy' ? '🆔 Pièce d\'identité' :
                          docType}

                        </span>
                        <div className="flex items-center space-x-2">
                          {isValidated ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              ✅ Validé
                            </span>
                          ) : isPending ? (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                              ⏳ En attente
                            </span>
                          ) : isRejected ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                              ❌ Rejeté
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                              📄 Manquant
                            </span>
                          )}
                          {memberDoc && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => viewDocument(memberDoc)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Voir le document"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => downloadDocument(memberDoc)}
                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                title="Télécharger"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">🎯 Prochaine étape</h4>
                <p className="text-sm text-blue-700">
                  {(selectedMember as any).next_step || 'Aucune action requise'}
                </p>
              </div>

              <div className="flex space-x-3">
                {selectedMember.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedMember(null);
                        handleValidateMember(selectedMember.id);
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Valider le profil</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMember(null);
                        handleRejectMember(selectedMember.id);
                      }}
                      className="px-6 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Rejeter
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};