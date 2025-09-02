import React, { useState, useEffect } from 'react';
import { X, Plus, Save, User, Mail, Phone, Calendar, MapPin, Euro, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddMemberFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Category {
  id: string;
  value: string;
  label: string;
  membership_fee: number;
  color: string;
}

export const AddMemberForm: React.FC<AddMemberFormProps> = ({ onClose, onSuccess }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [primaryCategory, setPrimaryCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    address: '',
    postal_code: '',
    city: '',
    membership_fee: 0,
    ffvb_license: '',
    emergency_contact: '',
    emergency_phone: '',
    notes: ''
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      
      setCategories(data || []);
      
      // Définir la catégorie par défaut
      if (data && data.length > 0) {
        const defaultCategory = data.find(cat => cat.value === 'loisirs') || data[0];
        setPrimaryCategory(defaultCategory.value);
        setSelectedCategories([defaultCategory.value]);
        setFormData(prev => ({ ...prev, membership_fee: defaultCategory.membership_fee }));
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const handleCategoryToggle = (categoryValue: string) => {
    const category = categories.find(cat => cat.value === categoryValue);
    if (!category) return;

    if (selectedCategories.includes(categoryValue)) {
      // Retirer la catégorie
      const updated = selectedCategories.filter(cat => cat !== categoryValue);
      setSelectedCategories(updated);
      
      // Si c'était la catégorie principale, en définir une nouvelle
      if (primaryCategory === categoryValue && updated.length > 0) {
        setPrimaryCategory(updated[0]);
        const newPrimaryCategory = categories.find(cat => cat.value === updated[0]);
        if (newPrimaryCategory) {
          setFormData(prev => ({ ...prev, membership_fee: newPrimaryCategory.membership_fee }));
        }
      }
    } else {
      // Ajouter la catégorie
      const updated = [...selectedCategories, categoryValue];
      setSelectedCategories(updated);
      
      // Si c'est la première catégorie, la définir comme principale
      if (selectedCategories.length === 0) {
        setPrimaryCategory(categoryValue);
        setFormData(prev => ({ ...prev, membership_fee: category.membership_fee }));
      }
    }
  };

  const setPrimary = (categoryValue: string) => {
    setPrimaryCategory(categoryValue);
    const category = categories.find(cat => cat.value === categoryValue);
    if (category) {
      setFormData(prev => ({ ...prev, membership_fee: category.membership_fee }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedCategories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie');
      return;
    }

    if (!primaryCategory) {
      alert('Veuillez définir une catégorie principale');
      return;
    }

    try {
      setLoading(true);

      // Récupérer la saison courante
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .maybeSingle();

      if (seasonError) throw seasonError;

      // Créer le membre
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone || null,
          birth_date: formData.birth_date || null,
          address: formData.address || null,
          postal_code: formData.postal_code || null,
          city: formData.city || null,
          category: primaryCategory,
          membership_fee: formData.membership_fee,
          ffvb_license: formData.ffvb_license || null,
          emergency_contact: formData.emergency_contact || null,
          emergency_phone: formData.emergency_phone || null,
          notes: formData.notes || null,
          status: 'pending',
          payment_status: 'pending',
          season_id: currentSeason?.id
        })
        .select()
        .single();

      if (memberError) throw memberError;

      // Ajouter les catégories
      const categoryInserts = selectedCategories.map(categoryValue => ({
        member_id: newMember.id,
        category_value: categoryValue,
        is_primary: categoryValue === primaryCategory
      }));

      const { error: categoriesError } = await supabase
        .from('member_categories')
        .insert(categoryInserts);

      if (categoriesError) throw categoriesError;

      alert('✅ Membre ajouté avec succès !');
      onSuccess();
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              👤 Ajouter un nouveau membre
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informations personnelles */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📝 Informations personnelles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de naissance
                  </label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Licence FFVB
                  </label>
                  <input
                    type="text"
                    value={formData.ffvb_license}
                    onChange={(e) => setFormData(prev => ({ ...prev, ffvb_license: e.target.value }))}
                    placeholder="Numéro de licence (optionnel)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Adresse */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📍 Adresse
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code postal
                    </label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ville
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Catégories */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🏐 Catégories d'entraînement
              </h3>
              <div className="space-y-3">
                {categories.map(category => {
                  const isSelected = selectedCategories.includes(category.value);
                  const isPrimary = primaryCategory === category.value;
                  
                  return (
                    <div key={category.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <label className="flex items-center space-x-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCategoryToggle(category.value)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          ></div>
                          <span className="text-sm font-medium text-gray-900">{category.label}</span>
                          <span className="text-xs text-gray-500">({category.membership_fee}€)</span>
                        </div>
                      </label>
                      
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => setPrimary(category.value)}
                          className={`px-3 py-1 text-xs rounded-full transition-colors ${
                            isPrimary 
                              ? 'bg-primary-600 text-white font-medium'
                              : 'bg-gray-200 text-gray-700 hover:bg-primary-100 hover:text-primary-800'
                          }`}
                        >
                          {isPrimary ? '⭐ Principal' : 'Définir principal'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                La catégorie principale détermine le tarif de base et l'affichage principal
              </p>
            </div>

            {/* Cotisation */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                💰 Cotisation
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant de la cotisation (€)
                </label>
                <input
                  type="number"
                  value={formData.membership_fee}
                  onChange={(e) => setFormData(prev => ({ ...prev, membership_fee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Montant automatiquement défini selon la catégorie principale
                </p>
              </div>
            </div>

            {/* Contact d'urgence */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🚨 Contact d'urgence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du contact
                  </label>
                  <input
                    type="text"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone d'urgence
                  </label>
                  <input
                    type="tel"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Notes sur le membre..."
              />
            </div>

            {/* Boutons */}
            <div className="flex space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || selectedCategories.length === 0}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Ajout...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Ajouter le membre</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};