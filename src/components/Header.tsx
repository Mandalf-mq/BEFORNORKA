import React from 'react';
import { Bell, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Header: React.FC = () => {
  const { user, userProfile, signOut, hasPermission } = useAuth();

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'webmaster': return 'Webmaster';
      case 'administrateur': return 'Administrateur';
      case 'tresorerie': return 'Trésorerie';
      case 'entraineur': return 'Entraîneur';
      case 'member': return 'Membre';
      default: return 'Utilisateur';
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

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo et titre */}
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <img 
              src="/logo b4NK.png" 
                alt="BE FOR NOR KA"
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  console.log('❌ [Header] Erreur chargement logo:', e);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = '<span class="text-white font-bold text-2xl">🏐</span>';
                  }
                }}
                onLoad={() => console.log('✅ [Header] Logo chargé avec succès')}
              />
            </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">BE FOR NOR KA</h1>
            <p className="text-xs text-gray-600">Gestion d'association</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications (pour plus tard) */}
          {false && (
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
          )}

          {/* Profil utilisateur */}
          <div className="flex items-center space-x-3">
            {/* Bouton mobile de déconnexion - TOUJOURS VISIBLE */}
            <button
              onClick={signOut}
              className="sm:hidden p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors border border-red-700 shadow-lg"
              title="Se déconnecter"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>

            {/* Profil desktop avec menu déroulant */}
            <div className="hidden sm:flex items-center space-x-3 relative group">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {userProfile?.first_name && userProfile?.last_name 
                  ? `${userProfile.first_name} ${userProfile.last_name}`
                  : userProfile?.email === 'handala77@gmail.com' 
                    ? 'Alessia Valenti'
                    : userProfile?.email === 'de.sousa.barros.alfredo@gmail.com'
                      ? 'Alfredo De Sousa Barros'
                      : user?.email || 'Utilisateur'
                }
              </p>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(userProfile?.role || 'member')}`}>
                  {getRoleLabel(userProfile?.role || 'member')}
                </span>
                {userProfile?.permissions && userProfile.permissions.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {userProfile.permissions.length} permissions
                  </span>
                )}
              </div>
            </div>
            
            {/* Menu déroulant - TOUJOURS VISIBLE */}
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="p-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {userProfile?.first_name} {userProfile?.last_name}
                </p>
                <p className="text-xs text-gray-600">{user?.email}</p>
              </div>
              <div className="p-2">
                <button
                  onClick={signOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </header>
  );
};