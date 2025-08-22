import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Copy, Phone, Calendar, Clock, MapPin, User, RefreshCw, Send, Target, BarChart3, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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

interface WhatsAppContact {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  category: string;
  additional_categories: string[];
}

export const WhatsAppManager: React.FC = () => {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pollMessage, setPollMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'standard' | 'urgent' | 'match'>('standard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSessions(),
        fetchCategories(),
        fetchContacts(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Erreur initialisation WhatsApp Manager:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
      setSessions([]);
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
      console.error('Erreur chargement catégories:', error);
      setCategories([]);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase.rpc('get_members_for_whatsapp', {
        p_categories: selectedCategories.length > 0 ? selectedCategories : null
      });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
      setContacts([]);
    }
  };

  const fetchStats = async () => {
    try {
      // Statistiques simples depuis les membres
      const { data: membersData, error } = await supabase
        .from('members')
        .select('phone, status')
        .eq('status', 'season_validated');

      if (error) throw error;

      const totalMembers = membersData?.length || 0;
      const membersWithPhone = membersData?.filter(m => m.phone && m.phone.trim() !== '').length || 0;
      const coverageRate = totalMembers > 0 ? Math.round((membersWithPhone / totalMembers) * 100) : 0;

      setStats({
        total_members: totalMembers,
        members_with_phone: membersWithPhone,
        coverage_rate: coverageRate
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      setStats({
        total_members: 0,
        members_with_phone: 0,
        coverage_rate: 0
      });
    }
  };

  const generatePollMessage = (session: TrainingSession, type: string = 'standard') => {
    const categoryLabels = session.category
      .map(cat => categories.find(c => c.value === cat)?.label || cat)
      .join(' • ');

    const dateFormatted = format(new Date(session.date), 'EEEE dd MMMM yyyy', { locale: fr });
    
    switch (type) {
      case 'urgent':
        return `🚨 URGENT - BE FOR NOR KA

⚡ Entraînement exceptionnel : ${session.title}
📅 AUJOURD'HUI ${dateFormatted}
⏰ ${session.start_time} - ${session.end_time}
📍 ${session.location}
👨‍🏫 Coach: ${session.coach}

${session.description || 'Entraînement exceptionnel'}

⚠️ RÉPONSE RAPIDE DEMANDÉE :
✅ PRÉSENT
❌ ABSENT
🤔 PEUT-ÊTRE

Merci ! 🏐`;

      case 'match':
        return `🏆 BE FOR NOR KA - MATCH OFFICIEL

🆚 ${session.title}
📅 ${dateFormatted}
⏰ ${session.start_time} - ${session.end_time}
📍 ${session.location}
👨‍🏫 Coach: ${session.coach}
🏷️ ${categoryLabels}

${session.description || 'Match officiel'}

⚠️ PRÉSENCE OBLIGATOIRE
Confirmez RAPIDEMENT :
✅ PRÉSENT
❌ ABSENT (avec justification)

Allez-y les champions ! 🏐💪`;

      default: // standard
        return `🏐 BE FOR NOR KA - Sondage Entraînement

📅 ${dateFormatted}
⏰ ${session.start_time} - ${session.end_time}
📍 ${session.location}
👨‍🏫 Coach: ${session.coach}
🏷️ ${categoryLabels}

${session.description || 'Entraînement régulier'}

Confirmez votre présence :
✅ PRÉSENT
❌ ABSENT  
🤔 PEUT-ÊTRE

Merci ! 🏐

---
BE FOR NOR KA - Association de Volleyball`;
    }
  };

  const createPollForSession = () => {
    if (!selectedSession) {
      alert('Veuillez sélectionner un entraînement');
      return;
    }

    const session = sessions.find(s => s.id === selectedSession);
    if (!session) {
      alert('Entraînement non trouvé');
      return;
    }

    const message = generatePollMessage(session, messageType);
    setPollMessage(message);

    alert(`✅ Sondage créé pour "${session.title}" !

📅 ${format(new Date(session.date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
👥 ${contacts.length} membres concernés
📱 Message prêt à poster dans votre canal WhatsApp !

💡 Copiez le message ci-dessous et postez-le dans votre groupe.`);
  };

  const copyMessageToClipboard = () => {
    if (pollMessage) {
      navigator.clipboard.writeText(pollMessage);
      alert('📋 Message copié dans le presse-papiers !\n\nVous pouvez maintenant le coller dans votre canal WhatsApp.');
    } else {
      alert('Aucun message à copier. Créez d\'abord un sondage.');
    }
  };

  const scheduleAllDailyPolls = () => {
    const upcomingSessions = sessions.filter(s => {
      const sessionDate = new Date(s.date);
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      return sessionDate >= today && sessionDate <= nextWeek;
    });

    if (upcomingSessions.length === 0) {
      alert('Aucun entraînement programmé dans les 7 prochains jours.');
      return;
    }

    const scheduleInfo = upcomingSessions.map(session => {
      const sessionDate = new Date(session.date);
      const sendTime = new Date(sessionDate);
      sendTime.setHours(8, 0, 0, 0);
      
      return {
        title: session.title,
        date: format(sessionDate, 'dd/MM', { locale: fr }),
        sendTime: format(sendTime, 'dd/MM à 08:00', { locale: fr })
      };
    });

    const scheduleText = scheduleInfo
      .map(info => `• ${info.title} (${info.date}) → Message prêt le ${info.sendTime}`)
      .join('\n');

    alert(`📅 Programmation pour les 7 prochains jours :

${scheduleText}

💡 Mode d'emploi quotidien :
1. Chaque matin à 8h, venez ici
2. Sélectionnez l'entraînement du jour
3. Copiez le message généré
4. Postez dans votre canal WhatsApp
5. Les membres répondent directement dans le canal

🔄 Simple et efficace !`);
  };

  const openWhatsAppWeb = () => {
    window.open('https://web.whatsapp.com', '_blank');
    alert('📱 WhatsApp Web ouvert !\n\nVous pouvez maintenant coller votre message dans le bon canal.');
  };

  useEffect(() => {
    if (selectedSession) {
      const session = sessions.find(s => s.id === selectedSession);
      if (session) {
        const message = generatePollMessage(session, messageType);
        setPollMessage(message);
      }
    }
  }, [selectedSession, messageType, sessions, categories]);

  useEffect(() => {
    fetchContacts();
  }, [selectedCategories]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement du gestionnaire WhatsApp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">📱 Gestionnaire WhatsApp</h1>
            <p className="text-green-100">
              Créez des sondages pour vos canaux WhatsApp
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {stats && (
              <div className="text-right">
                <p className="text-green-100 text-sm">Membres avec WhatsApp</p>
                <p className="text-2xl font-bold">{stats.members_with_phone}</p>
                <p className="text-xs text-green-200">Couverture : {stats.coverage_rate}%</p>
              </div>
            )}
            <button
              onClick={openWhatsAppWeb}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ouvrir WhatsApp Web</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total membres</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_members || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Phone className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avec WhatsApp</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.members_with_phone || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Contacts ciblés</p>
              <p className="text-2xl font-bold text-gray-900">{contacts.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Couverture</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.coverage_rate || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Générateur de sondage */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <span>Créer un sondage d'entraînement</span>
        </h2>

        <div className="space-y-6">
          {/* Sélection de l'entraînement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏐 Entraînement
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Sélectionner un entraînement...</option>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.title} - {format(new Date(session.date), 'dd/MM/yyyy', { locale: fr })} à {session.start_time}
                </option>
              ))}
            </select>
          </div>

          {/* Type de message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 Type de message
            </label>
            <div className="flex space-x-3">
              <button
                onClick={() => setMessageType('standard')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  messageType === 'standard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📅 Standard
              </button>
              <button
                onClick={() => setMessageType('urgent')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  messageType === 'urgent'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🚨 Urgent
              </button>
              <button
                onClick={() => setMessageType('match')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  messageType === 'match'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🏆 Match
              </button>
            </div>
          </div>

          {/* Filtrage par catégories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏷️ Catégories concernées (optionnel)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {categories.map(category => (
                <label key={category.id} className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCategories(prev => [...prev, category.value]);
                      } else {
                        setSelectedCategories(prev => prev.filter(c => c !== category.value));
                      }
                    }}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm">{category.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Laissez vide pour inclure tous les membres
            </p>
          </div>

          {/* Bouton de génération */}
          <button
            onClick={createPollForSession}
            disabled={!selectedSession}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>Générer le sondage</span>
          </button>
        </div>
      </div>

      {/* Aperçu du message */}
      {pollMessage && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">📱 Message à poster</h3>
            <div className="flex space-x-3">
              <button
                onClick={copyMessageToClipboard}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copier</span>
              </button>
              <button
                onClick={openWhatsAppWeb}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ouvrir WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Prévisualisation style WhatsApp */}
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="bg-green-500 text-white p-4 rounded-lg max-w-md ml-auto shadow-lg">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                {pollMessage}
              </pre>
            </div>
            <div className="text-xs text-gray-500 mt-2 text-right">
              {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ✓✓
            </div>
          </div>

          {/* Statistiques du message */}
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="text-lg font-bold text-gray-700">{pollMessage.length}</div>
                <div className="text-gray-500">Caractères</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-700">{pollMessage.split(' ').length}</div>
                <div className="text-gray-500">Mots</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-700">{contacts.length}</div>
                <div className="text-gray-500">Destinataires</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-700">{Math.ceil(pollMessage.split(' ').length / 200)}</div>
                <div className="text-gray-500">Min lecture</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Liste des contacts */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            👥 Membres concernés ({contacts.length})
          </h3>
          <button
            onClick={fetchContacts}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualiser</span>
          </button>
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-8">
            <Phone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucun contact disponible</p>
            <p className="text-xs text-gray-400 mt-1">
              Vérifiez que les membres ont des numéros de téléphone renseignés
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map(contact => (
              <div key={contact.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-sm text-gray-600">{contact.phone}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {categories.find(c => c.value === contact.category)?.label || contact.category}
                      </span>
                      {contact.additional_categories.map(cat => (
                        <span key={cat} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {categories.find(c => c.value === cat)?.label || cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions d'utilisation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-3">📋 Mode d'emploi</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p><strong>1. Sélectionnez un entraînement</strong> dans la liste ci-dessus</p>
          <p><strong>2. Choisissez le type</strong> : Standard / Urgent / Match</p>
          <p><strong>3. Cliquez "Générer le sondage"</strong> pour créer le message</p>
          <p><strong>4. Cliquez "Copier"</strong> pour copier le message</p>
          <p><strong>5. Postez dans votre canal WhatsApp</strong> du club</p>
          <p><strong>6. Les membres répondent</strong> directement : "PRÉSENT", "ABSENT", "PEUT-ÊTRE"</p>
        </div>
        
        <div className="mt-4 p-3 bg-blue-100 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Astuce :</strong> Utilisez le bouton "Programmer 7 jours" pour préparer tous les sondages de la semaine !
          </p>
        </div>
      </div>

      {/* Programmation automatique */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">⏰ Programmation automatique</h3>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-green-800 mb-2">🤖 Workflow quotidien suggéré</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>• <strong>8h00 :</strong> Venez sur cette page</p>
            <p>• <strong>8h05 :</strong> Sélectionnez l'entraînement du jour</p>
            <p>• <strong>8h10 :</strong> Copiez et postez le sondage dans votre canal</p>
            <p>• <strong>Toute la journée :</strong> Les membres répondent dans le canal</p>
            <p>• <strong>Avant l'entraînement :</strong> Vous avez toutes les réponses !</p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={scheduleAllDailyPolls}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>Voir la programmation 7 jours</span>
          </button>
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              const todaySession = sessions.find(s => s.date === today);
              if (todaySession) {
                setSelectedSession(todaySession.id);
                alert(`📅 Entraînement d'aujourd'hui sélectionné !\n\n"${todaySession.title}" à ${todaySession.start_time}`);
              } else {
                alert('Aucun entraînement programmé aujourd\'hui.');
              }
            }}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span>Entraînement du jour</span>
          </button>
        </div>
      </div>
    </div>
  );
};