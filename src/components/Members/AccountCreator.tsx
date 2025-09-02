import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Eye, EyeOff, Upload, Download, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CSVImporter } from './CSVImporter';

interface AccountCreatorProps {
  onSuccess: () => void;
}

interface Category {
  id: string;
  value: string;
  label: string;
  membership_fee: number;
  color: string;
}

export const AccountCreator: React.FC<AccountCreatorProps> = ({ onSuccess }) => {
  const { userProfile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    category: 'loisirs',
    role: 'member',
    membership_fee: 200,
    address: '',
    postal_code: '',
    city: '',
    emergency_contact: '',
    emergency_phone: '',
    notes: ''
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<any>(null);

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
        setFormData(prev => ({ 
          ...prev, 
          category: defaultCategory.value,
          membership_fee: defaultCategory.membership_fee 
        }));
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const generateStrongPassword = () => {
    const lowercase = 'abcdefghijkmnpqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const specials = '!@#$%^&*()_+-=[]{}';
    
    let password = '';
    
    // Garantir au moins un caractère de chaque type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    // Compléter avec 8 caractères supplémentaires pour avoir 12 au total
    const allChars = lowercase + uppercase + numbers + specials;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mélanger le mot de passe
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleCategoryChange = (categoryValue: string) => {
    const category = categories.find(cat => cat.value === categoryValue);
    if (category) {
      setFormData(prev => ({
        ...prev,
        category: categoryValue,
        membership_fee: category.membership_fee
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name || !formData.email) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);

      // Générer un mot de passe temporaire
      const tempPassword = generateStrongPassword();
      setGeneratedPassword(tempPassword);

      // Utiliser l'Edge Function pour créer un compte complet
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          accounts: [{
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone || null,
            birth_date: formData.birth_date || null,
            category: formData.category,
            role: formData.role,
            membership_fee: formData.membership_fee,
            address: formData.address || null,
            postal_code: formData.postal_code || null,
            city: formData.city || null,
            emergency_contact: formData.emergency_contact || null,
            emergency_phone: formData.emergency_phone || null,
            notes: formData.notes || null,
            temporary_password: tempPassword
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.success_count > 0) {
        setCreatedAccount({
          email: formData.email,
          name: `${formData.first_name} ${formData.last_name}`,
          password: tempPassword,
          role: formData.role
        });
        setAccountCreated(true);
        onSuccess();
      } else {
        const errorMsg = result.results?.[0]?.error || result.error || 'Erreur inconnue';
        throw new Error(errorMsg);
      }

    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      birth_date: '',
      category: 'loisirs',
      role: 'member',
      membership_fee: 200,
      address: '',
      postal_code: '',
      city: '',
      emergency_contact: '',
      emergency_phone: '',
      notes: ''
    });
    setGeneratedPassword('');
    setAccountCreated(false);
    setCreatedAccount(null);
  };

  const copyCredentials = () => {
    if (createdAccount) {
      const credentials = `Identifiants BE FOR NOR KA

Nom: ${createdAccount.name}
Email: ${createdAccount.email}
Mot de passe: ${createdAccount.password}
Rôle: ${createdAccount.role}

Connexion: ${window.location.origin}/auth`;

      navigator.clipboard.writeText(credentials);
      alert('📋 Identifiants copiés dans le presse-papiers !');
    }
  };

  if (accountCreated && createdAccount) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <UserPlus className="w-6 h-6 text-green-600" />
            <span>Compte créé avec succès !</span>
          </h2>
        </div>

        {/* Identifiants créés */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-800 mb-2">
              Compte créé pour {createdAccount.name}
            </h3>
            <p className="text-green-700">
              Le compte a été créé avec succès dans Supabase Auth
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-green-300">
            <h4 className="font-semibold text-green-800 mb-4">🔑 Identifiants à communiquer</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Email :</span>
                <span className="font-mono font-medium">{createdAccount.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Mot de passe :</span>
                <span className="font-mono font-medium">{createdAccount.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rôle :</span>
                <span className="font-medium">{createdAccount.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">URL de connexion :</span>
                <span className="font-mono text-blue-600">{window.location.origin}/auth</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={copyCredentials}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Copier les identifiants</span>
            </button>
            <button
              onClick={resetForm}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Créer un autre compte</span>
            </button>
          </div>

          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
            <p className="text-green-800 text-sm">
              <strong>📧 Instructions :</strong> Communiquez ces identifiants à l'utilisateur. 
              Il pourra se connecter immédiatement et devra changer son mot de passe à la première connexion.
            </p>
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
            <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <UserPlus className="w-6 h-6 text-primary-600" />
              <span>Créer un compte</span>
            </h2>
            <p className="text-gray-600 mt-2">
              Créez un nouveau compte utilisateur avec profil membre
            </p>
          </div>
          <button
            onClick={() => setShowCSVImporter(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
        </div>
      </div>

      {/* Formulaire de création */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
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
                  Rôle *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="member">👤 Membre</option>
                  <option value="entraineur">🏐 Entraîneur</option>
                  <option value="tresorerie">💰 Trésorerie</option>
                  <option value="administrateur">👨‍💼 Administrateur</option>
                  {userProfile?.role === 'webmaster' && (
                    <option value="webmaster">👑 Webmaster</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Catégorie et cotisation (seulement pour les membres) */}
          {formData.role === 'member' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🏐 Informations volleyball
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.value}>
                        {category.label} ({category.membership_fee}€)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cotisation (€)
                  </label>
                  <input
                    type="number"
                    value={formData.membership_fee}
                    onChange={(e) => setFormData(prev => ({ ...prev, membership_fee: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Adresse (optionnel) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📍 Adresse (optionnel)
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

          {/* Contact d'urgence (pour les membres) */}
          {formData.role === 'member' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🚨 Contact d'urgence (optionnel)
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
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📝 Notes (optionnel)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Notes sur l'utilisateur..."
            />
          </div>

          {/* Bouton de création */}
          <div className="pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Créer le compte</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal CSV Importer */}
      {showCSVImporter && (
        <CSVImporter
          onClose={() => setShowCSVImporter(false)}
          onSuccess={() => {
            setShowCSVImporter(false);
            onSuccess();
          }}
        />
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-3">💡 Instructions</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>Création individuelle :</strong> Remplissez le formulaire ci-dessus pour créer un compte unique</p>
          <p><strong>Import CSV :</strong> Utilisez le bouton "Import CSV" pour créer plusieurs comptes en une fois</p>
          <p><strong>Mot de passe :</strong> Un mot de passe temporaire sera généré automatiquement</p>
          <p><strong>Première connexion :</strong> L'utilisateur devra changer son mot de passe</p>
          <p><strong>Rôles :</strong> Définissent les permissions d'accès dans l'application</p>
        </div>
      </div>
    </div>
  );
};