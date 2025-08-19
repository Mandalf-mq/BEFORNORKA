import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, Send, Plus, Edit, Trash2, Eye, X, Copy, Calendar, Clock, MapPin, User } from 'lucide-react';
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

interface MessageTemplate {
  id: string;
  name: string;
  message: string;
  template_type: string;
  is_default: boolean;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  category: string;
}

export const WhatsAppManager: React.FC = () => {
  const { userProfile } = useAuth();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    message: '',
    template_type: 'training'
  });

  useEffect(() => {
    fetchSessions();
    fetchTemplates();
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [selectedCategories]);

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

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des modèles:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      // Utiliser la fonction RPC si disponible, sinon requête directe
      let data, error;
      
      try {
        const result = await supabase.rpc('get_members_for_whatsapp', {
          p_categories: selectedCategories.length > 0 ? selectedCategories : null
        });
        data = result.data;
        error = result.error;
      } catch (rpcError) {
        // Fallback vers requête directe si la fonction RPC n'existe pas
        const result = await supabase
          .from('members')
          .select('id, first_name, last_name, phone, category')
          .eq('status', 'season_validated')
          .not('phone', 'is', null)
          .neq('phone', '');
        
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMessage = () => {
    if (!selectedSession || !selectedTemplate) return '';

    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return '';

    let message = template.message;
    
    // Remplacer les variables
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
    message = message.replace(/{titre}/g, selectedSession.title);

    return message;
  };

  const sendWhatsAppMessage = async () => {
    if (!selectedSession || (!selectedTemplate && !customMessage)) {
      alert('Veuillez sélectionner une séance et un modèle de message');
      return;
    }

    const finalMessage = customMessage || generateMessage();
    if (!finalMessage) {
      alert('Impossible de générer le message');
      return;
    }

    const filteredMembers = members.filter(member => 
      selectedCategories.length === 0 || selectedCategories.includes(member.category)
    );

    if (filteredMembers.length === 0) {
      alert('Aucun membre sélectionné pour l\'envoi');
      return;
    }

    try {
      setSending(true);

      // Enregistrer la notification dans la base
      const { error } = await supabase
        .from('whatsapp_notifications')
        .insert({
          session_id: selectedSession.id,
          session_title: selectedSession.title,
          template_used: selectedTemplate || 'custom',
          message: finalMessage,
          recipient_count: filteredMembers.length,
          sent_via: 'web',
          sent_by: userProfile?.id
        });

      if (error) throw error;

      // Générer les liens WhatsApp
      const whatsappLinks = filteredMembers.map(member => {
        const encodedMessage = encodeURIComponent(finalMessage);
        const phoneNumber = member.phone.replace(/\D/g, ''); // Supprimer tous les caractères non numériques
        const formattedPhone = phoneNumber.startsWith('33') ? phoneNumber : `33${phoneNumber.substring(1)}`;
        
        return {
          member: `${member.first_name} ${member.last_name}`,
          phone: member.phone,
          link: `https://wa.me/${formattedPhone}?text=${encodedMessage}`
        };
      });

      // Afficher les liens dans une nouvelle fenêtre
      const linksWindow = window.open('', '_blank');
      if (linksWindow) {
        linksWindow.document.write(`
          <html>
            <head>
              <title>Liens WhatsApp - ${selectedSession.title}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .member { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                .link { color: #25D366; text-decoration: none; font-weight: bold; }
                .link:hover { text-decoration: underline; }
                .message { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; white-space: pre-wrap; }
              </style>
            </head>
            <body>
              <h1>🏐 BE FOR NOR KA - Appel d'entraînement</h1>
              <h2>📅 ${selectedSession.title}</h2>
              <p><strong>Date :</strong> ${new Date(selectedSession.date).toLocaleDateString('fr-FR')}</p>
              <p><strong>Heure :</strong> ${selectedSession.start_time} - ${selectedSession.end_time}</p>
              <p><strong>Lieu :</strong> ${selectedSession.location}</p>
              <p><strong>Coach :</strong> ${selectedSession.coach}</p>
              
              <h3>📱 Message à envoyer :</h3>
              <div class="message">${finalMessage}</div>
              
              <h3>👥 Membres à contacter (${filteredMembers.length}) :</h3>
              ${whatsappLinks.map(link => `
                <div class="member">
                  <strong>${link.member}</strong> - ${link.phone}<br>
                  <a href="${link.link}" target="_blank" class="link">📱 Ouvrir WhatsApp</a>
                </div>
              `).join('')}
              
              <p style="margin-top: 30px; color: #666; font-size: 12px;">
                💡 Cliquez sur "Ouvrir WhatsApp" pour chaque membre pour envoyer le message automatiquement.
              </p>
            </body>
          </html>
        `);
      }

      alert(`✅ ${filteredMembers.length} liens WhatsApp générés !

📱 Une nouvelle fenêtre s'est ouverte avec tous les liens.
👆 Cliquez sur chaque lien pour envoyer le message automatiquement.`);

    } catch (error: any) {
      console.error('Erreur lors de l\'envoi:', error);
      alert(`❌ Erreur lors de l'envoi: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const createTemplate = async () => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .insert({
          name: newTemplate.name,
          message: newTemplate.message,
          template_type: newTemplate.template_type,
          is_default: false,
          created_by: userProfile?.id
        });

      if (error) throw error;

      setNewTemplate({ name: '', message: '', template_type: 'training' });
      setShowTemplateForm(false);
      await fetchTemplates();
      alert('✅ Modèle créé avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const updateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .update({
          name: editingTemplate.name,
          message: editingTemplate.message,
          template_type: editingTemplate.template_type
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      setEditingTemplate(null);
      await fetchTemplates();
      alert('✅ Modèle mis à jour avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce modèle ?')) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      await fetchTemplates();
      alert('✅ Modèle supprimé !');
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const availableCategories = [...new Set(members.map(m => m.category))];

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement des données WhatsApp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <MessageSquare className="w-6 h-6 text-primary-600" />
            <span>Gestionnaire WhatsApp</span>
          </h2>
          <button
            onClick={() => setShowTemplateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau modèle</span>
          </button>
        </div>
        <p className="text-gray-600">
          Envoyez des appels d'entraînement via WhatsApp aux membres validés
        </p>
      </div>

      {/* Sélection de la séance */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📅 Sélectionner une séance d'entraînement
        </h3>
        
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucune séance d'entraînement programmée</p>
            <p className="text-xs text-gray-400 mt-2">
              Créez des séances dans l'onglet "Entraînements"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedSession?.id === session.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <h4 className="font-semibold text-gray-900">{session.title}</h4>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
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
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>Coach: {session.coach}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {session.category.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                    >
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
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🏐 Sélectionner les catégories
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {availableCategories.map((category) => (
            <label key={category} className="flex items-center space-x-2 cursor-pointer">
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
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 capitalize">{category}</span>
            </label>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            👥 Membres concernés : {members.filter(m => 
              selectedCategories.length === 0 || selectedCategories.includes(m.category)
            ).length}
          </p>
        </div>
      </div>

      {/* Modèles de messages */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            💬 Modèles de messages
          </h3>
          <button
            onClick={() => setShowTemplateForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau modèle</span>
          </button>
        </div>
        
        <div className="space-y-4">
          <select
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value);
              setCustomMessage('');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Sélectionner un modèle...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} {template.is_default ? '(Par défaut)' : ''}
              </option>
            ))}
          </select>

          {/* Liste des modèles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingTemplate(template)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {!template.is_default && (
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Type: {template.template_type}
                </p>
                <p className="text-xs text-gray-500 line-clamp-3">
                  {template.message.substring(0, 100)}...
                </p>
              </div>
            ))}
          </div>

          {/* Aperçu du message */}
          {(selectedTemplate || customMessage) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">📱 Aperçu du message</h4>
              <div className="bg-white border border-gray-300 rounded-lg p-3 text-sm whitespace-pre-wrap">
                {customMessage || generateMessage()}
              </div>
            </div>
          )}

          {/* Message personnalisé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ou écrivez un message personnalisé :
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => {
                setCustomMessage(e.target.value);
                setSelectedTemplate('');
              }}
              placeholder="Tapez votre message personnalisé..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Bouton d'envoi */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              🚀 Envoyer l'appel d'entraînement
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {members.filter(m => 
                selectedCategories.length === 0 || selectedCategories.includes(m.category)
              ).length} membre(s) recevront le message
            </p>
          </div>
          
          <button
            onClick={sendWhatsAppMessage}
            disabled={!selectedSession || (!selectedTemplate && !customMessage) || sending}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Génération...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Générer les liens WhatsApp</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Liste des membres */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          👥 Membres validés avec téléphone
        </h3>
        
        {members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aucun membre validé avec numéro de téléphone</p>
            <p className="text-xs text-gray-400 mt-2">
              Les membres doivent être validés pour la saison et avoir un numéro de téléphone
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members
              .filter(member => 
                selectedCategories.length === 0 || selectedCategories.includes(member.category)
              )
              .map((member) => (
                <div key={member.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-semibold text-sm">
                        {member.first_name[0]}{member.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{member.phone}</p>
                      <p className="text-xs text-gray-500">{member.category}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Modal de création de modèle */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Nouveau modèle de message
              </h3>
              <button
                onClick={() => setShowTemplateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du modèle
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ex: Appel entraînement urgent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de modèle
                </label>
                <select
                  value={newTemplate.template_type}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, template_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="training">Entraînement</option>
                  <option value="match">Match</option>
                  <option value="urgent">Urgent</option>
                  <option value="reminder">Rappel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={newTemplate.message}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, message: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Votre message... Utilisez {date}, {heure}, {lieu}, {coach}, {description} comme variables"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="font-semibold text-blue-800 mb-2">💡 Variables disponibles</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>• <code>{'{date}'}</code> - Date de la séance</p>
                  <p>• <code>{'{heure}'}</code> - Horaires de la séance</p>
                  <p>• <code>{'{lieu}'}</code> - Lieu de la séance</p>
                  <p>• <code>{'{coach}'}</code> - Nom du coach</p>
                  <p>• <code>{'{description}'}</code> - Description de la séance</p>
                  <p>• <code>{'{titre}'}</code> - Titre de la séance</p>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={createTemplate}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Créer le modèle
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

      {/* Modal d'édition de modèle */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Modifier le modèle
              </h3>
              <button
                onClick={() => setEditingTemplate(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du modèle
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de modèle
                </label>
                <select
                  value={editingTemplate.template_type}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, template_type: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="training">Entraînement</option>
                  <option value="match">Match</option>
                  <option value="urgent">Urgent</option>
                  <option value="reminder">Rappel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={editingTemplate.message}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, message: e.target.value } : null)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={updateTemplate}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Sauvegarder
                </button>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message personnalisé */}
      {!selectedTemplate && (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ✏️ Message personnalisé
          </h3>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Tapez votre message personnalisé..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Bouton d'envoi */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              🚀 Envoyer l'appel d'entraînement
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {members.filter(m => 
                selectedCategories.length === 0 || selectedCategories.includes(m.category)
              ).length} membre(s) recevront le message
            </p>
          </div>
          
          <button
            onClick={sendWhatsAppMessage}
            disabled={!selectedSession || (!selectedTemplate && !customMessage) || sending}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Génération...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Générer les liens WhatsApp</span>
              </>
            )}
          </button>
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
              <p className="text-sm text-gray-600">Membres validés</p>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Modèles disponibles</p>
              <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Séances à venir</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600 font-bold text-lg">🏐</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Catégories actives</p>
              <p className="text-2xl font-bold text-gray-900">{availableCategories.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};