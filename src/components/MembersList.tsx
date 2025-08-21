import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Filter, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, UserPlus, Download, Upload, Archive, AlertTriangle } from 'lucide-react';
import { useMembers } from '../hooks/useMembers';
import { AddMemberForm } from './AddMemberForm';
import { CSVImporter } from './Members/CSVImporter';
import { supabase } from '../lib/supabase';

// Interface pour le typage
interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  membership_fee: number;
  payment_status: 'pending' | 'overdue' | 'paid' | 'pass_sport';
  category: string;
  status: string;
  ffvb_license?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

interface MemberDetailsModalProps {
  member: any;
  onClose: () => void;
  onUpdate: () => void;
  isEditing?: boolean;
  categories: any[];
}

// Fonctions utilitaires
const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1;
  }
  return age;
};

const isPassSportEligible = (member: any): boolean => {
  if (!member.birth_date) return false;
  const age = calculateAge(member.birth_date);
  return age < 18;
};

const getStatusLabel = (status: string) => {
  const labels = {
    'pending': '⏳ En attente',
    'overdue': '⚠️ En retard', 
    'paid': '✅ Payé',
    'pass_sport': '🇫🇷 Pass Sport',
    'archived': '📁 Archivé',
    'season_validated': '✅ Saison validée',
    'documents_validated': '📄 Documents validés',
    'documents_pending': '⏳ Documents en attente',
    'validated': '✅ Validé',
    'rejected': '❌ Rejeté'
  };
  return labels[status as keyof typeof labels] || status;
};

// Composant de statistiques FFVB
const LicenseStats: React.FC<{ members: Member[] }> = ({ members }) => {
  const withLicense = members.filter(m => m.ffvb_license?.trim()).length;
  const withoutLicense = members.length - withLicense;
  const licenseRate = members.length > 0 ? Math.round((withLicense / members.length) * 100) : 0;

  return (
    <div className="bg-blue-50 rounded-lg p-4">
      <h4 className="font-medium text-blue-900 mb-3 flex items-center">
        🏐 Licences FFVB
      </h4>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-xl font-bold text-green-600">{withLicense}</div>
          <div className="text-gray-600 text-xs">Avec licence</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-orange-600">{withoutLicense}</div>
          <div className="text-gray-600 text-xs">Sans licence</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600">{licenseRate}%</div>
          <div className="text-gray-600 text-xs">Taux</div>
        </div>
      </div>
    </div>
  );
};

