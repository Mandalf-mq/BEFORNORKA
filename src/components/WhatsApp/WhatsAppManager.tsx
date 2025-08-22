import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Send, Copy, Phone, CheckCircle, XCircle, AlertCircle, Eye, Settings, TrendingUp, BarChart3, Clock, Zap, Target, Award, RefreshCw, Download, Upload, Link as LinkIcon, UserCheck, UserX, Calendar, Bell, Play, Pause, RotateCcw, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WhatsAppPoll {
  id: string;
  session_id: string;
  poll_title: string;
  poll_message: string;
  is_active: boolean;
  sent_at: string;
  scheduled_for: string;
  auto_send: boolean;
  total_sent: number;
  total_responses: number;
  response_rate: number;
  session_title: string;
  session_date: string;
  session_time: string;
}

interface PollResponse {
  id: string;
  member_name: string;
  response_text: string;
  response_status: string;
  confidence_score: number;
  responded_at: string;
  phone_number: string;
}

interface ScheduledMessage {
  id: string;
  session_title: string;
  session_date: string;
  session_time: string;
  scheduled_for: string;
  message_type: string;
  is_sent: boolean;
  sent_at: string;
}

interface AutomationRule {
  id: string;
  rule_name: string;
  rule_type: string;
  send_time_offset: string;
  is_active: boolean;
  execution_count: number;
  success_rate: number;
}

