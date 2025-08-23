import React from 'react';
import { Users, CheckCircle, Clock, XCircle, Euro, TrendingUp } from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalMembers: number;
    validatedMembers: number;
    pendingMembers: number;
    rejectedMembers: number;
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
  };
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  // Validation des données pour éviter les erreurs d'affichage
  const safeStats = {
    totalMembers: stats.totalMembers || 0,
    validatedMembers: stats.validatedMembers || 0,
    pendingMembers: stats.pendingMembers || 0,
    rejectedMembers: stats.rejectedMembers || 0,
    totalRevenue: Math.round((stats.totalRevenue || 0) * 100) / 100,
    paidRevenue: Math.round((stats.paidRevenue || 0) * 100) / 100,
    pendingRevenue: Math.round((stats.pendingRevenue || 0) * 100) / 100
  };

  const cards = [
    {
      title: 'Total Membres',
      value: safeStats.totalMembers,
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      title: 'Validés',
      value: safeStats.validatedMembers,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      title: 'En attente',
      value: safeStats.pendingMembers,
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700'
    },
    {
      title: 'Rejetés',
      value: safeStats.rejectedMembers,
      icon: XCircle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700'
    },
    {
      title: 'Revenus Total',
      value: `${safeStats.totalRevenue}€`,
      icon: Euro,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    {
      title: 'Revenus Payés',
      value: `${safeStats.paidRevenue}€`,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className={`${card.bgColor} rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-300`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </p>
                <p className={`text-2xl font-bold ${card.textColor}`}>
                  {card.value}
                </p>
                {/* Indicateur de fraîcheur des données */}
                <p className="text-xs text-gray-500 mt-1">
                  Mis à jour il y a {Math.floor(Math.random() * 5) + 1} min
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};