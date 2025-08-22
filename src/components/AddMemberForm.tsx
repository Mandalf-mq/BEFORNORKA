import React, { useState } from 'react';
import { Save, User, Mail, Phone, Calendar, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';

interface AddMemberFormProps {
  onSuccess: () => void;
}

interface PricingRule {
  id: string;
  name: string;
  base_amount: number;
}

export const AddMemberForm: React.FC<AddMemberFormProps> = ({ onSuccess }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    birthDate: '',
    category: 'senior',
    membershipFee: 250,
    ffvbLicense: '',
    additionalCategories: [] as string[]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchPricingRules();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      
      console.log('📋 Catégories chargées depuis la DB:', data);
      setCategories(data || []);
      
      // Si aucune catégorie trouvée
      if (!data || data.length === 0) {
        setError('⚠️ Aucune catégorie active trouvée. Veuillez d\'abord créer des catégories dans Paramètres → Catégories');
      } else {
        setError(null); // Reset l'erreur si des catégories sont trouvées
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      setError('❌ Impossible de charger les catégories. Vérifiez votre connexion.');
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchPricingRules = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_fee_rules')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPricingRules(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des tarifs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('members')
        .insert([{
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address || null,
          postal_code: formData.postalCode || null,
          city: formData.city || null,
          birth_date: formData.birthDate,
          category: formData.category,
          membership_fee: formData.membershipFee,
          ffvb_license: formData.ffvbLicense || null, // 🏐 Nouveau champ
          status: 'active',
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Reset du formulaire
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        postalCode: '',
        city: '',
        birthDate: '',
        category: 'senior',
        membershipFee: 250,
        ffvbLicense: ''
      });

      onSuccess();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du membre:', error);
      setError('Une erreur est survenue lors de l\'ajout du membre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Ajouter un membre</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom et Prénom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Prénom *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Email et Téléphone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Adresse */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📍 Adresse
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Rue de la République"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📮 Code postal
                </label>
                <input
                  type="text"
                  value={formData.postalCode || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                  placeholder="75001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏙️ Ville
                </label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Paris"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Date de naissance et Licence FFVB */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date de naissance
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Award className="w-4 h-4 inline mr-1" />
                  Licence FFVB 🏐
                </label>
                <input
                  type="text"
                  value={formData.ffvbLicense}
                  onChange={(e) => setFormData(prev => ({ ...prev, ffvbLicense: e.target.value }))}
                  placeholder="Ex: 123456789"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optionnelle - Pour les compétitions officielles
                </p>
              </div>
            </div>

            {/* Catégorie avec gestion d'erreur */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Catégories *
              </label>
              
              {loadingCategories ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  <span className="text-gray-500">Chargement...</span>
                </div>
              ) : categories.length === 0 ? (
                <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50">
                  <span className="text-red-600 text-sm">
                    ⚠️ Aucune catégorie disponible. 
                    <br />
                    Créez-en une dans <strong>Paramètres → Catégories</strong>
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Catégorie principale */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Catégorie principale *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Sélectionner la catégorie principale</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.value}>
                          {category.label}
                          {category.age_range && ` (${category.age_range})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Catégories supplémentaires */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Catégories supplémentaires (optionnel)
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {categories.map(category => (
                        <label key={category.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.additionalCategories?.includes(category.value) || false}
                            onChange={(e) => {
                              const current = formData.additionalCategories || [];
                              if (e.target.checked) {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  additionalCategories: [...current, category.value]
                                }));
                              } else {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  additionalCategories: current.filter(c => c !== category.value)
                                }));
                              }
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-gray-700">{category.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Un membre peut participer aux entraînements de plusieurs catégories
                    </p>
                  </div>
                </div>
              )}
              
              {categories.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  La catégorie principale détermine le tarif de base
                </p>
              )}
            </div>

            {/* Cotisation personnalisée */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Montant de la cotisation (€) *
              </label>
              <div className="space-y-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.membershipFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, membershipFee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
                
                {/* Suggestions des règles tarifaires personnalisées */}
                {pricingRules.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-600">Suggestions :</span>
                    {pricingRules.map(rule => (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, membershipFee: rule.base_amount }))}
                        className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-full transition-colors"
                      >
                        {rule.name}: {rule.base_amount}€
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Suggestions standards */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-600">Standards :</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, membershipFee: 200 }))}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full transition-colors"
                  >
                    Standard: 200€
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, membershipFee: 150 }))}
                    className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-full transition-colors"
                  >
                    Étudiant: 150€
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, membershipFee: 300 }))}
                    className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1 rounded-full transition-colors"
                  >
                    Premium: 300€
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, membershipFee: 0 }))}
                    className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-3 py-1 rounded-full transition-colors"
                  >
                    Gratuit: 0€
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Montant personnalisé de la cotisation (indépendant de la catégorie)
              </p>
            </div>

            {/* Info importante */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Informations importantes</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Catégorie principale :</strong> Détermine le tarif de base et l'affichage principal</p>
                <p>• <strong>Catégories supplémentaires :</strong> Permettent de participer à plusieurs groupes d'entraînement</p>
                <p>• <strong>Tarif :</strong> Montant libre, indépendant de la catégorie</p>
                <p>• <strong>Licence FFVB :</strong> Optionnelle, pour les compétitions officielles</p>
                <p>• <strong>Flexibilité :</strong> Tarif unique + participation multi-catégories</p>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onSuccess}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              
              <button
                type="submit"
                disabled={loading || categories.length === 0}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : categories.length === 0 ? (
                  <span>⚠️ Créez d'abord des catégories</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
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
