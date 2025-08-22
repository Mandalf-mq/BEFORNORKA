import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Users, Send, Plus, Edit, Trash2, Eye, X, Copy, Calendar, Clock, MapPin, User,
  Phone, CheckCircle, XCircle, AlertTriangle, Shield, BarChart3, Smartphone, Zap, Target,
  TrendingUp, Activity, Settings, Download, Upload, RefreshCw, Bell, Heart
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TrainingSession {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string[];
  coach: string;
  description?: string;
}

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

interface MessageTemplate {
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
  const [activeTab, setActiveTab] = useState<'send' | 'contacts' | 'templates' | 'stats'>('send');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [messagePreview, setMessagePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    message_template: '',
    template_type: 'training',
    suggested_emojis: [] as string[]
  });
  const [syncingContacts, setSyncingContacts] = useState(false);

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    updateMessagePreview();
  }, [selectedSession, selectedTemplate, customMessage]);

  useEffect(() => {
    fetchContacts();
  }, [selectedCategories]);

  const initializeData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSessions(),
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
      console.error('Erreur lors du chargement des séances:', error);
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
      console.error('Erreur lors du chargement des contacts:', error);
      setContacts([]);
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
      console.error('Erreur lors du chargement des templates:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_stats');
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
    }
  };

  const syncContacts = async () => {
    try {
      setSyncingContacts(true);
      const { data, error } = await supabase.rpc('sync_whatsapp_contacts');
      if (error) throw error;
      
      console.log('✅ Contacts synchronisés:', data);
      await fetchContacts();
    } catch (error) {
      console.error('Erreur synchronisation contacts:', error);
    } finally {
      setSyncingContacts(false);
    }
  };

  const updateMessagePreview = () => {
    if (!selectedSession) {
      setMessagePreview('');
      return;
    }

    let message = '';
    
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        message = template.message_template;
      }
    } else if (customMessage) {
      message = customMessage;
    }

    if (message) {
      // Remplacer les variables
      message = message.replace(/{titre}/g, selectedSession.title);
      message = message.replace(/{date}/g, new Date(selectedSession.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }));
      message = message.replace(/{heure}/g, `${selectedSession.start_time} - ${selectedSession.end_time}`);
      message = message.replace(/{lieu}/g, selectedSession.location);
      message = message.replace(/{coach}/g, selectedSession.coach);
      message = message.replace(/{description}/g, selectedSession.description || '');
    }

    setMessagePreview(message);
  };

  const generateWhatsAppLinks = async () => {
    if (!selectedSession || (!selectedTemplate && !customMessage)) {
      alert('Veuillez sélectionner une séance et un message');
      return;
    }

    const finalMessage = customMessage || messagePreview;
    if (!finalMessage) {
      alert('Impossible de générer le message');
      return;
    }

    const filteredContacts = contacts.filter(contact => 
      selectedCategories.length === 0 || 
      selectedCategories.includes(contact.category) ||
      contact.additional_categories.some(cat => selectedCategories.includes(cat))
    );

    if (filteredContacts.length === 0) {
      alert('Aucun contact valide sélectionné');
      return;
    }

    try {
      setSending(true);

      // Enregistrer l'envoi dans l'historique
      const memberIds = filteredContacts.map(c => c.member_id);
      const { data: logResult, error: logError } = await supabase.rpc('log_whatsapp_message', {
        p_session_id: selectedSession.id,
        p_member_ids: memberIds,
        p_message_content: finalMessage,
        p_template_id: selectedTemplate || null,
        p_message_type: templates.find(t => t.id === selectedTemplate)?.template_type || 'custom'
      });

      if (logError) throw logError;

      // Mettre à jour le compteur d'usage du template
      if (selectedTemplate) {
        await supabase
          .from('whatsapp_templates_enhanced')
          .update({ 
            usage_count: templates.find(t => t.id === selectedTemplate)?.usage_count + 1 
          })
          .eq('id', selectedTemplate);
      }

      // Générer les liens WhatsApp
      const whatsappLinks = filteredContacts
        .filter(contact => contact.phone_valid)
        .map(contact => {
          const encodedMessage = encodeURIComponent(finalMessage);
          return {
            member: `${contact.first_name} ${contact.last_name}`,
            phone: contact.phone_original,
            formatted_phone: contact.phone_formatted,
            link: `https://wa.me/${contact.phone_formatted}?text=${encodedMessage}`,
            engagement_score: contact.engagement_score,
            last_sent: contact.last_message_sent
          };
        });

      // Créer la page de liens avec design amélioré
      const linksWindow = window.open('', '_blank');
      if (linksWindow) {
        linksWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>🏐 BE FOR NOR KA - Liens WhatsApp</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  padding: 20px;
                }
                .container { 
                  max-width: 800px; 
                  margin: 0 auto; 
                  background: white; 
                  border-radius: 20px; 
                  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                  overflow: hidden;
                }
                .header { 
                  background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); 
                  color: white; 
                  padding: 30px; 
                  text-align: center;
                }
                .header h1 { font-size: 28px; margin-bottom: 10px; }
                .header p { opacity: 0.9; font-size: 16px; }
                .session-info { 
                  background: #f8f9fa; 
                  padding: 25px; 
                  border-bottom: 1px solid #e9ecef;
                }
                .session-grid { 
                  display: grid; 
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
                  gap: 15px; 
                  margin-bottom: 20px;
                }
                .session-item { 
                  display: flex; 
                  align-items: center; 
                  gap: 10px; 
                  padding: 10px; 
                  background: white; 
                  border-radius: 10px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .message-preview { 
                  background: #e3f2fd; 
                  padding: 20px; 
                  border-radius: 15px; 
                  border-left: 4px solid #2196f3;
                  white-space: pre-wrap;
                  font-family: monospace;
                  line-height: 1.5;
                }
                .contacts-section { padding: 25px; }
                .contacts-header { 
                  display: flex; 
                  justify-content: space-between; 
                  align-items: center; 
                  margin-bottom: 20px;
                }
                .stats { 
                  display: grid; 
                  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); 
                  gap: 15px; 
                  margin-bottom: 25px;
                }
                .stat-card { 
                  text-align: center; 
                  padding: 15px; 
                  background: #f8f9fa; 
                  border-radius: 10px;
                  border: 2px solid #e9ecef;
                }
                .stat-number { font-size: 24px; font-weight: bold; color: #25D366; }
                .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
                .contact-card { 
                  display: flex; 
                  justify-content: space-between; 
                  align-items: center; 
                  padding: 15px; 
                  margin: 10px 0; 
                  background: #f8f9fa; 
                  border-radius: 12px; 
                  border: 1px solid #e9ecef;
                  transition: all 0.3s ease;
                }
                .contact-card:hover { 
                  transform: translateY(-2px); 
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .contact-info { display: flex; align-items: center; gap: 15px; }
                .contact-avatar { 
                  width: 50px; 
                  height: 50px; 
                  background: linear-gradient(135deg, #25D366, #128C7E); 
                  border-radius: 50%; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center; 
                  color: white; 
                  font-weight: bold;
                  font-size: 18px;
                }
                .contact-details h4 { margin-bottom: 5px; color: #333; }
                .contact-details p { font-size: 14px; color: #666; margin: 2px 0; }
                .whatsapp-btn { 
                  background: linear-gradient(135deg, #25D366, #128C7E); 
                  color: white; 
                  border: none; 
                  padding: 12px 20px; 
                  border-radius: 25px; 
                  font-weight: bold; 
                  cursor: pointer; 
                  transition: all 0.3s ease;
                  text-decoration: none;
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                }
                .whatsapp-btn:hover { 
                  transform: scale(1.05); 
                  box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
                }
                .engagement-badge {
                  padding: 4px 8px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: bold;
                }
                .engagement-high { background: #d4edda; color: #155724; }
                .engagement-medium { background: #fff3cd; color: #856404; }
                .engagement-low { background: #f8d7da; color: #721c24; }
                .footer { 
                  background: #f8f9fa; 
                  padding: 20px; 
                  text-align: center; 
                  color: #666; 
                  font-size: 14px;
                  border-top: 1px solid #e9ecef;
                }
                .copy-all-btn {
                  background: #007bff;
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  border-radius: 8px;
                  cursor: pointer;
                  margin-bottom: 20px;
                }
                @media (max-width: 768px) {
                  .session-grid { grid-template-columns: 1fr; }
                  .contact-card { flex-direction: column; gap: 15px; text-align: center; }
                  .stats { grid-template-columns: repeat(2, 1fr); }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🏐 BE FOR NOR KA</h1>
                  <p>Appel d'entraînement WhatsApp</p>
                </div>
                
                <div class="session-info">
                  <h2 style="margin-bottom: 20px; color: #333;">📅 ${selectedSession.title}</h2>
                  <div class="session-grid">
                    <div class="session-item">
                      <span style="font-size: 20px;">📅</span>
                      <div>
                        <strong>Date</strong><br>
                        <span style="color: #666;">${new Date(selectedSession.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <div class="session-item">
                      <span style="font-size: 20px;">⏰</span>
                      <div>
                        <strong>Heure</strong><br>
                        <span style="color: #666;">${selectedSession.start_time} - ${selectedSession.end_time}</span>
                      </div>
                    </div>
                    <div class="session-item">
                      <span style="font-size: 20px;">📍</span>
                      <div>
                        <strong>Lieu</strong><br>
                        <span style="color: #666;">${selectedSession.location}</span>
                      </div>
                    </div>
                    <div class="session-item">
                      <span style="font-size: 20px;">👨‍🏫</span>
                      <div>
                        <strong>Coach</strong><br>
                        <span style="color: #666;">${selectedSession.coach}</span>
                      </div>
                    </div>
                  </div>
                  
                  <h3 style="margin-bottom: 15px; color: #333;">📱 Message à envoyer :</h3>
                  <div class="message-preview">${finalMessage}</div>
                </div>
                
                <div class="contacts-section">
                  <div class="contacts-header">
                    <h3>👥 Contacts à contacter (${whatsappLinks.length})</h3>
                    <button class="copy-all-btn" onclick="copyAllLinks()">📋 Copier tous les liens</button>
                  </div>
                  
                  <div class="stats">
                    <div class="stat-card">
                      <div class="stat-number">${whatsappLinks.length}</div>
                      <div class="stat-label">Contacts valides</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">${filteredContacts.filter(c => !c.phone_valid).length}</div>
                      <div class="stat-label">Numéros invalides</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">${whatsappLinks.filter(l => l.engagement_score > 70).length}</div>
                      <div class="stat-label">Engagement élevé</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">${Math.round(finalMessage.length)}</div>
                      <div class="stat-label">Caractères</div>
                    </div>
                  </div>
                  
                  ${whatsappLinks.map(link => `
                    <div class="contact-card">
                      <div class="contact-info">
                        <div class="contact-avatar">
                          ${link.member.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div class="contact-details">
                          <h4>${link.member}</h4>
                          <p>📱 ${link.phone}</p>
                          <p>🏐 Catégorie principale</p>
                          ${link.engagement_score > 0 ? `
                            <span class="engagement-badge ${
                              link.engagement_score > 70 ? 'engagement-high' : 
                              link.engagement_score > 40 ? 'engagement-medium' : 'engagement-low'
                            }">
                              📊 Engagement: ${link.engagement_score}%
                            </span>
                          ` : ''}
                          ${link.last_sent ? `<p style="font-size: 11px; color: #999;">Dernier envoi: ${new Date(link.last_sent).toLocaleDateString('fr-FR')}</p>` : ''}
                        </div>
                      </div>
                      <a href="${link.link}" target="_blank" class="whatsapp-btn">
                        <span style="font-size: 18px;">📱</span>
                        Ouvrir WhatsApp
                      </a>
                    </div>
                  `).join('')}
                </div>
                
                <div class="footer">
                  <p>💡 <strong>Instructions :</strong></p>
                  <p>1. Cliquez sur "Ouvrir WhatsApp" pour chaque membre</p>
                  <p>2. Le message sera pré-rempli dans WhatsApp</p>
                  <p>3. Appuyez sur Envoyer dans WhatsApp</p>
                  <p>4. Répétez pour tous les membres</p>
                  <br>
                  <p style="font-size: 12px; color: #999;">
                    📊 Envoi enregistré le ${new Date().toLocaleString('fr-FR')} par ${userProfile?.first_name} ${userProfile?.last_name}
                  </p>
                </div>
              </div>
              
              <script>
                function copyAllLinks() {
                  const links = [${whatsappLinks.map(l => `"${l.link}"`).join(',')}];
                  const text = links.join('\\n');
                  navigator.clipboard.writeText(text).then(() => {
                    alert('✅ Tous les liens copiés dans le presse-papier !');
                  });
                }
              </script>
            </body>
          </html>
        `);
      }

      alert(`✅ ${whatsappLinks.length} liens WhatsApp générés !

📱 Nouvelle fenêtre ouverte avec interface améliorée
📊 Statistiques d'engagement incluses
📋 Bouton pour copier tous les liens
🎯 ${logResult.sent_count} envois enregistrés`);

      // Rafraîchir les données
      await Promise.all([fetchStats(), fetchContacts()]);

    } catch (error: any) {
      console.error('Erreur lors de la génération:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const createTemplate = async () => {
    try {
      const { error } = await supabase
        .from('whatsapp_templates_enhanced')
        .insert({
          name: newTemplate.name,
          description: newTemplate.description,
          message_template: newTemplate.message_template,
          template_type: newTemplate.template_type,
          suggested_emojis: newTemplate.suggested_emojis,
          created_by: userProfile?.id
        });

      if (error) throw error;

      setNewTemplate({
        name: '',
        description: '',
        message_template: '',
        template_type: 'training',
        suggested_emojis: []
      });
      setShowTemplateForm(false);
      await fetchTemplates();
      alert('✅ Template créé avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const updateConsent = async (memberId: string, consent: boolean) => {
    try {
      const { error } = await supabase
        .from('whatsapp_consent')
        .upsert({
          member_id: memberId,
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
      alert(`✅ Consentement ${consent ? 'accordé' : 'retiré'} !`);
    } catch (error: any) {
      console.error('Erreur mise à jour consentement:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const availableCategories = [...new Set(contacts.map(c => c.category))];
  const filteredContacts = contacts.filter(contact => 
    selectedCategories.length === 0 || 
    selectedCategories.includes(contact.category) ||
    contact.additional_categories.some(cat => selectedCategories.includes(cat))
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement du gestionnaire WhatsApp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <MessageSquare className="w-6 h-6" />
              <span>Gestionnaire WhatsApp Pro</span>
            </div>
            <p className="text-green-100 mt-2">
              Interface avancée pour la communication avec vos membres
            </p>
          </div>
          <button
            onClick={syncContacts}
            disabled={syncingContacts}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            {syncingContacts ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Sync contacts</span>
          </button>
        </div>

        {/* Stats rapides */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.valid_contacts}</div>
              <div className="text-green-100 text-sm">Contacts valides</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.consent_given}</div>
              <div className="text-green-100 text-sm">Consentements</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.messages_sent}</div>
              <div className="text-green-100 text-sm">Messages envoyés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{Math.round(stats.avg_engagement)}%</div>
              <div className="text-green-100 text-sm">Engagement moyen</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{templates.length}</div>
              <div className="text-green-100 text-sm">Templates</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation par onglets */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeTab === 'send'
                ? 'border-b-2 border-green-500 text-green-600 bg-green-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Envoyer</span>
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

        <div className="p-6">
          {/* ONGLET ENVOI */}
          {activeTab === 'send' && (
            <div className="space-y-6">
              {/* Sélection de séance */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📅 Sélectionner une séance
                </h3>
                
                {sessions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Aucune séance programmée</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg ${
                          selectedSession?.id === session.id
                            ? 'border-green-500 bg-green-50 shadow-lg'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <h4 className="font-semibold text-gray-900 mb-2">{session.title}</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(session.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4" />
                            <span>{session.start_time} - {session.end_time}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4" />
                            <span>{session.location}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {session.category.map((cat) => (
                            <span key={cat} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sélection des catégories */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🏐 Filtrer par catégories
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableCategories.map((category) => (
                    <label key={category} className="flex items-center space-x-2 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories(prev => [...prev, category]);
                          } else {
                            setSelectedCategories(prev => prev.filter(c => c !== category));
                          }
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 font-medium">{category}</span>
                    </label>
                  ))}
                </div>
                
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>
                      <strong>{filteredContacts.filter(c => c.phone_valid).length}</strong> contacts valides sélectionnés
                      {filteredContacts.filter(c => !c.phone_valid).length > 0 && (
                        <span className="text-red-600 ml-2">
                          ({filteredContacts.filter(c => !c.phone_valid).length} numéros invalides)
                        </span>
                      )}
                    </span>
                  </p>
                </div>
              </div>

              {/* Templates et message */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  💬 Composer le message
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Sélection template */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Choisir un template
                      </label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => {
                          setSelectedTemplate(e.target.value);
                          setCustomMessage('');
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Template personnalisé</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} {template.is_default ? '⭐' : ''} ({template.usage_count} utilisations)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Message personnalisé */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ou message personnalisé
                      </label>
                      <textarea
                        value={customMessage}
                        onChange={(e) => {
                          setCustomMessage(e.target.value);
                          setSelectedTemplate('');
                        }}
                        placeholder="Tapez votre message..."
                        rows={8}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Variables: {'{date}'}, {'{heure}'}, {'{lieu}'}, {'{coach}'}</span>
                        <span>{customMessage.length} caractères</span>
                      </div>
                    </div>

                    {/* Émojis suggérés */}
                    {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.suggested_emojis && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Émojis suggérés
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {templates.find(t => t.id === selectedTemplate)?.suggested_emojis.map((emoji, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                if (customMessage) {
                                  setCustomMessage(prev => prev + emoji);
                                }
                              }}
                              className="text-2xl hover:bg-gray-100 p-2 rounded-lg transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Prévisualisation */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📱 Prévisualisation mobile
                      </label>
                      <div className="bg-gray-100 rounded-2xl p-4 max-w-sm mx-auto">
                        <div className="bg-green-500 text-white p-3 rounded-t-xl text-center text-sm font-medium">
                          WhatsApp
                        </div>
                        <div className="bg-white p-4 rounded-b-xl min-h-[200px]">
                          {messagePreview ? (
                            <div className="bg-green-100 p-3 rounded-lg text-sm whitespace-pre-wrap">
                              {messagePreview}
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm text-center py-8">
                              Sélectionnez une séance et un template pour voir l'aperçu
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Informations du message */}
                    {messagePreview && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-800 mb-2">📊 Analyse du message</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-blue-700">Caractères:</span>
                            <span className={`ml-2 font-bold ${
                              messagePreview.length > 1000 ? 'text-red-600' : 
                              messagePreview.length > 500 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {messagePreview.length}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-700">Mots:</span>
                            <span className="ml-2 font-bold text-blue-900">
                              {messagePreview.split(' ').length}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-700">Lignes:</span>
                            <span className="ml-2 font-bold text-blue-900">
                              {messagePreview.split('\n').length}
                            </span>
                          </div>
                          <div>
                            <span className="text-blue-700">Émojis:</span>
                            <span className="ml-2 font-bold text-blue-900">
                              {(messagePreview.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bouton d'envoi amélioré */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <Zap className="w-5 h-5 text-green-600" />
                      <span>Envoyer l'appel d'entraînement</span>
                    </h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        <strong>{filteredContacts.filter(c => c.phone_valid).length}</strong> contacts valides recevront le message
                      </p>
                      {filteredContacts.filter(c => !c.phone_valid).length > 0 && (
                        <p className="text-sm text-red-600">
                          ⚠️ <strong>{filteredContacts.filter(c => !c.phone_valid).length}</strong> numéros invalides seront ignorés
                        </p>
                      )}
                      {filteredContacts.filter(c => !c.has_consent).length > 0 && (
                        <p className="text-sm text-yellow-600">
                          🔒 <strong>{filteredContacts.filter(c => !c.has_consent).length}</strong> sans consentement explicite
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={generateWhatsAppLinks}
                    disabled={!selectedSession || (!selectedTemplate && !customMessage) || sending}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-4 px-8 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {sending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Génération...</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-5 h-5" />
                        <span>Générer les liens WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET CONTACTS */}
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  👥 Gestion des contacts
                </h3>
                <button
                  onClick={syncContacts}
                  disabled={syncingContacts}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  {syncingContacts ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Synchroniser</span>
                </button>
              </div>

              {/* Statistiques des contacts */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-700">{contacts.filter(c => c.phone_valid).length}</div>
                  <div className="text-sm text-green-600">Numéros valides</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-700">{contacts.filter(c => !c.phone_valid).length}</div>
                  <div className="text-sm text-red-600">Numéros invalides</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-700">{contacts.filter(c => c.has_consent).length}</div>
                  <div className="text-sm text-blue-600">Consentements</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <Activity className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-700">
                    {contacts.length > 0 ? Math.round(contacts.reduce((sum, c) => sum + c.engagement_score, 0) / contacts.length) : 0}%
                  </div>
                  <div className="text-sm text-purple-600">Engagement moyen</div>
                </div>
              </div>

              {/* Liste des contacts */}
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                          {contact.first_name[0]}{contact.last_name[0]}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </h4>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            <span>{contact.phone_original}</span>
                            {contact.phone_valid ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              {contact.category}
                            </span>
                            {contact.engagement_score > 0 && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                contact.engagement_score > 70 ? 'bg-green-100 text-green-700' :
                                contact.engagement_score > 40 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                📊 {contact.engagement_score}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {/* Consentement RGPD */}
                        <button
                          onClick={() => updateConsent(contact.member_id, !contact.has_consent)}
                          className={`p-2 rounded-lg transition-colors ${
                            contact.has_consent 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={contact.has_consent ? 'Retirer le consentement' : 'Donner le consentement'}
                        >
                          <Shield className="w-4 h-4" />
                        </button>

                        {/* Statistiques */}
                        <div className="text-right text-xs text-gray-500">
                          <div>{contact.total_messages_sent} messages</div>
                          {contact.last_message_sent && (
                            <div>Dernier: {new Date(contact.last_message_sent).toLocaleDateString('fr-FR')}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ONGLET TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  💬 Gestion des templates
                </h3>
                <button
                  onClick={() => setShowTemplateForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouveau template</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map((template) => (
                  <div key={template.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                          <span>{template.name}</span>
                          {template.is_default && <span className="text-yellow-500">⭐</span>}
                        </h4>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingTemplate(template)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {!template.is_default && (
                          <button
                            onClick={() => {
                              if (confirm('Supprimer ce template ?')) {
                                supabase
                                  .from('whatsapp_templates_enhanced')
                                  .update({ is_active: false })
                                  .eq('id', template.id)
                                  .then(() => fetchTemplates());
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Type:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          template.template_type === 'urgent' ? 'bg-red-100 text-red-700' :
                          template.template_type === 'match' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {template.template_type}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Utilisations:</span>
                        <span className="font-bold text-gray-900">{template.usage_count}</span>
                      </div>

                      {template.suggested_emojis && template.suggested_emojis.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-600">Émojis:</span>
                          <div className="flex space-x-1 mt-1">
                            {template.suggested_emojis.slice(0, 8).map((emoji, index) => (
                              <span key={index} className="text-lg">{emoji}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 max-h-20 overflow-hidden">
                        {template.message_template.substring(0, 150)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ONGLET STATISTIQUES */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                📊 Statistiques d'engagement
              </h3>

              {/* Métriques principales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-800">Contacts</h4>
                      <p className="text-sm text-green-600">Gestion des numéros</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-700">Total:</span>
                      <span className="font-bold text-green-900">{stats.total_contacts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Valides:</span>
                      <span className="font-bold text-green-900">{stats.valid_contacts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Invalides:</span>
                      <span className="font-bold text-red-600">{stats.invalid_contacts}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-800">RGPD</h4>
                      <p className="text-sm text-blue-600">Consentements</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Accordés:</span>
                      <span className="font-bold text-green-600">{stats.consent_given}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">En attente:</span>
                      <span className="font-bold text-yellow-600">{stats.consent_pending}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Taux:</span>
                      <span className="font-bold text-blue-900">
                        {stats.total_contacts > 0 ? Math.round((stats.consent_given / stats.total_contacts) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-purple-800">Engagement</h4>
                      <p className="text-sm text-purple-600">Performance</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-purple-700">Messages:</span>
                      <span className="font-bold text-purple-900">{stats.messages_sent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Engagement:</span>
                      <span className="font-bold text-purple-900">{Math.round(stats.avg_engagement)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Actifs:</span>
                      <span className="font-bold text-green-600">
                        {contacts.filter(c => c.engagement_score > 50).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top performers */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <Target className="w-5 h-5 text-green-600" />
                  <span>Top engagement</span>
                </h4>
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
                            <p className="text-sm text-gray-600">{contact.total_messages_sent} messages reçus</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">{contact.engagement_score}%</div>
                          <div className="text-xs text-gray-500">engagement</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de création de template */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                ✨ Nouveau template WhatsApp
              </h3>
              <button
                onClick={() => setShowTemplateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du template *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex: Appel match important"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type de template *
                  </label>
                  <select
                    value={newTemplate.template_type}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, template_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="training">🏐 Entraînement</option>
                    <option value="match">🏆 Match</option>
                    <option value="urgent">🚨 Urgent</option>
                    <option value="reminder">🔔 Rappel</option>
                    <option value="custom">✏️ Personnalisé</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Description courte du template"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message template *
                </label>
                <textarea
                  value={newTemplate.message_template}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, message_template: e.target.value }))}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Votre message... Utilisez {date}, {heure}, {lieu}, {coach}, {description}, {titre} comme variables"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Variables disponibles: {'{date}'}, {'{heure}'}, {'{lieu}'}, {'{coach}'}, {'{titre}'}, {'{description}'}</span>
                  <span>{newTemplate.message_template.length} caractères</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Émojis suggérés (optionnel)
                </label>
                <input
                  type="text"
                  value={newTemplate.suggested_emojis.join(' ')}
                  onChange={(e) => setNewTemplate(prev => ({ 
                    ...prev, 
                    suggested_emojis: e.target.value.split(' ').filter(emoji => emoji.trim())
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="🏐 📅 ⏰ 📍 👨‍🏫 ✅ ❌"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Séparez les émojis par des espaces
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={createTemplate}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Créer le template
                </button>
                <button
                  onClick={() => setShowTemplateForm(false)}
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