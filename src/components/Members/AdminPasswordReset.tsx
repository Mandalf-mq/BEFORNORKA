import React, { useState } from 'react';
import { Key, Search, RefreshCw, CheckCircle, AlertTriangle, User, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdminPasswordResetProps {
  onClose: () => void;
}

export const AdminPasswordReset: React.FC<AdminPasswordResetProps> = ({ onClose }) => {
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState(false);

  const searchUser = async () => {
    if (!searchEmail.trim()) {
      alert('Veuillez entrer un email');
      return;
    }

    try {
      setLoading(true);
      
      // Chercher dans la table users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', searchEmail.trim())
        .maybeSingle();

      if (userError) throw userError;

      // Chercher aussi dans members
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('email', searchEmail.trim())
        .maybeSingle();

      if (memberError) throw memberError;

      if (!userData && !memberData) {
        alert('❌ Aucun utilisateur trouvé avec cet email');
        setFoundUser(null);
        return;
      }

      setFoundUser({
        user: userData,
        member: memberData,
        email: searchEmail.trim()
      });

      // Générer un mot de passe temporaire
      const tempPassword = generateStrongPassword();
      setNewPassword(tempPassword);

    } catch (error: any) {
      console.error('Erreur recherche utilisateur:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
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
    
    // Compléter avec 4 caractères supplémentaires
    const allChars = lowercase + uppercase + numbers + specials;
    for (let i = 4; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mélanger le mot de passe
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const resetPassword = async () => {
    if (!foundUser || !newPassword) {
      alert('Veuillez d\'abord rechercher un utilisateur et générer un mot de passe');
      return;
    }

    if (!confirm(`⚠️ Confirmer la réinitialisation du mot de passe pour ${foundUser.email} ?

🔑 Nouveau mot de passe : ${newPassword}

Cette action est irréversible.`)) {
      return;
    }

    try {
      setResetting(true);

      // Utiliser l'Edge Function pour réinitialiser le mot de passe
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: foundUser.email,
          new_password: newPassword
        })
      });

      if (!response.ok) {
        // Si l'Edge Function n'existe pas, utiliser la méthode de contournement
        throw new Error('Edge Function non disponible - utilisation du contournement');
      }

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        alert(`✅ Mot de passe réinitialisé avec succès !

👤 Utilisateur : ${foundUser.email}
🔑 Nouveau mot de passe : ${newPassword}

📧 Communiquez ces identifiants à l'utilisateur.
⚠️ Il devra changer son mot de passe à la première connexion.`);
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }

    } catch (error: any) {
      console.error('Erreur réinitialisation:', error);
      
      // Méthode de contournement : créer un nouveau compte
      const shouldRecreate = confirm(`❌ Impossible de réinitialiser le mot de passe via l'API.

🔧 SOLUTION DE CONTOURNEMENT :
Supprimer l'ancien compte et en créer un nouveau avec le même email ?

⚠️ ATTENTION :
• L'utilisateur perdra sa session actuelle
• Il devra se reconnecter avec le nouveau mot de passe
• Les données membre seront préservées

Continuer ?`);

      if (shouldRecreate) {
        await recreateUserAccount();
      }
    } finally {
      setResetting(false);
    }
  };

  const recreateUserAccount = async () => {
    try {
      // Supprimer l'ancien compte utilisateur (garder le profil membre)
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', foundUser.email);

      if (deleteError) {
        console.warn('Erreur suppression ancien compte:', deleteError);
      }

      // Créer un nouveau compte avec l'Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          accounts: [{
            first_name: foundUser.user?.first_name || foundUser.member?.first_name || 'Utilisateur',
            last_name: foundUser.user?.last_name || foundUser.member?.last_name || '',
            email: foundUser.email,
            phone: foundUser.user?.phone || foundUser.member?.phone || null,
            birth_date: foundUser.member?.birth_date || null,
            category: foundUser.member?.category || 'loisirs',
            role: foundUser.user?.role || 'member',
            temporary_password: newPassword
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Edge Function non disponible');
      }

      const result = await response.json();

      if (result.success && result.success_count > 0) {
        setSuccess(true);
        alert(`✅ Compte recréé avec succès !

👤 Utilisateur : ${foundUser.email}
🔑 Nouveau mot de passe : ${newPassword}

📧 L'utilisateur peut maintenant se connecter avec ces identifiants.
🔄 Son profil membre a été préservé.`);
      } else {
        throw new Error(result.error || 'Erreur lors de la recréation');
      }

    } catch (error: any) {
      console.error('Erreur recréation compte:', error);
      alert(`❌ Erreur lors de la recréation du compte: ${error.message}

🆘 SOLUTION MANUELLE :
1. Supprimez manuellement l'utilisateur dans Supabase Dashboard
2. Demandez à l'utilisateur de s'inscrire à nouveau
3. Liez son nouveau compte au profil membre existant`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <Key className="w-5 h-5 text-red-600" />
              <span>🆘 Réinitialisation Administrateur</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Mot de passe réinitialisé !
              </h3>
              <p className="text-green-700">
                L'utilisateur peut maintenant se connecter avec le nouveau mot de passe.
              </p>
              <button
                onClick={onClose}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
              >
                Fermer
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Recherche utilisateur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. Rechercher l'utilisateur
                </label>
                <div className="flex space-x-3">
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={searchUser}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span>Rechercher</span>
                  </button>
                </div>
              </div>

              {/* Utilisateur trouvé */}
              {foundUser && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">👤 Utilisateur trouvé</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Email :</strong> {foundUser.email}</p>
                      <p><strong>Nom :</strong> {foundUser.user?.first_name || foundUser.member?.first_name} {foundUser.user?.last_name || foundUser.member?.last_name}</p>
                      <p><strong>Rôle :</strong> {foundUser.user?.role || 'member'}</p>
                    </div>
                    <div>
                      <p><strong>Compte auth :</strong> {foundUser.user ? '✅ Existe' : '❌ Manquant'}</p>
                      <p><strong>Profil membre :</strong> {foundUser.member ? '✅ Existe' : '❌ Manquant'}</p>
                      <p><strong>Statut :</strong> {foundUser.user?.is_active ? '🟢 Actif' : '🔴 Inactif'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nouveau mot de passe */}
              {foundUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. Nouveau mot de passe temporaire
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder="Mot de passe généré automatiquement"
                    />
                    <button
                      onClick={() => setNewPassword(generateStrongPassword())}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Générer</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Mot de passe sécurisé généré automatiquement (8 caractères, majuscules, minuscules, chiffres, symboles)
                  </p>
                </div>
              )}

              {/* Actions */}
              {foundUser && newPassword && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">🔑 Réinitialisation du mot de passe</h4>
                  <div className="text-sm text-blue-700 space-y-2 mb-4">
                    <p>Cliquez sur le bouton ci-dessous pour réinitialiser le mot de passe de cet utilisateur.</p>
                    <p><strong>Nouveau mot de passe :</strong> {newPassword}</p>
                  </div>
                  
                  <button
                    onClick={resetPassword}
                    disabled={resetting}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {resetting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Réinitialisation...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        <span>Réinitialiser le mot de passe</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">📋 Mode d'emploi</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>1. <strong>Recherchez</strong> l'utilisateur par email</p>
                  <p>2. <strong>Générez</strong> un mot de passe temporaire sécurisé</p>
                  <p>3. <strong>Réinitialisez</strong> le mot de passe</p>
                  <p>4. <strong>Communiquez</strong> les nouveaux identifiants à l'utilisateur</p>
                </div>
              </div>

              {/* Boutons */}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};