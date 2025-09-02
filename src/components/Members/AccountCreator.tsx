import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Mail, User, Phone, Calendar, Tag, Euro, AlertCircle, CheckCircle, Eye, EyeOff, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  const [success, setSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    category: 'loisirs',
    role: 'member',
    membership_fee: 200
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

      // Utiliser l'Edge Function pour créer le compte complet
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
            temporary_password: tempPassword
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.success_count > 0) {
        setSuccess(true);
        alert(`✅ Compte créé avec succès !

👤 Utilisateur : ${formData.first_name} ${formData.last_name}
📧 Email : ${formData.email}
🔑 Mot de passe temporaire : ${tempPassword}
👥 Rôle : ${formData.role}

📋 Communiquez ces identifiants à l'utilisateur.
⚠️ Il devra changer son mot de passe à la première connexion.`);

        // Réinitialiser le formulaire
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          birth_date: '',
          category: 'loisirs',
          role: 'member',
          membership_fee: 200
        });

        onSuccess();
      } else {
        const errorMsg = result.results?.[0]?.error || result.error || 'Erreur inconnue';
        throw new Error(errorMsg);
      }

    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur lors de la création du compte: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyPasswordToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    alert('🔑 Mot de passe copié dans le presse-papiers !');
  };

  // Vérifier les permissions
  const userRole = userProfile?.role || '';
  const hasAccess = ['webmaster', 'administrateur'].includes(userRole);

  if (!hasAccess) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="text-lg font-semibold text-red-800">Accès refusé</h3>
            <p className="text-red-700">
              Cette section est réservée aux Webmasters et Administrateurs.
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
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2 mb-2">
          <UserPlus className="w-6 h-6 text-primary-600" />
          <span>Créer un compte</span>
        </h2>
        <p className="text-gray-600">
          Créez un nouveau compte utilisateur avec profil membre
        </p>
      </div>

      {success && generatedPassword && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-800">
              Compte créé avec succès !
            </h3>
          </div>
          <div className="bg-white rounded-lg p-4 border border-green-300">
            <h4 className="font-semibold text-green-800 mb-3">🔑 Identifiants à communiquer</h4>
            <div className="space-y-2 text-sm">
              <p><strong>Email :</strong> {formData.email}</p>
              <div className="flex items-center space-x-2">
                <span><strong>Mot de passe :</strong></span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {showPassword ? generatedPassword : '••••••••••••'}
                </span>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={copyPasswordToClipboard}
                  className="p-1 text-blue-600 hover:text-blue-800"
                  title="Copier le mot de passe"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              👤 Informations personnelles
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

          {/* Informations club (seulement pour les membres) */}
          {formData.role === 'member' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🏐 Informations club
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
                  <span>Création du compte...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Créer le compte</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-3">📋 Mode d'emploi</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p>1. <strong>Remplissez</strong> les informations de la personne</p>
          <p>2. <strong>Choisissez</strong> le rôle approprié</p>
          <p>3. <strong>Cliquez "Créer"</strong> - Un mot de passe sera généré automatiquement</p>
          <p>4. <strong>Communiquez</strong> les identifiants à la personne</p>
          <p>5. <strong>La personne</strong> se connecte et change son mot de passe</p>
        </div>
        
        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Astuce :</strong> Pour créer plusieurs comptes en une fois, utilisez l'import CSV !
          </p>
        </div>
      </div>
    </div>
  );
};