import React, { useState, useEffect } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Calendar, Clock, MapPin, Users, Edit, Trash2, Copy, ChevronLeft, ChevronRight, Grid, List, X, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TrainingSession {
  id: number;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  coach: string;
  category: string[];
  description: string;
  max_participants?: number;
  created_at?: string;
}

const TrainingCalendar: React.FC = () => {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [newSession, setNewSession] = useState({
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    end_time: '11:30',
    location: '',
    coach: '',
    category: [] as string[],
    description: '',
    max_participants: ''
  });

  const categories = [
    { value: 'fitness', label: '💪 Fitness', color: 'from-blue-500 to-blue-600' },
    { value: 'cardio', label: '❤️ Cardio', color: 'from-red-500 to-red-600' },
    { value: 'strength', label: '🏋️ Musculation', color: 'from-purple-500 to-purple-600' },
    { value: 'flexibility', label: '🧘 Flexibilité', color: 'from-green-500 to-green-600' },
    { value: 'dance', label: '💃 Danse', color: 'from-pink-500 to-pink-600' },
    { value: 'martial', label: '🥋 Arts Martiaux', color: 'from-orange-500 to-orange-600' }
  ];

  // Fonctions utilitaires
  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat ? `bg-gradient-to-r ${cat.color}` : 'bg-gradient-to-r from-gray-500 to-gray-600';
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  const resetForm = () => {
    setNewSession({
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '10:00',
      end_time: '11:30',
      location: '',
      coach: '',
      category: [],
      description: '',
      max_participants: ''
    });
  };

  // Chargement des sessions
  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Gestion des formulaires
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('training_sessions')
        .insert([{
          ...newSession,
          max_participants: newSession.max_participants ? parseInt(newSession.max_participants) : null
        }]);

      if (error) throw error;
      
      setShowAddForm(false);
      resetForm();
      loadSessions();
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    try {
      const { error } = await supabase
        .from('training_sessions')
        .update(editingSession)
        .eq('id', editingSession.id);

      if (error) throw error;
      
      setEditingSession(null);
      loadSessions();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
    }
  };

  const deleteSession = async (id: number) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadSessions();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setDeleting(null);
    }
  };

  const duplicateSession = async (session: TrainingSession) => {
    try {
      const { id, created_at, ...sessionData } = session;
      const { error } = await supabase
        .from('training_sessions')
        .insert([sessionData]);

      if (error) throw error;
      loadSessions();
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
    }
  };

  // Filtrage des sessions pour la semaine courante
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getSessionsForDate = (date: Date) => {
    return sessions.filter(session => 
      format(new Date(session.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement du calendrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Premium */}
      <div className="bg-white shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Titre */}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  📅 Calendrier d'Entraînements
                </h1>
                <p className="text-gray-600">Gérez vos séances d'entraînement facilement</p>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-4">
                {/* Toggle vue */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'calendar'
                        ? 'bg-white shadow text-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Grid className="w-4 h-4 mr-2" />
                    Calendrier
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'list'
                        ? 'bg-white shadow text-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <List className="w-4 h-4 mr-2" />
                    Liste
                  </button>
                </div>

                {/* Bouton nouvelle séance */}
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg flex items-center space-x-2 font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="w-5 h-5" />
                  <span>Nouvelle séance</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation semaine */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
              className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-800">
                Semaine du {format(weekStart, 'dd MMM', { locale: fr })} au {format(weekEnd, 'dd MMM yyyy', { locale: fr })}
              </h2>
            </div>
            
            <button
              onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
              className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Vue Calendrier */}
        {viewMode === 'calendar' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100">
              {weekDays.map((day) => (
                <div key={day.toString()} className="p-4 bg-gray-50 border-r border-gray-100 last:border-r-0">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-600 mb-1">
                      {format(day, 'EEE', { locale: fr })}
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                      {format(day, 'd')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 min-h-[600px]">
              {weekDays.map((day) => {
                const daySessions = getSessionsForDate(day);
                return (
                  <div key={day.toString()} className="border-r border-gray-100 last:border-r-0 p-2">
                    <div className="space-y-2">
                      {daySessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => setViewingSession(session)}
                          className="bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 p-3 rounded-lg border border-blue-200 cursor-pointer transition-all duration-200 group"
                        >
                          <div className="text-sm font-semibold text-blue-800 mb-1 truncate">
                            {session.title}
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-blue-600 mb-2">
                            <span>{session.start_time}</span>
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSession(session);
                                }}
                                className="p-1 hover:bg-blue-300 rounded"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSession(session.id);
                                }}
                                className="p-1 hover:bg-red-300 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="text-xs text-blue-600 mb-1">
                            📍 {session.location}
                          </div>
                          <div className="text-xs text-blue-600">
                            👨‍🏫 {session.coach}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vue Liste */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            {sessions.filter(session => {
              const sessionDate = new Date(session.date);
              return sessionDate >= weekStart && sessionDate <= weekEnd;
            }).map((session) => (
              <div key={session.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">{session.title}</h3>
                      <div className="flex space-x-2">
                        {session.category.map((cat) => (
                          <span
                            key={cat}
                            className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getCategoryColor(cat)}`}
                          >
                            {getCategoryLabel(cat)}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{format(new Date(session.date), 'dd MMM yyyy', { locale: fr })}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{session.start_time} - {session.end_time}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{session.location}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span>{session.coach}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setViewingSession(session)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setEditingSession(session)}
                      className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => duplicateSession(session)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      disabled={deleting === session.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      {deleting === session.id ? (
                        <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Séances cette semaine</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sessions.filter(session => {
                    const sessionDate = new Date(session.date);
                    return sessionDate >= weekStart && sessionDate <= weekEnd;
                  }).length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Coachs actifs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(sessions.map(s => s.coach)).size}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Lieux différents</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(sessions.map(s => s.location)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Ajout */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">Nouvelle Séance</h3>
                    <p className="opacity-90">Créez une nouvelle séance d'entraînement</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Titre de la séance *
                      </label>
                      <input
                        type="text"
                        required
                        value={newSession.title}
                        onChange={(e) => setNewSession(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ex: Cours de Fitness"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={newSession.date}
                        onChange={(e) => setNewSession(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Heure de début *
                      </label>
                      <input
                        type="time"
                        required
                        value={newSession.start_time}
                        onChange={(e) => setNewSession(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Heure de fin *
                      </label>
                      <input
                        type="time"
                        required
                        value={newSession.end_time}
                        onChange={(e) => setNewSession(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Lieu *
                      </label>
                      <input
                        type="text"
                        required
                        value={newSession.location}
                        onChange={(e) => setNewSession(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Salle de sport, Gymnase..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Coach *
                      </label>
                      <input
                        type="text"
                        required
                        value={newSession.coach}
                        onChange={(e) => setNewSession(prev => ({ ...prev, coach: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Nom du coach"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Catégories
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => {
                            setNewSession(prev => ({
                              ...prev,
                              category: prev.category.includes(category.value)
                                ? prev.category.filter(c => c !== category.value)
                                : [...prev.category, category.value]
                            }));
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            newSession.category.includes(category.value)
                              ? `bg-gradient-to-r ${category.color} text-white shadow-md`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newSession.description}
                      onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={4}
                      placeholder="Description de la séance..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre maximum de participants
                    </label>
                    <input
                      type="number"
                      value={newSession.max_participants}
                      onChange={(e) => setNewSession(prev => ({ ...prev, max_participants: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: 15"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold"
                  >
                    Créer la séance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Édition */}
        {editingSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">Modifier la séance</h3>
                    <p className="opacity-90">Modifiez les détails de la séance</p>
                  </div>
                  <button
                    onClick={() => setEditingSession(null)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdate} className="p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Titre de la séance *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingSession.title}
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, title: e.target.value } : null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={editingSession.date}
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, date: e.target.value } : null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Heure de début *
                      </label>
                      <input
                        type="time"
                        required
                        value={editingSession.start_time}
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, start_time: e.target.value } : null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Heure de fin *
                      </label>
                      <input
                        type="time"
                        required
                        value={editingSession.end_time}
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, end_time: e.target.value } : null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Lieu *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingSession.location}
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, location: e.target.value } : null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Coach *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingSession.coach}
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, coach: e.target.value } : null)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Catégories
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => {
                            setEditingSession(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                category: prev.category.includes(category.value)
                                  ? prev.category.filter(c => c !== category.value)
                                  : [...prev.category, category.value]
                              };
                            });
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            editingSession.category.includes(category.value)
                              ? `bg-gradient-to-r ${category.color} text-white shadow-md`
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editingSession.description}
                      onChange={(e) => setEditingSession(prev => prev ? { ...prev, description: e.target.value } : null)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre maximum de participants
                    </label>
                    <input
                      type="number"
                      value={editingSession.max_participants || ''}
                      onChange={(e) => setEditingSession(prev => prev ? { ...prev, max_participants: parseInt(e.target.value) || undefined } : null)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEditingSession(null)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all font-semibold"
                  >
                    Sauvegarder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Visualisation */}
        {viewingSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{viewingSession.title}</h3>
                    <p className="opacity-90">Détails de la séance</p>
                  </div>
                  <button
                    onClick={() => setViewingSession(null)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-800">Date</span>
                    </div>
                    <p className="text-gray-600 ml-8">
                      {format(new Date(viewingSession.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <Clock className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-800">Horaire</span>
                    </div>
                    <p className="text-gray-600 ml-8">
                      {viewingSession.start_time} - {viewingSession.end_time}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <MapPin className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-800">Lieu</span>
                    </div>
                    <p className="text-gray-600 ml-8">{viewingSession.location}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <Users className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold text-gray-800">Coach</span>
                    </div>
                    <p className="text-gray-600 ml-8">{viewingSession.coach}</p>
                  </div>
                </div>

                {viewingSession.category.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-3">Catégories</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingSession.category.map((cat) => (
                        <span
                          key={cat}
                          className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${getCategoryColor(cat)}`}
                        >
                          {getCategoryLabel(cat)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {viewingSession.max_participants && (
                  <div className="mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <Users className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-800">
                          Maximum {viewingSession.max_participants} participants
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {viewingSession.description && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-800 mb-3">Description</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {viewingSession.description}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-center space-x-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setViewingSession(null);
                      setEditingSession(viewingSession);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all font-semibold flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => setViewingSession(null)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { TrainingCalendar };
export default TrainingCalendar;

