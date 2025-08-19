import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Settings, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  registration_start_date: string;
  registration_end_date: string;
  is_current: boolean;
  registration_open: boolean;
  max_members: number;
  membership_fees: Record<string, number>;
  description?: string;
}

export const SeasonManager: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSeasonData, setNewSeasonData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    registrationStart: '',
    registrationEnd: '',
    maxMembers: 150,
    description: ''
  });

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSeasons(data || []);
      setCurrentSeason(data?.find(s => s.is_current) || null);
    } catch (error) {
      console.error('Erreur lors du chargement des saisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewSeason = async () => {
    if (!newSeasonData.name || !newSeasonData.startDate || !newSeasonData.endDate) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      // Désactiver l'ancienne saison courante
      const { error: updateError } = await supabase
        .from('seasons')
        .update({ is_current: false })
        .eq('is_current', true);

      if (updateError) throw updateError;

      // Créer la nouvelle saison
      const { data, error } = await supabase
        .from('seasons')
        .insert({
          name: newSeasonData.name,
          start_date: newSeasonData.startDate,
          end_date: newSeasonData.endDate,
          registration_start_date: newSeasonData.registrationStart,
          registration_end_date: newSeasonData.registrationEnd,
          is_active: true,
          is_current: true,
          registration_open: true,
          max_members: newSeasonData.maxMembers,
          description: newSeasonData.description,
          membership_fees: {
            "baby": 120,
            "poussin": 140,
            "benjamin": 160,
            "minime": 180,
            "cadet": 200,
            "junior": 220,
            "senior": 250,
            "veteran": 200
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Réinitialiser les membres pour la nouvelle saison
      const { error: membersError } = await supabase
        .from('members')
        .update({
          status: 'pending',
          season_id: data.id,
          payment_status: 'pending',
          validated_by: null,
          validated_at: null
        })
        .in('status', ['validated', 'documents_pending', 'documents_validated', 'season_validated']);

      if (membersError) throw membersError;

      alert(`✅ Nouvelle saison "${newSeasonData.name}" créée avec succès !
      
📊 Les membres existants ont été réinitialisés au statut "pending"
🔄 Ils devront refaire le processus de validation pour cette saison`);
      
      setShowCreateForm(false);
      setNewSeasonData({
        name: '',
        startDate: '',
        endDate: '',
        registrationStart: '',
        registrationEnd: '',
        maxMembers: 150,
        description: ''
      });
      
      await fetchSeasons();
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur lors de la création de la saison: ${error.message}`);
    }
  };

  const setAsCurrentSeason = async (seasonId: string) => {
    const season = seasons.find(s => s.id === seasonId);
    if (!season) return;

    if (!confirm(`⚠️ Définir "${season.name}" comme saison courante ?\n\nCela va réinitialiser tous les membres au statut "pending" et ils devront refaire le processus de validation.`)) {
      return;
    }

    try {
      // Désactiver l'ancienne saison courante
      const { error: updateError } = await supabase
        .from('seasons')
        .update({ is_current: false })
        .eq('is_current', true);

      if (updateError) throw updateError;

      // Activer la nouvelle saison courante
      const { error: setCurrentError } = await supabase
        .from('seasons')
        .update({ is_current: true })
        .eq('id', seasonId);

      if (setCurrentError) throw setCurrentError;

      alert(`✅ "${season.name}" est maintenant la saison courante !`);
      await fetchSeasons();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(`❌ Erreur lors de la mise à jour: ${error.message}`);
    }
  };

  const updateSeason = async (seasonId: string, updates: Partial<Season>) => {
    try {
      console.log('🔄 [SeasonManager] Mise à jour saison:', seasonId, updates);
      
      const { error } = await supabase
        .from('seasons')
        .update(updates)
        .eq('id', seasonId);

      if (error) throw error;
      
      await fetchSeasons();
      alert('✅ Saison mise à jour avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(`❌ Erreur lors de la mise à jour: ${error.message}`);
    }
  };
  
  const closeSeason = async (seasonId: string) => {
    const season = seasons.find(s => s.id === seasonId);
    if (!season) return;

    if (!confirm(`⚠️ Fermer la saison "${season.name}" ?\n\nCela va :\n- Fermer les inscriptions\n- Archiver les données de la saison\n- Préparer le renouvellement pour la saison suivante\n\nContinuer ?`)) {
      return;
    }

    try {
      // Fermer la saison (arrêter les inscriptions)
      const { error: closeError } = await supabase
        .from('seasons')
        .update({ 
          registration_open: false,
          is_current: false,
          description: (season.description || '') + ' - Saison fermée le ' + new Date().toLocaleDateString('fr-FR')
        })
        .eq('id', seasonId);

      if (closeError) throw closeError;

      // Archiver tous les membres de cette saison
      const { error: archiveError } = await supabase
        .from('members')
        .update({ 
          status: 'archived',
          notes: 'Archivé automatiquement lors de la fermeture de saison'
        })
        .eq('season_id', seasonId)
        .in('status', ['validated', 'documents_pending', 'documents_validated', 'season_validated']);

      if (archiveError) throw archiveError;

      alert(`✅ Saison "${season.name}" fermée avec succès !\n\n📊 Les membres ont été archivés\n🔄 Vous pouvez maintenant créer une nouvelle saison`);
      await fetchSeasons();
    } catch (error: any) {
      console.error('Erreur lors de la fermeture:', error);
      alert(`❌ Erreur lors de la fermeture: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement des saisons...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-primary-600" />
            <span>Gestion des saisons</span>
          </h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle saison</span>
          </button>
        </div>

        {/* Saison courante */}
        {currentSeason && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div>
                <h3 className="font-semibold text-green-800">
                  🏐 Saison courante : {currentSeason.name}
                </h3>
                <p className="text-sm text-green-700">
                  Du {new Date(currentSeason.start_date).toLocaleDateString('fr-FR')} 
                  au {new Date(currentSeason.end_date).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-xs text-green-600">
                  Inscriptions {currentSeason.registration_open ? 'ouvertes' : 'fermées'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Liste des saisons */}
      <div className="space-y-4">
        {seasons.map((season) => (
          <div key={season.id} className={`bg-white rounded-xl p-6 shadow-lg border ${
            season.is_current ? 'border-green-300 bg-green-50' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {season.name}
                  </h3>
                  {season.is_current && (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                      Courante
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Du {new Date(season.start_date).toLocaleDateString('fr-FR')} au {new Date(season.end_date).toLocaleDateString('fr-FR')}</p>
                  <p>Inscriptions : {new Date(season.registration_start_date).toLocaleDateString('fr-FR')} - {new Date(season.registration_end_date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="mt-2 flex items-center space-x-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    season.registration_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {season.registration_open ? 'Inscriptions ouvertes' : 'Inscriptions fermées'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Max: {season.max_members} membres
                  </span>
                </div>
                {season.description && (
                  <p className="text-sm text-gray-500 mt-2">{season.description}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {!season.is_current && (
                  <button
                    onClick={() => setAsCurrentSeason(season.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Définir comme courante
                  </button>
                )}
                
                {season.is_current && (
                  <button
                    onClick={() => closeSeason(season.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Fermer la saison
                  </button>
                )}
              </div>
            </div>

            {/* Section de modification rapide pour la saison courante */}
            {season.is_current && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-3">⚙️ Modification rapide</h4>
                <div className="space-y-4">
                  {/* Nom de la saison */}
                  <div className="flex items-center space-x-4">
                    <label className="text-sm text-blue-700 min-w-[100px]">Nom :</label>
                    <input
                      type="text"
                      defaultValue={season.name}
                      onBlur={(e) => {
                        const newName = e.target.value;
                        if (newName && newName !== season.name) {
                          updateSeason(season.id, { name: newName });
                        }
                      }}
                      className="flex-1 px-3 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Inscriptions ouvertes/fermées */}
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={season.registration_open}
                        onChange={(e) => updateSeason(season.id, { registration_open: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-blue-700">Inscriptions ouvertes</span>
                    </label>
                  </div>
                  
                  {/* Nombre maximum de membres */}
                  <div className="flex items-center space-x-4">
                    <label className="text-sm text-blue-700 min-w-[100px]">Max membres :</label>
                    <input
                      type="number"
                      defaultValue={season.max_members}
                      onBlur={(e) => {
                        const newMax = parseInt(e.target.value);
                        if (newMax > 0 && newMax !== season.max_members) {
                          updateSeason(season.id, { max_members: newMax });
                        }
                      }}
                      className="w-24 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* Dates de la saison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-blue-700 min-w-[80px]">Début :</label>
                      <input
                        type="date"
                        defaultValue={season.start_date}
                        onBlur={(e) => {
                          if (e.target.value !== season.start_date) {
                            updateSeason(season.id, { start_date: e.target.value });
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-blue-700 min-w-[80px]">Fin :</label>
                      <input
                        type="date"
                        defaultValue={season.end_date}
                        onBlur={(e) => {
                          if (e.target.value !== season.end_date) {
                            updateSeason(season.id, { end_date: e.target.value });
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  {/* Dates d'inscription */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-blue-700 min-w-[80px]">Inscr. début :</label>
                      <input
                        type="date"
                        defaultValue={season.registration_start_date}
                        onBlur={(e) => {
                          if (e.target.value !== season.registration_start_date) {
                            updateSeason(season.id, { registration_start_date: e.target.value });
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-blue-700 min-w-[80px]">Inscr. fin :</label>
                      <input
                        type="date"
                        defaultValue={season.registration_end_date}
                        onBlur={(e) => {
                          if (e.target.value !== season.registration_end_date) {
                            updateSeason(season.id, { registration_end_date: e.target.value });
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal de création de saison */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Créer une nouvelle saison
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              createNewSeason();
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la saison *
                </label>
                <input
                  type="text"
                  required
                  value={newSeasonData.name}
                  onChange={(e) => setNewSeasonData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Saison 2025-2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSeasonData.startDate}
                    onChange={(e) => setNewSeasonData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSeasonData.endDate}
                    onChange={(e) => setNewSeasonData(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Début des inscriptions *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSeasonData.registrationStart}
                    onChange={(e) => setNewSeasonData(prev => ({ ...prev, registrationStart: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fin des inscriptions *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSeasonData.registrationEnd}
                    onChange={(e) => setNewSeasonData(prev => ({ ...prev, registrationEnd: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre maximum de membres
                </label>
                <input
                  type="number"
                  value={newSeasonData.maxMembers}
                  onChange={(e) => setNewSeasonData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newSeasonData.description}
                  onChange={(e) => setNewSeasonData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description de la saison..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  🆕 Créer la saison et réinitialiser les membres
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statistiques de la saison courante */}
      {currentSeason && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📊 Statistiques - {currentSeason.name}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">
                {seasons.find(s => s.is_current)?.max_members || 0}
              </div>
              <div className="text-sm text-blue-600">Places disponibles</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">
                {currentSeason.registration_open ? 'Ouvertes' : 'Fermées'}
              </div>
              <div className="text-sm text-green-600">Inscriptions</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">
                {new Date(currentSeason.start_date).toLocaleDateString('fr-FR', { month: 'short' })}
              </div>
              <div className="text-sm text-purple-600">Début saison</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">
                {new Date(currentSeason.end_date).toLocaleDateString('fr-FR', { month: 'short' })}
              </div>
              <div className="text-sm text-orange-600">Fin saison</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};