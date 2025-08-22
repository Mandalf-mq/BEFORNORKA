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

  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    category: [] as string[],
    coach: '',
    max_participants: 20
  });

  // ✅ CHARGEMENT INITIAL
  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadSessions();
      loadCategories();
    }
  }, [user, currentWeek]);

  // ✅ FONCTION - Récupérer l'utilisateur actuel
  const getCurrentUser = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Erreur profil:', error);
        } else {
          setProfile(profileData);
        }
      }
    } catch (error) {
      console.error('Erreur getCurrentUser:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FONCTION - Charger les catégories
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;

      const formattedCategories = data?.map(cat => ({
        value: cat.name.toLowerCase(),
        label: cat.name,
        color: cat.color
      })) || [];

      setCategories(formattedCategories);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      setCategories([]);
    }
  };

  // ✅ FONCTION - Charger les sessions
  const loadSessions = async () => {
    try {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date')
        .order('start_time');

      if (error) throw error;

      const filteredSessions = getFilteredSessions(data || []);
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      setSessions([]);
    }
  };

  // ✅ FONCTION - Filtrer selon le rôle utilisateur
  const getFilteredSessions = (allSessions: TrainingSession[]) => {
    if (!profile) return [];
    
    // Admin/Coach voient tout
    if (profile.role === 'admin' || profile.role === 'coach') {
      return allSessions;
    }
    
    // Membres voient seulement leurs catégories
    const userCategories = profile.categories || [];
    return allSessions.filter(session => 
      session.category.some(cat => userCategories.includes(cat))
    );
  };

  // ✅ FONCTION - Vérifier permissions de gestion
  const canManageTrainings = profile?.role === 'admin' || profile?.role === 'coach';

  // ✅ FONCTION - Créer une session
  const createSession = async () => {
    if (newSession.category.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie');
      return;
    }

    try {
      setCreating(true);

      const sessionData = {
        title: newSession.title.trim(),
        description: newSession.description.trim(),
        date: newSession.date,
        start_time: newSession.start_time,
        end_time: newSession.end_time,
        location: newSession.location.trim(),
        category: newSession.category,
        coach: newSession.coach.trim(),
        max_participants: newSession.max_participants,
        created_by: user?.id
      };

      const { error } = await supabase
        .from('training_sessions')
        .insert([sessionData]);

      if (error) throw error;

      // Reset form
      setNewSession({
        title: '',
        description: '',
        date: '',
        start_time: '',
        end_time: '',
        location: '',
        category: [],
        coach: '',
        max_participants: 20
      });

      setShowAddForm(false);
      loadSessions();

    } catch (error) {
      console.error('Erreur création session:', error);
      alert('Erreur lors de la création de la session');
    } finally {
      setCreating(false);
    }
  };

  // ✅ FONCTION - Mettre à jour une session  
  const updateSession = async () => {
    if (!editingSession || editingSession.category.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie');
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('training_sessions')
        .update({
          title: editingSession.title.trim(),
          description: editingSession.description?.trim(),
          date: editingSession.date,
          start_time: editingSession.start_time,
          end_time: editingSession.end_time,
          location: editingSession.location.trim(),
          category: editingSession.category,
          coach: editingSession.coach.trim(),
          max_participants: editingSession.max_participants,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSession.id);

      if (error) throw error;

      setEditingSession(null);
      loadSessions();

    } catch (error) {
      console.error('Erreur mise à jour session:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  // ✅ FONCTION - Supprimer une session
  const deleteSession = async (sessionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session ?')) {
      return;
    }

    try {
      setDeleting(sessionId);

      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      loadSessions();
    } catch (error) {
      console.error('Erreur suppression session:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  // ✅ FONCTION - Dupliquer une session
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

  // ✅ FONCTION - Obtenir la couleur d'une catégorie
  const getCategoryColor = (sessionCategories: string[]) => {
    const category = categories.find(cat => 
      sessionCategories.includes(cat.value)
    );
    return {
      backgroundColor: category?.color || '#6366f1',
      color: '#ffffff'
    };
  };

  // ✅ FONCTION - Obtenir le label d'une catégorie
  const getCategoryLabel = (categoryValue: string) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category?.label || categoryValue;
  };

  // ✅ NAVIGATION SEMAINE
  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToToday = () => setCurrentWeek(new Date());

  // ✅ OBTENIR LES JOURS DE LA SEMAINE
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ✅ HEADER AVEC CONTRÔLES */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Calendrier d'entraînement</h2>
          <p className="text-gray-600 mt-1">
            Semaine du {format(weekDays[0], 'dd MMM', { locale: fr })} au {format(weekDays[6], 'dd MMM yyyy', { locale: fr })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation semaine */}
          <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Aujourd'hui
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Toggle vue */}
          <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'calendar' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          {/* Bouton Ajouter (si autorisé) */}
          {canManageTrainings && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Ajouter</span>
            </button>
          )}
        </div>
      </div>

      {/* ✅ VUE CALENDRIER */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* En-tête jours */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((day, index) => (
              <div key={index} className="p-4 text-center border-r border-gray-200 last:border-r-0">
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  {format(day, 'EEEE', { locale: fr })}
                </div>
                <div className={`text-lg font-bold ${
                  isSameDay(day, new Date()) ? 'text-primary-600' : 'text-gray-600'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Sessions */}
          <div className="grid grid-cols-7 min-h-96">
            {weekDays.map((day, index) => {
              const daySessions = sessions.filter(session => 
                isSameDay(new Date(session.date), day)
              );

              return (
                <div key={index} className="border-r border-gray-200 last:border-r-0 p-2 space-y-2">
                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3 rounded-lg cursor-pointer hover:shadow-md transition-shadow text-sm"
                      style={getCategoryColor(session.category)}
                      onClick={() => setViewingSession(session)}
                    >
                      <div className="font-semibold mb-1">{session.title}</div>
                      <div className="text-xs opacity-90 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{session.start_time}</span>
                      </div>
                      <div className="text-xs opacity-90 flex items-center space-x-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{session.location}</span>
                      </div>
                      
                      {/* Actions rapides (si autorisé) */}
                      {canManageTrainings && (
                        <div className="flex justify-end space-x-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSession(session);
                            }}
                            className="p-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                            }}
                            className="p-1 bg-white/20 hover:bg-red-500 rounded transition-colors"
                            disabled={deleting === session.id}
                          >
                            {deleting === session.id ? (
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ✅ VUE LISTE */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {sessions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">Aucune session cette semaine</h3>
              <p>Aucune session d'entraînement prévue pour cette période.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <div key={session.id} className="p-6 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Ligne 1: Titre + Catégories */}
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                        <div className="flex space-x-1">
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

                      {/* Ligne 2: Infos principales */}
                      <div className="flex items-center space-x-6 text-sm text-gray-600 mb-2">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(session.date), 'EEEE dd MMM', { locale: fr })}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{session.start_time} - {session.end_time}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{session.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>Coach: {session.coach}</span>
                        </div>
                      </div>

                      {/* Description si présente */}
                      {session.description && (
                        <p className="text-sm text-gray-700 line-clamp-2">{session.description}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setViewingSession(session)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Voir détails"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      
                      {canManageTrainings && (
                        <>
                          <button
                            onClick={() => setEditingSession(session)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => duplicateSession(session)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Dupliquer"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteSession(session.id)}
                            disabled={deleting === session.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Supprimer"
                          >
                            {deleting === session.id ? (
                              <div className="w-5 h-5 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ✅ MODAL CRÉATION */}
      {showAddForm && canManageTrainings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                Nouvelle séance d'entraînement
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
                    placeholder="Ex: Entraînement U15"
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
                    placeholder="Terrain, salle..."
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
              {/* SÉLECTION CATÉGORIES */}
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
                          <span className="font-medium text-gray-700">{cat.label}</span>
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
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 resize-none"
                  placeholder="Description optionnelle de la séance..."
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-semibold"
                >
                  {creating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Création...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Créer la séance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ MODAL MODIFICATION */}
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

              {/* SÉLECTION CATÉGORIES POUR MODIFICATION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Catégories concernées *
                </label>
                {categories.length === 0 ? (
                  <p className="text-red-600 text-sm">
                    Aucune catégorie disponible.
                  </p>
                ) : (
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
                          <span className="font-medium text-gray-700">{cat.label}</span>
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
                  value={editingSession.description || ''}
                  onChange={(e) => setEditingSession(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 resize-none"
                  placeholder="Description optionnelle de la séance..."
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-colors font-semibold"
                >
                  {updating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Mise à jour...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Sauvegarder</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ MODAL VISUALISATION */}
      {viewingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                📋 Détails de la séance
              </h3>
              <button
                onClick={() => setViewingSession(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Titre & Badges */}
              <div>
                <h4 className="text-2xl font-bold text-gray-900 mb-3">{viewingSession.title}</h4>
                <div className="flex flex-wrap gap-2">
                  {viewingSession.category.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: categories.find(c => c.value === cat)?.color || '#6366f1' }}
                    >
                      {getCategoryLabel(cat)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Infos principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-gray-700">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    <span className="font-semibold">
                      {format(new Date(viewingSession.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-700">
                    <Clock className="w-5 h-5 text-primary-600" />
                    <span>{viewingSession.start_time} - {viewingSession.end_time}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-700">
                    <MapPin className="w-5 h-5 text-primary-600" />
                    <span>{viewingSession.location}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-gray-700">
                    <Users className="w-5 h-5 text-primary-600" />
                    <span>Coach: <strong>{viewingSession.coach}</strong></span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-700">
                    <Users className="w-5 h-5 text-primary-600" />
                    <span>Max: <strong>{viewingSession.max_participants || 20} participants</strong></span>
                  </div>
                </div>
              </div>

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

export default TrainingCalendar;k