export const WhatsAppManager: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'polls' | 'automation' | 'responses' | 'scheduled'>('polls');
  const [polls, setPolls] = useState<WhatsAppPoll[]>([]);
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPollData, setNewPollData] = useState({
    session_id: '',
    template_type: 'standard',
    auto_schedule: true,
    send_immediately: false
  });

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchPolls(),
        fetchSessions(),
        fetchScheduledMessages(),
        fetchAutomationRules(),
        fetchPollStats()
      ]);
    } catch (error) {
      console.error('Erreur initialisation WhatsApp Manager:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPolls = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_polls')
        .select(`
          *,
          training_sessions (
            title,
            date,
            start_time
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const enrichedPolls = data?.map(poll => ({
        ...poll,
        session_title: poll.training_sessions?.title || 'Session supprimée',
        session_date: poll.training_sessions?.date || '',
        session_time: poll.training_sessions?.start_time || ''
      })) || [];
      
      setPolls(enrichedPolls);
    } catch (error) {
      console.error('Erreur chargement sondages:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
    }
  };

  const fetchScheduledMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_scheduled_messages')
        .select(`
          *,
          training_sessions (
            title,
            date,
            start_time
          )
        `)
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      
      const enrichedMessages = data?.map(msg => ({
        ...msg,
        session_title: msg.training_sessions?.title || 'Session supprimée',
        session_date: msg.training_sessions?.date || '',
        session_time: msg.training_sessions?.start_time || ''
      })) || [];
      
      setScheduledMessages(enrichedMessages);
    } catch (error) {
      console.error('Erreur chargement messages programmés:', error);
    }
  };

  const fetchAutomationRules = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_automation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAutomationRules(data || []);
    } catch (error) {
      console.error('Erreur chargement règles automation:', error);
    }
  };

  const fetchPollStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_poll_statistics');
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Erreur chargement stats sondages:', error);
    }
  };

  const fetchPollResponses = async (pollId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_poll_responses')
        .select(`
          *,
          members (
            first_name,
            last_name
          )
        `)
        .eq('poll_id', pollId)
        .order('responded_at', { ascending: false });

      if (error) throw error;
      
      const enrichedResponses = data?.map(response => ({
        ...response,
        member_name: `${response.members?.first_name} ${response.members?.last_name}`
      })) || [];
      
      setResponses(enrichedResponses);
    } catch (error) {
      console.error('Erreur chargement réponses:', error);
    }
  };

  const createTrainingPoll = async () => {
    try {
      if (!newPollData.session_id) {
        alert('Veuillez sélectionner un entraînement');
        return;
      }

      const { data, error } = await supabase.rpc('create_training_poll', {
        p_session_id: newPollData.session_id,
        p_auto_schedule: newPollData.auto_schedule
      });

      if (error) throw error;

      if (data.success) {
        alert(`✅ Sondage créé avec succès !
        
📊 ID: ${data.poll_id}
⏰ Programmé pour: ${new Date(data.scheduled_for).toLocaleString('fr-FR')}
📱 Le message sera envoyé automatiquement`);

        setShowCreatePoll(false);
        setNewPollData({
          session_id: '',
          template_type: 'standard',
          auto_schedule: true,
          send_immediately: false
        });
        await fetchPolls();
        await fetchScheduledMessages();
      } else {
        alert(`❌ Erreur: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erreur création sondage:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const scheduleAllTrainingPolls = async () => {
    try {
      const { data, error } = await supabase.rpc('schedule_daily_training_polls');
      if (error) throw error;

      alert(`✅ Programmation automatique activée !
      
📅 ${data.scheduled_count} sondages programmés
⏰ Envoi automatique à 8h chaque matin
🔄 Couvre les 7 prochains jours`);

      await fetchPolls();
      await fetchScheduledMessages();
    } catch (error: any) {
      console.error('Erreur programmation:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const generatePollLinks = async (pollId: string) => {
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return;

      // Récupérer les contacts pour cette session
      const session = sessions.find(s => s.id === poll.session_id);
      if (!session) return;

      const { data: contacts, error } = await supabase.rpc('get_whatsapp_contacts_validated', {
        p_categories: session.category
      });

      if (error) throw error;

      // Générer les liens avec le message du sondage
      const links = contacts
        .filter((contact: any) => contact.phone_valid && contact.has_consent)
        .map((contact: any) => {
          const encodedMessage = encodeURIComponent(poll.poll_message);
          return {
            contact: `${contact.first_name} ${contact.last_name}`,
            phone: contact.phone_formatted,
            url: `https://wa.me/${contact.phone_formatted}?text=${encodedMessage}`
          };
        });

      // Afficher les liens dans une nouvelle fenêtre ou modal
      const linksText = links.map(link => 
        `${link.contact}: ${link.url}`
      ).join('\n');

      navigator.clipboard.writeText(linksText);
      alert(`✅ ${links.length} liens générés et copiés !
      
📱 Collez dans votre gestionnaire de liens
🔗 Chaque lien ouvre WhatsApp avec le sondage pré-rempli
📊 Les réponses seront automatiquement synchronisées`);

    } catch (error: any) {
      console.error('Erreur génération liens:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const simulateWhatsAppResponse = async (pollId: string, phoneNumber: string, responseText: string) => {
    try {
      const { data, error } = await supabase.rpc('process_whatsapp_response', {
        p_phone_number: phoneNumber,
        p_response_text: responseText,
        p_session_id: polls.find(p => p.id === pollId)?.session_id
      });

      if (error) throw error;

      if (data.success) {
        alert(`✅ Réponse simulée traitée !
        
👤 ${data.member_name}
📱 Réponse: "${responseText}"
✅ Statut: ${data.response_status}
📊 Confiance: ${data.confidence_score}%
🔄 Synchronisé avec le site`);

        await fetchPollResponses(pollId);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error: any) {
      console.error('Erreur simulation réponse:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement du système de sondages WhatsApp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header principal */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">📱 Sondages WhatsApp Automatiques</h1>
            <p className="text-green-100">
              Système intelligent de sondages pour les entraînements
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {stats && (
              <div className="text-right">
                <p className="text-green-100 text-sm">Taux de réponse moyen</p>
                <p className="text-2xl font-bold">{Math.round(stats.avg_response_rate || 0)}%</p>
              </div>
            )}
            <button
              onClick={scheduleAllTrainingPolls}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Auto-programmer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('polls')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'polls'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Sondages ({polls.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'automation'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Automatisation</span>
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'responses'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Réponses ({responses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'scheduled'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Programmés ({scheduledMessages.length})</span>
          </button>
        </div>

        {/* Contenu des onglets */}
        <div className="p-6">
          {activeTab === 'polls' && (
            <div className="space-y-6">
              {/* Actions rapides */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">📊 Sondages d'entraînement</h3>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowCreatePoll(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Nouveau sondage</span>
                  </button>
                  <button
                    onClick={scheduleAllTrainingPolls}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Auto-programmer 7 jours</span>
                  </button>
                </div>
              </div>

              {/* Statistiques rapides */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{stats.total_polls}</div>
                    <div className="text-sm text-blue-600">Sondages créés</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{stats.total_responses}</div>
                    <div className="text-sm text-green-600">Réponses reçues</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-700">{Math.round(stats.avg_response_rate || 0)}%</div>
                    <div className="text-sm text-purple-600">Taux de réponse</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-700">{scheduledMessages.filter(m => !m.is_sent).length}</div>
                    <div className="text-sm text-orange-600">En attente</div>
                  </div>
                </div>
              )}

              {/* Liste des sondages */}
              <div className="space-y-4">
                {polls.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-8 text-center">
                    <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Aucun sondage créé
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Créez votre premier sondage d'entraînement
                    </p>
                    <button
                      onClick={() => setShowCreatePoll(true)}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Créer un sondage</span>
                    </button>
                  </div>
                ) : (
                  polls.map(poll => (
                    <div key={poll.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{poll.session_title}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span>📅 {format(new Date(poll.session_date), 'dd/MM/yyyy', { locale: fr })}</span>
                            <span>⏰ {poll.session_time}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              poll.sent_at ? 'bg-green-100 text-green-700' : 
                              poll.scheduled_for ? 'bg-blue-100 text-blue-700' : 
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {poll.sent_at ? '✅ Envoyé' : 
                               poll.scheduled_for ? '⏰ Programmé' : 
                               '📝 Brouillon'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          {/* Statistiques du sondage */}
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {poll.total_responses}/{poll.total_sent}
                            </div>
                            <div className="text-sm text-gray-600">
                              {Math.round(poll.response_rate || 0)}% réponses
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedPoll(poll.id);
                                fetchPollResponses(poll.id);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Voir les réponses"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            
                            {!poll.sent_at && (
                              <button
                                onClick={() => generatePollLinks(poll.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                              >
                                <Send className="w-4 h-4" />
                                <span>Générer liens</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Aperçu du message */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-2">📱 Aperçu du message</h5>
                        <div className="bg-green-500 text-white p-3 rounded-lg max-w-md">
                          <pre className="whitespace-pre-wrap text-sm font-sans">
                            {poll.poll_message.substring(0, 200)}
                            {poll.poll_message.length > 200 && '...'}
                          </pre>
                        </div>
                      </div>

                      {/* Programmation */}
                      {poll.scheduled_for && !poll.sent_at && (
                        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-700">
                              Programmé pour: <strong>{format(new Date(poll.scheduled_for), 'dd/MM/yyyy à HH:mm', { locale: fr })}</strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'automation' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">⚙️ Règles d'automatisation</h3>
                <button
                  onClick={scheduleAllTrainingPolls}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Activer auto-programmation</span>
                </button>
              </div>

              {/* Explication du système */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-semibold text-blue-800 mb-3">🤖 Comment ça marche</h4>
                <div className="text-sm text-blue-700 space-y-2">
                  <p>• <strong>Programmation automatique :</strong> Chaque matin à 8h, envoi du sondage pour l'entraînement du jour</p>
                  <p>• <strong>Réponses intelligentes :</strong> Les membres répondent directement dans le groupe WhatsApp</p>
                  <p>• <strong>Mots-clés reconnus :</strong> OUI/PRÉSENT/✅ = Présent | NON/ABSENT/❌ = Absent | PEUT-ÊTRE/🤔 = Incertain</p>
                  <p>• <strong>Synchronisation :</strong> Les réponses WhatsApp mettent automatiquement à jour le site</p>
                  <p>• <strong>Rappels :</strong> Message de rappel 30min avant pour les non-répondants</p>
                </div>
              </div>

              {/* Règles actives */}
              <div className="space-y-4">
                {automationRules.map(rule => (
                  <div key={rule.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{rule.rule_name}</h4>
                        <p className="text-sm text-gray-600">
                          Type: {rule.rule_type} • Décalage: {rule.send_time_offset}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>Exécuté {rule.execution_count} fois</span>
                          <span>Succès: {Math.round(rule.success_rate || 0)}%</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          rule.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {rule.is_active ? '✅ Actif' : '❌ Inactif'}
                        </span>
                        <button
                          onClick={() => {
                            // Toggle activation
                            supabase
                              .from('whatsapp_automation_rules')
                              .update({ is_active: !rule.is_active })
                              .eq('id', rule.id)
                              .then(() => fetchAutomationRules());
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {rule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'responses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">💬 Réponses aux sondages</h3>
                <select
                  value={selectedPoll}
                  onChange={(e) => {
                    setSelectedPoll(e.target.value);
                    if (e.target.value) {
                      fetchPollResponses(e.target.value);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Sélectionner un sondage...</option>
                  {polls.map(poll => (
                    <option key={poll.id} value={poll.id}>
                      {poll.session_title} - {format(new Date(poll.session_date), 'dd/MM', { locale: fr })}
                    </option>
                  ))}
                </select>
              </div>

              {/* Test de réponse */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-3">🧪 Tester une réponse WhatsApp</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Numéro (ex: 0612345678)"
                    className="px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    id="test-phone"
                  />
                  <input
                    type="text"
                    placeholder="Réponse (ex: OUI, NON, PEUT-ÊTRE)"
                    className="px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    id="test-response"
                  />
                  <button
                    onClick={() => {
                      const phone = (document.getElementById('test-phone') as HTMLInputElement)?.value;
                      const response = (document.getElementById('test-response') as HTMLInputElement)?.value;
                      if (phone && response && selectedPoll) {
                        simulateWhatsAppResponse(selectedPoll, phone, response);
                      } else {
                        alert('Veuillez remplir tous les champs et sélectionner un sondage');
                      }
                    }}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Tester</span>
                  </button>
                </div>
                <p className="text-xs text-yellow-700 mt-2">
                  Simulez une réponse WhatsApp pour tester la synchronisation
                </p>
              </div>

              {/* Réponses */}
              {selectedPoll && (
                <div className="space-y-3">
                  {responses.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Aucune réponse pour ce sondage</p>
                    </div>
                  ) : (
                    responses.map(response => (
                      <div key={response.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-600 font-semibold text-sm">
                                {response.member_name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{response.member_name}</p>
                              <p className="text-sm text-gray-600">
                                📱 {response.phone_number} • 
                                {format(new Date(response.responded_at), 'dd/MM à HH:mm', { locale: fr })}
                              </p>
                              <p className="text-xs text-gray-500">
                                Réponse: "{response.response_text}" • Confiance: {response.confidence_score}%
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              response.response_status === 'present' ? 'bg-green-100 text-green-700' :
                              response.response_status === 'absent' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {response.response_status === 'present' ? '✅ Présent' :
                               response.response_status === 'absent' ? '❌ Absent' :
                               '🤔 Peut-être'}
                            </span>
                            
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              response.confidence_score >= 90 ? 'bg-green-100 text-green-700' :
                              response.confidence_score >= 70 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {response.confidence_score}% sûr
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'scheduled' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">⏰ Messages programmés</h3>
                <button
                  onClick={() => {
                    supabase.rpc('send_scheduled_whatsapp_messages').then(({ data, error }) => {
                      if (error) throw error;
                      alert(`✅ ${data.sent_count} messages envoyés, ${data.error_count} erreurs`);
                      fetchScheduledMessages();
                    });
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Envoyer maintenant</span>
                </button>
              </div>

              {/* Messages programmés */}
              <div className="space-y-4">
                {scheduledMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Aucun message programmé</p>
                  </div>
                ) : (
                  scheduledMessages.map(message => (
                    <div key={message.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{message.session_title}</h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span>📅 Entraînement: {format(new Date(message.session_date), 'dd/MM à HH:mm', { locale: fr })}</span>
                            <span>⏰ Envoi: {format(new Date(message.scheduled_for), 'dd/MM à HH:mm', { locale: fr })}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              message.is_sent ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {message.is_sent ? '✅ Envoyé' : '⏰ En attente'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            message.message_type === 'poll' ? 'bg-blue-100 text-blue-700' :
                            message.message_type === 'reminder' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {message.message_type === 'poll' ? '📊 Sondage' :
                             message.message_type === 'reminder' ? '⏰ Rappel' :
                             message.message_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Instructions d'utilisation */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-semibold text-green-800 mb-3">📋 Mode d'emploi</h4>
                <div className="text-sm text-green-700 space-y-2">
                  <p><strong>1. Programmation automatique :</strong></p>
                  <p className="ml-4">• Cliquez sur "Auto-programmer 7 jours" pour créer tous les sondages</p>
                  <p className="ml-4">• Les sondages seront envoyés automatiquement à 8h chaque matin</p>
                  
                  <p><strong>2. Dans le groupe WhatsApp :</strong></p>
                  <p className="ml-4">• Postez le message de sondage dans le groupe</p>
                  <p className="ml-4">• Les membres répondent directement : "OUI", "NON", "PEUT-ÊTRE"</p>
                  
                  <p><strong>3. Synchronisation :</strong></p>
                  <p className="ml-4">• Utilisez l'outil de test pour simuler les réponses</p>
                  <p className="ml-4">• Les réponses mettent automatiquement à jour le site</p>
                  <p className="ml-4">• Les entraîneurs voient les présences en temps réel</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de création de sondage */}
      {showCreatePoll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">📊 Créer un sondage d'entraînement</h3>
              <button
                onClick={() => setShowCreatePoll(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Sélection de l'entraînement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏐 Entraînement concerné *
                </label>
                <select
                  value={newPollData.session_id}
                  onChange={(e) => setNewPollData(prev => ({ ...prev, session_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choisir un entraînement...</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.title} - {format(new Date(session.date), 'dd/MM/yyyy', { locale: fr })} à {session.start_time}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type de template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Type de message
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { value: 'standard', label: '🏐 Standard', desc: 'Entraînement régulier' },
                    { value: 'urgent', label: '🚨 Urgent', desc: 'Entraînement de dernière minute' },
                    { value: 'match', label: '🏆 Match', desc: 'Match officiel' }
                  ].map(type => (
                    <label key={type.value} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="template_type"
                        value={type.value}
                        checked={newPollData.template_type === type.value}
                        onChange={(e) => setNewPollData(prev => ({ ...prev, template_type: e.target.value }))}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{type.label}</p>
                        <p className="text-xs text-gray-600">{type.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Options de programmation */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3">⏰ Programmation</h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={newPollData.auto_schedule}
                      onChange={(e) => setNewPollData(prev => ({ ...prev, auto_schedule: e.target.checked }))}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-blue-700">
                      📅 Programmer automatiquement (envoi 2h avant l'entraînement)
                    </span>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={newPollData.send_immediately}
                      onChange={(e) => setNewPollData(prev => ({ ...prev, send_immediately: e.target.checked }))}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-blue-700">
                      ⚡ Générer les liens immédiatement (pour envoi manuel)
                    </span>
                  </label>
                </div>
              </div>

              {/* Aperçu du message */}
              {newPollData.session_id && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3">📱 Aperçu du sondage</h4>
                  <div className="bg-green-500 text-white p-4 rounded-lg max-w-md">
                    <pre className="whitespace-pre-wrap text-sm font-sans">
                      {(() => {
                        const session = sessions.find(s => s.id === newPollData.session_id);
                        if (!session) return 'Sélectionnez un entraînement...';
                        
                        return `🏐 BE FOR NOR KA - Sondage Entraînement

📅 ${format(new Date(session.date), 'dd/MM/yyyy', { locale: fr })} à ${session.start_time}
📍 ${session.location}
👨‍🏫 Coach: ${session.coach}

${session.description || 'Entraînement régulier'}

⚡ RÉPONDEZ RAPIDEMENT :
✅ PRÉSENT (tapez: OUI ou ✅)
❌ ABSENT (tapez: NON ou ❌)  
🤔 PEUT-ÊTRE (tapez: PEUT-ÊTRE ou 🤔)

Merci ! 🏐`;
                      })()}
                    </pre>
                  </div>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex space-x-3">
                <button
                  onClick={createTrainingPoll}
                  disabled={!newPollData.session_id}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Créer le sondage</span>
                </button>
                <button
                  onClick={() => setShowCreatePoll(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};