import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, UserPlus, Baby, User, Crown, Link, Unlink, Settings, FileText, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  category: string;
  is_family_head: boolean;
  family_head_id?: string;
  family_head_name?: string;
  age: number;
  status: string;
  payment_status: string;
}

interface Family {
  family_head: FamilyMember;
  children: FamilyMember[];
  total_fee: number;
  family_discount: number;
}

export const FamilyManager: React.FC = () => {
  const { userProfile } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [unlinkedMembers, setUnlinkedMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [showFamilyManagement, setShowFamilyManagement] = useState(false);

  // Ajouter les colonnes manquantes à la table members si nécessaire
  const ensureFamilyColumns = async () => {
    try {
      // Vérifier si les colonnes existent en tentant une requête
      await supabase
        .from('members')
        .select('is_family_head, family_head_id')
        .limit(1);
    } catch (error) {
      console.warn('Colonnes familiales manquantes, utilisation de la logique de base');
      // Si les colonnes n'existent pas, on peut simuler avec des données existantes
    }
  };

  useEffect(() => {
    ensureFamilyColumns();
    fetchFamilies();
  }, []);

  const fetchFamilies = async () => {
    try {
      setLoading(true);
      
      // Récupérer tous les membres avec leurs relations familiales
      const { data: membersData, error } = await supabase
        .from('members_with_family_info')
        .select('*')
        .order('family_head_id', { ascending: true })
        .order('birth_date', { ascending: true });

      if (error) throw error;

      // Organiser les données par famille
      const familiesMap = new Map<string, Family>();
      const unlinked: FamilyMember[] = [];

      membersData?.forEach(member => {
        if (member.is_family_head) {
          // Chef de famille
          familiesMap.set(member.id, {
            family_head: member,
            children: [],
            total_fee: member.membership_fee,
            family_discount: 0
          });
        } else if (member.family_head_id) {
          // Enfant dans une famille
          const family = familiesMap.get(member.family_head_id);
          if (family) {
            family.children.push(member);
            family.total_fee += member.membership_fee;
          }
        } else {
          // Membre non lié à une famille
          unlinked.push(member);
        }
      });

      // Calculer les réductions familiales
      familiesMap.forEach(family => {
        if (family.children.length > 0) {
          // 10% de réduction à partir du 2ème enfant
          const childrenDiscount = family.children.length > 1 ? 
            family.children.slice(1).reduce((sum, child) => sum + child.membership_fee * 0.1, 0) : 0;
          family.family_discount = Math.round(childrenDiscount);
        }
      });

      setFamilies(Array.from(familiesMap.values()));
      setUnlinkedMembers(unlinked);
    } catch (error) {
      console.error('Erreur lors du chargement des familles:', error);
    } finally {
      setLoading(false);
    }
  };

  const linkMembersToFamily = async () => {
    if (!selectedParent || selectedChildren.length === 0) {
      alert('Veuillez sélectionner un parent et au moins un enfant');
      return;
    }

    try {
      setActionLoading('linking');

      // Utiliser la fonction PostgreSQL pour créer la famille
      const { data, error } = await supabase.rpc('create_family_link', {
        p_parent_id: selectedParent,
        p_children_ids: selectedChildren
      });

      if (error) throw error;

      if (data.success) {
        alert(`✅ Famille créée avec succès !
        
👨‍👩‍👧‍👦 Chef de famille : ${data.parent_name}
👶 Enfants liés : ${data.children_count}
💰 Réduction familiale : ${data.family_discount}€`);

        setShowLinkForm(false);
        setSelectedParent('');
        setSelectedChildren([]);
        await fetchFamilies();
      } else {
        alert(`❌ Erreur : ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erreur lors de la création de la famille:', error);
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const unlinkMemberFromFamily = async (memberId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir délier ce membre de sa famille ?')) return;

    try {
      setActionLoading(memberId);

      const { data, error } = await supabase.rpc('unlink_member_from_family', {
        p_member_id: memberId
      });

      if (error) throw error;

      if (data.success) {
        alert('✅ Membre délié de sa famille avec succès !');
        await fetchFamilies();
      } else {
        alert(`❌ Erreur : ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erreur lors du déliage:', error);
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const getEligibleParents = () => {
    return unlinkedMembers.filter(member => calculateAge(member.birth_date) >= 18);
  };

  const getEligibleChildren = () => {
    return unlinkedMembers.filter(member => calculateAge(member.birth_date) < 18);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement des familles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-primary-600" />
            <span>Gestion des familles</span>
          </h2>
          <button
            onClick={() => setShowLinkForm(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Link className="w-4 h-4" />
            <span>Créer une famille</span>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">👨‍👩‍👧‍👦 Gestion familiale</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>Chef de famille :</strong> Peut gérer les profils et documents de ses enfants mineurs</p>
            <p>• <strong>Réduction familiale :</strong> 10% de réduction à partir du 2ème enfant</p>
            <p>• <strong>Accès partagé :</strong> Le parent voit tous les documents de ses enfants</p>
            <p>• <strong>Notifications :</strong> Le parent reçoit les notifications pour toute la famille</p>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Familles</p>
              <p className="text-2xl font-bold text-gray-900">{families.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Crown className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Chefs de famille</p>
              <p className="text-2xl font-bold text-gray-900">{families.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Baby className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Enfants liés</p>
              <p className="text-2xl font-bold text-gray-900">
                {families.reduce((sum, family) => sum + family.children.length, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Membres non liés</p>
              <p className="text-2xl font-bold text-gray-900">{unlinkedMembers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des familles */}
      <div className="space-y-6">
        {families.map((family) => (
          <div key={family.family_head.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            {/* Chef de famille */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <Crown className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Famille {family.family_head.first_name} {family.family_head.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Chef de famille • {family.family_head.age} ans • {family.family_head.category}
                  </p>
                  <p className="text-xs text-gray-500">{family.family_head.email}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                <p className="text-lg font-bold text-gray-900">
                  {family.total_fee - family.family_discount}€
                </p>
                {family.family_discount > 0 && (
                  <p className="text-sm text-green-600">
                    Économie : {family.family_discount}€
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {family.children.length + 1} membre{family.children.length > 0 ? 's' : ''}
                </p>
                </div>
                
                <button
                  onClick={() => {
                    setSelectedFamily(family);
                    setShowFamilyManagement(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Gérer</span>
                </button>
              </div>
            </div>

            {/* Enfants */}
            {family.children.length > 0 && (
              <div className="mt-4 pl-16">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  👶 Enfants ({family.children.length})
                </h4>
                <div className="space-y-2">
                  {family.children.map((child) => (
                    <div key={child.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Baby className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {child.first_name} {child.last_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {child.age} ans • {child.category} • {child.membership_fee}€
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => unlinkMemberFromFamily(child.id)}
                        disabled={actionLoading === child.id}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Délier de la famille"
                      >
                        {actionLoading === child.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Unlink className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Membres non liés */}
      {unlinkedMembers.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            👤 Membres non liés à une famille ({unlinkedMembers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlinkedMembers.map((member) => (
              <div key={member.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {member.age >= 18 ? (
                      <User className="w-5 h-5 text-gray-600" />
                    ) : (
                      <Baby className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {member.age} ans • {member.category}
                    </p>
                    <p className="text-xs text-gray-500">{member.membership_fee}€</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de création de famille */}
      {showLinkForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                👨‍👩‍👧‍👦 Créer une famille
              </h3>
              <button
                onClick={() => setShowLinkForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Sélection du parent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  👨‍👩 Sélectionner le chef de famille (adulte)
                </label>
                <select
                  value={selectedParent}
                  onChange={(e) => setSelectedParent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Choisir un adulte...</option>
                  {getEligibleParents().map(parent => (
                    <option key={parent.id} value={parent.id}>
                      {parent.first_name} {parent.last_name} ({parent.age} ans)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Seuls les membres de 18 ans et plus peuvent être chefs de famille
                </p>
              </div>

              {/* Sélection des enfants */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  👶 Sélectionner les enfants (mineurs)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {getEligibleChildren().map(child => (
                    <label key={child.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedChildren.includes(child.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChildren(prev => [...prev, child.id]);
                          } else {
                            setSelectedChildren(prev => prev.filter(id => id !== child.id));
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {child.first_name} {child.last_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {child.age} ans • {child.category} • {child.membership_fee}€
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Seuls les membres de moins de 18 ans peuvent être liés comme enfants
                </p>
              </div>

              {/* Aperçu de la réduction */}
              {selectedChildren.length > 1 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">💰 Réduction familiale</h4>
                  <p className="text-sm text-green-700">
                    Avec {selectedChildren.length} enfants, vous bénéficiez d'une réduction de 10% 
                    à partir du 2ème enfant.
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={linkMembersToFamily}
                  disabled={!selectedParent || selectedChildren.length === 0 || actionLoading === 'linking'}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {actionLoading === 'linking' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Création...</span>
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4" />
                      <span>Créer la famille</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowLinkForm(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestion familiale */}
      {showFamilyManagement && selectedFamily && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                👨‍👩‍👧‍👦 Gestion de la famille {selectedFamily.family_head.first_name} {selectedFamily.family_head.last_name}
              </h3>
              <button
                onClick={() => {
                  setShowFamilyManagement(false);
                  setSelectedFamily(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Chef de famille */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center space-x-2">
                  <Crown className="w-5 h-5" />
                  <span>Chef de famille</span>
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-900">
                      {selectedFamily.family_head.first_name} {selectedFamily.family_head.last_name}
                    </p>
                    <p className="text-sm text-blue-700">
                      {selectedFamily.family_head.email} • {selectedFamily.family_head.age} ans
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                      <Edit className="w-4 h-4" />
                      <span>Modifier profil</span>
                    </button>
                    <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                      <FileText className="w-4 h-4" />
                      <span>Documents</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Enfants */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 mb-3 flex items-center space-x-2">
                  <Baby className="w-5 h-5" />
                  <span>Enfants ({selectedFamily.children.length})</span>
                </h4>
                <div className="space-y-3">
                  {selectedFamily.children.map((child) => (
                    <div key={child.id} className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {child.first_name} {child.last_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {child.age} ans • {child.category} • {child.membership_fee}€
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              child.status === 'season_validated' ? 'bg-green-100 text-green-700' :
                              child.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {child.status === 'season_validated' ? '✅ Validé' :
                               child.status === 'pending' ? '⏳ En attente' :
                               '❌ Problème'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              child.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                              child.payment_status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {child.payment_status === 'paid' ? '💰 Payé' :
                               child.payment_status === 'overdue' ? '⚠️ En retard' :
                               '⏳ En attente'}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                            <Edit className="w-4 h-4" />
                            <span>Profil</span>
                          </button>
                          <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                            <FileText className="w-4 h-4" />
                            <span>Documents</span>
                          </button>
                          <button className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                            <Calendar className="w-4 h-4" />
                            <span>Entraînements</span>
                          </button>
                          <button
                            onClick={() => unlinkMemberFromFamily(child.id)}
                            disabled={actionLoading === child.id}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Délier de la famille"
                          >
                            {actionLoading === child.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Unlink className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Résumé financier */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-3">💰 Résumé financier</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-700">{selectedFamily.total_fee}€</p>
                    <p className="text-sm text-green-600">Total avant réduction</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-700">-{selectedFamily.family_discount}€</p>
                    <p className="text-sm text-red-600">Réduction familiale</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{selectedFamily.total_fee - selectedFamily.family_discount}€</p>
                    <p className="text-sm text-gray-600">Total à payer</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};