import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Fonction pour parser les tokens depuis le fragment URL (#) ou les paramètres (?)
  const parseTokensFromUrl = () => {
    const hash = window.location.hash.slice(1); // Supprimer le #
    const search = window.location.search.slice(1); // Supprimer le ?
    
    // Créer un objet avec tous les paramètres (hash + search)
    const allParams = new URLSearchParams(hash + '&' + search);
    
    return {
      accessToken: allParams.get('access_token'),
      refreshToken: allParams.get('refresh_token'),
      type: allParams.get('type'),
      error_description: allParams.get('error_description'),
      error_code: allParams.get('error') || allParams.get('error_code')
    };
  };

  const { accessToken, refreshToken, type, error_description, error_code } = parseTokensFromUrl();

  useEffect(() => {
    console.log('🔍 [ResetPassword] URL complète:', window.location.href);
    console.log('🔍 [ResetPassword] Fragment (#):', window.location.hash);
    console.log('🔍 [ResetPassword] Search (?):', window.location.search);
    console.log('🔍 [ResetPassword] Tokens parsés:', {
      accessToken: accessToken ? 'Présent' : 'Manquant',
      refreshToken: refreshToken ? 'Présent' : 'Manquant',
      type: type,
      error_description: error_description,
      error_code: error_code
    });

    // Vérifier s'il y a une erreur (lien expiré, etc.)
    if (error_code || error_description) {
      console.error('❌ [ResetPassword] Erreur dans l\'URL:', { error_code, error_description });
      
      // FORCER LA DÉCONNEXION si on a un lien expiré
      if (error_code === 'otp_expired' || error_description?.includes('expired')) {
        console.log('🚨 [ResetPassword] Lien expiré détecté - Déconnexion forcée');
        supabase.auth.signOut().then(() => {
          console.log('✅ [ResetPassword] Déconnexion forcée terminée');
        }).catch((err) => {
          console.warn('⚠️ [ResetPassword] Erreur déconnexion forcée:', err);
        });
      }
      
      if (error_code === 'otp_expired' || error_description?.includes('expired')) {
        setError(`🕐 Lien de récupération expiré
        
Le lien de récupération a expiré ou est invalide.

🔍 Causes possibles :
• Le lien a plus d'1 heure
• Configuration Supabase incorrecte
• URLs de redirection mal configurées

💡 Solutions :
1. Demandez un nouveau lien ci-dessous
2. Utilisez-le dans les 5 minutes
3. Vérifiez votre configuration Supabase

⚠️ Vous pouvez demander un nouveau lien directement ici.`);
      } else {
        setError(`Erreur de récupération: ${error_description || error_code}
        
💡 Solutions :
• Demandez un nouveau lien de récupération
• Vérifiez que vous cliquez directement depuis l'email
• Contactez l'administration si le problème persiste`);
      }
      
      // NE PAS rediriger automatiquement - laisser l'utilisateur sur la page
      return;
    }

    // Si on a les tokens de récupération, les utiliser pour établir la session
    if (accessToken && refreshToken && type === 'recovery') {
      console.log('🔑 [ResetPassword] Tokens de récupération détectés, établissement de la session...');
      
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ error }) => {
        if (error) {
          console.error('❌ [ResetPassword] Erreur session:', error);
          setError(`Lien de récupération invalide ou expiré: ${error.message}
          
💡 Solutions :
• Demandez un nouveau lien de récupération
• Vérifiez que le lien n'a pas expiré (1 heure)
• Contactez l'administration si le problème persiste`);
        } else {
          console.log('✅ [ResetPassword] Session établie pour changement de mot de passe');
          setSessionReady(true);
        }
      });
    } else if (!accessToken || !refreshToken) {
      console.log('⚠️ [ResetPassword] Tokens manquants ou lien expiré');
      setError(`🔗 Lien de récupération invalide ou expiré
      
Les tokens d'authentification sont manquants ou le lien a expiré.

💡 Solutions :
• Demandez un nouveau lien de récupération
• Utilisez le lien dans les 60 minutes suivant l'envoi
• Vérifiez que vous cliquez directement depuis l'email
• Ne copiez/collez pas l'URL manuellement

⚠️ Vous pouvez demander un nouveau lien directement ci-dessous.`);
    }
  }, [accessToken, refreshToken, type, error_description, error_code, navigate]);

  const validatePassword = (password: string) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Au moins 8 caractères');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Au moins une majuscule');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Au moins une minuscule');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Au moins un chiffre');
    }
    
    return errors;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation côté client
      if (newPassword !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      const passwordErrors = validatePassword(newPassword);
      if (passwordErrors.length > 0) {
        throw new Error(`Mot de passe trop faible :\n• ${passwordErrors.join('\n• ')}`);
      }

      console.log('🔄 [ResetPassword] Tentative de changement de mot de passe...');
      
      // Vérifier qu'on a bien une session active
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('❌ [ResetPassword] Pas de session active:', userError);
        throw new Error('Session expirée. Veuillez redemander un nouveau lien de récupération.');
      }
      
      console.log('✅ [ResetPassword] Session active pour:', user.email);

      // Changer le mot de passe
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('❌ [ResetPassword] Erreur changement:', error);
        throw error;
      }

      console.log('✅ [ResetPassword] Mot de passe changé avec succès');
      setSuccess(true);

      // Rediriger vers l'application après 3 secondes
      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (err: any) {
      console.error('❌ [ResetPassword] Erreur:', err);
      setError(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  // Affichage de debug pendant le chargement
  if (!sessionReady && accessToken && refreshToken && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Préparation du changement de mot de passe...
            </h1>
            <p className="text-gray-600 text-sm">
              Établissement de la session sécurisée
            </p>
            <div className="mt-4 text-xs text-gray-500">
              <p>Tokens détectés ✅</p>
              <p>Type: {type}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si succès, afficher le message de confirmation
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Mot de passe modifié !
            </h1>
            <p className="text-gray-600 mb-4">
              Votre mot de passe a été changé avec succès.
            </p>
            <p className="text-sm text-gray-500">
              Redirection automatique vers l'application...
            </p>
            <div className="mt-4">
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 p-8">
          <div className="text-center mb-8">
            <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-white shadow-2xl flex items-center justify-center p-4">
              <img 
                src="/logo b4NK.png" 
                alt="BE FOR NOR KA"
                className="w-24 h-24 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = '<span class="text-primary-600 font-bold text-4xl">🏐</span>';
                  }
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Nouveau mot de passe
            </h1>
            <p className="text-gray-600">
              Choisissez un nouveau mot de passe sécurisé
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
              </div>
              
              {/* Bouton pour demander un nouveau lien */}
              <div className="mt-4 pt-4 border-t border-red-200">
                <button
                  onClick={() => {
                    // Rediriger vers la page de demande de nouveau lien
                    navigate('/auth');
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  🔄 Demander un nouveau lien de récupération
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handlePasswordReset} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                  placeholder="••••••••"
                  disabled={!sessionReady || !!error}
                />
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={!sessionReady || !!error}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Indicateur de force du mot de passe */}
              {newPassword && (
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">Force du mot de passe :</div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4].map((level) => {
                      const passwordErrors = validatePassword(newPassword);
                      const strength = 4 - passwordErrors.length;
                      return (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded ${
                            level <= strength
                              ? strength === 1 ? 'bg-red-500'
                              : strength === 2 ? 'bg-yellow-500'
                              : strength === 3 ? 'bg-blue-500'
                              : 'bg-green-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      );
                    })}
                  </div>
                  {validatePassword(newPassword).length > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      Manque : {validatePassword(newPassword).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                  placeholder="••••••••"
                  disabled={!sessionReady || !!error}
                />
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={!sessionReady || !!error}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Validation de correspondance */}
              {confirmPassword && (
                <div className="mt-2">
                  {newPassword === confirmPassword ? (
                    <div className="flex items-center space-x-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      <span>Les mots de passe correspondent</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>Les mots de passe ne correspondent pas</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || newPassword !== confirmPassword || validatePassword(newPassword).length > 0 || !sessionReady || !!error}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Modification...</span>
                </div>
              ) : !sessionReady || !!error ? (
                'Lien expiré - Demandez un nouveau lien'
              ) : (
                'Changer le mot de passe'
              )}
            </button>
          </form>

          {/* Exigences du mot de passe */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">🔒 Exigences du mot de passe</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${newPassword.length >= 8 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span>Au moins 8 caractères</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${/[A-Z]/.test(newPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span>Au moins une majuscule</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${/[a-z]/.test(newPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span>Au moins une minuscule</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${/[0-9]/.test(newPassword) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span>Au moins un chiffre</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};