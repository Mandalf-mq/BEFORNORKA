import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, Edit, Trash2, Eye, Copy, Grid, List, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
    category: ['senior'],
    coach: '',
    max_participants: 20
  });

  // ✅ FONCTIONS CORRIGÉES
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
      setSessions(data || []);
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
      // Fallback vers les catégories par défaut
      setCategories([
        { value: 'baby', label: 'Baby Volley', color: '#3b82f6' },
        { value: 'poussin', label: 'Poussin', color: '#10b981' },
        { value: 'benjamin', label: 'Benjamin', color: '#f59e0b' },
        { value: 'minime', label: 'Minime', color: '#8b5cf6' },
        { value: 'cadet', label: 'Cadet', color: '#ef4444' },
        { value: 'junior', label: 'Junior', color: '#ec4899' },
        { value: 'senior', label: 'Senior', color: '#06b6d4' },
        { value: 'veteran', label: 'Vétéran', color: '#84cc16' }
      ]);
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
      
      setNewSession({
        title: '',
        description: '',
        date: '',
        start_time: '',
        end_time: '',
        location: '',
        category: ['senior'],
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

  // ✅ FONCTION UPDATESSESSION MANQUANTE AJOUTÉE
  const updateSession = async () => {
    try {
      if (!editingSession) return;
      
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
      console.error('Erreur lors de la mise à jour:', error);
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

  // ✅ FONCTIONS POUR LES CATÉGORIES
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

  useEffect(() => {
    fetchSessions();
    fetchCategories();
  }, [currentWeek]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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

            {/* Bouton ajouter */}
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {/* Navigation semaine */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Semaine précédente</span>
          </button>
          
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              {format(weekStart, 'd MMMM', { locale: fr })} - {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
            </h3>
          </div>
          
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span>Semaine suivante</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Vue Calendrier */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {weekDays.map((day) => {
              const daySessions = sessions.filter(session => isSameDay(new Date(session.date), day));
              const isToday = isSameDay(day, new Date());
              
              return (
                <div key={day.toString()} className={`bg-white min-h-[200px] p-3 ${isToday ? 'bg-blue-50' : ''}`}>
                  <div className={`text-center mb-3 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                    <div className="text-sm font-medium">
                      {format(day, 'EEEE', { locale: fr })}
                    </div>
                    <div className={`text-lg ${isToday ? 'bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1' : ''}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => setViewingSession(session)}
                        className="p-2 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm leading-tight group-hover:text-primary-600 transition-colors">
                            {session.title}
                          </h4>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

                        {/* ✅ AFFICHAGE CORRIGÉ DES CATÉGORIES */}
                        <div className="mt-2 flex flex-wrap gap-1">
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
                    ))}
                    
                    {daySessions.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Aucun entraînement</p>
                      </div>
                    )}
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
          {sessions.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucun entraînement programmé
              </h3>
              <p className="text-gray-600">
                Créez votre première séance d'entraînement.
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
                      <p className="text-xs text-gray-500 mt-2">
                        Maximum {session.max_participants} participants
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setViewingSession(session)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingSession(session)}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicateSession(session)}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="Dupliquer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      disabled={deleting === session.id}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      {deleting === session.id ? (
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal d'ajout */}
      {showAddForm && (
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
                    placeholder="Entraînement Seniors"
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
                    Heure de début *
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
                    Heure de fin *
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
                    placeholder="Gymnase municipal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de participants max
                  </label>
                  <input
                    type="number"
                    value={newSession.max_participants}
                    onChange={(e) => setNewSession(prev => ({ ...prev, max_participants: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    placeholder="20"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégories *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {categories.map((category) => (
                    <label key={category.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSession.category.includes(category.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSession(prev => ({
                              ...prev,
                              category: [...prev.category, category.value]
                            }));
                          } else {
                            setNewSession(prev => ({
                              ...prev,
                              category: prev.category.filter(c => c !== category.value)
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{category.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newSession.description}
                  onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  rows={3}
                  placeholder="Description de la séance..."
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl transition-colors font-semibold flex items-center space-x-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Création...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Créer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de modification */}
      {editingSession && (
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
                    onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
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
                    onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, coach: e.target.value }) : null)}
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
                    onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure de début *
                  </label>
                  <input
                    type="time"
                    required
                    value={editingSession.start_time}
                    onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, start_time: e.target.value }) : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Heure de fin *
                  </label>
                  <input
                    type="time"
                    required
                    value={editingSession.end_time}
                    onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, end_time: e.target.value }) : null)}
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
                    onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, location: e.target.value }) : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de participants max
                  </label>
                  <input
                    type="number"
                    value={editingSession.max_participants || ''}
                    onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, max_participants: parseInt(e.target.value) || undefined }) : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégories *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {categories.map((category) => (
                    <label key={category.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingSession.category.includes(category.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingSession(prev => prev ? ({
                              ...prev,
                              category: [...prev.category, category.value]
                            }) : null);
                          } else {
                            setEditingSession(prev => prev ? ({
                              ...prev,
                              category: prev.category.filter(c => c !== category.value)
                            }) : null);
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{category.label}</span>
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
                  onChange={(e) => setEditingSession(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl transition-colors font-semibold flex items-center space-x-2"
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

      {/* Modal de visualisation */}
      {viewingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
            
            <div className="space-y-6">
              {/* Informations principales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Date et heure
                  </h4>
                  <p className="text-blue-700 font-medium">
                    {format(new Date(viewingSession.date), 'EEEE dd MMMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-blue-600">
                    {viewingSession.start_time} - {viewingSession.end_time}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                  <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Lieu
                  </h4>
                  <p className="text-green-700 font-medium">{viewingSession.location}</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                  <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Coach
                  </h4>
                  <p className="text-purple-700 font-medium">{viewingSession.coach}</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
                  <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Participants
                  </h4>
                  <p className="text-orange-700 font-medium">
                    {viewingSession.max_participants ? `Max ${viewingSession.max_participants}` : 'Illimité'}
                  </p>
                </div>
              </div>

              {/* Catégories */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-3">🏐 Catégories concernées</h4>
                <div className="flex flex-wrap gap-2">
                  {viewingSession.category.map((cat) => (
                    <span
                      key={cat}
                      className="px-4 py-2 rounded-full text-sm font-medium"
                      style={getCategoryColor([cat])}
                    >
                      {getCategoryLabel(cat)}
                    </span>
                  ))}
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
                <button
                  onClick={() => {
                    setViewingSession(null);
                    setEditingSession(viewingSession);
                  }}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-3 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all font-semibold shadow-lg hover:shadow-xl"
                >
                  <Edit className="w-5 h-5" />
                  <span>Modifier</span>
                </button>
                <button
                  onClick={() => {
                    setViewingSession(null);
                    duplicateSession(viewingSession);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl flex items-center justify-center space-x-2 transition-all font-semibold shadow-lg hover:shadow-xl"
                >
                  <Copy className="w-5 h-5" />
                  <span>Dupliquer</span>
                </button>
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
