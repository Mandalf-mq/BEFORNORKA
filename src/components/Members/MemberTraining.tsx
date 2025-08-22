import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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

export const MemberTraining: React.FC = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    fetchMemberData();
  }, []);

  useEffect(() => {
    if (memberData) {
      fetchTrainingSessions();
      fetchAttendanceRecords();
    }
  }, [memberData]);

const fetchMemberData = async () => {
  try {
    if (!user) return;

    // ✅ BONNE VERSION - sans relation vers categories
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

      // Récupérer TOUTES les séances futures et filtrer côté client
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // Filtrer les séances qui incluent la catégorie du membre
      const filteredSessions = (data || []).filter(session => 
        session.category && session.category.includes(memberData.category)
      );
      
      setSessions(filteredSessions);
    } catch (error) {
      console.error('Erreur lors du chargement des entraînements:', error);
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
    } finally {
      setLoading(false);
    }
  };

  const respondToSession = async (sessionId: string, response: 'present' | 'absent') => {
    try {
      if (!memberData) return;

      setResponding(sessionId);

      // Créer ou mettre à jour l'enregistrement de présence
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

      await fetchAttendanceRecords();
      
      const responseText = response === 'present' ? 'présent' : 'absent';
      alert(`✅ Réponse enregistrée : ${responseText}`);
    } catch (error: any) {
      console.error('Erreur lors de la réponse:', error);
      alert(`❌ Erreur lors de l'enregistrement: ${error.message}`);
    } finally {
      setResponding(null);
    }
  };

  const getAttendanceForSession = (sessionId: string) => {
    return attendanceRecords.find(record => record.session_id === sessionId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-600" />;
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
          Entraînements programmés pour votre catégorie : <span className="font-semibold text-primary-600">
  {memberData?.member_categories?.length > 0 
    ? memberData.member_categories
        .sort((a, b) => b.is_primary ? 1 : -1) // Primary en premier
        .map(mc => mc.category_value)
        .join(' - ')
    : memberData?.category || 'Aucune catégorie'
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
          <p className="text-gray-600">
            Aucun entraînement n'est actuellement programmé pour votre catégorie.
          </p>
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

                  {!hasResponded ? (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => respondToSession(session.id, 'present')}
                        disabled={responding === session.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
                      >
                        {responding === session.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        <span>Présent</span>
                      </button>
                      <button
                        onClick={() => respondToSession(session.id, 'absent')}
                        disabled={responding === session.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Absent</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Réponse enregistrée le {format(new Date(attendance.response_date!), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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