// Composant pour changer le statut de paiement
const PaymentStatusSelector: React.FC<{ member: any; onUpdate: () => void }> = ({ member, onUpdate }) => {
  const [updating, setUpdating] = useState(false);

  const handlePaymentStatusChange = async (newStatus: string) => {
    try {
      setUpdating(true);
      
      if (newStatus === 'pass_sport' && !isPassSportEligible(member)) {
        alert('⚠️ Le Pass Sport n\'est disponible que pour les mineurs (moins de 18 ans)');
        return;
      }

      const { error } = await supabase
        .from('members')
        .update({ 
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', member.id);

      if (error) throw error;
      
      alert(`✅ Statut mis à jour: ${getStatusLabel(newStatus)}`);
      onUpdate();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <select
      value={member.payment_status}
      onChange={(e) => handlePaymentStatusChange(e.target.value)}
      disabled={updating}
      className="px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-primary-500"
    >
      <option value="pending">⏳ En attente</option>
      <option value="overdue">⚠️ En retard</option>
      <option value="paid">✅ Payé</option>
      {isPassSportEligible(member) && (
        <option value="pass_sport">🇫🇷 Pass Sport</option>
      )}
    </select>
  );
};

// Nouveau composant pour gérer les catégories multiples
const MultiCategorySelector: React.FC<{
  member: any;
  categories: any[];
  editing: boolean;
  onUpdate: (categories: string[]) => void;
}> = ({ member, categories, editing, onUpdate }) => {
  const [memberCategories, setMemberCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Charger les catégories du membre
  useEffect(() => {
    const loadMemberCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('member_categories')
          .select('category_value, is_primary')
          .eq('member_id', member.id);

        if (error) throw error;

        const cats = data?.map(d => d.category_value) || [];
        
        // Si pas de catégories multiples, utiliser la catégorie principale
        if (cats.length === 0 && member.category) {
          cats.push(member.category);
        }

        setMemberCategories(cats);
        setLoading(false);
      } catch (error) {
        console.error('Erreur chargement catégories membre:', error);
        setMemberCategories(member.category ? [member.category] : []);
        setLoading(false);
      }
    };

    loadMemberCategories();
  }, [member.id, member.category]);

  const handleCategoryChange = (categoryValue: string, checked: boolean) => {
    let newCategories;
    
    if (checked) {
      newCategories = [...memberCategories, categoryValue];
    } else {
      newCategories = memberCategories.filter(c => c !== categoryValue);
    }
    
    setMemberCategories(newCategories);
    onUpdate(newCategories);
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        🏐 Catégories d'entraînement
      </label>
      
      {editing ? (
        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
          {categories.map(category => (
            <label key={category.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={memberCategories.includes(category.value)}
                onChange={(e) => handleCategoryChange(category.value, e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">
                {category.label}
                {category.age_range && (
                  <span className="text-gray-500 ml-1">({category.age_range})</span>
                )}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 bg-gray-50 rounded-lg">
          {memberCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {memberCategories.map((catValue, index) => {
                const category = categories.find(c => c.value === catValue);
                return (
                  <span 
                    key={catValue}
                    className={`px-2 py-1 text-xs rounded-full ${
                      index === 0 
                        ? 'bg-primary-100 text-primary-700 font-medium' 
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {category?.label || catValue}
                    {index === 0 && ' (Principale)'}
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="text-gray-500 italic">Aucune catégorie</span>
          )}
        </div>
      )}
    </div>
  );
};

// Modal de détails/édition - COMPLÈTE ET CORRIGÉE
const MemberDetailsModal: React.FC<MemberDetailsModalProps> = ({ 
  member, 
  onClose, 
  onUpdate, 
  isEditing: initialEditing = false,
  categories
}) => {
  const [editing, setEditing] = useState(initialEditing);
  const [saving, setSaving] = useState(false);
  const [memberCategories, setMemberCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    first_name: member.first_name || '',
    last_name: member.last_name || '',
    email: member.email || '',
    phone: member.phone || '',
    birth_date: member.birth_date || '',
    membership_fee: member.membership_fee || 0,
    payment_status: member.payment_status || 'pending',
    category: member.category || '',
    ffvb_license: member.ffvb_license || '',
    notes: member.notes || ''
  });

 // Fonction pour sauvegarder les catégories
  const saveMemberCategories = async (categories: string[]) => {
    try {
      // 1. Supprimer les anciennes catégories
      await supabase
        .from('member_categories')
        .delete()
        .eq('member_id', member.id);

      // 2. Ajouter les nouvelles catégories
      if (categories.length > 0) {
        const categoryData = categories.map((catValue, index) => ({
          member_id: member.id,
          category_value: catValue,
          is_primary: index === 0 // La première est principale
        }));

        const { error } = await supabase
          .from('member_categories')
          .insert(categoryData);

        if (error) throw error;

        // 3. Mettre à jour la catégorie principale dans members
        await supabase
          .from('members')
          .update({ 
            category: categories[0],
            category_id: categories.find(c => categories.find(cat => cat.value === c))?.id || null
          })
          .eq('id', member.id);
      }
    } catch (error) {
      console.error('Erreur sauvegarde catégories:', error);
      throw error;
    }
  };
  
  // Fonction de sauvegarde
  const handleSave = async () => {
    try {
      setSaving(true);

      // Validation
      if (!formData.first_name.trim() || !formData.last_name.trim()) {
        alert('❌ Le nom et prénom sont obligatoires');
        return;
      }

      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
        alert('❌ L\'email n\'est pas valide');
        return;
      }

    if (memberCategories && memberCategories.length > 0) {
      await saveMemberCategories(memberCategories);
    }
      
      // Vérification Pass Sport
      if (formData.payment_status === 'pass_sport' && !isPassSportEligible(member)) {
        alert('⚠️ Le Pass Sport n\'est disponible que pour les mineurs');
        return;
      }

      // Mise à jour
      const { error } = await supabase
        .from('members')
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          birth_date: formData.birth_date,
          membership_fee: formData.membership_fee,
          payment_status: formData.payment_status,
          category: formData.category,
          ffvb_license: formData.ffvb_license.trim(),
          notes: formData.notes.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', member.id);

      if (error) throw error;

      alert('✅ Membre modifié avec succès !');
      setEditing(false);
      onUpdate();
      
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {editing ? '✏️ Modifier le membre' : '👤 Détails du membre'}
              </h2>
              <p className="text-primary-100 mt-1">
                {member.first_name} {member.last_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {/* Informations personnelles */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">👤 Informations personnelles</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Prénom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg">{formData.first_name}</p>
              )}
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              {editing ? (
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg">{formData.last_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              {editing ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg">{formData.email || 'Non renseigné'}</p>
              )}
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              {editing ? (
                <input
                                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg">{formData.phone || 'Non renseigné'}</p>
              )}
            </div>

            {/* Date de naissance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
              {editing ? (
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {formData.birth_date ? (
                    <>
                      {new Date(formData.birth_date).toLocaleDateString('fr-FR')}
                      <span className="ml-2 text-sm text-gray-500">
                        ({calculateAge(formData.birth_date)} ans)
                      </span>
                    </>
                  ) : (
                    'Non renseigné'
                  )}
                </div>
              )}
            </div>

            {/* Licence FFVB */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏐 Numéro de licence FFVB
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.ffvb_license}
                  onChange={(e) => setFormData({ ...formData, ffvb_license: e.target.value })}
                  placeholder="Ex: 12345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg">
                  {formData.ffvb_license ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      🏐 {formData.ffvb_license}
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">Non renseigné</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Informations club */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🏐 Informations club</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Catégorie */}
       <div>
  <MultiCategorySelector
    member={member}
    categories={categories}
    editing={editing}
    onUpdate={setMemberCategories}
  />
</div>

            {/* Cotisation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cotisation (€)</label>
              {editing ? (
                <input
                  type="number"
                  value={formData.membership_fee}
                  onChange={(e) => setFormData({ ...formData, membership_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg">{formData.membership_fee} €</p>
              )}
            </div>

            {/* Statut de paiement */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut de paiement</label>
              {editing ? (
                <select
                  value={formData.payment_status}
                  onChange={(e) => {
                    if (e.target.value === 'pass_sport' && !isPassSportEligible(member)) {
                      alert('⚠️ Le Pass Sport n\'est disponible que pour les mineurs');
                      return;
                    }
                    setFormData({ ...formData, payment_status: e.target.value });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="pending">⏳ En attente</option>
                  <option value="overdue">⚠️ En retard</option>
                  <option value="paid">✅ Payé</option>
                  {isPassSportEligible(member) && (
                    <option value="pass_sport">🇫🇷 Pass Sport</option>
                  )}
                </select>
              ) : (
                <p className="px-3 py-2 bg-gray-50 rounded-lg">
                  {getStatusLabel(formData.payment_status)}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 Notes</h3>
          <div className="mb-6">
            {editing ? (
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Notes sur le membre..."
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 rounded-lg min-h-[100px]">
                {formData.notes || <span className="text-gray-500 italic">Aucune note</span>}
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-between border-t pt-6">
            {editing ? (
              <div className="flex space-x-3 w-full justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sauvegarde...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Sauvegarder</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex space-x-3 w-full justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Fermer
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Modifier</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant principal
const MembersManagement: React.FC = () => {
  const { members, loading, error, refetch } = useMembers();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [licenseFilter, setLicenseFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

// Charger les catégories

  // Dans MembersManagement, remplacer useEffect
useEffect(() => {
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories') // 🔥 PAS member_categories !
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      
      // ✅ Déjà au bon format !
      setCategories(data || []);
      console.log('✅ Catégories chargées:', data?.length || 0);
      
    } catch (error) {
      console.error('❌ Erreur catégories:', error);
      setCategories([]);
    }
  };

  fetchCategories();
}, []);

  // Filtrage des membres
  const filteredMembers = members.filter(member => {
    const matchesSearch = !searchTerm || 
      member.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.ffvb_license?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || member.payment_status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || member.category === categoryFilter;
    
    const matchesLicense = licenseFilter === 'all' || 
      (licenseFilter === 'with_license' && member.ffvb_license?.trim()) ||
      (licenseFilter === 'without_license' && !member.ffvb_license?.trim());

    return matchesSearch && matchesStatus && matchesCategory && matchesLicense;
  });

  // Actions
  const handleViewMember = (member: any) => {
    setSelectedMember(member);
    setShowDetailsModal(true);
  };

  const handleEditMember = (member: any) => {
    setEditingMember(member);
    setShowEditModal(true);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce membre ?')) return;

    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      
      alert('✅ Membre supprimé avec succès');
      refetch();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const handleArchiveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: 'archived' })
        .eq('id', memberId);

      if (error) throw error;
      
      alert('✅ Membre archivé');
      refetch();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">❌ Erreur: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-primary-600" />
            <span>Gestion des Membres</span>
          </h2>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImporter(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Importer CSV</span>
            </button>
            
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau membre</span>
            </button>
          </div>
        </div>

        {/* Statistiques FFVB */}
        <div className="mb-6">
          <LicenseStats members={filteredMembers} />
        </div>

        {/* Filtres et recherche */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher (nom, email, licence FFVB...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Filtre statut */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="overdue">En retard</option>
            <option value="paid">Payé</option>
            <option value="pass_sport">Pass Sport</option>
          </select>

          {/* Filtre catégorie */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>

          {/* Filtre licence FFVB */}
          <select
            value={licenseFilter}
            onChange={(e) => setLicenseFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Toutes les licences</option>
            <option value="with_license">🏐 Avec licence FFVB</option>
            <option value="without_license">⚠️ Sans licence FFVB</option>
          </select>

          {/* Stats */}
          <div className="flex items-center justify-center bg-primary-50 rounded-lg px-4 py-2">
            <span className="text-primary-600 font-semibold">
              {filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Liste des membres */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-lg">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucun membre trouvé</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || licenseFilter !== 'all'
              ? 'Aucun membre ne correspond aux filtres sélectionnés'
              : 'Commencez par ajouter votre premier membre'}
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter un membre</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700">Membre</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Contact</th>
                  <th className="text-left p-4 font-semibold text-gray-700">🏐 Licence FFVB</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Catégorie</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Cotisation</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Statut</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.birth_date && `${calculateAge(member.birth_date)} ans`}
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-gray-900">{member.email}</div>
                        <div className="text-gray-500">{member.phone}</div>
                      </div>
                    </td>

                    <td className="p-4">
                      {member.ffvb_license ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          🏐 {member.ffvb_license}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          ⚠️ Non renseigné
                        </span>
                      )}
                    </td>
                    
                    <td className="p-4">
                      <span className="text-sm text-gray-900">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {categories.find(c => c.value === member.category)?.label || member.category || 'N/A'}
                            <span className="ml-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                              Principal
                            </span>
                          </div>
                          {/* Afficher les catégories supplémentaires si disponibles */}
                          {member.additional_categories && member.additional_categories.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {member.additional_categories.map((catValue: string) => (
                                <span 
                                  key={catValue}
                                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                                >
                                  {categories.find(c => c.value === catValue)?.label || catValue}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </span>
                    </td>
                    
                    <td className="p-4">
                      <span className="font-medium">{member.membership_fee} €</span>
                    </td>
                    
                    <td className="p-4">
                      <PaymentStatusSelector
                        member={member}
                        onUpdate={refetch}
                      />
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center justify-center space-x-2">
                        {/* Voir */}
                        <button
                          onClick={() => handleViewMember(member)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Modifier */}
                        <button
                          onClick={() => handleEditMember(member)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Archiver */}
                        <button
                          onClick={() => handleArchiveMember(member.id)}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title="Archiver"
                        >
                          <Archive className="w-4 h-4" />
                        </button>

                        {/* Supprimer */}
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddForm && (
        <AddMemberForm
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            refetch();
          }}
        />
      )}

      {showImporter && (
        <CSVImporter
          onClose={() => setShowImporter(false)}
          onSuccess={() => {
            setShowImporter(false);
            refetch();
          }}
        />
      )}

      {showDetailsModal && selectedMember && (
        <MemberDetailsModal
          member={selectedMember}
          categories={categories}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMember(null);
          }}
          onUpdate={() => {
            refetch();
            setShowDetailsModal(false);
            setSelectedMember(null);
          }}
        />
      )}

      {showEditModal && editingMember && (
        <MemberDetailsModal
          member={editingMember}
          categories={categories}
          isEditing={true}
          onClose={() => {
            setShowEditModal(false);
            setEditingMember(null);
          }}
          onUpdate={() => {
            refetch();
            setShowEditModal(false);
            setEditingMember(null);
          }}
        />
      )}
    </div>
  );
};

export default MembersManagement;

