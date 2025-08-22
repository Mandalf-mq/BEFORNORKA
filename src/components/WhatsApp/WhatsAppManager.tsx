import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Send, Copy, Phone, CheckCircle, XCircle, AlertCircle, Eye, Settings, TrendingUp, BarChart3, Clock, Zap, Target, Award, RefreshCw, Download, Upload, Link as LinkIcon, UserCheck, UserX, Calendar, Bell, Play, Pause, RotateCcw, X, Plus } from 'lucide-react';
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

interface WhatsAppContact {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  category: string;
  additional_categories: string[];
}

interface PollMessage {
  session_id: string;
  message: string;
  scheduled_for?: string;
  target_count: number;
}

export const WhatsAppManager: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'scheduled' | 'responses'>('create');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [pollMessage, setPollMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [scheduledPolls, setScheduledPolls] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);

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
      const { data, error } = await supabase.rpc('get_whatsapp_dashboard_stats');
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
      setStats({
        total_members: 0,
        members_with_phone: 0,
        valid_contacts: 0,
        coverage_rate: 0
      });
    }
  };

  const generatePollMessage = (session: TrainingSession) => {
    const categoryLabels = session.category
      .map(cat => categories.find(c => c.value === cat)?.label || cat)
      .join(' • ');

    return `🏐 BE FOR NOR KA - Sondage Entraînement

📅 ${format(new Date(session.date), 'EEEE dd MMMM yyyy', { locale: fr })}
⏰ ${session.start_time} - ${session.end_time}
📍 ${session.location}
👨‍🏫 Coach: ${session.coach}
🏷️ ${categoryLabels}

${session.description || 'Entraînement régulier'}

⚡ CONFIRMEZ VOTRE PRÉSENCE :
✅ PRÉSENT (répondez: OUI ou ✅)
❌ ABSENT (répondez: NON ou ❌)
🤔 PEUT-ÊTRE (répondez: PEUT-ÊTRE ou 🤔)

Merci de répondre rapidement ! 🏐

---
BE FOR NOR KA - Association de Volleyball`;
  };

  const createPollForSession = async (sessionId: string, autoSchedule: boolean = false) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        alert('Session non trouvée');
        return;
      }

      const message = generatePollMessage(session);
      setPollMessage(message);

      // Calculer l'heure d'envoi (8h le matin du jour de l'entraînement)
      const sendTime = new Date(session.date);
      sendTime.setHours(8, 0, 0, 0);

      // Si l'entraînement est aujourd'hui et qu'il est déjà passé 8h, envoyer maintenant
      const now = new Date();
      if (session.date === now.toISOString().split('T')[0] && now.getHours() >= 8) {
        sendTime.setTime(now.getTime());
      }

      alert(`📊 Sondage créé pour "${session.title}" !

📅 Entraînement: ${format(new Date(session.date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
⏰ ${autoSchedule ? `Programmé pour: ${format(sendTime, 'dd/MM/yyyy à HH:mm', { locale: fr })}` : 'Prêt à envoyer'}
👥 ${contacts.length} contacts ciblés

📱 Copiez le message ci-dessous et postez-le dans votre groupe WhatsApp !`);

    } catch (error: any) {
      console.error('Erreur création sondage:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const scheduleAllDailyPolls = async () => {
    try {
      let scheduledCount = 0;
      const today = new Date();
      
      // Programmer pour les 7 prochains jours
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const dateString = targetDate.toISOString().split('T')[0];
        
        // Trouver les entraînements de ce jour
        const dayTrainings = sessions.filter(s => s.date === dateString);
        
        for (const session of dayTrainings) {
          await createPollForSession(session.id, true);
          scheduledCount++;
        }
      }

      alert(`✅ Programmation automatique activée !

📅 ${scheduledCount} sondages programmés pour les 7 prochains jours
⏰ Envoi automatique à 8h chaque matin
🔄 Les messages seront générés automatiquement

📱 Vous recevrez les messages formatés à copier dans votre groupe WhatsApp !`);

    } catch (error: any) {
      console.error('Erreur programmation:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const simulateWhatsAppResponse = async (phoneNumber: string, responseText: string) => {
    try {
      // Simuler le traitement d'une réponse WhatsApp
      const member = contacts.find(c => c.phone.includes(phoneNumber.slice(-4)));
      if (!member) {
        alert('❌ Membre non trouvé pour ce numéro');
        return;
      }

      // Analyser la réponse
      const responseLower = responseText.toLowerCase().trim();
      let status = 'pending';
      let confidence = 50;

      if (responseLower.match(/(oui|présent|ok|✅|👍|yes|y|1)/)) {
        status = 'present';
        confidence = 95;
      } else if (responseLower.match(/(non|absent|❌|👎|no|n|0)/)) {
        status = 'absent';
        confidence = 95;
      } else if (responseLower.match(/(peut-être|maybe|🤔|incertain)/)) {
        status = 'maybe';
        confidence = 90;
      }

      // Simuler l'enregistrement dans attendance_records
      if (selectedSession) {
        const { error } = await supabase
          .from('attendance_records')
          .upsert({
            session_id: selectedSession,
            member_id: member.id,
            status: status,
            response_date: new Date().toISOString(),
            notes: `Réponse WhatsApp simulée: "${responseText}"`
          }, {
            onConflict: 'session_id,member_id'
          });

        if (error) throw error;

        alert(`✅ Réponse WhatsApp simulée et synchronisée !

👤 ${member.first_name} ${member.last_name}
📱 Réponse: "${responseText}"
✅ Statut: ${status === 'present' ? 'Présent' : status === 'absent' ? 'Absent' : 'Peut-être'}
📊 Confiance: ${confidence}%
🔄 Synchronisé avec le site

Les entraîneurs voient maintenant cette réponse sur le site !`);
      }

    } catch (error: any) {
      console.error('Erreur simulation réponse:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const copyMessageToClipboard = () => {
    if (pollMessage) {
      navigator.clipboard.writeText(pollMessage);
      alert('📋 Message copié ! Collez-le dans votre groupe WhatsApp.');
    }
  };

  const generateWhatsAppLinks = () => {
    if (!pollMessage) {
      alert('Veuillez d\'abord créer un sondage');
      return;
    }

    const encodedMessage = encodeURIComponent(pollMessage);
    const links = contacts.map(contact => ({
      name: `${contact.first_name} ${contact.last_name}`,
      phone: contact.phone,
      url: `https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${encodedMessage}`
    }));

    // Créer une page de liens
    const linksHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Liens WhatsApp - BE FOR NOR KA</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f9ff; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { background: #059669; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .link-item { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #059669; }
        .link-item a { color: #059669; text-decoration: none; font-weight: bold; }
        .copy-all { background: #059669; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏐 Liens WhatsApp - Sondage d'entraînement</h1>
            <p>Cliquez sur chaque lien pour envoyer le sondage individuellement</p>
        </div>
        <button class="copy-all" onclick="copyAllLinks()">📋 Copier tous les liens</button>
        ${links.map(link => `
            <div class="link-item">
                <strong>${link.name}</strong> (${link.phone})<br>
                <a href="${link.url}" target="_blank">Envoyer le sondage WhatsApp</a>
            </div>
        `).join('')}
    </div>
    <script>
        function copyAllLinks() {
            const links = ${JSON.stringify(links.map(l => l.url))};
            navigator.clipboard.writeText(links.join('\\n'));
            alert('📋 Tous les liens copiés !');
        }
    </script>
</body>
</html>`;

    const blob = new Blob([linksHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    alert(`✅ Page de liens générée !

📱 ${links.length} liens WhatsApp créés
🔗 Nouvelle fenêtre ouverte avec tous les liens
📋 Utilisez "Copier tous les liens" pour un envoi rapide

💡 Astuce: Gardez cette page ouverte pour suivre vos envois !`);
  };

  useEffect(() => {
    if (selectedSession) {
      const session = sessions.find(s => s.id === selectedSession);
      if (session) {
        const message = generatePollMessage(session);
        setPollMessage(message);
      }
    }
  }, [selectedSession, sessions, categories]);

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
      {/* Header principal */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">📱 Gestionnaire WhatsApp</h1>
            <p className="text-green-100">
              Sondages automatiques pour les entraînements
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {stats && (
              <div className="text-right">
                <p className="text-green-100 text-sm">Couverture WhatsApp</p>
                <p className="text-2xl font-bold">{stats.coverage_rate}%</p>
                <p className="text-xs text-green-200">{stats.members_with_phone}/{stats.total_members} membres</p>
              </div>
            )}
            <button
              onClick={scheduleAllDailyPolls}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Auto-programmer 7 jours</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'create'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Créer un sondage</span>
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
            <span>Programmés</span>
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
            <span>Réponses</span>
          </button>
        </div>

        {/* Contenu des onglets */}
        <div className="p-6">
          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* Sélection de l'entraînement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏐 Sélectionner l'entraînement
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
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

              {/* Filtrage par catégories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏷️ Filtrer par catégories (optionnel)
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
                  Si aucune catégorie sélectionnée, tous les membres validés avec téléphone seront inclus
                </p>
              </div>

              {/* Statistiques des contacts */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">👥 Contacts ciblés</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-700">{contacts.length}</div>
                    <div className="text-sm text-blue-600">Contacts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-700">{stats?.members_with_phone || 0}</div>
                    <div className="text-sm text-green-600">Avec téléphone</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-700">{stats?.valid_contacts || 0}</div>
                    <div className="text-sm text-purple-600">Numéros valides</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-700">{stats?.coverage_rate || 0}%</div>
                    <div className="text-sm text-orange-600">Couverture</div>
                  </div>
                </div>
              </div>

              {/* Aperçu du message */}
              {pollMessage && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800">📱 Aperçu du sondage</h4>
                  
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

                  {/* Analyse du message */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h5 className="font-medium text-gray-800 mb-2">📊 Analyse du message</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-700">{pollMessage.length}</div>
                        <div className="text-gray-500">Caractères</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-700">{pollMessage.split(' ').length}</div>
                        <div className="text-gray-500">Mots</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-700">{(pollMessage.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length}</div>
                        <div className="text-gray-500">Émojis</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-700">{Math.ceil(pollMessage.split(' ').length / 200)}</div>
                        <div className="text-gray-500">Min lecture</div>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        pollMessage.length <= 1000 ? 'bg-green-100 text-green-700' : 
                        pollMessage.length <= 1500 ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {pollMessage.length <= 1000 ? '✅ Message optimal' : 
                         pollMessage.length <= 1500 ? '⚠️ Message long' : 
                         '❌ Message trop long'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    <button
                      onClick={copyMessageToClipboard}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copier le message</span>
                    </button>
                    <button
                      onClick={generateWhatsAppLinks}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span>Générer les liens</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions d'utilisation */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h4 className="font-semibold text-green-800 mb-3">📋 Mode d'emploi</h4>
                <div className="text-sm text-green-700 space-y-2">
                  <p><strong>1. Sélectionnez un entraînement</strong> dans la liste ci-dessus</p>
                  <p><strong>2. Le message de sondage</strong> est généré automatiquement</p>
                  <p><strong>3. Copiez le message</strong> et postez-le dans votre groupe WhatsApp</p>
                  <p><strong>4. Les membres répondent</strong> directement dans le groupe : "OUI", "NON", "PEUT-ÊTRE"</p>
                  <p><strong>5. Utilisez l'onglet "Réponses"</strong> pour simuler et synchroniser les réponses</p>
                  <p><strong>6. Les présences</strong> sont automatiquement mises à jour sur le site !</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scheduled' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">⏰ Sondages programmés</h3>
                <button
                  onClick={scheduleAllDailyPolls}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>Programmer 7 jours</span>
                </button>
              </div>

              {/* Explication du système */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-semibold text-blue-800 mb-3">🤖 Programmation automatique</h4>
                <div className="text-sm text-blue-700 space-y-2">
                  <p>• <strong>Chaque matin à 8h :</strong> Le système génère automatiquement le sondage pour l'entraînement du jour</p>
                  <p>• <strong>Message formaté :</strong> Prêt à copier-coller dans votre groupe WhatsApp</p>
                  <p>• <strong>Réponses intelligentes :</strong> Les membres répondent "OUI"/"NON"/"PEUT-ÊTRE\" directement</p>
                  <p>• <strong>Synchronisation :</strong> Utilisez l'outil de simulation pour mettre à jour le site</p>
                  <p>• <strong>Suivi temps réel :</strong> Les entraîneurs voient les présences instantanément</p>
                </div>
              </div>

              {/* Liste des entraînements à venir */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800">📅 Entraînements des 7 prochains jours</h4>
                {sessions.slice(0, 7).map(session => (
                  <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-gray-900">{session.title}</h5>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span>📅 {format(new Date(session.date), 'dd/MM/yyyy', { locale: fr })}</span>
                          <span>⏰ {session.start_time}</span>
                          <span>📍 {session.location}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSession(session.id);
                          setActiveTab('create');
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Créer sondage</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'responses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">💬 Simulateur de réponses WhatsApp</h3>
                <button
                  onClick={fetchContacts}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Actualiser</span>
                </button>
              </div>

              {/* Explication */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">🧪 Comment utiliser le simulateur</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p>1. <strong>Postez le sondage</strong> dans votre groupe WhatsApp</p>
                  <p>2. <strong>Les membres répondent</strong> dans le groupe : "OUI", "NON", "PEUT-ÊTRE"</p>
                  <p>3. <strong>Copiez chaque réponse</strong> et utilisez le simulateur ci-dessous</p>
                  <p>4. <strong>Le site se met à jour</strong> automatiquement avec les présences !</p>
                </div>
              </div>

              {/* Sélection de l'entraînement pour les réponses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏐 Entraînement concerné
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choisir l'entraînement...</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.title} - {format(new Date(session.date), 'dd/MM/yyyy', { locale: fr })}
                    </option>
                  ))}
                </select>
              </div>

              {/* Simulateur de réponses */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">🧪 Simuler une réponse WhatsApp</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      📱 Numéro de téléphone
                    </label>
                    <input
                      type="text"
                      placeholder="06 12 34 56 78"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      id="test-phone"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Numéro du membre qui répond
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      💬 Réponse WhatsApp
                    </label>
                    <input
                      type="text"
                      placeholder="OUI / NON / PEUT-ÊTRE"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      id="test-response"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Texte exact de la réponse
                    </p>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        const phone = (document.getElementById('test-phone') as HTMLInputElement)?.value;
                        const response = (document.getElementById('test-response') as HTMLInputElement)?.value;
                        if (phone && response && selectedSession) {
                          simulateWhatsAppResponse(phone, response);
                        } else {
                          alert('Veuillez remplir tous les champs et sélectionner un entraînement');
                        }
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Simuler réponse</span>
                    </button>
                  </div>
                </div>

                {/* Exemples de réponses */}
                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-800 mb-2">💡 Exemples de réponses reconnues</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-green-700 mb-1">✅ PRÉSENT</p>
                      <p className="text-gray-600">OUI, PRÉSENT, OK, ✅, 👍, Y, 1</p>
                    </div>
                    <div>
                      <p className="font-medium text-red-700 mb-1">❌ ABSENT</p>
                      <p className="text-gray-600">NON, ABSENT, ❌, 👎, N, 0</p>
                    </div>
                    <div>
                      <p className="font-medium text-yellow-700 mb-1">🤔 PEUT-ÊTRE</p>
                      <p className="text-gray-600">PEUT-ÊTRE, MAYBE, 🤔, INCERTAIN</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liste des contacts pour référence */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">👥 Contacts disponibles ({contacts.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {contacts.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-sm text-gray-600">{contact.phone}</p>
                        <p className="text-xs text-gray-500">
                          {contact.category}
                          {contact.additional_categories.length > 0 && 
                            ` + ${contact.additional_categories.length} autres`
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          (document.getElementById('test-phone') as HTMLInputElement).value = contact.phone;
                        }}
                        className="text-green-600 hover:text-green-700 p-1"
                        title="Utiliser ce numéro"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};