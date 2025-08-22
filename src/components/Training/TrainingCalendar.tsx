import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, Edit, Trash2, Eye, Copy, Grid, List, Save, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { TrainingSession } from '../../types';

export const TrainingCalendar: React.FC = () => {
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
    category: [],
    coach: '',
    max_participants: 20
  });

  useEffect(() => {
    fetchSessions();
    fetchCategories();
  }, [currentWeek]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const weekStart = startOfWeek(currentWeek, { locale: fr });
      const weekEnd = endOfWeek(currentWeek, { locale: fr });
      
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
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

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    }
  };

  const resetForm = () => {
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
  };

  const createSession = async () => {
    try {
      setCreating(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('training_sessions')
        .insert({
          ...newSession,
          created_by: user?.id
        });

      if (error) throw error;
      
      await fetchSessions();
      resetForm();
      setShowAddForm(false);
      alert('✅ Séance créée avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const updateSession = async () => {
    if (!editingSession) return;
    
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('training_sessions')
        .update(editingSession)
        .eq('id', editingSession.id);

      if (error) throw error;
      
      await fetchSessions();
      setEditingSession(null);
      alert('✅ Séance modifiée !');
    } catch (error) {
      console.error('Erreur:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const duplicateSession = async (session: TrainingSession) => {
    try {
      const { error } = await supabase
        .from('training_sessions')
        .insert({
          title: `${session.title} (Copie)`,
          description: session.description,
          date: session.date,
          start_time: session.start_time,
          end_time: session.end_time,
          location: session.location,
          category: session.category,
          coach: session.coach,
          max_participants: session.max_participants,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;
      await fetchSessions();
      alert('✅ Séance dupliquée avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la duplication:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette séance ?')) return;

    try {
      setDeleting(sessionId);
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      await fetchSessions();
      alert('✅ Séance supprimée !');
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const getCategoryColor = (categoryArray: string[]) => {
    const colors = {
      'loisir': { backgroundColor: '#e0f2fe', color: '#0277bd' },
      'competition': { backgroundColor: '#fce4ec', color: '#c2185b' },
      'jeunes': { backgroundColor: '#e8f5e8', color: '#388e3c' },
      'seniors': { backgroundColor: '#fff3e0', color: '#f57c00' },
      'veterans': { backgroundColor: '#f3e5f5', color: '#7b1fa2' }
    };
    
    if (categoryArray.length === 0) return { backgroundColor: '#f5f5f5', color: '#757575' };
    return colors[categoryArray[0] as keyof typeof colors] || { backgroundColor: '#e3f2fd', color: '#1976d2' };
  };

  const getCategoryLabel = (categorySlug: string) => {
    const category = categories.find(cat => cat.slug === categorySlug);
    return category?.name || categorySlug;
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { locale: fr }),
    end: endOfWeek(currentWeek, { locale: fr })
  });

  const getSessionsForDay = (day: Date) => {
    return sessions.filter(session => 
      isSameDay(new Date(session.date), day)
    );
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
        {/* 🎨 HEADER AMÉLIORÉ */}
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
                      Semaine du {format(startOfWeek(currentWeek, { locale: fr }), 'dd MMMM yyyy', { locale: fr })}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {sessions.length} séance{sessions.length > 1 ? 's' : ''} programmée{sessions.length > 1 ? 's' : ''}
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

        {/* 🎨 VUE CALENDRIER AMÉLIORÉE */}
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

            {/* Contenu des jours */}
            <div className="grid grid-cols-7 min-h-[500px]">
              {weekDays.map((day) => {
                const daySessions = getSessionsForDay(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div
                    key={day.toISOString()}
                    className={`p-3 border-r border-gray-200 last:border-r-0 border-b transition-colors ${
                      isToday ? 'bg-gradient-to-br from-indigo-50 to-purple-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="space-y-2 h-full">
                      {daySessions.map((session) => (
                        <div
                          key={session.id}
                          className="group cursor-pointer"
                          onClick={() => setViewingSession(session)}
                        >
                          <div
                            className="p-3 rounded-lg border border-gray-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
                            style={{ ...getCategoryColor(session.category), borderLeftWidth: '4px', borderLeftColor: getCategoryColor(session.category).color }}
                          >
                            <div className="font-semibold text-sm mb-1 truncate">
                              {session.title}
                            </div>
                            
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium opacity-80">
                                {session.start_time} - {session.end_time}
                              </span>
                              
                              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingSession(session);
                                  }}
                                  className="p-1 hover:bg-white/50 rounded transition-colors"
                                  title="Voir détails"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
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
                            
                            <div className="space-y-1 text-xs opacity-70">
                              <div className="flex items-center space-x-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{session.location}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Users className="w-3 h-3" />
                                <span>{session.coach}</span>
                              </div>
                            </div>

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

        {/* 🎨 VUE LISTE AMÉLIORÉE */}
        {viewMode === 'list' && (
          <div className="space-y-6">
            {sessions.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Aucun entraînement programmé
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Créez votre première séance d'entraînement pour commencer à organiser vos activités.
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Créer ma première séance
                </button>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300">
                  <div className="p-8">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-6">
                          <h3 className="text-2xl font-bold text-gray-900">{session.title}</h3>
                          <div className="flex flex-wrap gap-2">
                            {session.category.map((cat) => (
                              <span
                                key={cat}
                                className="px-3 py-1 rounded-full text-sm font-semibold shadow-sm"
                                style={getCategoryColor([cat])}
                              >
                                {getCategoryLabel(cat)}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
                        
                        {session.description && (
                          <div className="bg-gray-50 rounded-xl p-6 mb-6">
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                              📝 Description
                            </h4>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{session.description}</p>
                          </div>
                        )}
                        
                        {session.max_participants && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3 inline-flex">
                            <Users className="w-4 h-4" />
                            <span>Maximum {session.max_participants} participants</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col space-y-2 ml-6">
                        <button
                          onClick={() => setViewingSession(session)}
                          className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                          title="Voir détails"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setEditingSession(session)}
                          className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
                          title="Modifier"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => duplicateSession(session)}
                          className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all duration-200"
                          title="Dupliquer"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteSession(session.id)}
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
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 🎨 STATISTIQUES */}
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
                  <Users className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Coachs actifs</p>
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
                <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-7 h-7 text-purple-600" />
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

        {/* 🎨 MODAL AJOUT - DESIGN AMÉLIORÉ */}
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

              <form onSubmit={(e) => {
                e.preventDefault();
                createSession();
              }} className="p-8">
                <div className="space-y-8">
                  {/* Informations principales */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                      📋 Informations principales
                    </h4>
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                          placeholder="ex: Entraînement Seniors"
                        />
                      </div>

                      <div>
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

                    <div className="mt-6">
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

                  {/* Date et horaires */}
                  <div className="bg-blue-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                      🗓️ Planning
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={newSession.date}
                          onChange={(e) => setNewSession(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
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
                    </div>
                  </div>

                  {/* Lieu et catégories */}
                  <div className="bg-green-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                      📍 Lieu et catégories
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Lieu de la séance *
                        </label>
                        <input
                          type="text"
                          required
                          value={newSession.location}
                          onChange={(e) => setNewSession(prev => ({ ...prev, location: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                          placeholder="ex: Gymnase Municipal"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nombre max de participants
                        </label>
                        <input
                          type="number"
                          value={newSession.max_participants}
                          onChange={(e) => setNewSession(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 20 }))}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                          min="1"
                          max="100"
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Catégories concernées *
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className="relative flex items-center space-x-2 p-3 rounded-xl border-2 border-gray-200 hover:border-green-300 cursor-pointer transition-all duration-200"
                          >
                            <input
                              type="checkbox"
                              checked={newSession.category.includes(category.slug)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewSession(prev => ({
                                    ...prev,
                                    category: [...prev.category, category.slug]
                                  }));
                                } else {
                                  setNewSession(prev => ({
                                    ...prev,
                                    category: prev.category.filter(cat => cat !== category.slug)
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{category.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {creating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

        {/* 🎨 MODAL ÉDITION - DESIGN IDENTIQUE */}
        {editingSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">✏️ Modifier la Séance</h3>
                    <p className="opacity-90">Modifiez les informations de la séance</p>
                  </div>
                  <button
                    onClick={() => setEditingSession(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                updateSession();
              }} className="p-8">
                <div className="space-y-8">
                  {/* Informations principales */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                      📋 Informations principales
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Titre de la séance *
                        </label>
                        <input
                          type="text"
                          required
                          value={editingSession.title}
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                        />
                      </div>

                      <div>
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

                    <div className="mt-6">
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

                  {/* Date et horaires */}
                  <div className="bg-blue-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                      🗓️ Planning
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={editingSession.date}
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
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
                          value={editingSession.end_time}
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, end_time: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lieu et catégories */}
                  <div className="bg-green-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                      📍 Lieu et catégories
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Lieu de la séance *
                        </label>
                        <input
                          type="text"
                          required
                          value={editingSession.location}
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, location: e.target.value }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Nombre max de participants
                        </label>
                        <input
                          type="number"
                          value={editingSession.max_participants}
                          onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, max_participants: parseInt(e.target.value) || 20 }) : null)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200"
                          min="1"
                          max="100"
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Catégories concernées *
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className="relative flex items-center space-x-2 p-3 rounded-xl border-2 border-gray-200 hover:border-green-300 cursor-pointer transition-all duration-200"
                          >
                            <input
                              type="checkbox"
                              checked={editingSession.category.includes(category.slug)}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setEditingSession(prev => {
                                  if (!prev) return null;
                                  if (isChecked) {
                                    return {
                                      ...prev,
                                      category: [...prev.category, category.slug]
                                    };
                                  } else {
                                    return {
                                      ...prev,
                                      category: prev.category.filter(cat => cat !== category.slug)
                                    };
                                  }
                                });
                              }}
                              className="w-4 h-4 text-green-600 border-2 border-gray-300 rounded focus:ring-green-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{category.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEditingSession(null)}
                    className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {updating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Modification...</span>
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

        {/* 🎨 MODAL VISUALISATION - DESIGN AMÉLIORÉ */}
        {viewingSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">👁️ {viewingSession.title}</h3>
                    <p className="opacity-90">Détails de la séance d'entraînement</p>
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
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                    <h4 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                      🏐 Catégories concernées
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {viewingSession.category.map((cat) => (
                        <div
                          key={cat}
                          className="px-6 py-3 rounded-full font-bold shadow-md border-2"
                          style={{
                            ...getCategoryColor([cat]),
                            borderColor: getCategoryColor([cat]).color
                          }}
                        >
                          {getCategoryLabel(cat)}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  {viewingSession.description && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6">
                      <h4 className="font-bold text-gray-800 mb-4 text-lg flex items-center">
                        📝 Description
                      </h4>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg">
                          {viewingSession.description}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Participants */}
                  {viewingSession.max_participants && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
                      <h4 className="font-bold text-gray-800 mb-4 text-lg flex items-center">
                        👥 Participation
                      </h4>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-gray-700 text-lg">
                          <span className="font-bold text-purple-600">{viewingSession.max_participants}</span> participants maximum
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setViewingSession(null);
                      setEditingSession(viewingSession);
                    }}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold"
                  >
                    <Edit className="w-5 h-5" />
                    <span>Modifier cette séance</span>
                  </button>
                  <button
                    onClick={() => {
                      setViewingSession(null);
                      duplicateSession(viewingSession);
                    }}
                    className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold"
                  >
                                        <Copy className="w-5 h-5" />
                    <span>Dupliquer</span>
                  </button>
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
    );
};

export default TrainingCalendar;
