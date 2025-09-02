import React, { useState, useEffect } from 'react';
import { UserPlus, Mail, User, Lock, Eye, EyeOff, Save, RefreshCw, Copy, Send, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AccountCreatorProps {
  onSuccess: () => void;
}

interface Category {
  id: string;
  value: string;
  label: string;
  membership_fee: number;
}

// Générateur de mot de passe conforme aux exigences Supabase
const generateStrongPassword = (): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specials = '!@#$%^&*()_+-=[]{};\':"|<>?,./`~';
  
  let password = '';
  
  // Garantir au moins un caractère de chaque type requis
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specials[Math.floor(Math.random() * specials.length)];
  
  // Compléter avec 8 caractères supplémentaires pour avoir 12 au total
  const allChars = lowercase + uppercase + numbers + specials;
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Mélanger le mot de passe pour éviter les patterns prévisibles
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

export const AccountCreator: React.FC<AccountCreatorProps> = ({ onSuccess }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<'member' | 'admin'>('member');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    category: 'loisirs',
    role: 'member',
    temporary_password: ''
  });
  const [createdAccount, setCreatedAccount] = useState<any>(null);

  useEffect(() => {
    fetchCategories();
    generateNewPassword();
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
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const generateNewPassword = () => {
    const newPassword = generateStrongPassword();
    setFormData(prev => ({ ...prev, temporary_password: newPassword }));
  };

  const validatePassword = (password: string): boolean => {
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|<>?,./`~]/.test(password);
    const isLongEnough = password.length >= 8;
    
    return hasLowercase && hasUppercase && hasNumber && hasSpecial && isLongEnough;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword(formData.temporary_password)) {
      alert(`❌ Le mot de passe ne respecte pas les exigences Supabase :

Requis :
• Au moins 8 caractères
• Au moins une minuscule (a-z)
• Au moins une majuscule (A-Z)  
• Au moins un chiffre (0-9)
• Au moins un caractère spécial (!@#$%^&*()_+-=[]{}...)`);
      return;
    }

    try {
      setLoading(true);

      // Utiliser l'Edge Function pour créer le compte avec authentification
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
            temporary_password: formData.temporary_password
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la création du compte');
      }

      const result = await response.json();

      if (result.success && result.success_count > 0) {
        const account = result.results[0];
        setCreatedAccount(account);
        
        alert(`✅ Compte créé avec succès !

👤 Nom : ${formData.first_name} ${formData.last_name}
📧 Email : ${formData.email}
🔑 Mot de passe : ${formData.temporary_password}
👥 Rôle : ${formData.role}

📋 Communiquez ces identifiants à l'utilisateur.
⚠️ Il devra changer son mot de passe à la première connexion.`);

        onSuccess();
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }

    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    const credentials = `Identifiants BE FOR NOR KA

👤 Nom : ${formData.first_name} ${formData.last_name}
📧 Email : ${formData.email}
🔑 Mot de passe : ${formData.temporary_password}
👥 Rôle : ${formData.role}

🌐 Connexion : https://www.befornorka.fr/auth

⚠️ Changez votre mot de passe à la première connexion.`;

    navigator.clipboard.writeText(credentials);
    alert('📋 Identifiants copiés dans le presse-papiers !');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
          <UserPlus className="w-6 h-6 text-primary-600" />
          <span>Créer un compte</span>
        </h2>
        <p className="text-gray-600">
          Créer un nouveau compte utilisateur avec profil membre
        </p>
      </div>

      {/* Alerte problème Supabase */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">🚨 Problème Supabase confirmé</h3>
            <p className="text-red-700 text-sm mt-1">
              Le système de récupération de mot de passe Supabase ne fonctionne pas (erreur "One-time token not found").
              Utilisez ce formulaire pour créer des comptes avec des mots de passe temporaires.
            </p>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type de compte */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de compte
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={accountType === 'member'}
                  onChange={() => {
                    setAccountType('member');
                    setFormData(prev => ({ ...prev, role: 'member' }));
                  }}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span>👤 Membre</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={accountType === 'admin'}
                  onChange={() => {
                    setAccountType('admin');
                    setFormData(prev => ({ ...prev, role: 'administrateur' }));
                  }}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span>👨‍💼 Administrateur</span>
              </label>
            </div>
          </div>

          {/* Informations personnelles */}
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
          </div>

          {/* Catégorie (seulement pour les membres) */}
          {accountType === 'member' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Catégorie
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.value}>
                      {category.label} ({category.membership_fee}€)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Rôle (seulement pour les admins) */}
          {accountType === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rôle administratif
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="administrateur">👨‍💼 Administrateur</option>
                <option value="tresorerie">💰 Trésorerie</option>
                <option value="entraineur">🏐 Entraîneur</option>
                <option value="webmaster">👑 Webmaster</option>
              </select>
            </div>
          )}

          {/* Mot de passe temporaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe temporaire *
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.temporary_password}
                  onChange={(e) => setFormData(prev => ({ ...prev, temporary_password: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={generateNewPassword}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center space-x-1 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Générer</span>
              </button>
            </div>
            
            {/* Validation du mot de passe */}
            <div className="mt-2 text-xs space-y-1">
              <div className={`flex items-center space-x-1 ${
                formData.temporary_password.length >= 8 ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{formData.temporary_password.length >= 8 ? '✅' : '❌'}</span>
                <span>Au moins 8 caractères</span>
              </div>
              <div className={`flex items-center space-x-1 ${
                /[a-z]/.test(formData.temporary_password) ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{/[a-z]/.test(formData.temporary_password) ? '✅' : '❌'}</span>
                <span>Au moins une minuscule (a-z)</span>
              </div>
              <div className={`flex items-center space-x-1 ${
                /[A-Z]/.test(formData.temporary_password) ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{/[A-Z]/.test(formData.temporary_password) ? '✅' : '❌'}</span>
                <span>Au moins une majuscule (A-Z)</span>
              </div>
              <div className={`flex items-center space-x-1 ${
                /[0-9]/.test(formData.temporary_password) ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{/[0-9]/.test(formData.temporary_password) ? '✅' : '❌'}</span>
                <span>Au moins un chiffre (0-9)</span>
              </div>
              <div className={`flex items-center space-x-1 ${
                /[!@#$%^&*()_+\-=\[\]{};':"\\|<>?,./`~]/.test(formData.temporary_password) ? 'text-green-600' : 'text-red-600'
              }`}>
                <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|<>?,./`~]/.test(formData.temporary_password) ? '✅' : '❌'}</span>
                <span>Au moins un caractère spécial</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading || !validatePassword(formData.temporary_password)}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Création...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Créer le compte</span>
                </>
              )}
            </button>
            
            {formData.temporary_password && (
              <button
                type="button"
                onClick={copyCredentials}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copier identifiants</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Instructions</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p>1. <strong>Remplissez</strong> les informations de l'utilisateur</p>
          <p>2. <strong>Générez</strong> un mot de passe conforme aux exigences Supabase</p>
          <p>3. <strong>Créez</strong> le compte (authentification + profil)</p>
          <p>4. <strong>Copiez</strong> les identifiants et communiquez-les à l'utilisateur</p>
          <p>5. <strong>L'utilisateur</strong> se connecte et change son mot de passe</p>
        </div>
      </div>

      {/* Résultat */}
      {createdAccount && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-800">✅ Compte créé avec succès !</h3>
              <div className="text-sm text-green-700 mt-2 space-y-1">
                <p><strong>Email :</strong> {createdAccount.email}</p>
                <p><strong>Mot de passe :</strong> {createdAccount.temporary_password}</p>
                <p><strong>Rôle :</strong> {createdAccount.role}</p>
              </div>
              <button
                onClick={copyCredentials}
                className="mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copier les identifiants</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};