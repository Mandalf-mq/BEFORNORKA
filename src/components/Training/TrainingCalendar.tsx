import React, { useState, useEffect } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Calendar, Clock, MapPin, Users, Edit, Trash2, Copy, ChevronLeft, ChevronRight, Grid, List, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TrainingSession {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  coach: string;
  category: string[];
  description: string;
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
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    end_time: '11:30',
    location: '',
    coach: '',
    category: [] as string[],
    description: ''
  });

  const categories = [
    { value: 'fitness', label: '💪 Fitness', color: 'bg-blue-500' },
    { value: 'cardio', label: '❤️ Cardio', color: 'bg-red-500' },
    { value: 'strength', label: '🏋️ Musculation', color: 'bg-purple-500' },
    { value: 'flexibility', label: '🧘 Flexibilité', color: 'bg-green-500' },
    { value: 'sports', label: '⚽ Sports', color: 'bg-orange-500' },
    { value: 'group', label: '👥 Cours collectif', color: 'bg-pink-500' }
  ];

  const getCategoryLabel = (value: string) => {
    return categories.find(cat => cat.value === value)?.label || value;
  };

  const getCategoryColor = (value: string) => {
    return categories.find(cat => cat.value === value)?.color || 'bg-gray-500';
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });

  useEffect(() => {
    fetchSessions();
  }, [currentWeek]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const startDate = format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const endDate = format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      setSessions(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewSession({
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '10:00',
      end_time: '11:30',
      location: '',
      coach: '',
      category: [],
      description: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('training_sessions')
        .insert([newSession]);

      if (error) throw error;

      await fetchSessions();
      setShowAddForm(false);
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    try {
      const { error } = await supabase
        .from('training_sessions')
        .update({
          date: editingSession.date,
          start_time: editingSession.start_time,
          end_time: editingSession.end_time,
          location: editingSession.location,
          coach: editingSession.coach,
          category: editingSession.category,
          description: editingSession.description
        })
        .eq('id', editingSession.id);

      if (error) throw error;

      await fetchSessions();
      setEditingSession(null);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

  const deleteSession = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette séance ?')) return;

    setDeleting(id);
    try {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setDeleting(null);
    }
  };

  const duplicateSession = async (session: TrainingSession) => {
    try {
      const newSession = {
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        location: session.location,
        coach: session.coach,
        category: session.category,
        description: session.description + ' (Copie)'
      };

      const { error } = await supabase
        .from('training_sessions')
        .insert([newSession]);

      if (error) throw error;

      await fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
    }
  };

  const handleCategoryToggle = (category: string, isEditing = false) => {
    if (isEditing && editingSession) {
      const currentCategories = editingSession.category || [];
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category];
      
      setEditingSession({...editingSession, category: newCategories});
    } else {
      const currentCategories = newSession.category || [];
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category];
      
      setNewSession(prev => ({...prev, category: newCategories}));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 font-medium">Chargement du calendrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER AMÉLIORÉ */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Titre et navigation semaine */}
              <div className="space-y-4 lg:space-y-0">
                <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  📅 Calendrier d'Entraînements
                </h1>
                
                {/* Navigation semaine */}
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
                    className="p-2 rounded-xl bg-white shadow-md hover:shadow-lg border border-gray-200 hover:border-indigo-300 transition-all duration-200 group"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 group-hover:text-indigo-600" />
                  </button>
                  
                  <div className="text-center px-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Semaine du {format(startOfWeek(currentWeek, { locale: fr, weekStartsOn: 1 }), 'dd MMM yyyy', { locale: fr })}
                    </h2>
                    <p className="text-sm text-gray-600">
                      au {format(endOfWeek(currentWeek, { locale: fr, weekStartsOn: 1 }), 'dd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
                    className="p-2 rounded-xl bg-white shadow-md hover:shadow-lg border border-gray-200 hover:border-indigo-300 transition-all duration-200 group"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-600" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Toggle vue */}
                <div className="flex bg-gray-100 rounded-xl p-1 shadow-inner">
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewMode === 'calendar'
                        ? 'bg-white shadow-md text-indigo-600 border border-indigo-200'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Grid className="w-4 h-4 mr-2" />
                    Calendrier
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewMode === 'list'
                        ? 'bg-white shadow-md text-indigo-600 border border-indigo-200'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <List className="w-4 h-4 mr-2" />
                    Liste
                  </button>
                </div>
                
                {/* Bouton nouveau */}
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 group"
                >
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                  <span>Nouvelle séance</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* VUE CALENDRIER AMÉLIORÉE */}
        {viewMode === 'calendar' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            {/* En-têtes des jours */}
            <div className="grid grid-cols-7 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="p-4 text-center border-r border-white/20 last:border-r-0">
                  <div className="font-semibold text-sm uppercase tracking-wide">
                    {format(day, 'EEEE', { locale: fr })}
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {format(day, 'dd')}
                  </div>
                  <div className="text-xs opacity-80">
                    {format(day, 'MMM', { locale: fr })}
                  </div>
                </div>
              ))}
            </div>

            {/* Corps du calendrier */}
            <div className="grid grid-cols-7 min-h-[600px]">
              {weekDays.map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const daySessions = sessions.filter(session => session.date === dayStr);
                
                return (
                  <div key={dayStr} className="border-r border-gray-200 last:border-r-0 bg-gradient-to-b from-white/50 to-gray-50/30">
                    <div className="p-3 h-full">
                      {daySessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => setViewingSession(session)}
                          className={`
                            ${getCategoryColor(session.category[0])} 
                            text-white p-3 rounded-lg mb-2 cursor-pointer shadow-md 
                            hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 group
                          `}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-medium opacity-90">
                              {session.start_time} - {session.end_time}
                            </div>
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSession(session);
                                }}
                                className="p-1 hover:bg-white/50 rounded transition-colors"
                                title="Modifier"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateSession(session);
                                }}
                                className="p-1 hover:bg-white/50 rounded transition-colors"
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
                                className="p-1 hover:bg-white/50 rounded transition-colors"
                                title="Supprimer"
                              >
                                {deleting === session.id ? (
                                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-semibold text-sm mb-1">{session.location}</div>
                            <div className="text-xs opacity-90 mb-2">👤 {session.coach}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {session.category.map((cat) => (
                                <span
                                  key={cat}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/50"
                                >
                                  {getCategoryLabel(cat)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {daySessions.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                          <Calendar className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-xs text-center">Aucun<br/>entraînement</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VUE LISTE */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            {sessions.length === 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucune séance cette semaine</h3>
                <p className="text-gray-500">Commencez par créer votre première séance d'entraînement</p>
              </div>
            )}
            
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 cursor-pointer group"
                onClick={() => setViewingSession(session)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Date</p>
                        <p className="font-semibold text-gray-900">
                          {format(new Date(session.date), 'dd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Horaires</p>
                        <p className="font-semibold text-gray-900">{session.start_time} - {session.end_time}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Lieu</p>
                        <p className="font-semibold text-gray-900">{session.location}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Coach</p>
                        <p className="font-semibold text-gray-900">{session.coach}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSession(session);
                      }}
                      className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                      title="Modifier"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateSession(session);
                      }}
                      className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all duration-200"
                      title="Dupliquer"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      disabled={deleting === session.id}
                      className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 disabled:opacity-50"
                      title="Supprimer"
                    >
                      {deleting === session.id ? (
                        <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
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
            ))}
          </div>
        )}

        {/* STATISTIQUES */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Séances cette semaine</p>
                  <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Heures totales</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {sessions.reduce((total, session) => {
                      const start = new Date(`2000-01-01T${session.start_time}`);
                      const end = new Date(`2000-01-01T${session.end_time}`);
                      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      return total + duration;
                    }, 0).toFixed(1)}h
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Coaches différents</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {new Set(sessions.map(s => s.coach)).size}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Lieux différents</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {new Set(sessions.map(s => s.location)).size}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL AJOUT */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header du modal */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">✨ Nouvelle Séance d'Entraînement</h3>
                    <p className="opacity-90">Créez une nouvelle séance pour vos membres</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Corps du modal */}
              <form onSubmit={handleSubmit} className="p-8">
                <div className="space-y-8">
                  {/* Informations principales */}
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      📋 Informations principales
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Date de la séance *
                        </label>
                        <input
                          type="date"
                          required
                          value={newSession.date}
                          onChange={(e) => setNewSession(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                          placeholder="Salle de sport, Gymnase..."
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Coach responsable *
                        </label>
                        <input
                          type="text"
                          required
                          value={newSession.coach}
                          onChange={(e) => setNewSession(prev => ({ ...prev, coach: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                          placeholder="Nom du coach"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Catégories */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      🏷️ Catégories d'entraînement
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categories.map((category) => (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => handleCategoryToggle(category.value)}
                          className={`
                            p-4 rounded-xl text-sm font-medium transition-all duration-200 border-2
                            ${newSession.category.includes(category.value)
                              ? `${category.color} text-white border-transparent shadow-lg scale-105`
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md'
                            }
                          `}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      📝 Description et détails
                    </h4>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Description de la séance
                      </label>
                      <textarea
                        value={newSession.description}
                        onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                        rows={4}
                        placeholder="Décrivez le contenu de la séance, les objectifs, le matériel nécessaire..."
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex-1"
                  >
                    ✨ Créer la séance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL MODIFICATION */}
        {editingSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">✏️ Modifier la Séance</h3>
                    <p className="opacity-90">Mettez à jour les informations de la séance</p>
                  </div>
                  <button
                    onClick={() => setEditingSession(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdate} className="p-8">
                <div className="space-y-8">
                  <div className="bg-gradient-to-r from-gray-50 to-orange-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      📋 Informations principales
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Date de la séance *
                        </label>
                        <input
                          type="date"
                          required
                          value={editingSession.date}
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
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
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, location: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
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
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, start_time: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
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
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, end_time: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Coach responsable *
                        </label>
                        <input
                          type="text"
                          required
                          value={editingSession.coach}
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, coach: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      🏷️ Catégories d'entraînement
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categories.map((category) => (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => handleCategoryToggle(category.value, true)}
                          className={`
                            p-4 rounded-xl text-sm font-medium transition-all duration-200 border-2
                            ${editingSession.category?.includes(category.value)
                              ? `${category.color} text-white border-transparent shadow-lg scale-105`
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md'
                            }
                          `}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      📝 Description et détails
                    </h4>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Description de la séance
                      </label>
                      <textarea
                        value={editingSession.description}
                        onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEditingSession(null)}
                    className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex-1"
                  >
                    💾 Sauvegarder les modifications
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL VISUALISATION */}
        {viewingSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">👁️ Détails de la Séance</h3>
                    <p className="opacity-90">Informations complètes sur la séance d'entraînement</p>
                  </div>
                  <button
                    onClick={() => setViewingSession(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="space-y-8">
                  {/* Informations principales */}
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      📋 Informations générales
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <span className="text-sm text-gray-600 font-medium block mb-2">📅 Date</span>
                        <p className="font-bold text-lg text-gray-800">
                          {format(new Date(viewingSession.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <span className="text-sm text-gray-600 font-medium block mb-2">⏰ Horaires</span>
                        <p className="font-bold text-lg text-gray-800">
                          {viewingSession.start_time} - {viewingSession.end_time}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <span className="text-sm text-gray-600 font-medium block mb-2">📍 Lieu</span>
                        <p className="font-bold text-lg text-gray-800">{viewingSession.location}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <span className="text-sm text-gray-600 font-medium block mb-2">👨‍🏫 Coach</span>
                        <p className="font-bold text-lg text-gray-800">{viewingSession.coach}</p>
                      </div>
                    </div>
                  </div>

                  {/* Catégories */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-4 text-lg flex items-center">
                      🏷️ Catégories
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {viewingSession.category.map((cat) => (
                        <span
                          key={cat}
                          className={`px-4 py-2 rounded-full text-sm font-semibold text-white ${getCategoryColor(cat)} shadow-md`}
                        >
                          {getCategoryLabel(cat)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  {viewingSession.description && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                      <h4 className="font-bold text-gray-800 mb-4 text-lg flex items-center">
                        📝 Description
                      </h4>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {viewingSession.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-center mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setViewingSession(null)}
                    className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold"
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

export default TrainingCalendar;
