import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, MapPin, Save, Edit, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  category: string;
  address?: string;
  postal_code?: string;
  city?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  ffvb_license?: string;
  membership_fee: number;
  status: string;
  payment_status: string;
  additional_categories?: string[];
}

// Composant pour afficher les catégories du membre
const ProfileCategoriesDisplay: React.FC<{ memberId: string }> = ({ memberId }) => {
  const [memberCategories, setMemberCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('member_categories')
          .select(`
            category_value,
            is_primary,
            categories:categories(label, color)
          `)
          .eq('member_id', memberId)
          .order('is_primary', { ascending: false });

        if (error) throw error;
        setMemberCategories(data || []);
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
        setMemberCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberCategories();
  }, [memberId]);

  if (loading) {
    return <p className="text-gray-400">Chargement...</p>;
  }
  
  if (memberCategories.length === 0) {
    return <p className="text-gray-500">Aucune catégorie assignée</p>;
  }

  return (
    <div className="space-y-2">
      {memberCategories.map((memberCat, index) => (
        <span 
          key={index}
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mr-2 ${
            memberCat.is_primary 
              ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-200' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {memberCat.is_primary && '⭐ '}
          {memberCat.categories?.label || memberCat.category_value}
        </span>
      ))}
    </div>
  );
};

export const MemberProfile: React.FC = () => {
  const { user } = useAuth();
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    emergency_contact: '',
    emergency_phone: ''
  });

  useEffect(() => {
    fetchMemberData();
  }, []);

  useEffect(() => {
    if (memberData) {
      setFormData({
        first_name: memberData.first_name,
        last_name: memberData.last_name,
        phone: memberData.phone,
        address: memberData.address || '',
        postal_code: memberData.postal_code || '',
        city: memberData.city || '',
        emergency_contact: memberData.emergency_contact || '',
        emergency_phone: memberData.emergency_phone || ''
      });
    }
  }, [memberData]);

  const fetchMemberData = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        console.log('Aucun profil membre trouvé pour cet utilisateur');
        setMemberData(null);
        return;
      }
      
      setMemberData(data);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!memberData) return;

      const { error } = await supabase
        .from('members')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          address: formData.address || null,
          postal_code: formData.postal_code || null,
          city: formData.city || null,
          emergency_contact: formData.emergency_contact || null,
          emergency_phone: formData.emergency_phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', memberData.id);

      if (error) throw error;

      await fetchMemberData();
      setEditing(false);
      alert('✅ Profil mis à jour avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(`❌ Erreur lors de la sauvegarde: ${error.message}`);
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement de votre profil...</p>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="text-lg font-semibold text-red-800">Profil non trouvé</h3>
            <p className="text-red-700">Impossible de charger votre profil membre.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              👤 Mon Profil
            </h1>
            <p className="text-gray-600">
              Gérez vos informations personnelles
            </p>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>{editing ? 'Annuler' : 'Modifier'}</span>
          </button>
        </div>
      </div>

      {/* Informations personnelles */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          📝 Informations personnelles
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prénom
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 font-medium">{memberData.first_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 font-medium">{memberData.last_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <p className="text-gray-600">{memberData.email}</p>
            <p className="text-xs text-gray-500">L'email ne peut pas être modifié</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone
            </label>
            {editing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 font-medium">{memberData.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance
            </label>
            <p className="text-gray-900 font-medium">
              {new Date(memberData.birth_date).toLocaleDateString('fr-FR')} ({calculateAge(memberData.birth_date)} ans)
            </p>
          </div>

          <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Catégories d'entraînement
  </label>
  <ProfileCategoriesDisplay memberId={memberData.id} />
</div>
        </div>
      </div>

      {/* Adresse */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          📍 Adresse
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Rue de la République"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 font-medium">{memberData.address || 'Non renseignée'}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code postal
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                  placeholder="75001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-900 font-medium">{memberData.postal_code || 'Non renseigné'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville
              </label>
              {editing ? (
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Paris"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-900 font-medium">{memberData.city || 'Non renseignée'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact d'urgence */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🚨 Contact d'urgence
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du contact
            </label>
            {editing ? (
              <input
                type="text"
                value={formData.emergency_contact}
                onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                placeholder="Marie Dupont"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 font-medium">{memberData.emergency_contact || 'Non renseigné'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone d'urgence
            </label>
            {editing ? (
              <input
                type="tel"
                value={formData.emergency_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, emergency_phone: e.target.value }))}
                placeholder="06 12 34 56 78"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            ) : (
              <p className="text-gray-900 font-medium">{memberData.emergency_phone || 'Non renseigné'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Informations volleyball */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🏐 Informations volleyball
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Catégories d'entraînement
  </label>
  <ProfileCategoriesDisplay memberId={memberData.id} />
</div>


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cotisation
            </label>
            <p className="text-gray-900 font-medium">{memberData.membership_fee}€</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Licence FFVB
            </label>
            <p className="text-gray-900 font-medium">{memberData.ffvb_license || 'Non attribuée'}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statut du dossier
            </label>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              memberData.status === 'validated' ? 'bg-green-100 text-green-700' :
              memberData.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {memberData.status === 'validated' ? '✅ Validé' :
               memberData.status === 'pending' ? '⏳ En attente' :
               '❌ Rejeté'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statut de paiement
            </label>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              memberData.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
              memberData.payment_status === 'overdue' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {memberData.payment_status === 'paid' ? '💰 Payé' :
               memberData.payment_status === 'overdue' ? '⚠️ En retard' :
               '⏳ En attente'}
            </span>
          </div>
        </div>
      </div>

      {/* Bouton de sauvegarde */}
      {editing && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Sauvegarder les modifications</span>
                </>
              )}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
};