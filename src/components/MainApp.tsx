import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { DashboardOverview } from './Dashboard/DashboardOverview';
import MembersList from './MembersList';
import { TrainingCalendar } from './Training/TrainingCalendar';
import { WhatsAppManager } from './WhatsApp/WhatsAppManager';
import { SettingsPanel } from './Settings/SettingsPanel';
import { SeasonManager } from './Seasons/SeasonManager';
import { ValidationWorkflow } from './Workflow/ValidationWorkflow';
import { AccountCreator } from './Members/AccountCreator';
import { DocumentsManager } from './Documents/DocumentsManager';
import { MemberDocuments } from './Members/MemberDocuments';
import { MemberProfile } from './Members/MemberProfile';
import { MemberTraining } from './Members/MemberTraining';
import { FamilyManager } from './Members/FamilyManager';

export const MainApp = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('mes-documents');
  const { user, userProfile, loading, refetchProfile } = useAuth();
  const location = useLocation();

  const handleHashChange = () => {
    const hash = window.location.hash.slice(1);
    console.log('🔄 [MainApp] Hash changed to:', hash);
    
    if (hash && hash !== '') {
      setCurrentView(hash);
    } else {
      // Vue par défaut pour les membres : toujours mes-entrainements
      const defaultView = hasAdminRights ? 'mon-profil' : 'mes-entrainements';
      setCurrentView(defaultView);
      // Pour les membres, forcer la redirection vers mes-entrainements
      if (!hasAdminRights) {
        window.location.hash = 'mes-entrainements';
      }
    }
  };

  const getDefaultMemberView = () => {
    if (!userProfile) return 'mes-entrainements';
    
    const hasAdminRights = ['webmaster', 'administrateur', 'tresorerie', 'entraineur'].includes(userProfile.role);
    
    if (hasAdminRights) {
      return 'mon-profil';
    }
    
    return 'mes-entrainements';
  };

  // Écouter les changements de hash pour la navigation des membres
  useEffect(() => {
    // Définir la vue initiale selon le hash
    const hash = window.location.hash.slice(1);
    if (hash && hash !== '') {
      setCurrentView(hash);
    } else {
      // Vue par défaut pour les membres : mes-entrainements
      const defaultView = hasAdminRights ? 'mon-profil' : 'mes-entrainements';
      setCurrentView(defaultView);
      // Mettre à jour l'URL aussi
      if (!hasAdminRights) {
        window.location.hash = 'mes-entrainements';
      }
    }
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [userProfile]);

  // Gérer les changements de route
  useEffect(() => {
    console.log('🔄 [MainApp] Location changed:', location.pathname);
  }, [location]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement de l'authentification...</p>
        </div>
      </div>
    );
  }

  // Debug des rôles
  console.log('🔍 [MainApp] User:', user?.email);
  console.log('🔍 [MainApp] UserProfile:', userProfile?.role);
  console.log('🔍 [MainApp] Current view:', currentView);
  console.log('🔍 [MainApp] Location:', location.pathname);
  console.log('🔍 [MainApp] hasAdminRights:', hasAdminRights);
  
  const hasAdminRights = userProfile?.role && ['webmaster', 'administrateur', 'tresorerie', 'entraineur'].includes(userProfile.role);
  const isOnMemberRoute = location.pathname === '/member' || window.location.hash.startsWith('#');
  
  console.log('🔍 [MainApp] hasAdminRights:', {
    role: userProfile?.role,
    hasAdminRights: hasAdminRights,
    allowedRoles: ['webmaster', 'administrateur', 'tresorerie', 'entraineur']
  });

  // Navigation des vues membres avec breadcrumb
  const MemberNavigation = () => (
    <div className="mb-6">
      <nav className="flex space-x-1 text-sm text-gray-600 mb-4">
        <span>Espace membre</span>
        <span>/</span>
        <span className="text-primary-600 font-medium">
          {currentView === 'mes-documents' && 'Mes documents'}
          {currentView === 'mon-profil' && 'Mon profil'}
          {currentView === 'mes-entrainements' && 'Mes entraînements'}
          {currentView === 'ma-famille' && 'Ma famille'}
        </span>
      </nav>
      
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => {
            setCurrentView('mes-documents');
            window.location.hash = 'mes-documents';
          }}
          className={`px-4 py-2 rounded-lg transition-colors ${
            currentView === 'mes-documents'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          📁 Mes documents
        </button>
        
        <button
          onClick={() => {
            setCurrentView('mon-profil');
            window.location.hash = 'mon-profil';
          }}
          className={`px-4 py-2 rounded-lg transition-colors ${
            currentView === 'mon-profil'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          👤 Mon profil
        </button>
        
        <button
          onClick={() => {
            setCurrentView('mes-entrainements');
            window.location.hash = 'mes-entrainements';
          }}
          className={`px-4 py-2 rounded-lg transition-colors ${
            currentView === 'mes-entrainements'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          🏐 Mes entraînements
        </button>

        {/* Bouton famille pour les parents */}
        {userProfile?.role === 'parent' && (
          <button
            onClick={() => {
              setCurrentView('ma-famille');
              window.location.hash = 'ma-famille';
            }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              currentView === 'ma-famille'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            👨‍👩‍👧‍👦 Ma famille
          </button>
        )}
      </div>
    </div>
  );

  // Fonction pour rendre le contenu membre selon la vue
  const renderMemberContent = () => {
    return (
      <div>
        <MemberNavigation />
        
        {(() => {
          switch (currentView) {
            case 'mon-profil':
              return <MemberProfile />;
            case 'mes-entrainements':
              return <MemberTraining />;
            case 'ma-famille':
              return userProfile?.role === 'parent' ? <FamilyManager /> : <MemberDocuments />;
            case 'mes-documents':
            default:
              return <MemberDocuments />;
          }
        })()}
      </div>
    );
  };

  // Vérifier les permissions pour certaines routes
  const ProtectedRoute = ({ children, requiredRoles = [] }: { children: React.ReactNode, requiredRoles?: string[] }) => {
    const hasPermission = !requiredRoles.length || (userProfile?.role && requiredRoles.includes(userProfile.role));
    
    if (!hasPermission) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Accès non autorisé</h2>
          <p className="text-gray-600 mb-4">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <button
            onClick={() => window.location.href = '/member#mes-documents'}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
          >
            Retour à mes documents
          </button>
        </div>
      );
    }
    
    return <>{children}</>;
  };
  
  console.log('🔍 [MainApp] isOnMemberRoute:', isOnMemberRoute);
  console.log('🔍 [MainApp] hasAdminRights:', hasAdminRights);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <Header />
      
      <div className="flex">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentRole={userProfile?.role}
        />
        
        <main className="flex-1 p-6 lg:ml-64">
          {isOnMemberRoute ? (
            renderMemberContent()
          ) : (
            <Routes>
              <Route path="/" element={<DashboardOverview />} />
              
              {/* Routes protégées par rôle */}
              <Route 
                path="/members" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur', 'tresorerie', 'entraineur']}>
                    <MembersList />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/workflow" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur', 'tresorerie']}>
                    <ValidationWorkflow />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/create-account" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur']}>
                    <AccountCreator onSuccess={refetchProfile} />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/documents" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur', 'tresorerie']}>
                    <DocumentsManager />
                  </ProtectedRoute>
                } 
              />
              
              <Route path="/training" element={<TrainingCalendar />} />
              
              <Route 
                path="/whatsapp" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur', 'entraineur']}>
                    <WhatsAppManager />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/seasons" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur']}>
                    <SeasonManager />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur']}>
                    <SettingsPanel />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/families" 
                element={
                  <ProtectedRoute requiredRoles={['webmaster', 'administrateur', 'tresorerie']}>
                    <FamilyManager />
                  </ProtectedRoute>
                } 
              />
              
              {/* Redirection par défaut */}
              <Route 
                path="*" 
                element={
                  hasAdminRights ? 
                    <Navigate to="/" replace /> : 
                    <Navigate to="#mes-entrainements" replace />
                } 
              />
            </Routes>
          )}
        </main>
      </div>
    </div>
  );
};
