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

interface Category {
  id: number;
  name: string;
  color: string;
  icon?: string;
}

const TrainingCalendar: React.FC = () => {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

  // 🔄 CHARGEMENT DES CATÉGORIES DEPUIS LA BDD
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

  // 🔄 CHARGEMENT DES SÉANCES
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .order('date', { ascending: true });
      
      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des séances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSessions();
  }, []);

  // 🎨 FONCTIONS UTILITAIRES COULEURS
  const getCategoryColor = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    return category ? category.color : '#6366f1';
  };

  const getCategoryById = (categoryName: string) => {
    return categories.find(cat => cat.name === categoryName);
  };

  // 📅 FONCTIONS DE NAVIGATION
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const goToPreviousWeek = () => setCurrentWeek(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeek(prev => addWeeks(prev, 1));
  const goToToday = () => setCurrentWeek(new Date());

  // 📊 STATISTIQUES
  const totalSessions = sessions.length;
  const thisWeekSessions = sessions.filter(session => {
    const sessionDate = new Date(session.date);
    return sessionDate >= weekStart && sessionDate <= weekEnd;
  }).length;
  const uniqueCoaches = new Set(sessions.map(s => s.coach)).size;
  const totalCategories = categories.length;

  // 🔄 RESET FORMULAIRE
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

  // ➕ CRÉATION DE SÉANCE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sessionData = {
        ...newSession,
        max_participants: newSession.max_participants ? parseInt(newSession.max_participants) : null
      };

      const { error } = await supabase
        .from('training_sessions')
        .insert([sessionData]);

      if (error) throw error;

      await fetchSessions();
      setShowAddForm(false);
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert('Erreur lors de la création de la séance');
    }
  };

  // ✏️ MODIFICATION DE SÉANCE
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    try {
      const { error } = await supabase
        .from('training_sessions')
        .update({
          title: editingSession.title,
          date: editingSession.date,
          start_time: editingSession.start_time,
          end_time: editingSession.end_time,
          location: editingSession.location,
          coach: editingSession.coach,
          category: editingSession.category,
          description: editingSession.description,
          max_participants: editingSession.max_participants
        })
        .eq('id', editingSession.id);

      if (error) throw error;

      await fetchSessions();
      setEditingSession(null);
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert('Erreur lors de la modification de la séance');
    }
  };

  // 🗑️ SUPPRESSION DE SÉANCE
  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette séance ?')) return;

    try {
      setDeleting(id);
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de la séance');
    } finally {
      setDeleting(null);
    }
  };

  // 📋 DUPLICATION DE SÉANCE
  const handleDuplicate = async (session: TrainingSession) => {
    try {
      const duplicatedSession = {
        title: `${session.title} (Copie)`,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        location: session.location,
        coach: session.coach,
        category: session.category,
        description: session.description,
        max_participants: session.max_participants
      };

      const { error } = await supabase
        .from('training_sessions')
        .insert([duplicatedSession]);

      if (error) throw error;

      await fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
      alert('Erreur lors de la duplication de la séance');
    }
  };

  // 📅 SÉANCES PAR JOUR
  const getSessionsForDay = (day: Date) => {
    return sessions.filter(session => 
      format(new Date(session.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* 🎯 HEADER PREMIUM */}
        <div className="bg-white rounded-2xl shadow-xl mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-6 lg:mb-0">
                <h1 className="text-4xl font-bold mb-2">Calendrier des Entraînements</h1>
                <p className="text-indigo-100 text-lg">Gérez vos séances d'entraînement efficacement</p>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex bg-white bg-opacity-20 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-4 py-2 rounded-md transition-all ${
                      viewMode === 'calendar' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-white hover:bg-white hover:bg-opacity-20'
                    }`}
                  >
                    <Grid className="w-4 h-4 inline mr-2" />
                    Calendrier
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-md transition-all ${
                      viewMode === 'list' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-white hover:bg-white hover:bg-opacity-20'
                    }`}
                  >
                    <List className="w-4 h-4 inline mr-2" />
                    Liste
                  </button>
                </div>
                
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl flex items-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Nouvelle séance</span>
                </button>
              </div>
            </div>
          </div>

          {/* 📊 STATISTIQUES */}
          <div className="p-8 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Séances</p>
                    <p className="text-3xl font-bold">{totalSessions}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Cette Semaine</p>
                    <p className="text-3xl font-bold">{thisWeekSessions}</p>
                  </div>
                  <Clock className="w-8 h-8 text-green-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Coaches</p>
                    <p className="text-3xl font-bold">{uniqueCoaches}</p>
                  </div>
                  <Users className="w-8 h-8 text-purple-200" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Catégories</p>
                    <p className="text-3xl font-bold">{totalCategories}</p>
                  </div>
                  <Grid className="w-8 h-8 text-orange-200" />
                </div>
              </div>
            </div>
          </div>

          {/* 🗓️ NAVIGATION SEMAINE */}
          {viewMode === 'calendar' && (
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={goToPreviousWeek}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                  </button>
                  
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800">
                      {format(weekStart, 'dd MMM', { locale: fr })} - {format(weekEnd, 'dd MMM yyyy', { locale: fr })}
                    </h2>
                    <p className="text-gray-600">
                      Semaine {format(currentWeek, 'w', { locale: fr })}
                    </p>
                  </div>
                  
                  <button
                    onClick={goToNextWeek}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
                
                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
                >
                  Aujourd'hui
                </button>
              </div>

              {/* 📅 GRILLE CALENDRIER */}
              <div className="grid grid-cols-7 gap-4">
                {weekDays.map((day) => {
                  const daySession = getSessionsForDay(day);
                  const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={`bg-gray-50 rounded-xl p-4 min-h-[200px] ${
                        isToday ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''
                      }`}
                    >
                      <div className="mb-3">
                        <div className={`text-sm font-medium ${isToday ? 'text-indigo-700' : 'text-gray-600'}`}>
                          {format(day, 'EEEE', { locale: fr })}
                        </div>
                        <div className={`text-xl font-bold ${isToday ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {daySession.map((session) => (
                          <div
                            key={session.id}
                            className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => setViewingSession(session)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
                                {session.title}
                              </h4>
                              <div className="flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingSession(session);
                                  }}
                                  className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSession(session);
                                  }}
                                  className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(session);
                                  }}
                                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(session.id);
                                  }}
                                  disabled={deleting === session.id}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex items-center text-xs text-gray-600">
                                <Clock className="w-3 h-3 mr-1" />
                                {session.start_time} - {session.end_time}
                              </div>
                              <div className="flex items-center text-xs text-gray-600">
                                <MapPin className="w-3 h-3 mr-1" />
                                {session.location}
                              </div>
                              <div className="flex items-center text-xs text-gray-600">
                                <Users className="w-3 h-3 mr-1" />
                                {session.coach}
                              </div>
                            </div>
                            
                            {session.category.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {session.category.slice(0, 2).map((cat, index) => (
                                  <span
                                    key={index}
                                    className="inline-block w-2 h-2 rounded-full"
                                    style={{ backgroundColor: getCategoryColor(cat) }}
                                  />
                                ))}
                                {session.category.length > 2 && (
                                  <span className="text-xs text-gray-500">+{session.category.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 📋 VUE LISTE */}
        {viewMode === 'list' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Toutes les séances</h2>
              
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{session.title}</h3>
                          <div className="flex space-x-1">
                            {session.category.slice(0, 3).map((cat, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: getCategoryColor(cat) }}
                              >
                                {cat}
                              </span>
                            ))}
                            {session.category.length > 3 && (
                              <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-medium">
                                +{session.category.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            {format(new Date(session.date), 'dd/MM/yyyy')}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2" />
                            {session.start_time} - {session.end_time}
                          </div>
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2" />
                            {session.location}
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2" />
                            {session.coach}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => setViewingSession(session)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
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
                          onClick={() => handleDuplicate(session)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(session.id)}
                          disabled={deleting === session.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {sessions.length === 0 && (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-500 mb-2">Aucune séance trouvée</h3>
                    <p className="text-gray-400">Commencez par créer votre première séance d'entraînement</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 🎯 MODAL CRÉATION - DESIGN ORIGINAL */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">Nouvelle séance d'entraînement</h3>
                    <p className="text-indigo-100">Créez une nouvelle séance pour votre planning</p>
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

              <form onSubmit={handleSubmit} className="p-8">
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                        placeholder="Ex: Yoga matinal, HIIT avancé..."
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
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
                        placeholder="Ex: Salle 1, Gymnase, Extérieur..."
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                        placeholder="Nom du coach"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nombre maximum de participants
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newSession.max_participants}
                        onChange={(e) => setNewSession(prev => ({ ...prev, max_participants: e.target.value }))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                        placeholder="Ex: 20"
                      />
                    </div>
                  </div>

                  {/* 🎨 SÉLECTION CATÉGORIES DYNAMIQUES */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">
                      Catégories
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {categories.map((category) => (
                        <label
                          key={category.id}
                          className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                            newSession.category.includes(category.name)
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newSession.category.includes(category.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewSession(prev => ({
                                  ...prev,
                                  category: [...prev.category, category.name]
                                }));
                              } else {
                                setNewSession(prev => ({
                                  ...prev,
                                  category: prev.category.filter(c => c !== category.name)
                                }));
                              }
                            }}
                            className="sr-only"
                          />
                          <div
                            className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {category.name}
                          </span>
                          {newSession.category.includes(category.name) && (
                            <div className="absolute top-2 right-2">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                    {categories.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Grid className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 mb-2">Aucune catégorie disponible</p>
                        <p className="text-sm text-gray-400">
                          Créez des catégories dans les paramètres pour pouvoir les sélectionner ici
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      value={newSession.description}
                      onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 resize-none"
                      placeholder="Description détaillée de la séance..."
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
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-800 transition-all font-semibold shadow-lg hover:shadow-xl"
                  >
                    Créer la séance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ✏️ MODAL ÉDITION */}
        {editingSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">Modifier la séance</h3>
                    <p className="text-orange-100">Modifiez les détails de la séance d'entraînement</p>
                  </div>
                  <button
                    onClick={() => setEditingSession(null)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdate} className="p-8">
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
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
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, start_time: e.target.value } : null)}
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
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, end_time: e.target.value } : null)}
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
                        onChange={(e) => setEditingSession(prev => prev ? { ...prev, location: e.target.value } : null)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
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
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nombre maximum de participants
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editingSession.max_participants || ''}
                        onChange={(e) => setEditingSession(prev => prev ? { 
                          ...prev, 
                          max_participants: e.target.value ? parseInt(e.target.value) : undefined 
                        } : null)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* 🎨 SÉLECTION CATÉGORIES POUR ÉDITION */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">
                      Catégories
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {categories.map((category) => (
                        <label
                          key={category.id}
                          className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                            editingSession.category.includes(category.name)
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={editingSession.category.includes(category.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingSession(prev => prev ? {
                                  ...prev,
                                  category: [...prev.category, category.name]
                                } : null);
                              } else {
                                setEditingSession(prev => prev ? {
                                  ...prev,
                                  category: prev.category.filter(c => c !== category.name)
                                } : null);
                              }
                            }}
                            className="sr-only"
                          />
                          <div
                            className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {category.name}
                          </span>
                          {editingSession.category.includes(category.name) && (
                            <div className="absolute top-2 right-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      value={editingSession.description}
                      onChange={(e) => setEditingSession(prev => prev ? { ...prev, description: e.target.value } : null)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200 resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setEditingSession(null)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all font-semibold shadow-lg hover:shadow-xl"
                  >
                    Mettre à jour
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 👁️ MODAL VISUALISATION */}
        {viewingSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{viewingSession.title}</h3>
                    <p className="text-indigo-100">Détails de la séance d'entraînement</p>
                  </div>
                  <button
                    onClick={() => setViewingSession(null)}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Date</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {format(new Date(viewingSession.date), 'dd MMMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Horaires</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {viewingSession.start_time} - {viewingSession.end_time}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Lieu</p>
                        <p className="text-lg font-semibold text-gray-900">{viewingSession.location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Coach</p>
                        <p className="text-lg font-semibold text-gray-900">{viewingSession.coach}</p>
                      </div>
                    </div>

                    {viewingSession.max_participants && (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                          <Users className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Participants max</p>
                          <p className="text-lg font-semibold text-gray-900">{viewingSession.max_participants}</p>
                        </div>
                      </div>
                    )}

                    {viewingSession.category.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-3">Catégories</p>
                        <div className="flex flex-wrap gap-2">
                          {viewingSession.category.map((cat, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 rounded-full text-sm font-medium text-white"
                              style={{ backgroundColor: getCategoryColor(cat) }}
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {viewingSession.description && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Description</h4>
                    <div className="bg-gray-50 rounded-xl p-6">
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
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all font-semibold flex items-center space-x-2 shadow-lg hover:shadow-xl"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Modifier</span>
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
    </div>
  );
};




export { TrainingCalendar };
export default TrainingCalendar;

