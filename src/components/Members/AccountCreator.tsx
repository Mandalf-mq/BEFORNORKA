import React, { useState } from 'react';
import { UserPlus, Save, Eye, EyeOff, RefreshCw, User, Mail, Phone, Calendar, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CSVImporter } from './CSVImporter';

interface AccountCreatorProps {
  onSuccess: () => void;
}

export const AccountCreator: React.FC<AccountCreatorProps> = ({ onSuccess }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    category: '',
    temporaryPassword: '',
    role: 'member'
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les catégories depuis la base de données
  React.useEffect(() => {
    fetchCategories();
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
      
      setCategories(data || []);

       if (data && data.length > 0 && !formData.category) {
      setFormData(prev => ({ ...prev, category: data[0].value }));
    }
      
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      // En cas d'erreur, afficher un message mais ne pas bloquer l'interface
      setCategories([]);
      setError('Erreur lors du chargement des catégories. Veuillez réessayer.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const roles = [
    { 
      value: 'member', 
      label: '👤 Membre', 
      description: 'Accès à son profil et documents uniquement',
      needsCategory: true,
      needsCotisation: true
    },
    { 
      value: 'entraineur', 
      label: '🏐 Entraîneur', 
      description: 'Membre + gestion des entraînements et WhatsApp',
      needsCategory: false,
      needsCotisation: false
    },
    { 
      value: 'tresorerie', 
      label: '💰 Trésorerie', 
      description: 'Membre + gestion des paiements et tarifs',
      needsCategory: false,
      needsCotisation: false
    },
    { 
      value: 'administrateur', 
      label: '👨‍💼 Administrateur', 
      description: 'Membre + gestion des membres et documents',
      needsCategory: false,
      needsCotisation: false
    },
    { 
      value: 'webmaster', 
      label: '👑 Webmaster', 
      description: 'Accès technique complet à toutes les fonctionnalités',
      needsCategory: false,
      needsCotisation: false
    }
  ];

  const selectedRole = roles.find(r => r.value === formData.role);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, temporaryPassword: password }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.temporaryPassword) {
      setError('Veuillez générer un mot de passe temporaire');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('create_member_account_with_password', {
  p_email: formData.email,
  p_first_name: formData.firstName,
  p_last_name: formData.lastName,
  p_phone: formData.phone,
  p_birth_date: formData.birthDate,
  p_category: formData.category,  // 👈 AJOUTER CETTE LIGNE !
  p_temporary_password: formData.temporaryPassword,
  p_role: formData.role
});

      if (error) throw error;

      if (data.success) {
        const roleLabel = roles.find(r => r.value === formData.role)?.label;
        
        // Message personnalisé selon le rôle
        const message = formData.role === 'member' 
          ? `✅ Compte membre créé avec succès !

👤 Nom : ${formData.firstName} ${formData.lastName}
📧 Email : ${formData.email}
🔑 Rôle : ${roleLabel}
🏐 Catégorie : ${formData.category}
💰 Cotisation : ${categories.find(c => c.value === formData.category)?.membership_fee}€
🔑 Mot de passe temporaire : ${formData.temporaryPassword}

⚠️ IMPORTANT :
• Communiquez ces identifiants au membre
• Il devra changer son mot de passe à la première connexion
• Le membre est en statut "pending" - pensez à le valider
• Il pourra ensuite uploader ses documents`
          : `✅ Compte ${roleLabel} créé avec succès !

👤 Nom : ${formData.firstName} ${formData.lastName}
📧 Email : ${formData.email}
🔑 Rôle : ${roleLabel}
🔑 Mot de passe temporaire : ${formData.temporaryPassword}

⚠️ IMPORTANT :
• Communiquez ces identifiants à la personne
• Elle devra changer son mot de passe à la première connexion
• Accès immédiat aux fonctionnalités de son rôle
• Pas de profil membre ni de cotisation (rôle administratif)`;

        alert(message);

            accountErrors.push(`${member.email}: ${accountError.message}`);
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          birthDate: '',
         category: categories.length > 0 ? categories[0].value : '',
          temporaryPassword: '',
          role: 'member'
        });

        onSuccess();
      } else {
        setError(data.error || 'Erreur lors de la création du compte');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  if (loadingCategories) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-lg text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des catégories...</p>
        </div>
      </div>
    );
  }

  if (showCSVImporter) {
    return (
      <CSVImporter 
        onSuccess={() => {
          setShowCSVImporter(false);
          onSuccess();
        }}
        onClose={() => setShowCSVImporter(false)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <UserPlus className="w-6 h-6 text-primary-600" />
            <span>Créer un compte</span>
          </h2>
          <button
            onClick={() => setShowCSVImporter(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
        </div>

        {/* Info importante */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">🔐 Création de compte avec authentification</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Un compte Supabase sera créé avec le rôle sélectionné</p>
            <p>• Vous définissez un mot de passe temporaire</p>
            <p>• La personne devra le changer à sa première connexion</p>
            <p>• Le téléphone est optionnel (peut être ajouté plus tard)</p>
            <p>• <strong>Membre :</strong> Profil membre + cotisation créés automatiquement</p>
            <p>• <strong>Admin/Entraîneur/Trésorerie :</strong> Compte utilisateur seulement</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">👤 Informations personnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="06 12 34 56 78 (optionnel)"
                  />
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Le téléphone est optionnel mais recommandé pour les notifications WhatsApp
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Rôle dans l'association */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">🔑 Rôle dans l'association</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sélectionner le rôle *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              
              {/* Description du rôle sélectionné */}
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>📋 Description :</strong> {selectedRole?.description}
                </p>
                <div className="mt-2 flex items-center space-x-4 text-xs">
                  <span className={`px-2 py-1 rounded-full ${
                    selectedRole?.needsCategory ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selectedRole?.needsCategory ? '✅ Catégorie requise' : '❌ Pas de catégorie'}
                  </span>
                  <span className={`px-2 py-1 rounded-full ${
                    selectedRole?.needsCotisation ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selectedRole?.needsCotisation ? '✅ Cotisation calculée' : '❌ Pas de cotisation'}
                  </span>
                </div>
              </div>

              {/* Avertissement pour webmaster */}
              {formData.role === 'webmaster' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ⚠️ <strong>Attention :</strong> Seul un Webmaster peut créer d'autres Webmasters
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Catégorie (seulement pour les membres) */}
          {selectedRole?.needsCategory && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-4">🏐 Catégorie volleyball</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie selon l'âge
                </label>
                {categories.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-red-700">
                      ⚠️ Aucune catégorie disponible. Veuillez d'abord créer des catégories dans Paramètres → Catégories.
                    </p>
                  </div>
                ) : null}
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={categories.length === 0}
                >
                  {categories.length === 0 && (
                    <option value="">Aucune catégorie disponible</option>
                  )}
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label} {category.age_range ? `(${category.age_range})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  La catégorie est purement informative (âge, niveau) - utilisée pour organiser les entraînements
                </p>
              </div>
            </div>
          )}

          {/* Info pour rôles administratifs */}
          {!selectedRole?.needsCategory && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Rôle administratif</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Pas de profil membre</strong> créé (rôle administratif)</p>
                <p>• <strong>Pas de cotisation</strong> à payer</p>
                <p>• <strong>Accès immédiat</strong> aux fonctionnalités de son rôle</p>
                <p>• <strong>Peut gérer</strong> les membres selon ses permissions</p>
              </div>
            </div>
          )}

          {/* Génération du mot de passe temporaire */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">🔐 Authentification</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe temporaire *
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.temporaryPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                    placeholder="Générez ou tapez un mot de passe"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Générer</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                La personne devra changer ce mot de passe à sa première connexion
              </p>
            </div>
          </div>

          {/* Résumé avant création */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">📋 Résumé de la création</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>• <strong>Nom :</strong> {formData.firstName} {formData.lastName}</p>
              <p>• <strong>Email :</strong> {formData.email}</p>
              <p>• <strong>Rôle :</strong> {selectedRole?.label}</p>
              <p>• <strong>Téléphone :</strong> {formData.phone || 'Non renseigné'}</p>
              {selectedRole?.needsCategory && (
                <>
                  <p>• <strong>Catégorie :</strong> {categories.find(c => c.value === formData.category)?.label || formData.category}</p>
                  <p>• <strong>Cotisation :</strong> Calculée automatiquement selon la catégorie</p>
                </>
              )}
              <p>• <strong>Profil membre :</strong> {selectedRole?.needsCategory ? 'Oui' : 'Non (rôle administratif)'}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (selectedRole?.needsCategory && categories.length === 0)}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Créer le compte {selectedRole?.label}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};