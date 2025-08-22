import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Send, Copy, Phone, CheckCircle, XCircle, AlertCircle, Eye, Settings, TrendingUp, BarChart3, Clock, Zap, Target, Award, RefreshCw, Download, Upload, Link as LinkIcon, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface WhatsAppContact {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  phone_original: string;
  phone_formatted: string;
  phone_valid: boolean;
  whatsapp_url: string;
  category: string;
  additional_categories: string[];
  has_consent: boolean;
  last_message_sent: string;
  total_messages_sent: number;
  engagement_score: number;
}

interface TrainingSession {
  id: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string[];
  coach: string;
  max_participants: number;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  description: string;
  message_template: string;
  template_type: string;
  variables: any;
  suggested_emojis: string[];
  usage_count: number;
  is_default: boolean;
}

interface WhatsAppStats {
  total_contacts: number;
  valid_contacts: number;
  invalid_contacts: number;
  consent_given: number;
  consent_pending: number;
  messages_sent: number;
  avg_engagement: number;
}

export const WhatsAppManager: React.FC = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'compose' | 'contacts' | 'templates' | 'stats'>('compose');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [finalMessage, setFinalMessage] = useState('');
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showLinksPage, setShowLinksPage] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<string[]>([]);

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSessions(),
        fetchCategories(),
        fetchTemplates(),
        fetchStats(),
        syncContacts()
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
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates_enhanced')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erreur chargement templates:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_stats');
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const syncContacts = async () => {
    try {
      const { data, error } = await supabase.rpc('sync_whatsapp_contacts');
      if (error) throw error;
      await fetchContacts();
    } catch (error) {
      console.error('Erreur sync contacts:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_contacts_validated', {
        p_categories: selectedCategories.length > 0 ? selectedCategories : null
      });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Erreur chargement contacts:', error);
    }
  };

  useEffect(() => {
    if (selectedCategories.length >= 0) {
      fetchContacts();
    }
  }, [selectedCategories]);

  const generateMessage = () => {
    const session = sessions.find(s => s.id === selectedSession);
    const template = templates.find(t => t.id === selectedTemplate);
    
    if (!session) {
      setFinalMessage(customMessage);
      return;
    }

    let message = template?.message_template || customMessage;
    
    // Remplacer les variables
    const variables = {
      '{titre}': session.title,
      '{date}': new Date(session.date).toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      '{heure}': `${session.start_time} - ${session.end_time}`,
      '{lieu}': session.location,
      '{coach}': session.coach,
      '{description}': session.description || '',
      '{categories}': session.category.map(cat => 
        categories.find(c => c.value === cat)?.label || cat
      ).join(', '),
      '{max_participants}': session.max_participants?.toString() || '20'
    };

    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(key, 'g'), value);
    });

    setFinalMessage(message);
  };

  useEffect(() => {
    generateMessage();
  }, [selectedSession, selectedTemplate, customMessage, sessions, templates, categories]);

  const generateWhatsAppLinks = () => {
    const filteredContacts = contacts.filter(contact => 
      contact.phone_valid && contact.has_consent
    );

    const links = filteredContacts.map(contact => {
      const encodedMessage = encodeURIComponent(finalMessage);
      return `https://wa.me/${contact.phone_formatted}?text=${encodedMessage}`;
    });

    setGeneratedLinks(links);
    setShowLinksPage(true);
  };

  const copyAllLinks = () => {
    const allLinks = generatedLinks.join('\n');
    navigator.clipboard.writeText(allLinks);
    alert(`✅ ${generatedLinks.length} liens copiés dans le presse-papier !`);
  };

  const updateConsent = async (contactId: string, consent: boolean) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const { error } = await supabase
        .from('whatsapp_consent')
        .upsert({
          member_id: contact.member_id,
          consent_given: consent,
          consent_date: consent ? new Date().toISOString() : null,
          consent_withdrawn: !consent,
          withdrawal_date: !consent ? new Date().toISOString() : null,
          consent_source: 'manual'
        }, {
          onConflict: 'member_id'
        });

      if (error) throw error;
      
      await fetchContacts();
      alert(`✅ Consentement ${consent ? 'accordé' : 'retiré'} pour ${contact.first_name} ${contact.last_name}`);
    } catch (error: any) {
      console.error('Erreur mise à jour consentement:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const analyzeMessage = (message: string) => {
    const charCount = message.length;
    const wordCount = message.split(/\s+/).filter(word => word.length > 0).length;
    const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
    
    return {
      characters: charCount,
      words: wordCount,
      emojis: emojiCount,
      readingTime: Math.ceil(wordCount / 200), // mots par minute
      isOptimal: charCount >= 50 && charCount <= 300 && emojiCount >= 2
    };
  };

  const messageAnalysis = analyzeMessage(finalMessage);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement du gestionnaire WhatsApp...</p>
      </div>
    );
  }

  if (showLinksPage) {
    return (
      <div className="space-y-6">
        {/* Header de la page des liens */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">📱 Liens WhatsApp générés</h2>
              <p className="text-green-100">
                {generatedLinks.length} liens prêts à utiliser
              </p>
            </div>
            <button
              onClick={() => setShowLinksPage(false)}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Retour
            </button>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🚀 Actions rapides</h3>
            <div className="flex space-x-3">
              <button
                onClick={copyAllLinks}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copier tous les liens</span>
              </button>
              <button
                onClick={() => {
                  generatedLinks.forEach((link, index) => {
                    setTimeout(() => window.open(link, '_blank'), index * 500);
                  });
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
                <span>Ouvrir tous ({generatedLinks.length})</span>
              </button>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2">💡 Comment utiliser</h4>
            <div className="text-sm text-green-700 space-y-1">
              <p>• <strong>Copier tous :</strong> Colle tous les liens dans un document</p>
              <p>• <strong>Ouvrir tous :</strong> Ouvre chaque conversation WhatsApp (avec délai)</p>
              <p>• <strong>Clic individuel :</strong> Ouvre une conversation spécifique</p>
              <p>• <strong>Message pré-rempli :</strong> Le message apparaît automatiquement</p>
            </div>
          </div>
        </div>

        {/* Liste des liens */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📋 Liens individuels ({generatedLinks.length})
          </h3>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {contacts.filter(c => c.phone_valid && c.has_consent).map((contact, index) => (
              <div key={contact.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold text-sm">
                      {contact.first_name[0]}{contact.last_name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      📱 {contact.phone_original} → {contact.phone_formatted}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {contact.category}
                      </span>
                      {contact.additional_categories.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          +{contact.additional_categories.length}
                        </span>
                      )}
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        📊 {contact.engagement_score}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLinks[index]);
                      alert('✅ Lien copié !');
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Copier le lien"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => window.open(generatedLinks[index], '_blank')}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Ouvrir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aperçu du message */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📱 Aperçu du message</h3>
          <div className="bg-gray-100 rounded-xl p-4 max-h-64 overflow-y-auto">
            <div className="bg-green-500 text-white p-3 rounded-lg max-w-xs ml-auto">
              <pre className="whitespace-pre-wrap text-sm font-sans">{finalMessage}</pre>
            </div>
          </div>
        </div>
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
              Envoyez des appels d'entraînement via WhatsApp
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {stats && (
              <div className="text-right">
                <p className="text-green-100 text-sm">Contacts valides</p>
                <p className="text-2xl font-bold">{stats.valid_contacts}</p>
              </div>
            )}
            <button
              onClick={() => syncContacts()}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('compose')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'compose'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Composer</span>
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'contacts'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Contacts ({contacts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'templates'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Templates ({templates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'stats'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Statistiques</span>
          </button>
        </div>

        {/* Contenu des onglets */}
        <div className="p-6">
          {activeTab === 'compose' && (
            <div className="space-y-6">
              {/* Sélection de l'entraînement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏐 Sélectionner l'entraînement
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Choisir un entraînement...</option>
                  {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.title} - {new Date(session.date).toLocaleDateString('fr-FR')} à {session.start_time}
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
                    <label key={category.id} className="flex items-center space-x-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
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
                      <span className="text-sm text-gray-700">{category.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Si aucune catégorie sélectionnée, tous les membres validés recevront le message
                </p>
              </div>

              {/* Sélection du template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Template de message
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Message personnalisé</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.template_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Zone de composition */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Éditeur de message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ✏️ Composer votre message
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                    placeholder="Tapez votre message ici ou sélectionnez un template..."
                  />
                  
                  {/* Analyse du message */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{messageAnalysis.characters}</p>
                        <p className="text-xs text-gray-600">Caractères</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{messageAnalysis.words}</p>
                        <p className="text-xs text-gray-600">Mots</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{messageAnalysis.emojis}</p>
                        <p className="text-xs text-gray-600">Émojis</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{messageAnalysis.readingTime}s</p>
                        <p className="text-xs text-gray-600">Lecture</p>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        messageAnalysis.isOptimal 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {messageAnalysis.isOptimal ? '✅ Message optimal' : '⚠️ Peut être amélioré'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prévisualisation mobile */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📱 Aperçu WhatsApp
                  </label>
                  <div className="bg-gray-100 rounded-xl p-4 h-80 overflow-y-auto">
                    <div className="bg-green-500 text-white p-3 rounded-lg max-w-xs ml-auto shadow-lg">
                      <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                        {finalMessage || 'Votre message apparaîtra ici...'}
                      </pre>
                      <div className="text-right mt-2">
                        <span className="text-xs text-green-100">
                          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Émojis suggérés */}
                  {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.suggested_emojis && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-800 mb-2">😊 Émojis suggérés</p>
                      <div className="flex flex-wrap gap-2">
                        {templates.find(t => t.id === selectedTemplate)?.suggested_emojis.map((emoji, index) => (
                          <button
                            key={index}
                            onClick={() => setCustomMessage(prev => prev + emoji)}
                            className="text-lg hover:bg-blue-100 p-1 rounded transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Destinataires */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3">
                  👥 Destinataires ({contacts.filter(c => c.phone_valid && c.has_consent).length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {contacts.filter(c => c.phone_valid && c.has_consent).slice(0, 6).map(contact => (
                    <div key={contact.id} className="bg-white p-3 rounded-lg border border-blue-200">
                      <p className="font-medium text-gray-900 text-sm">
                        {contact.first_name} {contact.last_name}
                      </p>
                      <p className="text-xs text-gray-600">{contact.phone_original}</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {contact.category}
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          📊 {contact.engagement_score}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {contacts.filter(c => c.phone_valid && c.has_consent).length > 6 && (
                    <div className="bg-white p-3 rounded-lg border border-blue-200 flex items-center justify-center">
                      <span className="text-sm text-gray-600">
                        +{contacts.filter(c => c.phone_valid && c.has_consent).length - 6} autres
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bouton de génération */}
              <div className="text-center">
                <button
                  onClick={generateWhatsAppLinks}
                  disabled={!finalMessage.trim() || contacts.filter(c => c.phone_valid && c.has_consent).length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 mx-auto"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Générer les liens WhatsApp</span>
                  <span className="bg-white/20 px-2 py-1 rounded-full text-sm">
                    {contacts.filter(c => c.phone_valid && c.has_consent).length}
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-6">
              {/* Statistiques des contacts */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{stats?.total_contacts || 0}</div>
                  <div className="text-sm text-blue-600">Total contacts</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{stats?.valid_contacts || 0}</div>
                  <div className="text-sm text-green-600">Numéros valides</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">{stats?.invalid_contacts || 0}</div>
                  <div className="text-sm text-red-600">Numéros invalides</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-700">{stats?.consent_given || 0}</div>
                  <div className="text-sm text-purple-600">Consentements</div>
                </div>
              </div>

              {/* Liste des contacts */}
              <div className="space-y-3">
                {contacts.map(contact => (
                  <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold">
                            {contact.first_name[0]}{contact.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </p>
                          <div className="flex items-center space-x-2 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              contact.phone_valid 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              📱 {contact.phone_original}
                            </span>
                            {contact.phone_valid && (
                              <span className="text-xs text-gray-500">
                                → {contact.phone_formatted}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              {contact.category}
                            </span>
                            {contact.additional_categories.length > 0 && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                +{contact.additional_categories.length}
                              </span>
                            )}
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                              📊 {contact.engagement_score}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {/* Gestion du consentement */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-600">RGPD:</span>
                          {contact.has_consent ? (
                            <button
                              onClick={() => updateConsent(contact.id, false)}
                              className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs flex items-center space-x-1 transition-colors"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Accordé</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => updateConsent(contact.id, true)}
                              className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs flex items-center space-x-1 transition-colors"
                            >
                              <UserX className="w-3 h-3" />
                              <span>Refusé</span>
                            </button>
                          )}
                        </div>

                        {/* Statistiques du contact */}
                        <div className="text-right text-xs text-gray-500">
                          <p>{contact.total_messages_sent} messages</p>
                          {contact.last_message_sent && (
                            <p>Dernier: {new Date(contact.last_message_sent).toLocaleDateString('fr-FR')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              {/* Liste des templates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map(template => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          template.template_type === 'urgent' ? 'bg-red-100 text-red-700' :
                          template.template_type === 'match' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {template.template_type}
                        </span>
                        {template.is_default && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                            ⭐ Défaut
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {template.message_template.substring(0, 200)}
                        {template.message_template.length > 200 && '...'}
                      </pre>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Utilisé {template.usage_count} fois</span>
                      <div className="flex space-x-1">
                        {template.suggested_emojis.slice(0, 5).map((emoji, index) => (
                          <span key={index}>{emoji}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              {/* Statistiques principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Messages envoyés</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.messages_sent}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Engagement moyen</p>
                      <p className="text-2xl font-bold text-gray-900">{Math.round(stats.avg_engagement)}%</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Consentements RGPD</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.consent_given}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top performers */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <span>Top membres les plus réactifs</span>
                </h3>
                <div className="space-y-3">
                  {contacts
                    .filter(c => c.engagement_score > 0)
                    .sort((a, b) => b.engagement_score - a.engagement_score)
                    .slice(0, 5)
                    .map((contact, index) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index === 0 ? 'bg-yellow-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-orange-500' :
                            'bg-blue-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {contact.total_messages_sent} messages reçus
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            {contact.engagement_score}%
                          </p>
                          <p className="text-xs text-gray-500">Engagement</p>
                        </div>
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