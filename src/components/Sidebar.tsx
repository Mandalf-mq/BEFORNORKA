import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  FileText, 
  Calendar, 
  MessageSquare, 
  Settings,
  UserPlus,
  Workflow,
  CalendarDays,
  Menu,
  X,
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  isHash?: boolean;
}

interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  
  // État des sections pliables (sauvegardé dans localStorage)
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-sections');
    return saved ? JSON.parse(saved) : {
      member: true,  // Section membre ouverte par défaut
      admin: true    // Section admin ouverte par défaut
    };
  });

  // Sauvegarder l'état dans localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-sections', JSON.stringify(sectionStates));
  }, [sectionStates]);

  const toggleSection = (sectionId: string) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Menus de base (toujours en premier pour tous)
  const memberMenus: MenuItem[] = [
    {
      id: 'mes-documents',
      label: 'Mes Documents',
      icon: FileText,
      path: '#mes-documents',
      isHash: true
    },
    {
      id: 'mon-profil',
      label: 'Mon Profil',
      icon: User,
      path: '#mon-profil',
      isHash: true
    },
    {
      id: 'mes-entrainements',
      label: 'Mes Entraînements',
      icon: Calendar,
      path: '#mes-entrainements',
      isHash: true
    }
  ];

  // Menus admin selon le rôle
  const getAdminMenus = (): MenuItem[] => {
    const userRole = userProfile?.role || '';
    
    const adminMenus: MenuItem[] = [];

    // Webmaster et Administrateur : tableau de bord
    if (['webmaster', 'administrateur', 'tresorerie'].includes(userRole)) {
      adminMenus.push({
        id: 'dashboard',
        label: 'Tableau de bord',
        icon: BarChart3,
        path: '/',
        isHash: false
      });
    }

    // Webmaster, Administrateur, Trésorerie, Entraîneur : gestion membres
    if (['webmaster', 'administrateur', 'tresorerie', 'entraineur'].includes(userRole)) {
      adminMenus.push({
        id: 'members',
        label: 'Membres',
        icon: Users,
        path: '/members',
        isHash: false
      });
    }

    // Webmaster et Administrateur : workflow et création de comptes
    if (['webmaster', 'administrateur'].includes(userRole)) {
      adminMenus.push(
        {
          id: 'workflow',
          label: 'Workflow',
          icon: Workflow,
          path: '/workflow',
          isHash: false
        },
        {
          id: 'create-account',
          label: 'Créer un compte',
          icon: UserPlus,
          path: '/create-account',
          isHash: false
        },
        {
          id: 'documents',
          label: 'Documents',
          icon: FileText,
          path: '/documents',
          isHash: false
        }
      );
    }

    // Webmaster et Administrateur : gestion des familles
    if (['webmaster', 'administrateur'].includes(userRole)) {
      adminMenus.push({
        id: 'families',
        label: 'Familles',
        icon: Users,
        path: '/families',
        isHash: false
      });
    }

    // Webmaster, Administrateur, Entraîneur : entraînements
    if (['webmaster', 'administrateur', 'entraineur'].includes(userRole)) {
      adminMenus.push({
        id: 'training',
        label: 'Entraînements',
        icon: Calendar,
        path: '/training',
        isHash: false
      });
    }

    // Webmaster, Administrateur, Entraîneur : WhatsApp
    if (['webmaster', 'administrateur', 'entraineur'].includes(userRole)) {
      adminMenus.push({
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: MessageSquare,
        path: '/whatsapp',
        isHash: false
      });
    }

    // Webmaster et Administrateur : saisons et paramètres
    if (['webmaster', 'administrateur'].includes(userRole)) {
      adminMenus.push(
        {
          id: 'seasons',
          label: 'Saisons',
          icon: CalendarDays,
          path: '/seasons',
          isHash: false
        },
        {
          id: 'settings',
          label: 'Paramètres',
          icon: Settings,
          path: '/settings',
          isHash: false
        }
      );
    }

    return adminMenus;
  };

  const adminMenus = getAdminMenus();
  const hasAdminMenus = adminMenus.length > 0;

  const handleNavigation = (item: MenuItem) => {
    if (item.isHash) {
      window.location.hash = item.path;
    } else {
      navigate(item.path);
    }
    
    // Fermer le menu mobile après navigation
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  const isActive = (item: MenuItem) => {
    if (item.isHash) {
      return window.location.hash === item.path || 
             (item.path === '#mes-documents' && window.location.hash === '');
    } else {
      return window.location.pathname === item.path;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-white shadow-xl border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <img 
                src="/logo b4NK.png" 
                alt="BE FOR NOR KA"
                className="w-20 h-20 object-contain"
                onError={(e) => {
                  console.log('❌ [Sidebar] Erreur chargement logo:', e);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = '<span class="text-white font-bold text-5xl">🏐</span>';
                  }
                }}
                onLoad={() => console.log('✅ [Sidebar] Logo chargé avec succès')}
              />
            </div>
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-semibold text-sm">
                {userProfile?.first_name?.[0] || 'U'}{userProfile?.last_name?.[0] || ''}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {userProfile?.first_name && userProfile?.last_name 
                  ? `${userProfile.first_name} ${userProfile.last_name}`
                  : 'Utilisateur'
                }
              </p>
              <p className="text-xs text-gray-600">
                {userProfile?.role === 'webmaster' ? 'Webmaster' :
                 userProfile?.role === 'administrateur' ? 'Administrateur' :
                 userProfile?.role === 'tresorerie' ? 'Trésorerie' :
                 userProfile?.role === 'entraineur' ? 'Entraîneur' :
                 'Membre'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation avec sections pliables */}
        <nav className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* SECTION 1: ESPACE MEMBRE (toujours en premier) */}
          <div>
            <button
              onClick={() => toggleSection('member')}
              className="w-full flex items-center justify-between px-2 py-2 text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors"
            >
              <span className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Espace Membre</span>
              </span>
              {sectionStates.member ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {sectionStates.member && (
              <div className="mt-2 space-y-1">
                {memberMenus.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors group ${
                        isActive(item)
                          ? 'bg-primary-100 text-primary-700' 
                          : 'text-gray-700 hover:bg-primary-50 hover:text-primary-600'
                      }`}
                    >
                      <Icon className="w-5 h-5 group-hover:text-primary-600" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: ADMINISTRATION (si l'utilisateur a des droits admin) */}
          {hasAdminMenus && (
            <div>
              <button
                onClick={() => toggleSection('admin')}
                className="w-full flex items-center justify-between px-2 py-2 text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors"
              >
                <span className="flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Administration</span>
                </span>
                {sectionStates.admin ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              
              {sectionStates.admin && (
                <div className="mt-2 space-y-1">
                  {adminMenus.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigation(item)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors group ${
                          isActive(item)
                            ? 'bg-primary-100 text-primary-700' 
                            : 'text-gray-700 hover:bg-primary-50 hover:text-primary-600'
                        }`}
                      >
                        <Icon className="w-5 h-5 group-hover:text-primary-600" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer avec déconnexion */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              console.log('🔗 [Sidebar] Déconnexion utilisateur');
              signOut();
            }}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors group text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Se déconnecter</span>
          </button>
          
          <div className="text-center mt-3">
            <p className="text-xs text-gray-500">BE FOR NOR KA v1.0</p>
            <p className="text-xs text-gray-400">Gestion d'association</p>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="lg:hidden fixed top-4 right-4 z-40 p-2 bg-white rounded-lg shadow-lg border border-gray-200"
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>
    </>
  );
};