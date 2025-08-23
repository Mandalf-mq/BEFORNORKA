import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStats } from '../../hooks/useStats';
import { StatsCards } from './StatsCards';
import { RecentMembers } from './RecentMembers';
import { CategoryChart } from './CategoryChart';
import { DocumentsProgress } from './DocumentsProgress';
import { BarChart3, TrendingUp, Users, FileText, MessageSquare } from 'lucide-react';

export const DashboardOverview: React.FC = () => {
  const { stats, loading, error, refetch } = useStats();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-8 text-center shadow-lg">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement des statistiques...</p>
          <p className="text-xs text-gray-500 mt-2">Connexion à la base de données...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Erreur de chargement
          </h3>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="bg-red-100 rounded-lg p-4 mb-4 text-left">
            <h4 className="font-semibold text-red-800 mb-2">🔍 Diagnostic</h4>
            <div className="text-sm text-red-700 space-y-1">
              <p>• Vérifiez votre connexion Supabase</p>
              <p>• URL: {import.meta.env.VITE_SUPABASE_URL}</p>
              <p>• Clé: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configurée' : 'Manquante'}</p>
              <p>• Erreur: {error}</p>
            </div>
          </div>
          <button
            onClick={refetch}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">Aucune statistique disponible</p>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">💡 Suggestion</h4>
          <p className="text-sm text-blue-700">
            Votre base de données semble vide ou les statistiques n'ont pas pu être calculées.
          </p>
          <div className="mt-3 space-y-1 text-xs text-blue-600">
            <p>• Vérifiez que des membres sont inscrits</p>
            <p>• Vérifiez que les catégories sont configurées</p>
            <p>• Allez dans "Membres" pour ajouter des membres</p>
          </div>
          <button
            onClick={() => navigate('/members')}
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Aller aux membres
          </button>
        </div>
      </div>
    );
  }

  // Validation supplémentaire des stats
  const hasValidStats = stats.totalMembers > 0 || stats.membersByCategory.length > 0;
  
  if (!hasValidStats) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
        <BarChart3 className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          Données insuffisantes
        </h3>
        <p className="text-yellow-700 mb-4">
          Les statistiques ne peuvent pas être calculées car il n'y a pas assez de données.
        </p>
        <div className="bg-yellow-100 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-yellow-800 mb-2">🔧 Actions suggérées</h4>
          <div className="text-sm text-yellow-700 space-y-1 text-left">
            <p>1. Ajoutez des membres dans la section "Membres"</p>
            <p>2. Configurez les catégories dans "Paramètres → Catégories"</p>
            <p>3. Vérifiez que la saison courante est active</p>
            <p>4. Actualisez cette page</p>
          </div>
        </div>
        <div className="flex space-x-3 justify-center">
          <button
            onClick={() => navigate('/members')}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Gérer les membres
          </button>
          <button
            onClick={refetch}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Actualiser
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header avec info de dernière mise à jour */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Tableau de bord - BE FOR NOR KA
        </h1>
        <p className="text-primary-100">
          Vue d'ensemble de votre association de volleyball
        </p>
        <div className="mt-4 bg-white/20 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span>Dernière mise à jour :</span>
            <span>{new Date().toLocaleTimeString('fr-FR')}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-primary-100 mt-1">
            <span>Membres actifs :</span>
            <span>{stats.totalMembers}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards avec validation */}
      <StatsCards stats={stats} />

      {/* Charts and Details avec données validées */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Distribution */}
        <CategoryChart data={stats.membersByCategory} />
        
        {/* Documents Progress */}
        <DocumentsProgress stats={stats.documentStats} />
      </div>

      {/* Recent Members */}
      <RecentMembers members={stats.recentMembers} />

      {/* Quick Actions avec compteurs dynamiques */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Actions rapides
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => {
              console.log('🔗 [Dashboard] Navigation vers /create-account');
              navigate('/create-account');
            }}
            className="flex items-center space-x-3 p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            <Users className="w-6 h-6 text-primary-600" />
            <div className="text-left">
              <p className="font-medium text-primary-700">Créer un compte</p>
              <p className="text-xs text-primary-600">Inscription rapide</p>
            </div>
          </button>
          
          <button 
            onClick={() => {
              console.log('🔗 [Dashboard] Navigation vers /workflow');
              navigate('/workflow');
            }}
            className="flex items-center space-x-3 p-4 bg-secondary-50 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <FileText className="w-6 h-6 text-secondary-600" />
            <div className="text-left">
              <p className="font-medium text-secondary-700">Valider documents</p>
              <p className="text-xs text-secondary-600">
                {stats.documentStats.reduce((sum, doc) => sum + doc.total_pending, 0)} en attente
              </p>
            </div>
          </button>
          
          <button 
            onClick={() => {
              console.log('🔗 [Dashboard] Navigation vers /whatsapp');
              navigate('/whatsapp');
            }}
            className="flex items-center space-x-3 p-4 bg-accent-50 hover:bg-accent-100 rounded-lg transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-accent-600" />
            <div className="text-left">
              <p className="font-medium text-accent-700">Envoyer WhatsApp</p>
              <p className="text-xs text-accent-600">Appels d'entraînement</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Tableau de bord - BE FOR NOR KA
        </h1>
        <p className="text-primary-100">
          Vue d'ensemble de votre association de volleyball
        </p>
        <div className="mt-4 bg-white/20 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span>Dernière mise à jour :</span>
            <span>{new Date().toLocaleTimeString('fr-FR')}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Distribution */}
        <CategoryChart data={stats.membersByCategory} />
        
        {/* Documents Progress */}
        <DocumentsProgress stats={stats.documentStats} />
      </div>

      {/* Recent Members */}
      <RecentMembers members={stats.recentMembers} />

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Actions rapides
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => {
              console.log('🔗 [Dashboard] Navigation vers /create-account');
              navigate('/create-account');
            }}
            className="flex items-center space-x-3 p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            <Users className="w-6 h-6 text-primary-600" />
            <div className="text-left">
              <p className="font-medium text-primary-700">Créer un compte</p>
              <p className="text-xs text-primary-600">Inscription rapide</p>
            </div>
          </button>
          
          <button 
            onClick={() => {
              console.log('🔗 [Dashboard] Navigation vers /workflow');
              navigate('/workflow');
            }}
            className="flex items-center space-x-3 p-4 bg-secondary-50 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <FileText className="w-6 h-6 text-secondary-600" />
            <div className="text-left">
              <p className="font-medium text-secondary-700">Valider documents</p>
              <p className="text-xs text-secondary-600">{stats.documentStats.reduce((sum, doc) => sum + doc.total_pending, 0)} en attente</p>
            </div>
          </button>
          
          <button 
            onClick={() => {
              console.log('🔗 [Dashboard] Navigation vers /whatsapp');
              navigate('/whatsapp');
            }}
            className="flex items-center space-x-3 p-4 bg-accent-50 hover:bg-accent-100 rounded-lg transition-colors"
          >
            <MessageSquare className="w-6 h-6 text-accent-600" />
            <div className="text-left">
              <p className="font-medium text-accent-700">Envoyer WhatsApp</p>
              <p className="text-xs text-accent-600">Appels d'entraînement</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};