import React, { useState, useEffect } from 'react';
import { PieChart, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CategoryChartProps {
  data: Array<{
    category: string;
    categoryLabel: string;
    count: number;
    revenue: number;
  }>;
}

export const CategoryChart: React.FC<CategoryChartProps> = ({ data }) => {
  const [categories, setCategories] = useState<any[]>([]);
  
  useEffect(() => {
    fetchCategories();
  }, []);
  
  const fetchCategories = async () => {
    try {
      const { data: categoriesData, error } = await supabase
        .from('categories')
        .select('value, label, color')
        .eq('is_active', true);
        
      if (error) throw error;
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Erreur chargement catégories pour chart:', error);
      setCategories([]);
    }
  };
  
  const total = data.reduce((sum, item) => sum + item.count, 0);
  
  const getCategoryLabel = (categoryValue: string, fallbackLabel?: string) => {
    // Utiliser le label fourni par useStats en priorité
    if (fallbackLabel) return fallbackLabel;
    
    // Sinon chercher dans les catégories chargées
    const category = categories.find(cat => cat.value === categoryValue);
    return category?.label || categoryValue;
  };

  const getCategoryColor = (categoryValue: string) => {
    // Chercher la couleur dans les catégories de la DB
    const category = categories.find(cat => cat.value === categoryValue);
    if (category?.color) {
      return `bg-[${category.color}]`;
    }
    
    // Couleurs par défaut si pas trouvé
    const defaultColors: Record<string, string> = {
      'baby': 'bg-blue-500',
      'poussin': 'bg-green-500',
      'benjamin': 'bg-yellow-500',
      'minime': 'bg-purple-500',
      'cadet': 'bg-red-500',
      'junior': 'bg-pink-500',
      'senior': 'bg-cyan-500',
      'veteran': 'bg-lime-500',
      'unknown': 'bg-gray-500'
    };
    return defaultColors[categoryValue] || 'bg-gray-500';
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <PieChart className="w-5 h-5 text-primary-600" />
        <span>Répartition par catégorie</span>
      </h3>

      {data.length === 0 ? (
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune donnée disponible</p>
          <p className="text-xs text-gray-400 mt-1">
            Les statistiques apparaîtront quand des membres seront ajoutés
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item) => {
            const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
            
            return (
              <div key={item.category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getCategoryColor(item.category)}`}></div>
                    <span className="font-medium text-gray-700">
                      {getCategoryLabel(item.category, item.categoryLabel)}
                    </span>
                    <span className="text-xs text-gray-500">({item.category})</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{item.count}</span>
                    <span className="text-gray-500 ml-1">({percentage}%)</span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getCategoryColor(item.category)}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                
                <div className="text-xs text-gray-500 text-right">
                  Revenus: {Math.round(item.revenue * 100) / 100}€
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};