import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Edit, Trash2, Users, Tag, Euro, Building, Palette, Globe, Mail, Phone, MapPin, X, UserCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AdminPasswordReset } from './AdminPasswordReset';
import { AdminPasswordReset } from './AdminPasswordReset';

interface ClubSettings {
  clubName: string;
  clubDescription: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  postalCode: string;
  logoUrl: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

interface Category {
  id: string;
  value: string;
  label: string;
  description: string;
  age_range: string;
  membership_fee: number;
  color: string;
  is_active: boolean;
  display_order: number;
  is_system: boolean;
}

interface FeeRule {
  id: string;
  name: string;
  category: string[];
  base_amount: number;
  discounts: Record<string, number>;
  supplements: Record<string, number>;
  conditions: Record<string, any>;
  is_active: boolean;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export const SettingsPanel: React.FC = () => {
  const { userProfile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'categories' | 'fees'>('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // États pour les paramètres généraux
  const [generalSettings, setGeneralSettings] = useState<ClubSettings>({
  const [categories, setCategories] = useState<any[]>([]);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
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
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    fetchCategories();
    generatePassword();
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

  const generatePassword = () => {
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
    
    // Compléter avec 8 caractères supplémentaires
    const allChars = lowercase + uppercase + numbers + specials;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mélanger le mot de passe
    const finalPassword = password.split('').sort(() => Math.random() - 0.5).join('');
    setFormData(prev => ({ ...prev, temporary_password: finalPassword }));
  };

  const validatePassword = (password: string) => {
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;':".,<>?]/.test(password);
    const isLongEnough = password.length >= 8;
    
    return hasLower && hasUpper && hasNumber && hasSpecial && isLongEnough;
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
        throw new Error(`Erreur HTTP: ${response.status} - Vérifiez que l'Edge Function est déployée`);
      }

      const result = await response.json();
      
      if (result.success && result.success_count > 0) {
        alert(`✅ Compte créé avec succès !

👤 Utilisateur : ${formData.first_name} ${formData.last_name}
📧 Email : ${formData.email}
🔑 Mot de passe temporaire : ${formData.temporary_password}
👨‍💼 Rôle : ${getRoleLabel(formData.role)}

📋 Instructions à communiquer :
1. Se connecter sur le site avec ces identifiants
2. Changer le mot de passe à la première connexion
3. Compléter son profil si nécessaire`);

        // Réinitialiser le formulaire
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          birth_date: '',
          category: 'loisirs',
          role: 'member',
          temporary_password: ''
        });
        generatePassword();
        onSuccess();
      } else {
        throw new Error(result.error || 'Erreur inconnue lors de la création');
      }

    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('HTTP: 404')) {
        alert(`❌ Edge Function non disponible

🔧 L'Edge Function 'create-user-accounts' n'est pas déployée.

📋 Pour la déployer :
1. Allez dans Supabase Dashboard
2. Edge Functions → Create Function
3. Nom : create-user-accounts
4. Copiez le code depuis supabase/functions/create-user-accounts/index.ts
5. Deploy

🆘 SOLUTION TEMPORAIRE :
Utilisez l'import CSV en mode "Profils seulement" en attendant.`);
      } else {
        alert(`❌ Erreur lors de la création: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'webmaster': return 'Webmaster';
      case 'administrateur': return 'Administrateur';
      case 'tresorerie': return 'Trésorerie';
      case 'entraineur': return 'Entraîneur';
      case 'member': return 'Membre';
      default: return 'Membre';
    }
  };

  // Vérifier les permissions
  const userRole = userProfile?.role || '';
  const hasAccess = ['webmaster', 'administrateur'].includes(userRole);
  
  if (!hasAccess) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
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
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2 mb-6">
          <UserPlus className="w-6 h-6 text-primary-600" />
          <span>Créer un compte</span>
        </h2>
        
        <div className="flex space-x-4">
          <button
            onClick={() => setShowPasswordReset(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Key className="w-4 h-4" />
            <span>🆘 Réinitialiser mot de passe</span>
          </button>
        </div>
      </div>

      {/* Formulaire de création */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Nouveau compte utilisateur
        </h3>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Catégorie (si membre) */}
          {formData.role === 'member' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie *
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
          )}

          {/* Mot de passe temporaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe temporaire *
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                required
                value={formData.temporary_password}
                onChange={(e) => setFormData(prev => ({ ...prev, temporary_password: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
              />
              <button
                type="button"
                onClick={generatePassword}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Générer</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Mot de passe conforme aux exigences Supabase (8+ caractères, majuscules, minuscules, chiffres, symboles)
            </p>
            <div className="mt-2 text-xs">
              <div className="flex space-x-4">
                <span className={validatePassword(formData.temporary_password) ? 'text-green-600' : 'text-red-600'}>
                  {validatePassword(formData.temporary_password) ? '✅ Conforme' : '❌ Non conforme'}
                </span>
              </div>
            </div>
          </div>

          {/* Bouton de création */}
          <button
            type="submit"
            disabled={loading || !validatePassword(formData.temporary_password)}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Création du compte...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Créer le compte avec authentification</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Mode d'emploi</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p>1. <strong>Remplissez</strong> les informations de l'utilisateur</p>
          <p>2. <strong>Choisissez</strong> le rôle approprié</p>
          <p>3. <strong>Générez</strong> un mot de passe temporaire sécurisé</p>
          <p>4. <strong>Créez</strong> le compte (utilise l'Edge Function)</p>
          <p>5. <strong>Communiquez</strong> les identifiants à l'utilisateur</p>
          <p>6. <strong>L'utilisateur</strong> se connecte et change son mot de passe</p>
        </div>
      </div>

      {/* Modal de réinitialisation */}
      {showPasswordReset && (
        <AdminPasswordReset onClose={() => setShowPasswordReset(false)} />
      )}
    </div>
  );
};
    }
  };

  const saveCategory = async () => {
    try {
      setSaving(true);

      if (editingCategory) {
        // Modification
        const { error } = await supabase
          .from('categories')
          .update({
            label: newCategory.label,
            description: newCategory.description,
            age_range: newCategory.age_range,
            membership_fee: newCategory.membership_fee,
            color: newCategory.color,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        alert('✅ Catégorie modifiée avec succès !');
      } else {
        // Création
        const { error } = await supabase
          .from('categories')
          .insert({
            value: newCategory.value,
            label: newCategory.label,
            description: newCategory.description,
            age_range: newCategory.age_range,
            membership_fee: newCategory.membership_fee,
            color: newCategory.color,
            is_active: true,
            display_order: categories.length + 1,
            is_system: false
          });

        if (error) throw error;
        alert('✅ Catégorie créée avec succès !');
      }

      setShowCategoryForm(false);
      setEditingCategory(null);
      setNewCategory({
        value: '',
        label: '',
        description: '',
        age_range: '',
        membership_fee: 0,
        color: '#3b82f6'
      });
      await fetchCategories();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return;

    try {
      const { data, error } = await supabase.rpc('delete_category', {
        p_category_id: categoryId
      });

      if (error) throw error;

      if (data.success) {
        alert('✅ Catégorie supprimée avec succès !');
        await fetchCategories();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  // ========================================
  // FONCTIONS POUR LES RÈGLES DE TARIFICATION
  // ========================================

  const fetchFeeRules = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_fee_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeeRules(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des règles de tarification:', error);
    }
  };

  const saveFeeRule = async () => {
    try {
      setSaving(true);

      if (editingFeeRule) {
        // Modification
        const { error } = await supabase
          .from('membership_fee_rules')
          .update({
            name: newFeeRule.name,
            category: newFeeRule.category,
            base_amount: newFeeRule.base_amount,
            discounts: newFeeRule.discounts,
            supplements: newFeeRule.supplements,
            conditions: newFeeRule.conditions,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingFeeRule.id);

        if (error) throw error;
        alert('✅ Règle de tarification modifiée avec succès !');
      } else {
        // Création
        const { error } = await supabase
          .from('membership_fee_rules')
          .insert({
            name: newFeeRule.name,
            category: newFeeRule.category,
            base_amount: newFeeRule.base_amount,
            discounts: newFeeRule.discounts,
            supplements: newFeeRule.supplements,
            conditions: newFeeRule.conditions,
            is_active: true,
            season_id: null
          });

        if (error) throw error;
        alert('✅ Règle de tarification créée avec succès !');
      }

      setShowFeeForm(false);
      setEditingFeeRule(null);
      setNewFeeRule({
        name: '',
        category: ['senior'],
        base_amount: 250,
        discounts: { family: 0, earlyBird: 0, student: 0 },
        supplements: { competition: 0, equipment: 0 },
        conditions: { requiresParent: false }
      });
      await fetchFeeRules();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteFeeRule = async (ruleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle de tarification ?')) return;

    try {
      const { error } = await supabase
        .from('membership_fee_rules')
        .update({ is_active: false })
        .eq('id', ruleId);

      if (error) throw error;

      alert('✅ Règle de tarification supprimée !');
      await fetchFeeRules();
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  // ========================================
  // FONCTIONS UTILITAIRES
  // ========================================

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'webmaster': return 'Webmaster';
      case 'administrateur': return 'Administrateur';
      case 'tresorerie': return 'Trésorerie';
      case 'entraineur': return 'Entraîneur';
      case 'member': return 'Membre';
      default: return 'Membre';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'webmaster': return 'bg-purple-100 text-purple-700';
      case 'administrateur': return 'bg-blue-100 text-blue-700';
      case 'tresorerie': return 'bg-green-100 text-green-700';
      case 'entraineur': return 'bg-orange-100 text-orange-700';
      case 'member': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const startEditingCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategory({
      value: category.value,
      label: category.label,
      description: category.description,
      age_range: category.age_range,
      membership_fee: category.membership_fee,
      color: category.color
    });
    setShowCategoryForm(true);
  };

  const startEditingFeeRule = (rule: FeeRule) => {
    setEditingFeeRule(rule);
    setNewFeeRule({
      name: rule.name,
      category: rule.category,
      base_amount: rule.base_amount,
      discounts: rule.discounts,
      supplements: rule.supplements,
      conditions: rule.conditions
    });
    setShowFeeForm(true);
  };

  // Vérifier l'accès
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
            <p className="text-sm text-red-600 mt-1">
              Votre rôle actuel : {getRoleLabel(userRole)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement des paramètres...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2 mb-6">
          <Settings className="w-6 h-6 text-primary-600" />
          <span>Paramètres</span>
        </h2>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'general'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Général</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'users'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Utilisateurs ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'categories'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Catégories ({categories.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('fees')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'fees'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Euro className="w-4 h-4" />
            <span>Tarifs ({feeRules.length})</span>
          </button>
        </div>
      </div>

      {/* Contenu selon l'onglet */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Informations générales du club
          </h3>

          <div className="space-y-6">
            {/* Informations de base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du club *
                </label>
                <input
                  type="text"
                  value={generalSettings.clubName}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, clubName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de contact *
                </label>
                <input
                  type="email"
                  value={generalSettings.contactEmail}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description du club
              </label>
              <textarea
                value={generalSettings.clubDescription}
                onChange={(e) => setGeneralSettings(prev => ({ ...prev, clubDescription: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={generalSettings.contactPhone}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, contactPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site web
                </label>
                <input
                  type="url"
                  value={generalSettings.websiteUrl}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, websiteUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Adresse */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse
                </label>
                <input
                  type="text"
                  value={generalSettings.address}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code postal
                  </label>
                  <input
                    type="text"
                    value={generalSettings.postalCode}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, postalCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={generalSettings.city}
                    onChange={(e) => setGeneralSettings(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Couleurs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur primaire
                </label>
                <input
                  type="color"
                  value={generalSettings.primaryColor}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-full h-10 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur secondaire
                </label>
                <input
                  type="color"
                  value={generalSettings.secondaryColor}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-full h-10 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur d'accent
                </label>
                <input
                  type="color"
                  value={generalSettings.accentColor}
                  onChange={(e) => setGeneralSettings(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-full h-10 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Bouton de sauvegarde */}
            <div className="pt-6">
              <button
                onClick={saveGeneralSettings}
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Gestion des utilisateurs
          </h3>

          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun utilisateur trouvé</p>
              <p className="text-xs text-gray-400 mt-2">
                Les utilisateurs apparaîtront ici après leur première connexion
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-semibold text-sm">
                        {user.first_name?.[0] || 'U'}{user.last_name?.[0] || ''}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <p className="text-xs text-gray-500">
                        Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>

                    <div className="relative">
                      <select
                        value={user.role}
                        onChange={(e) => {
                          if (e.target.value !== user.role) {
                            updateUserRole(user.email, e.target.value);
                          }
                        }}
                        disabled={changingRole === user.email}
                        className="text-sm px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 disabled:opacity-50 bg-white"
                      >
                        <option value="member">👤 Membre</option>
                        <option value="entraineur">🏐 Entraîneur</option>
                        <option value="tresorerie">💰 Trésorerie</option>
                        <option value="administrateur">👨‍💼 Administrateur</option>
                        {userProfile?.role === 'webmaster' && (
                          <option value="webmaster">👑 Webmaster</option>
                        )}
                      </select>
                      {changingRole === user.email && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center">
                      {user.is_active ? (
                        <span className="text-green-600 text-sm flex items-center space-x-1">
                          <UserCheck className="w-4 h-4" />
                          <span>Actif</span>
                        </span>
                      ) : (
                        <span className="text-red-600 text-sm flex items-center space-x-1">
                          <AlertCircle className="w-4 h-4" />
                          <span>Inactif</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info sur les utilisateurs */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Gestion des rôles</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Webmaster :</strong> Accès technique complet (seul un webmaster peut créer d'autres webmasters)</p>
              <p>• <strong>Administrateur :</strong> Gestion des membres, documents, entraînements</p>
              <p>• <strong>Trésorerie :</strong> Gestion des paiements et tarifs</p>
              <p>• <strong>Entraîneur :</strong> Gestion des entraînements et WhatsApp</p>
              <p>• <strong>Membre :</strong> Accès à son profil et documents uniquement</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Gestion des catégories
            </h3>
            <button
              onClick={() => setShowCategoryForm(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle catégorie</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <h4 className="font-semibold text-gray-900">{category.label}</h4>
                    {category.is_system && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Système
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditingCategory(category)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {!category.is_system && (
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Âge: {category.age_range}</span>
                  <span className="font-medium text-gray-900">{category.membership_fee}€</span>
                </div>
              </div>
            ))}
          </div>

          {/* Info sur les catégories */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Gestion des catégories</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Catégorie principale :</strong> Détermine le tarif de base et l'affichage principal</p>
              <p>• <strong>Catégories multiples :</strong> Un membre peut participer aux entraînements de plusieurs catégories</p>
              <p>• <strong>Personnalisation :</strong> Modifiez les noms selon votre club</p>
              <p>• <strong>Couleurs :</strong> Pour l'affichage et l'organisation visuelle</p>
              <p>• <strong>Flexibilité :</strong> Système adaptatif selon les besoins du club</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Règles de tarification
            </h3>
            <button
              onClick={() => setShowFeeForm(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle règle</span>
            </button>
          </div>

          <div className="space-y-4">
            {feeRules.filter(rule => rule.is_active).map((rule) => (
              <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{rule.name}</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditingFeeRule(rule)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteFeeRule(rule.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Montant de base:</span>
                    <p className="font-medium">{rule.base_amount}€</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Catégories:</span>
                    <p className="font-medium">{rule.category.join(', ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Réductions:</span>
                    <p className="font-medium">
                      {Object.entries(rule.discounts).filter(([_, value]) => value > 0).length} actives
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de catégorie */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </h3>
              <button
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {!editingCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valeur technique *
                  </label>
                  <input
                    type="text"
                    value={newCategory.value}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="ex: u21"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom affiché *
                </label>
                <input
                  type="text"
                  value={newCategory.label}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="ex: U21 Masculin"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tranche d'âge
                  </label>
                  <input
                    type="text"
                    value={newCategory.age_range}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, age_range: e.target.value }))}
                    placeholder="ex: 18-21 ans"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarif (€)
                  </label>
                  <input
                    type="number"
                    value={newCategory.membership_fee}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, membership_fee: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Couleur
                </label>
                <input
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={saveCategory}
                  disabled={saving}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde...' : (editingCategory ? 'Modifier' : 'Créer')}
                </button>
                <button
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategory(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de règle de tarification */}
      {showFeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingFeeRule ? 'Modifier la règle' : 'Nouvelle règle de tarification'}
              </h3>
              <button
                onClick={() => {
                  setShowFeeForm(false);
                  setEditingFeeRule(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la règle *
                </label>
                <input
                  type="text"
                  value={newFeeRule.name}
                  onChange={(e) => setNewFeeRule(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: Tarif Étudiant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant de base (€) *
                </label>
                <input
                  type="number"
                  value={newFeeRule.base_amount}
                  onChange={(e) => setNewFeeRule(prev => ({ ...prev, base_amount: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={saveFeeRule}
                  disabled={saving}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde...' : (editingFeeRule ? 'Modifier' : 'Créer')}
                </button>
                <button
                  onClick={() => {
                    setShowFeeForm(false);
                    setEditingFeeRule(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};