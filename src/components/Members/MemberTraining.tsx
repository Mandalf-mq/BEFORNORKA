import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, AlertCircle, Eye, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  status: string;
  response_date?: string;
}

interface MemberData {
  id: string;
  category: string;
  status: string;
  member_categories?: Array<{
    id: string;
    category_value: string;
    is_primary: boolean;
  }>;
}

interface Category {
  id: string;
  value: string;
  label: string;
  color: string;
}

export const MemberTraining: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<TrainingSession | null>(null);

  useEffect(() => {
    initializeData();
  }, [user]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await loadCategories();
      await fetchMemberData();
    } catch (error) {
      console.error('Erreur initialisation:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberData && categories.length > 0) {
      fetchTrainingSessions();
      fetchAttendanceRecords();
    } else if (memberData) {
      // Même si les catégories ne sont pas encore chargées, essayer de charger les sessions
      console.log('⚠️ [MemberTraining] Chargement sessions sans catégories complètes');
      fetchTrainingSessions();
      fetchAttendanceRecords();
    }
  }, [memberData, categories]);

  // Écouter les changements en temps réel sur les training_sessions
  useEffect(() => {
    if (!memberData) return;

    console.log('🔄 [MemberTraining] Mise en place de la subscription temps réel');
    
    const channel = supabase
      .channel('training_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_sessions'
        },
        (payload) => {
          console.log('🔄 [MemberTraining] Changement détecté sur training_sessions:', payload);
          // Recharger les sessions quand il y a un changement
          fetchTrainingSessions();
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 [MemberTraining] Nettoyage subscription');
      supabase.removeChannel(channel);
    };
  }, [memberData]);

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

  const fetchMemberData = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
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
      
      if (!data) {
        console.log('Aucun profil membre trouvé pour cet utilisateur');
        setMemberData(null);
        return;
      }
      
      setMemberData(data);
    } catch (error) {
      console.error('Erreur lors du chargement du membre:', error);
    }
  };

  const fetchTrainingSessions = async () => {
    try {
      if (!memberData) return;

      console.log('🔍 [MemberTraining] Chargement des sessions pour membre:', memberData.id);
      
      // Récupérer les catégories du membre (principale + supplémentaires)
      const { data: memberCategoriesData, error: memberCatError } = await supabase
        .from('member_categories')
        .select('category_value')
        .eq('member_id', memberData.id);

      if (memberCatError) {
        console.error('Erreur chargement catégories membre:', memberCatError);
        // Continuer avec la catégorie principale seulement
      }

      // Construire la liste des catégories du membre
      const memberCategories = memberCategoriesData?.map(mc => mc.category_value) || [];
      
      console.log('🏷️ [MemberTraining] Catégories du membre:', memberCategories);
      
      // Si aucune catégorie trouvée, afficher un message d'erreur
      if (memberCategories.length === 0) {
        console.log('⚠️ [MemberTraining] Aucune catégorie trouvée pour ce membre');
        setSessions([]);
        return;
      }

      // Récupérer toutes les séances futures
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      console.log('📅 [MemberTraining] Sessions trouvées:', data?.length || 0);
      console.log('📅 [MemberTraining] Sessions détails:', data?.map(s => ({ 
        title: s.title, 
        categories: s.category,
        date: s.date 
      })));
      
      // Filtrer les séances selon les catégories du membre avec logging détaillé
      const filteredSessions = (data || []).filter(session => {
        const sessionCategories = session.category || [];
        const hasMatchingCategory = sessionCategories.some(cat => memberCategories.includes(cat));
        
        console.log(`🔍 [MemberTraining] Session "${session.title}":`, {
          sessionCategories,
          memberCategories,
          hasMatchingCategory,
          sessionDate: session.date,
          sessionTime: `${session.start_time}-${session.end_time}`
        });
        
        return hasMatchingCategory;
      });
      
      console.log('✅ [MemberTraining] Sessions filtrées pour le membre:', filteredSessions.length);
      console.log('✅ [MemberTraining] Sessions filtrées détails:', filteredSessions.map(s => s.title));
      
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Erreur lors du chargement des entraînements:', error);
      setSessions([]);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      if (!memberData) return;

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('member_id', memberData.id);

      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des présences:', error);
    }
  };

  const respondToSession = async (sessionId: string, response: 'present' | 'absent' | 'maybe') => {
    try {
      if (!memberData) return;

      setResponding(sessionId);

      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: sessionId,
          member_id: memberData.id,
          status: response as 'present' | 'absent' | 'maybe',
          response_date: new Date().toISOString()
        }, {
          onConflict: 'session_id,member_id'
        });

      if (error) throw error;

      await fetchAttendanceRecords();
      
      const responseText = response === 'present' ? 'présent' : 
                          response === 'absent' ? 'absent' : 'peut-être';
      alert(`✅ Réponse enregistrée : ${responseText}`);
    } catch (error: any) {
      console.error('Erreur lors de la réponse:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setResponding(null);
    }
  };

  const getAttendanceForSession = (sessionId: string) => {
    return attendanceRecords.find(record => record.session_id === sessionId);
  };

  const getCategoryLabel = (categoryValue: string) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category?.label || categoryValue;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'maybe':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'absent':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'maybe':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement de vos entraînements...</p>
      </div>
    );
  }

  // Si l'utilisateur n'a pas de profil membre
  if (!memberData) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-blue-800 mb-2">
            Section réservée aux membres
          </h2>
          <p className="text-blue-700">
            Cette section est réservée aux membres inscrits du club. Si vous êtes un administrateur, utilisez les autres sections de gestion.
          </p>
        </div>
      </div>
    );
  }

  // Vérifier si le membre est validé pour voir les entraînements
  if (memberData?.status !== 'season_validated') {
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
              <p>3. Une fois votre dossier complet validé, vous accéderez aux entraînements</p>
              <p>4. Vous pourrez alors confirmer votre présence aux séances</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🏐 Mes Entraînements
        </h1>
        <p className="text-gray-600">
          Entraînements programmés pour vos catégories : 
          <span className="font-semibold text-primary-600 ml-1">
            {memberData?.member_categories?.length > 0 
              ? memberData.member_categories
                  .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
                  .map(mc => getCategoryLabel(mc.category_value))
                  .join(' • ')
              : 'Aucune catégorie assignée'
            }
          </span>
        </p>
      </div>

      {/* Liste des entraînements */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aucun entraînement programmé
          </h3>
          <div className="space-y-2">
            <p className="text-gray-600">
              Aucun entraînement n'est actuellement programmé pour vos catégories.
            </p>
            {memberData?.member_categories?.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <p className="text-yellow-800 text-sm">
                  ⚠️ <strong>Aucune catégorie assignée</strong><br/>
                  Contactez un administrateur pour vous assigner des catégories d'entraînement.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const attendance = getAttendanceForSession(session.id);
            const hasResponded = attendance !== undefined;
            
            return (
              <div key={session.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                    {session.description && (
                      <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
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
                  
                  {hasResponded && (
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(attendance.status)}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(attendance.status)}`}>
                        {attendance.status === 'present' ? 'Présent' : 'Absent'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(session.date), 'EEEE dd MMMM yyyy', { locale: fr })}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{session.start_time} - {session.end_time}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{session.location}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>Coach: {session.coach}</span>
                    {session.max_participants && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                        Max: {session.max_participants}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setViewingSession(session)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Voir détails"
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    {/* Boutons de réponse rapide - toujours visibles */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => respondToSession(session.id, 'present')}
                        disabled={responding === session.id}
                        className={`px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors disabled:opacity-50 text-sm ${
                          attendance?.status === 'present'
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                        }`}
                      >
                        {responding === session.id ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        <span>Présent</span>
                      </button>
                      
                      <button
                        onClick={() => respondToSession(session.id, 'maybe')}
                        disabled={responding === session.id}
                        className={`px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors disabled:opacity-50 text-sm ${
                          attendance?.status === 'maybe'
                            ? 'bg-yellow-600 text-white shadow-md'
                            : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300'
                        }`}
                      >
                        <AlertCircle className="w-3 h-3" />
                        <span>Peut-être</span>
                      </button>
                      
                      <button
                        onClick={() => respondToSession(session.id, 'absent')}
                        disabled={responding === session.id}
                        className={`px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors disabled:opacity-50 text-sm ${
                          attendance?.status === 'absent'
                            ? 'bg-red-600 text-white shadow-md'
                            : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
                        }`}
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Absent</span>
                      </button>
                    </div>
                    
                    {/* Affichage du statut actuel */}
                    {hasResponded && (
                      <div className="text-xs text-gray-500">
                        Répondu le {format(new Date(attendance.response_date!), 'dd/MM', { locale: fr })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de détails */}
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

              {/* Actions de présence */}
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
                            <CheckCircle className="w-4 h-4" />
                            <span>Je serai présent</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => respondToSession(viewingSession.id, 'absent')}
                        disabled={responding === viewingSession.id}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Je serai absent</span>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Bouton fermer */}
              <div className="flex justify-end pt-6 border-t border-gray-200">
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

      {/* Statistiques */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Entraînements</p>
                <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Présences</p>
                <p className="text-2xl font-bold text-gray-900">
                  {attendanceRecords.filter(r => r.status === 'present').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Absences</p>
                <p className="text-2xl font-bold text-gray-900">
                  {attendanceRecords.filter(r => r.status === 'absent').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};