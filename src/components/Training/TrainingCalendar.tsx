import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, Edit, Trash2, Eye, Copy, Grid, List, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { TrainingSession } from '../../types';

export const TrainingCalendar: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  // ✅ PLUS DE CATÉGORIES HARDCODÉES !
  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    category: [], // ✅ VIDE - sera rempli depuis la BDD
    coach: '',
    max_participants: 20
  });

  // ✅ CHARGEMENT DE L'UTILISATEUR ET PROFIL
  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
    }
  };

  // ✅ FONCTION POUR FILTRER LES SESSIONS SELON LE RÔLE
  const getFilteredSessions = (allSessions: TrainingSession[]) => {
    // Si admin/coach : voir tout
    if (profile?.role === 'admin' || profile?.role === 'coach') {
      return allSessions;
    }

    // Si membre : voir seulement ses catégories
    if (profile?.role === 'member' && profile?.categories?.length > 0) {
      return allSessions.filter(session => {
        // Vérifier si au moins une catégorie du membre correspond
        return session.category.some(sessionCat => 
          profile.categories.includes(sessionCat)
        );
      });
    }

    // Par défaut : voir tout (sécurité)
    return allSessions;
  };

  // ✅ VÉRIFICATION DES PERMISSIONS
  const canManageTrainings = profile?.role === 'admin' || profile?.role === 'coach';

  useEffect(() => {
    fetchCategories();
    fetchSessions();
  }, [currentWeek]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
      
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // ✅ FILTRAGE SELON LE RÔLE
      const filteredSessions = getFilteredSessions(data || []);
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Erreur lors du chargement des séances:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      // ✅ PAS DE FALLBACK HARDCODÉ - juste tableau vide
      setCategories([]);
    }
  };

  const createSession = async () => {
    try {
      setCreating(true);
      const { data, error } = await supabase
        .from('training_sessions')
        .insert([{
          title: newSession.title,
          description: newSession.description,
          date: newSession.date,
          start_time: newSession.start_time,
          end_time: newSession.end_time,
          location: newSession.location,
          category: newSession.category,
          coach: newSession.coach,
          max_participants: newSession.max_participants
        }])
        .select();

      if (error) throw error;
      
      if (data) {
        setSessions(prev => [...prev, ...data]);
      }
      
      // ✅ RESET SANS CATÉGORIES HARDCODÉES
      setNewSession({
        title: '',
        description: '',
        date: '',
        start_time: '',
        end_time: '',
        location: '',
        category: [], // ✅ VIDE
        coach: '',
        max_participants: 20
      });
      
      setShowAddForm(false);
    } catch (error) {
      console.error('Erreur lors de la création:', error);
    } finally {
      setCreating(false);
    }
  };

  const updateSession = async () => {
    if (!editingSession) return;
    
    try {
      setUpdating(true);
      const { data, error } = await supabase
        .from('training_sessions')
        .update({
          title: editingSession.title,
          description: editingSession.description,
          date: editingSession.date,
          start_time: editingSession.start_time,
          end_time: editingSession.end_time,
          location: editingSession.location,
          category: editingSession.category,
          coach: editingSession.coach,
          max_participants: editingSession.max_participants
        })
        .eq('id', editingSession.id)
        .select();

      if (error) throw error;
      
      if (data) {
        setSessions(prev => prev.map(s => s.id === editingSession.id ? data[0] : s));
      }
      
      setEditingSession(null);
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
    } finally {
      setUpdating(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      setDeleting(sessionId);
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setDeleting(null);
    }
  };

  const duplicateSession = (session: TrainingSession) => {
    setNewSession({
      title: `${session.title} (copie)`,
      description: session.description || '',
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      location: session.location,
      category: [...session.category],
      coach: session.coach,
      max_participants: session.max_participants || 20
    });
    setShowAddForm(true);
  };

  // ✅ FONCTIONS POUR LES CATÉGORIES DYNAMIQUES
  const getCategoryColor = (categoryValues: string[]) => {
    const category = categories.find(cat => categoryValues.includes(cat.value));
    const color = category?.color || '#3B82F6';
    return {
      backgroundColor: color + '20',
      color: color,
      borderColor: color + '40'
    };
  };

  const getCategoryLabel = (categoryValue: string) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category?.label || categoryValue;
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-primary-600" />
            <span>Calendrier des entraînements</span>
          </h2>
          <div className="flex items-center space-x-3">
            {/* Toggle vue */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'calendar' 
                    ? 'bg-white text-primary-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid className="w-4 h-4 inline mr-1" />
                Calendrier
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-primary-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4 inline mr-1" />
                Liste
              </button>
            </div>
            
            {/* ✅ BOUTON CRÉATION SEULEMENT SI AUTORISÉ */}
            {canManageTrainings && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvelle séance</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation semaine */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <h3 className="text-lg font-semibold text-gray-900">
            Semaine du {format(weekDays[0], 'dd MMMM', { locale: fr })} au {format(weekDays[6], 'dd MMMM yyyy', { locale: fr })}
          </h3>
          
          <button
            onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des entraînements...</p>
        </div>
      ) : (
        <>
          {/* Vue Calendrier */}
          {viewMode === 'calendar' && (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="grid grid-cols-7 gap-4">
                {/* En-têtes des jours */}
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="text-center pb-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {format(day, 'EEEE', { locale: fr })}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {format(day, 'dd MMM', { locale: fr })}
                    </p>
                  </div>
                ))}

                {/* Sessions par jour */}
                {weekDays.map((day) => {
                  const daySessions = sessions.filter(session => 
                    isSameDay(new Date(session.date), day)
                  );

                  return (
                    <div key={day.toISOString()} className="min-h-[200px] pt-4 space-y-2">
                      {daySessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => setViewingSession(session)}
                          className="p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all group"
                          style={getCategoryColor(session.category)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm truncate pr-2">
                              {session.title}
                            </h4>
                            {/* ✅ ACTIONS SEULEMENT SI AUTORISÉ */}
                            {canManageTrainings && (
                              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSession(session);
                                  }}
                                  className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                                  title="Modifier"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateSession(session);
                                  }}
                                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                  title="Dupliquer"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSession(session.id);
                                  }}
                                  disabled={deleting === session.id}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Supprimer"
                                >
                                  {deleting === session.id ? (
                                    <div className="w-3 h-3 border border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{session.start_time} - {session.end_time}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{session.location}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Users className="w-3 h-3" />
                              <span>{session.coach}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vue Liste */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Aucun entraînement programmé
                  </h3>
                  <p className="text-gray-600">
                    {canManageTrainings 
                      ? "Créez votre première séance d'entraînement." 
                      : "Aucun entraînement pour vos catégories cette semaine."
                    }
                  </p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                          {/* ✅ AFFICHAGE CORRIGÉ DES CATÉGORIES */}
                          <div className="flex flex-wrap gap-1">
                            {session.category.map((cat) => (
                              <span
                                key={cat}
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={getCategoryColor([cat])}
                              >
                                {getCategoryLabel(cat)}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>{format(new Date(session.date), 'EEEE dd MMMM yyyy', { locale: fr })}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>{session.start_time} - {session.end_time}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4" />
                            <span>{session.location}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4" />
                            <span>Coach: {session.coach}</span>
                          </div>
                        </div>
                        
                        {session.description && (
                          <p className="text-sm text-gray-600 mt-2">{session.description}</p>
                        )}
                        
                        {session.max_participants && (
                          <p className="text-sm text-gray-500 mt-1">
                            Maximum {session.max_participants} participants
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => setViewingSession(session)}
                          className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                          title="Voir détails"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        
                        {/* ✅ ACTIONS SEULEMENT SI AUTORISÉ */}
                        {canManageTrainings && (
                          <>
                            <button
                              onClick={() => setEditingSession(session)}
                              className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                              title="Modifier"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            
                            <button
                              onClick={() => duplicateSession(session)}
                              className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                              title="Dupliquer"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                            
                            <button
                              onClick={() => deleteSession(session.id)}
                              disabled={deleting === session.id}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Supprimer"
                            >
                              {deleting === session.id ? (
                                <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Trash2 className="w-5 h-5" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ✅ MODAL DE CRÉATION - SEULEMENT SI AUTORISÉ */}
      {showAddForm && canManageTrainings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                Créer une nouvelle séance
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              createSession();
            }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titre *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSession.title}
                    onChange={(e) => setNewSession(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    placeholder="Entraînement..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coach *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSession.coach}
                    onChange={(e) => setNewSession(prev => ({ ...prev, coach: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    placeholder="Nom du coach"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSession.date}
                    onChange={(e) => setNewSession(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure début *
                  </label>
                  <input
                    type="time"
                    required
                    value={newSession.start_time}
                    onChange={(e) => setNewSession(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure fin *
                  </label>
                  <input
                    type="time"
                    required
                    value={newSession.end_time}
                    onChange={(e) => setNewSession(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lieu *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSession.location}
                    onChange={(e) => setNewSession(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    placeholder="Gymnase..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max participants
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newSession.max_participants}
                    onChange={(e) => setNewSession(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 20 }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
              </div>

                            {/* ✅ SÉLECTION DES CATÉGORIES DEPUIS LA BDD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Catégories concernées *
                </label>
                {categories.length === 0 ? (
                  <p className="text-red-600 text-sm">
                    Aucune catégorie disponible. Veuillez créer des catégories dans les paramètres.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {categories.map(cat => (
                      <label key={cat.value} className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                        newSession.category.includes(cat.value)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          checked={newSession.category.includes(cat.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSession(prev => ({ ...prev, category: [...prev.category, cat.value] }));
                            } else {
                              setNewSession(prev => ({ ...prev, category: prev.category.filter(c => c !== cat.value) }));
                            }
                          }}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center transition-colors ${
                          newSession.category.includes(cat.value)
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-gray-300'
                        }`}>
                          {newSession.category.includes(cat.value) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: cat.color }}
                          ></div>
                          <span className="text-sm font-medium text-gray-700">
                            {cat.label}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newSession.description}
                  onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 resize-none"
                  placeholder="Description de la séance..."
                />
              </div>

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || newSession.category.length === 0}
                  className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-semibold flex items-center justify-center space-x-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Création...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Créer la séance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ MODAL D'ÉDITION - SEULEMENT SI AUTORISÉ */}
      {editingSession && canManageTrainings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                Modifier la séance
              </h3>
              <button
                onClick={() => setEditingSession(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              updateSession();
            }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titre *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSession.title}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coach *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSession.coach}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, coach: e.target.value } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingSession.date}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, date: e.target.value } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure début *
                  </label>
                  <input
                    type="time"
                    required
                    value={editingSession.start_time}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, start_time: e.target.value } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure fin *
                  </label>
                  <input
                    type="time"
                    required
                    value={editingSession.end_time}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, end_time: e.target.value } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lieu *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSession.location}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, location: e.target.value } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max participants
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingSession.max_participants || 20}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, max_participants: parseInt(e.target.value) || 20 } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
              </div>

              {/* ✅ SÉLECTION DES CATÉGORIES POUR L'ÉDITION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Catégories concernées *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categories.map(cat => (
                    <label key={cat.value} className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                      editingSession.category.includes(cat.value)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={editingSession.category.includes(cat.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingSession(prev => prev ? { ...prev, category: [...prev.category, cat.value] } : null);
                          } else {
                            setEditingSession(prev => prev ? { ...prev, category: prev.category.filter(c => c !== cat.value) } : null);
                          }
                        }}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center transition-colors ${
                        editingSession.category.includes(cat.value)
                          ? 'bg-primary-500 border-primary-500'
                          : 'border-gray-300'
                      }`}>
                        {editingSession.category.includes(cat.value) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        ></div>
                        <span className="text-sm font-medium text-gray-700">
                          {cat.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editingSession.description || ''}
                  onChange={(e) => setEditingSession(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 resize-none"
                  placeholder="Description de la séance..."
                />
              </div>

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updating || editingSession.category.length === 0}
                  className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-semibold flex items-center justify-center space-x-2"
                >
                  {updating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Modification...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Sauvegarder</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ MODAL DE VISUALISATION */}
      {viewingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {viewingSession.title}
              </h3>
              <button
                onClick={() => setViewingSession(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Infos générales */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(viewingSession.date), 'EEEE dd MMMM yyyy', { locale: fr })}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{viewingSession.start_time} - {viewingSession.end_time}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{viewingSession.location}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>Coach: {viewingSession.coach}</span>
                </div>
              </div>

              {/* Catégories */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">🎯 Catégories</h4>
                <div className="flex flex-wrap gap-2">
                  {viewingSession.category.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={getCategoryColor([cat])}
                    >
                      {getCategoryLabel(cat)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Participants max */}
              {viewingSession.max_participants && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-800 mb-1">👥 Participants</h4>
                  <p className="text-gray-700">Maximum {viewingSession.max_participants} participants</p>
                </div>
              )}

              {/* Description */}
              {viewingSession.description && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">📝 Description</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{viewingSession.description}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                {canManageTrainings && (
                  <>
                    <button
                      onClick={() => {
                        setViewingSession(null);
                        setEditingSession(viewingSession);
                      }}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all font-semibold"
                    >
                      <Edit className="w-5 h-5" />
                      <span>Modifier</span>
                    </button>
                    <button
                      onClick={() => {
                        setViewingSession(null);
                        duplicateSession(viewingSession);
                      }}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center space-x-2 transition-all font-semibold"
                    >
                      <Copy className="w-5 h-5" />
                      <span>Dupliquer</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewingSession(null)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingCalendar;
