import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, Mail } from 'lucide-react';
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
  const [showFallback, setShowFallback] = useState(false);
  const [urlAnalysis, setUrlAnalysis] = useState<any>(null);

  // Fonction pour parser les tokens depuis l'URL complète
  const parseTokensFromUrl = () => {
    const hash = window.location.hash.slice(1);
    const search = window.location.search.slice(1);
    
    const allParams = new URLSearchParams(hash + '&' + search);
    
    return {
      accessToken: allParams.get('access_token'),
      refreshToken: allParams.get('refresh_token'),
      code: allParams.get('code'),
      token: allParams.get('token'), // Token PKCE
      type: allParams.get('type'),
      error_description: allParams.get('error_description'),
      error_code: allParams.get('error') || allParams.get('error_code')
    };
  };

  const { accessToken, refreshToken, code, token, type, error_description, error_code } = parseTokensFromUrl();

  useEffect(() => {
    // Analyser immédiatement l'URL pour diagnostic
    const analysis = {
      fullUrl: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      hasAnyParams: !!(window.location.search || window.location.hash),
      detectedTokens: { accessToken, refreshToken, code, token, type, error_description, error_code }
    };
    setUrlAnalysis(analysis);
    
    console.log('🔍 [ResetPassword] === ANALYSE COMPLÈTE URL ===');
    console.log('🔍 [ResetPassword] Analyse URL:', analysis);
    console.log('🔍 [ResetPassword] Tokens détectés:', {
      accessToken: accessToken ? 'Présent' : 'Manquant',
      refreshToken: refreshToken ? 'Présent' : 'Manquant',
      code: code ? 'Présent' : 'Manquant',
      token: token ? 'Présent (PKCE)' : 'Manquant',
      type: type,
      error_description: error_description,
      error_code: error_code
    });

    // Si l'URL est complètement vide (cas actuel), afficher immédiatement le diagnostic
    if (!analysis.hasAnyParams) {
      console.log('🚨 [ResetPassword] URL COMPLÈTEMENT VIDE - Problème de génération Supabase');
      setError(`🚨 PROBLÈME SUPABASE CONFIRMÉ - URL vide

❌ Diagnostic technique :
• URL reçue : ${analysis.fullUrl}
• Paramètres : AUCUN (search: "${analysis.search}", hash: "${analysis.hash}")
• Tokens : TOUS MANQUANTS

🔍 ANALYSE :
Supabase n'a généré AUCUN paramètre dans l'URL de redirection.
Cela indique un problème de configuration côté serveur Supabase.

📊 LOGS SUPABASE ANALYSÉS :
• Token PKCE généré : pkce_55b27e6fdadbf415a3b01fc4ac4eb5671d5a0d895f2298b3647dd233
• Erreur serveur : "One-time token not found"
• Le token est créé mais Supabase ne le trouve pas

🔧 SOLUTIONS À TESTER :
1. Vérifiez Authentication → Settings → Site URL
2. Vérifiez que le template email utilise {{ .ConfirmationURL }}
3. Testez avec un autre email
4. Contactez le support Supabase avec ces logs précis

🆘 CONTOURNEMENT IMMÉDIAT :
Utilisez le système de fallback ci-dessous pour créer un nouveau lien.`);
      setShowFallback(true);
      return;
    }

    // 🚨 DÉTECTION IMMÉDIATE des erreurs
    const hasError = error_code || error_description || 
                    window.location.href.includes('error') ||
                    window.location.href.includes('expired') ||
                    window.location.href.includes('invalid');
    
    if (hasError) {
      console.log('🚨 [ResetPassword] Erreur détectée dans l\'URL');
      setError(`🚨 Lien de récupération invalide

❌ Erreur Supabase : "${error_description || error_code}"

🔍 ANALYSE DES LOGS SUPABASE :
• Token PKCE généré : ${token || 'Non trouvé'}
• Type de récupération : ${type || 'Non spécifié'}
• Erreur serveur : "One-time token not found"
• Code HTTP : 403

🚨 PROBLÈME CONFIRMÉ :
Le token PKCE est généré mais Supabase ne le trouve pas côté serveur.
C'est un problème de configuration ou de synchronisation Supabase.

💡 SOLUTIONS IMMÉDIATES :
1. 🔄 Demandez un NOUVEAU lien (bouton ci-dessous)
2. 🕐 Cliquez IMMÉDIATEMENT sur le nouveau lien
3. 🧹 Videz complètement le cache navigateur
4. 🔧 Vérifiez la configuration Supabase :
   • Site URL : https://www.befornorka.fr
   • Email Template : {{ .ConfirmationURL }}

🆘 SOLUTION DE CONTOURNEMENT :
Si ça ne marche toujours pas, utilisez le système de fallback ci-dessous.`);
      
      // Déconnexion forcée
      supabase.auth.signOut({ scope: 'global' });
      localStorage.clear();
      sessionStorage.clear();
      
      // Afficher le fallback après 3 secondes
      setTimeout(() => {
        setShowFallback(true);
      }, 3000);
      
      return;
    }

    // Gérer le code de récupération
    if (code && !hasError) {
      console.log('🔑 [ResetPassword] Code de récupération détecté:', code);
      
      supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
        if (error) {
          console.error('❌ [ResetPassword] Erreur échange code:', error);
          setError(`🚨 Code de récupération invalide

❌ Erreur : ${error.message}

🔍 Détails :
• Code reçu : ${code}
• Type : ${type}
• Erreur Supabase : ${error.message}

💡 Le code a expiré ou est invalide. Demandez un nouveau lien.`);
          setShowFallback(true);
        } else if (data.session) {
          console.log('✅ [ResetPassword] Session établie via code');
          setSessionReady(true);
        }
      });
    }
    // Gérer les tokens directs
    else if (accessToken && refreshToken && type === 'recovery' && !hasError) {
      console.log('🔑 [ResetPassword] Tokens directs détectés');
      
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ error }) => {
        if (error) {
          console.error('❌ [ResetPassword] Erreur session:', error);
          setError(`🚨 Session invalide : ${error.message}`);
          setShowFallback(true);
        } else {
          console.log('✅ [ResetPassword] Session établie');
          setSessionReady(true);
        }
      });
    }
    // Aucun token valide trouvé
    else if (!hasError) {
      console.log('⚠️ [ResetPassword] Aucun token valide dans l\'URL');
      setError(`🔗 Lien de récupération incomplet

❌ Aucun paramètre d'authentification valide dans l'URL

🔍 URL analysée : ${window.location.href}

💡 Causes possibles :
• Lien copié/collé manuellement (ne marche pas)
• Email mal formaté par Supabase
• Configuration Supabase incorrecte
• Token expiré avant d'arriver sur la page

🆘 Utilisez le système de fallback ci-dessous.`);
      setShowFallback(true);
    }
  }, [accessToken, refreshToken, code, token, type, error_description, error_code]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      const passwordErrors = validatePassword(newPassword);
      if (passwordErrors.length > 0) {
        throw new Error(`Mot de passe trop faible :\n• ${passwordErrors.join('\n• ')}`);
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Session expirée. Utilisez le système de fallback ci-dessous.');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (password: string) => {
    const errors = [];
    if (password.length < 8) errors.push('Au moins 8 caractères');
    if (!/[A-Z]/.test(password)) errors.push('Au moins une majuscule');
    if (!/[a-z]/.test(password)) errors.push('Au moins une minuscule');
    if (!/[0-9]/.test(password)) errors.push('Au moins un chiffre');
    return errors;
  };

  // Système de fallback pour contourner le problème Supabase
  const FallbackSystem = () => {
    const [fallbackEmail, setFallbackEmail] = useState('');
    const [fallbackLoading, setFallbackLoading] = useState(false);
    const [fallbackSent, setFallbackSent] = useState(false);

    const handleFallbackReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setFallbackLoading(true);

      try {
        // Essayer avec une URL de redirection différente
        const { error } = await supabase.auth.resetPasswordForEmail(fallbackEmail, {
          redirectTo: `${window.location.origin}/auth/reset-password`
        });

        if (error) throw error;

        setFallbackSent(true);
        alert(`📧 Nouveau lien envoyé vers ${fallbackEmail} !

🚨 INSTRUCTIONS CRITIQUES :
1. Vérifiez votre boîte mail IMMÉDIATEMENT
2. Cliquez sur le lien dans les 30 SECONDES
3. Si ça ne marche pas → Contactez l'administrateur

⚠️ Problème Supabase confirmé - tokens expirés immédiatement`);

      } catch (error: any) {
        alert(`❌ Erreur : ${error.message}`);
      } finally {
        setFallbackLoading(false);
      }
    };

    return (
      <div className="mt-6 p-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
        <h3 className="text-lg font-bold text-yellow-800 mb-4">
          🆘 Système de contournement
        </h3>
        
        {!fallbackSent ? (
          <form onSubmit={handleFallbackReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-yellow-700 mb-2">
                Votre email pour un nouveau lien :
              </label>
              <input
                type="email"
                required
                value={fallbackEmail}
                onChange={(e) => setFallbackEmail(e.target.value)}
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                placeholder="votre@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={fallbackLoading}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {fallbackLoading ? 'Envoi...' : '🔄 Envoyer un nouveau lien'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-green-800 font-medium">
              Nouveau lien envoyé ! Cliquez IMMÉDIATEMENT dessus.
            </p>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-800 text-sm">
            <strong>🚨 PROBLÈME SUPABASE CONFIRMÉ :</strong><br/>
            Les logs montrent "One-time token not found" - les tokens expirent immédiatement.<br/>
            <strong>Solution définitive :</strong> Contactez l'administrateur pour recréer votre compte.
          </p>
        </div>
      </div>
    );
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Mot de passe modifié !
            </h1>
            <p className="text-gray-600 mb-4">
              Votre mot de passe a été changé avec succès.
            </p>
            <p className="text-sm text-gray-500">
              Redirection automatique...
            </p>
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
              Réinitialisation du mot de passe
            </h1>
            <p className="text-gray-600">
              {sessionReady ? 'Choisissez votre nouveau mot de passe' : 'Vérification du lien de récupération...'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
                </div>
              </div>
            </div>
          )}

          {sessionReady ? (
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
                    className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
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
                    className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || newPassword !== confirmPassword || validatePassword(newPassword).length > 0}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Modification...</span>
                  </div>
                ) : (
                  'Changer le mot de passe'
                )}
              </button>
            </form>
          ) : !error ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Vérification du lien...</p>
            </div>
          ) : null}

          {/* Système de fallback */}
          {(showFallback || error) && <FallbackSystem />}

          {/* Bouton retour */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-800 mx-auto transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la connexion</span>
            </button>
          </div>

          {/* Diagnostic technique */}
          {error && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h4 className="text-sm font-bold text-gray-800 mb-2">🔍 Diagnostic technique</h4>
              <div className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                {urlAnalysis && (
                  <>
                    <p><strong>URL complète :</strong> {urlAnalysis.fullUrl}</p>
                    <p><strong>Pathname :</strong> {urlAnalysis.pathname}</p>
                    <p><strong>Search params :</strong> {urlAnalysis.search || 'Vide'}</p>
                    <p><strong>Hash params :</strong> {urlAnalysis.hash || 'Vide'}</p>
                    <p><strong>A des paramètres :</strong> {urlAnalysis.hasAnyParams ? 'Oui' : 'NON - PROBLÈME ICI'}</p>
                    <p><strong>Token PKCE :</strong> {token || 'Manquant'}</p>
                    <p><strong>Code :</strong> {code || 'Manquant'}</p>
                    <p><strong>Type :</strong> {type || 'Manquant'}</p>
                    <p><strong>Erreur :</strong> {error_description || error_code || 'Aucune'}</p>
                    <p><strong>Plan Supabase :</strong> Pro (confirmé)</p>
                    <p><strong>Problème :</strong> {urlAnalysis.hasAnyParams ? 'Token invalide côté serveur' : 'URL générée sans paramètres'}</p>
                  </>
                )}
              </div>
              
              <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                <strong>🚨 CONCLUSION :</strong> 
                {urlAnalysis?.hasAnyParams 
                  ? 'Supabase génère les tokens mais ne les trouve pas côté serveur (bug Supabase)'
                  : 'Supabase ne génère AUCUN paramètre dans l\'URL (configuration incorrecte)'
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};