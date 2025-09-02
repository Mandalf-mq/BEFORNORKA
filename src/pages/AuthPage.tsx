import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const AuthPage: React.FC = () => {
  const { user, signIn, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'login' | 'reset'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

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
      errorParam: allParams.get('error') || allParams.get('error_code'),
      errorDescription: allParams.get('error_description')
    };
  };

  const { accessToken, refreshToken, type, errorParam, errorDescription } = parseTokensFromUrl();

  // Si on a des tokens de récupération, rediriger vers la page de reset
  if (accessToken && refreshToken && type === 'recovery') {
    console.log('🔄 [AuthPage] Tokens de récupération détectés, redirection vers reset-password');
    // Préserver TOUS les paramètres dans le fragment
    const resetUrl = `/auth/reset-password${window.location.hash}`;
    return <Navigate to={resetUrl} replace />;
  }

  // Si on a une erreur dans les paramètres ET qu'on n'est pas déjà en train de rediriger
  if ((errorParam || errorDescription) && !window.location.pathname.includes('reset-password')) {
    console.error('❌ [AuthPage] Erreur dans les paramètres URL:', { errorParam, errorDescription });
    
    // Afficher un message d'erreur spécifique pour les liens expirés
    if (errorParam === 'otp_expired' || errorDescription?.includes('expired')) {
      // Rediriger vers reset-password avec l'erreur pour affichage
      const resetUrl = `/auth/reset-password${window.location.hash}`;
      return <Navigate to={resetUrl} replace />;
    }
  }

  // Gestion des autres erreurs (non liées au reset)
  if ((errorParam || errorDescription) && !errorParam?.includes('otp_expired')) {
    console.error('❌ [AuthPage] Autre erreur:', { errorParam, errorDescription });
    
    if (errorParam === 'access_denied') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Accès refusé
              </h1>
              <div className="text-gray-600 mb-6">
                <p className="font-semibold text-red-600">Erreur d'authentification.</p>
                <p className="text-sm mt-2">Veuillez vous connecter normalement.</p>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  // Nettoyer l'URL
                  window.history.replaceState({}, '', '/auth');
                }}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Retour à la connexion
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Rediriger si déjà connecté
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signIn(formData.email, formData.password);
      
      // La redirection sera gérée automatiquement par AuthContext
      console.log('✅ [AuthPage] Connexion réussie, redirection en cours...');
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      console.log('🔄 [AuthPage] Envoi email de récupération pour:', resetEmail);
      
      // Détecter l'environnement et utiliser la bonne URL
      const isProduction = window.location.hostname.includes('befornorka.fr');
      const isBolt = window.location.hostname.includes('bolt.new');
      
      let redirectUrl;
      if (isProduction) {
        redirectUrl = 'https://www.befornorka.fr/auth/reset-password';
      } else if (isBolt) {
        redirectUrl = `${window.location.origin}/auth/reset-password`;
      } else {
        redirectUrl = 'http://localhost:5173/auth/reset-password';
      }
      
      console.log('🔄 [AuthPage] Environnement détecté:', {
        hostname: window.location.hostname,
        isProduction,
        isBolt,
        redirectUrl
      });
      
      // Timeout personnalisé pour l'envoi d'email
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout envoi email (20s)')), 20000);
      });
      
      const resetPromise = supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl
      });
      
      const { error } = await Promise.race([resetPromise, timeoutPromise]) as any;
      
      console.log('🔄 [AuthPage] URL de redirection envoyée:', redirectUrl);
      
      if (error) {
        console.error('❌ [AuthPage] Erreur envoi email:', error);
        throw error;
      }
      
      console.log('✅ [AuthPage] Email de récupération envoyé avec succès');
      
      alert(`📧 Email de récupération envoyé !

Vérifiez votre boîte mail et cliquez sur le lien reçu.`);
      
      setResetSent(true);
    } catch (err: any) {
      console.error('❌ [AuthPage] Erreur récupération:', err);
      setError(err.message || 'Erreur lors de l\'envoi');
    }
  };

  const renderLoginForm = () => (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-white shadow-2xl flex items-center justify-center p-4">
          <img 
            src="/logo b4NK.png" 
            alt="BE FOR NOR KA"
            className="w-24 h-24 object-contain"
            onError={(e) => {
              console.log('❌ [AuthPage] Erreur chargement logo:', e);
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = '<span class="text-primary-600 font-bold text-4xl">🏐</span>';
              }
            }}
            onLoad={() => console.log('✅ [AuthPage] Logo chargé avec succès')}
          />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          BE FOR NOR KA
        </h1>
        <p className="text-gray-600">
          Connexion à votre espace membre
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <div className="relative">
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
              placeholder="votre@email.com"
            />
            <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mot de passe
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
              placeholder="••••••••"
            />
            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Connexion...</span>
            </div>
          ) : (
            'Se connecter'
          )}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setView('reset')}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors"
          >
            Mot de passe oublié ?
          </button>
        </div>
      </form>
    </div>
  );

  const renderResetForm = () => (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-white shadow-2xl flex items-center justify-center p-4">
          <img 
            src="/logo b4NK.png" 
            alt="BE FOR NOR KA"
            className="w-24 h-24 object-contain"
            onError={(e) => {
              console.log('❌ [AuthPage Reset] Erreur chargement logo:', e);
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = '<span class="text-primary-600 font-bold text-4xl">🏐</span>';
              }
            }}
            onLoad={() => console.log('✅ [AuthPage Reset] Logo chargé avec succès')}
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Récupération de mot de passe
        </h1>
        <p className="text-gray-600">
          Entrez votre email pour recevoir un lien de réinitialisation
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {resetSent ? (
        <div className="text-center space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              Email envoyé !
            </h3>
            <p className="text-green-700 text-sm">
              Un lien de réinitialisation a été envoyé à <strong>{resetEmail}</strong>
            </p>
            <p className="text-green-600 text-xs mt-2">
              Vérifiez votre boîte mail et vos spams
            </p>
          </div>
          
          <button
            onClick={() => {
              setView('login');
              setResetSent(false);
              setResetEmail('');
              setError(null);
            }}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Retour à la connexion
          </button>
        </div>
      ) : (
        <form onSubmit={handlePasswordReset} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300"
                placeholder="votre@email.com"
              />
              <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Envoi...</span>
              </div>
            ) : (
              'Envoyer le lien'
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setView('login');
              setError(null);
              setResetEmail('');
            }}
            className="w-full flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-800 font-medium py-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la connexion</span>
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200/50 p-8">
          {view === 'login' ? renderLoginForm() : renderResetForm()}
        </div>
      </div>
    </div>
  );
};