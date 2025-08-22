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
    start_time: '',
    end_time: '',
    location: '',
    coach: '',
    category: [] as string[],
    description: '',
    max_participants: ''
  });

  // 🎨 Fonction pour les couleurs des catégories (ORIGINALE)
  const getCategoryColor = (categories: string[]) => {
    const colorMap: { [key: string]: string } = {
      'baby': 'bg-pink-100 text-pink-800 border-pink-200',
      'poussin': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'benjamin': 'bg-orange-100 text-orange-800 border-orange-200',
      'minime': 'bg-green-100 text-green-800 border-green-200',
      'cadet': 'bg-blue-100 text-blue-800 border-blue-200',
      'junior': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'senior': 'bg-purple-100 text-purple-800 border-purple-200',
      'veteran': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    return categories.length > 0 ? colorMap[categories[0]] || 'bg-gray-100 text-gray-800 border-gray-200' : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Fonctions de données (IDENTIQUES À L'ORIGINAL)
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
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

  const createSession = async () => {
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .insert([{
          title: newSession.title,
          date: newSession.date,
          start_time: newSession.start_time,
          end_time: newSession.end_time,
          location: newSession.location,
          coach: newSession.coach,
          category: newSession.category,
          description: newSession.description,
          max_participants: newSession.max_participants ? parseInt(newSession.max_participants) : null
        }])
        .select();
      
      if (error) throw error;
      
      setNewSession({
        title: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '',
        end_time: '',
        location: '',
        coach: '',
        category: [],
        description: '',
        max_participants: ''
      });
      setShowAddForm(false);
      fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
    }
  };

  const updateSession = async () => {
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
          max_participants: editingSession.max_participants || null
        })
        .eq('id', editingSession.id);
      
      if (error) throw error;
      
      setEditingSession(null);
      fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
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
      fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setDeleting(null);
    }
  };

  const duplicateSession = async (session: TrainingSession) => {
    try {
      const { error } = await supabase
        .from('training_sessions')
        .insert([{
          title: `${session.title} (copie)`,
          date: session.date,
          start_time: session.start_time,
          end_time: session.end_time,
          location: session.location,
          coach: session.coach,
          category: session.category,
          description: session.description,
          max_participants: session.max_participants
        }]);
      
      if (error) throw error;
      fetchSessions();
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
    }
  };

  // Navigation semaine
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - DESIGN AMÉLIORÉ */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-2xl p-8 shadow-lg border border-primary-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <div className="bg-primary-600 p-2 rounded-xl">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <span>Calendrier des entraînements</span>
          </h2>
          <div className="flex items-center space-x-4">
            {/* Toggle vue - DESIGN AMÉLIORÉ */}
            <div className="flex bg-white rounded-xl p-1 shadow-md border border-gray-200">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center space-x-2 ${
                  viewMode === 'calendar' 
                    ? 'bg-primary-600 text-white shadow-md transform scale-105' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Calendrier</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center space-x-2 ${
                  viewMode === 'list' 
                    ? 'bg-primary-600 text-white shadow-md transform scale-105' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Liste</span>
              </button>
            </div>
            
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Nouvelle séance</span>
            </button>
          </div>
        </div>

        {/* Navigation semaine - DESIGN AMÉLIORÉ */}
        {viewMode === 'calendar' && (
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={() => setCurrentWeek(prev => subWeeks(prev, 1))}
              className="p-3 bg-white rounded-xl shadow-md hover:shadow-lg text-gray-600 hover:text-primary-600 transition-all duration-200 hover:scale-110"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold text-gray-800 bg-white px-6 py-3 rounded-xl shadow-md">
              Semaine du {format(weekStart, 'd', { locale: fr })} au {format(weekEnd, 'd MMMM yyyy', { locale: fr })}
            </h3>
            
            <button
              onClick={() => setCurrentWeek(prev => addWeeks(prev, 1))}
              className="p-3 bg-white rounded-xl shadow-md hover:shadow-lg text-gray-600 hover:text-primary-600 transition-all duration-200 hover:scale-110"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Vue Calendrier - DESIGN AMÉLIORÉ */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 gap-0 border-b border-gray-200">
            {weekDays.map((day) => {
              const daySessions = sessions.filter(session => session.date === format(day, 'yyyy-MM-dd'));
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              
              return (
                <div key={day.toString()} className={`min-h-[200px] border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-primary-50' : 'bg-white'}`}>
                  <div className={`p-4 border-b border-gray-200 ${isToday ? 'bg-primary-600 text-white' : 'bg-gray-50'}`}>
                    <div className="text-center">
                      <div className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-gray-600'}`}>
                        {format(day, 'EEEE', { locale: fr })}
                      </div>
                      <div className={`text-xl font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-2">
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
                        className="group bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all duration-200 cursor-pointer hover:from-primary-50 hover:to-primary-100 hover:border-primary-200"
                        onClick={() => setViewingSession(session)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-800">
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

                        <div className="mt-2 flex flex-wrap gap-1">
                          {session.category.map((cat) => (
                            <span
                              key={cat}
                              className={`px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor([cat])}`}
                            >
                              {cat}
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

      {/* Vue Liste - DESIGN AMÉLIORÉ */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-12 text-center border border-gray-200">
              <div className="bg-gray-200 rounded-full p-4 w-20 h-20 mx-auto mb-6">
                <Calendar className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Aucun entraînement programmé
              </h3>
              <p className="text-gray-600">
                Créez votre première séance d'entraînement.
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{session.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        {session.category.map((cat) => (
                          <span
                            key={cat}
                            className={`px-3 py-1 rounded-full text-sm font-semibold border ${getCategoryColor([cat])}`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-primary-600" />
                        <span>{format(new Date(session.date), 'EEEE dd MMMM yyyy', { locale: fr })}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-primary-600" />
                        <span>{session.start_time} - {session.end_time}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-primary-600" />
                        <span>{session.location}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-primary-600" />
                        <span>Coach: {session.coach}</span>
                      </div>
                    </div>
                    
                    {session.description && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">{session.description}</p>
                    )}
                    
                    {session.max_participants && (
                      <p className="text-xs text-gray-500 bg-blue-50 text-blue-700 rounded-lg px-3 py-1 inline-block">
                        Maximum {session.max_participants} participants
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => setViewingSession(session)}
                      className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                      title="Voir détails"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setEditingSession(session)}
                      className="p-3 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200"
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
            ))
          )}
        </div>
      )}

      {/* Modal d'ajout de séance - DESIGN AMÉLIORÉ */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Plus className="w-6 h-6" />
                  <span>Nouvelle séance d'entraînement</span>
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              createSession();
            }} className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Lieu *
                    </label>
                    <input
                      type="text"
                      required
                      value={newSession.location}
                      onChange={(e) => setNewSession(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                      placeholder="Gymnase Municipal"
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
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                      placeholder="20"
                    />
                  </div>
                </div>

                {/* CATÉGORIES ORIGINALES */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">
                    Catégories concernées *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['baby', 'poussin', 'benjamin', 'minime', 'cadet', 'junior', 'senior', 'veteran'].map(cat => (
                      <label key={cat} className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                        newSession.category.includes(cat)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          checked={newSession.category.includes(cat)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSession(prev => ({ ...prev, category: [...prev.category, cat] }));
                            } else {
                              setNewSession(prev => ({ ...prev, category: prev.category.filter(c => c !== cat) }));
                            }
                          }}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center transition-colors ${
                          newSession.category.includes(cat)
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300'
                        }`}>
                          {newSession.category.includes(cat) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700 capitalize">{cat}</span>
                      </label>
                    ))}
                  </div>
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
                    disabled={newSession.category.length === 0}
                    className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl"
                  >
                    Créer la séance
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de modification - DESIGN AMÉLIORÉ */}
      {editingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Edit className="w-6 h-6" />
                  <span>Modifier la séance</span>
                </h3>
                <button
                  onClick={() => setEditingSession(null)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              updateSession();
            }} className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingSession.description || ''}
                    onChange={(e) => setEditingSession(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre maximum de participants
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingSession.max_participants || ''}
                      onChange={(e) => setEditingSession(prev => prev ? { ...prev, max_participants: parseInt(e.target.value) || undefined } : null)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* CATÉGORIES ORIGINALES */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">
                    Catégories concernées *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['baby', 'poussin', 'benjamin', 'minime', 'cadet', 'junior', 'senior', 'veteran'].map(cat => (
                      <label key={cat} className={`relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                        editingSession.category.includes(cat)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          checked={editingSession.category.includes(cat)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingSession(prev => prev ? { ...prev, category: [...prev.category, cat] } : null);
                            } else {
                              setEditingSession(prev => prev ? { ...prev, category: prev.category.filter(c => c !== cat) } : null);
                            }
                          }}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded border-2 mr-3 flex items-center justify-center transition-colors ${
                          editingSession.category.includes(cat)
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300'
                        }`}>
                          {editingSession.category.includes(cat) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700 capitalize">{cat}</span>
                      </label>
                    ))}
                  </div>
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
                    className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all font-semibold shadow-lg hover:shadow-xl"
                  >
                    Sauvegarder
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de visualisation - DESIGN AMÉLIORÉ */}
      {viewingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center space-x-3">
                  <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <span>{viewingSession.title}</span>
                </h3>
                <button
                  onClick={() => setViewingSession(null)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Informations principales */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <div className="bg-primary-100 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-primary-600" />
                  </div>
                  <span>Informations générales</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Date</span>
                    <p className="text-lg font-bold text-gray-900 mt-1">{format(new Date(viewingSession.date), 'EEEE dd MMMM yyyy', { locale: fr })}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Horaires</span>
                    <p className="text-lg font-bold text-gray-900 mt-1">{viewingSession.start_time} - {viewingSession.end_time}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Lieu</span>
                    <p className="text-lg font-bold text-gray-900 mt-1">{viewingSession.location}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Coach</span>
                    <p className="text-lg font-bold text-gray-900 mt-1">{viewingSession.coach}</p>
                  </div>
                </div>
              </div>

              {/* Catégories */}
              <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6 border border-primary-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <div className="bg-primary-600 p-2 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <span>Catégories concernées</span>
                </h4>
                <div className="flex flex-wrap gap-3">
                  {viewingSession.category.map((cat) => (
                    <span
                      key={cat}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 capitalize shadow-sm ${getCategoryColor([cat])}`}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              {viewingSession.description && (
                <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
                    <div className="bg-amber-500 p-2 rounded-lg">
                      <Edit className="w-5 h-5 text-white" />
                    </div>
                    <span>Description</span>
                  </h4>
                  <div className="bg-white rounded-lg p-4 border border-amber-200">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{viewingSession.description}</p>
                  </div>
                </div>
              )}

              {/* Participants */}
              {viewingSession.max_participants && (
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center space-x-2">
                    <div className="bg-green-600 p-2 rounded-lg">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <span>Participants</span>
                  </h4>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <p className="text-lg font-semibold text-gray-700">Maximum {viewingSession.max_participants} participants</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setViewingSession(null);
                    setEditingSession(viewingSession);
                  }}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white py-3 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all font-semibold shadow-lg hover:shadow-xl"
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


export { TrainingCalendar };
export default TrainingCalendar;

