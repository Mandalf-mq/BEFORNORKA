import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, Edit, Trash2, Eye, Copy, Grid, List, Save, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TrainingSession {
  id: string;
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string[];
  coach: string;
  max_participants?: number;
  season_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  value: string;
  label: string;
  color: string;
  is_active: boolean;
  display_order: number;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  member_id: string;
  status: string;
  response_date?: string;
}

interface Season {
  id: string;
  name: string;
  is_current: boolean;
}

export const TrainingCalendar: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [memberData, setMemberData] = useState<any>(null);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

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

  // Vérifier les permissions
  const canManageTrainings = userProfile?.role && ['webmaster', 'administrateur', 'entraineur'].includes(userProfile.role);
  const isMember = userProfile?.role === 'member';

  useEffect(() => {
    initializeData();
  }, [user, userProfile]);

  useEffect(() => {
    if (categories.length > 0) {
      loadSessions();
    }
  }, [currentWeek, categories, memberData]);

  useEffect(() => {
    if (memberData && sessions.length > 0 && isMember) {
      loadAttendanceRecords();
    }
  }, [memberData, sessions, isMember]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCategories(),
        loadCurrentSeason(),
        isMember ? loadMemberData() : Promise.resolve()
      ]);
    } catch (error) {
      console.error('Erreur initialisation:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      setCategories([]);
    }
  };

  const loadCurrentSeason = async () => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_current', true)
        .maybeSingle();

      if (error) throw error;
      setCurrentSeason(data);
    } catch (error) {
      console.error('Erreur chargement saison:', error);
    }
  };

  const loadMemberData = async () => {
    try {
      if (!user) return;

      const { data: member, error } = await supabase
        .from('members')
        .select(`
          id, 
          category,
          status,
          member_categories (
            id,
            category_value,
            is_primary
          )
        `)
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
      setMemberData(member);
    } catch (error) {
      console.error('Erreur chargement membre:', error);
    }
  };

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

      // Filtrer selon le rôle
      const filteredSessions = getFilteredSessions(data || []);
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      setSessions([]);
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      if (!memberData) return;

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('member_id', memberData.id);

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (error) {
      console.error('Erreur chargement présences:', error);
    }
  };

  const getFilteredSessions = (allSessions: TrainingSession[]) => {
    if (!isMember || !memberData) {
      return allSessions; // Admin/Coach voient tout
    }

    // Pour les membres, filtrer selon leurs catégories
    const memberCategories = memberData.member_categories?.map((mc: any) => mc.category_value) || [];
    if (memberData.category && !memberCategories.includes(memberData.category)) {
      memberCategories.push(memberData.category);
    }

    return allSessions.filter(session => 
      session.category.some(cat => memberCategories.includes(cat))
    );
  };

  const createSession = async () => {
    if (!newSession.title.trim() || !newSession.date || !newSession.start_time || !newSession.end_time || !newSession.location.trim() || !newSession.coach.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (newSession.category.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie');
      return;
    }

    try {
      setCreating(true);

      console.log('🆕 [TrainingCalendar] Création nouvelle session');
      console.log('🏷️ [TrainingCalendar] Catégories sélectionnées:', newSession.category);

      const sessionData = {
        title: newSession.title.trim(),
        description: newSession.description.trim() || null,
        date: newSession.date,
        start_time: newSession.start_time,
        end_time: newSession.end_time,
        location: newSession.location.trim(),
        category: newSession.category,
        coach: newSession.coach.trim(),
        max_participants: newSession.max_participants,
        season_id: currentSeason?.id || null,
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
      await loadSessions();
      alert('✅ Séance créée avec succès !');

    } catch (error: any) {
      console.error('Erreur création session:', error);
      alert(`❌ Erreur lors de la création: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const updateSession = async () => {
    if (!editingSession) return;

    if (!editingSession.title.trim() || !editingSession.date || !editingSession.start_time || !editingSession.end_time || !editingSession.location.trim() || !editingSession.coach.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
      console.log('🔄 [TrainingCalendar] Mise à jour session:', editingSession.id);
      console.log('🏷️ [TrainingCalendar] Nouvelles catégories:', newSession.category);

    }

    if (editingSession.category.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie');
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('training_sessions')
        .update({
          title: editingSession.title.trim(),
          description: editingSession.description?.trim() || null,
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

      console.log('✅ [TrainingCalendar] Session mise à jour avec succès');
      
      setEditingSession(null);
      await loadSessions();
      alert('✅ Séance modifiée avec succès !');

    } catch (error: any) {
      console.error('Erreur mise à jour session:', error);
      alert(`❌ Erreur lors de la mise à jour: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette session ?')) {
      return;
    }

    try {
      setDeleting(sessionId);
      
      console.log('🗑️ [TrainingCalendar] Suppression session:', sessionId);

      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      console.log('✅ [TrainingCalendar] Session supprimée avec succès');
      await loadSessions();
      alert('✅ Séance supprimée avec succès !');
    } catch (error: any) {
      console.error('Erreur suppression session:', error);
      alert(`❌ Erreur lors de la suppression: ${error.message}`);
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

  const respondToSession = async (sessionId: string, response: 'present' | 'absent') => {
    try {
      if (!memberData) return;

      setResponding(sessionId);

      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: sessionId,
          member_id: memberData.id,
          status: response,
          response_date: new Date().toISOString()
        }, {
          onConflict: 'session_id,member_id'
        });

      if (error) throw error;

      console.log('✅ [TrainingCalendar] Session créée avec succès');
      
      await loadAttendanceRecords();
      
      const responseText = response === 'present' ? 'présent' : 'absent';
      alert(`✅ Réponse enregistrée : ${responseText}`);
    } catch (error: any) {
      console.error('Erreur lors de la réponse:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setResponding(null);
    }
  };

  const getCategoryColor = (sessionCategories: string[]) => {
    if (sessionCategories.length === 0) return { backgroundColor: '#6366f1', color: '#ffffff' };
    
    const category = categories.find(cat => 
      sessionCategories.includes(cat.value)
    );
    return {
      backgroundColor: category?.color || '#6366f1',
      color: '#ffffff'
    };
  };

  const getCategoryLabel = (categoryValue: string) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category?.label || categoryValue;
  };

  const getAttendanceForSession = (sessionId: string) => {
    return attendanceRecords.find(record => record.session_id === sessionId);
  };

  // Navigation semaine
  const goToPreviousWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const goToToday = () => setCurrentWeek(new Date());

  // Obtenir les jours de la semaine
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des entraînements...</p>
        </div>
      </div>
    );
  }

  // Vue membre non validé
  if (isMember && memberData?.status !== 'season_validated') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Dossier en cours de validation
          </h2>
          <p className="text-yellow-700 mb-4">
            Vous devez avoir un dossier complet et validé pour accéder aux entraînements.
          </p>
          <div className="bg-yellow-100 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">📋 Prochaines étapes</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>1. Complétez l'upload de vos documents</p>
              <p>2. Attendez la validation par un administrateur</p>
              <p>3. Une fois validé, vous accéderez aux entraînements</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec contrôles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isMember ? '🏐 Mes Entraînements' : '📅 Calendrier d\'entraînement'}
          </h2>
          <p className="text-gray-600 mt-1">
            Semaine du {format(weekDays[0], 'dd MMM', { locale: fr })} au {format(weekDays[6], 'dd MMM yyyy', { locale: fr })}
          </p>
          {isMember && memberData && (
            <p className="text-sm text-primary-600 mt-1">
              Vos catégories : {memberData.member_categories?.map((mc: any) => 
                getCategoryLabel(mc.category_value)
              ).join(', ') || getCategoryLabel(memberData.category)}
            </p>
          )}
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

      {/* Vue calendrier */}
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
                  {daySessions.map((session) => {
                    const attendance = isMember ? getAttendanceForSession(session.id) : null;
                    
                    return (
                      <div
                        key={session.id}
                        className="p-3 rounded-lg cursor-pointer hover:shadow-md transition-shadow text-sm group"
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
                        
                        {/* Statut de présence pour les membres */}
                        {isMember && attendance && (
                          <div className="text-xs mt-2 bg-white/20 rounded px-2 py-1">
                            {attendance.status === 'present' ? '✅ Présent' : '❌ Absent'}
                          </div>
                        )}
                        
                        {/* Actions rapides admin */}
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
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vue liste */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {sessions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">Aucune session cette semaine</h3>
              <p>Aucune session d'entraînement prévue pour cette période.</p>
              {canManageTrainings && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer une séance</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions.map((session) => {
                const attendance = isMember ? getAttendanceForSession(session.id) : null;
                
                return (
                  <div key={session.id} className="p-6 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Titre + Catégories */}
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                          <div className="flex space-x-1">
                            {session.category.map((cat) => (
                              <span
                                key={cat}
                                className="px-2 py-1 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: categories.find(c => c.value === cat)?.color || '#6366f1' }}
                              >
                                {getCategoryLabel(cat)}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Infos principales */}
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

                        {/* Description */}
                        {session.description && (
                          <p className="text-sm text-gray-700 line-clamp-2">{session.description}</p>
                        )}

                        {/* Statut de présence pour les membres */}
                        {isMember && attendance && (
                          <div className="mt-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              attendance.status === 'present' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {attendance.status === 'present' ? '✅ Présent confirmé' : '❌ Absent confirmé'}
                            </span>
                            <span className="ml-2 text-xs text-gray-500">
                              le {format(new Date(attendance.response_date!), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                            </span>
                          </div>
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal création */}
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

              {/* Sélection catégories */}
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

      {/* Modal modification */}
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

              {/* Sélection catégories pour modification */}
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

      {/* Modal visualisation */}
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

              {/* Actions pour membres */}
              {isMember && memberData && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">✋ Votre présence</h4>
                  {(() => {
                    const attendance = getAttendanceForSession(viewingSession.id);
                    const hasResponded = attendance !== undefined;
                    
                    if (hasResponded) {
                      return (
                        <div className="text-center">
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                            attendance.status === 'present' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {attendance.status === 'present' ? '✅ Présent confirmé' : '❌ Absent confirmé'}
                          </span>
                          <p className="text-xs text-gray-500 mt-2">
                            Réponse enregistrée le {format(new Date(attendance.response_date!), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => respondToSession(viewingSession.id, 'present')}
                          disabled={responding === viewingSession.id}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                        >
                          {responding === viewingSession.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Users className="w-4 h-4" />
                              <span>Je serai présent</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => respondToSession(viewingSession.id, 'absent')}
                          disabled={responding === viewingSession.id}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          <span>Je serai absent</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Actions admin */}
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