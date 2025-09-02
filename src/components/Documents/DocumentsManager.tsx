import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit, Trash2, Eye, Download, Upload, X, Copy, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  document_type: string;
  file_name: string;
  file_path: string;
  is_active: boolean;
  download_count: number;
  created_at: string;
}

export const DocumentsManager: React.FC = () => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [currentSeason, setCurrentSeason] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('current');
  const [allSeasons, setAllSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    document_type: 'ffvbForm',
    file_name: '',
    file: null as File | null
  });
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    if (currentSeason) {
      fetchTemplates();
    }
  }, [currentSeason, selectedSeason]);

  const fetchSeasons = async () => {
    try {
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('id, name, is_current')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (seasonsError) throw seasonsError;
      
      setAllSeasons(seasonsData || []);
      const current = seasonsData?.find(s => s.is_current);
      setCurrentSeason(current || null);
    } catch (error) {
      console.error('Erreur lors du chargement des saisons:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      
      if (!currentSeason) return;

      // Déterminer la saison à utiliser
      const seasonId = selectedSeason === 'current' ? currentSeason.id : selectedSeason;

      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('season_id', seasonId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des modèles:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    try {
      if (!newTemplate.name || !newTemplate.file || !currentSeason) {
        alert('Veuillez remplir tous les champs et sélectionner un fichier');
        return;
      }

      setUploadingTemplate(true);

      // Upload du fichier vers Supabase Storage
      const fileExt = newTemplate.file.name.split('.').pop();
      const fileName = `${newTemplate.document_type}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(filePath, newTemplate.file);

      if (uploadError) throw uploadError;

      // Enregistrer le modèle dans la base de données avec season_id
      const { error } = await supabase
        .from('document_templates')
        .insert({
          name: newTemplate.name,
          description: newTemplate.description,
          document_type: newTemplate.document_type,
          file_name: newTemplate.file.name,
          file_path: filePath,
          file_size: newTemplate.file.size,
          season_id: currentSeason.id,
          is_active: true
        });

      if (error) throw error;

      setNewTemplate({
        name: '',
        description: '',
        document_type: 'registration_form',
        file_name: '',
        file: null
      });
      setShowCreateForm(false);
      await fetchTemplates();
      alert('✅ Modèle créé avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setUploadingTemplate(false);
    }
  };

  const copyTemplatesFromPreviousSeason = async () => {
    try {
      if (!currentSeason || allSeasons.length < 2) return;

      const previousSeason = allSeasons.find(s => !s.is_current);
      if (!previousSeason) return;

      const { data, error } = await supabase.rpc('copy_templates_to_new_season', {
        p_source_season_id: previousSeason.id,
        p_target_season_id: currentSeason.id
      });

      if (error) throw error;

      await fetchTemplates();
      alert(`✅ ${data || 0} modèles copiés depuis ${previousSeason.name} !`);
    } catch (error: any) {
      console.error('Erreur lors de la copie:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const updateTemplate = async (templateId: string, updates: Partial<DocumentTemplate>) => {
    try {
      const { error } = await supabase
        .from('document_templates')
        .update(updates)
        .eq('id', templateId);

      if (error) throw error;
      await fetchTemplates();
      alert('✅ Modèle mis à jour !');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce modèle ?')) return;

    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ is_active: false })
        .eq('id', templateId);

      if (error) throw error;
      await fetchTemplates();
      alert('✅ Modèle supprimé !');
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const downloadTemplate = async (template: DocumentTemplate) => {
    try {
      // Télécharger le fichier depuis Supabase Storage
      const { data, error } = await supabase.storage
        .from('templates')
        .download(template.file_path);

      if (error) throw error;

      // Créer un blob et déclencher le téléchargement
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = template.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Nettoyer l'URL
      URL.revokeObjectURL(url);

      // Incrémenter le compteur de téléchargements
      await supabase
        .from('document_templates')
        .update({ download_count: (template.download_count || 0) + 1 })
        .eq('id', template.id);

      await fetchTemplates();
      
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      alert(`❌ Erreur lors du téléchargement: ${error.message}`);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      // Anciens formats pour compatibilité
      'ffvbForm': 'Formulaire FFVB',
      'medicalCertificate': 'Certificat médical',
      'idPhoto': 'Photo d\'identité',
      'parentalConsent': 'Autorisation parentale',
      // Nouveaux formats standardisés
      'registration_form': 'Formulaire d\'inscription',
      'medical_certificate': 'Certificat médical',
      'photo': 'Photo d\'identité',
      'parental_authorization': 'Autorisation parentale',
      'identity_copy': 'Copie pièce d\'identité'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement des documents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2 mb-6">
          <FileText className="w-6 h-6 text-primary-600" />
          <span>Modèles de Documents</span>
        </h2>

        <p className="text-gray-600 mb-4">
          Gérez les modèles de documents que les membres peuvent télécharger
        </p>

        {/* Sélecteur de saison */}
        {allSeasons.length > 0 && (
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">
              Saison :
            </label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="current">Saison courante ({currentSeason?.name})</option>
              {allSeasons.filter(s => !s.is_current).map(season => (
                <option key={season.id} value={season.id}>
                  {season.name} (Historique)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Header avec bouton d'ajout */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Modèles disponibles - {selectedSeason === 'current' ? currentSeason?.name : allSeasons.find(s => s.id === selectedSeason)?.name}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedSeason === 'current' ? 'Modèles actifs pour la saison courante' : 'Modèles historiques (lecture seule)'}
            </p>
          </div>
          <div className="flex space-x-3">
            {/* Bouton de copie depuis saison précédente */}
            {selectedSeason === 'current' && allSeasons.length > 1 && templates.length === 0 && (
              <button
                onClick={copyTemplatesFromPreviousSeason}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>Copier saison précédente</span>
              </button>
            )}
            
            {/* Bouton nouveau modèle (seulement pour saison courante) */}
            {selectedSeason === 'current' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau modèle</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Liste des modèles */}
      <div className="space-y-4">
        {templates.filter(t => t.is_active).length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucun modèle disponible
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedSeason === 'current' 
                ? 'Commencez par ajouter votre premier modèle de document'
                : 'Aucun modèle n\'était disponible pour cette saison'
              }
            </p>
            {selectedSeason === 'current' && allSeasons.length > 1 && (
              <button
                onClick={copyTemplatesFromPreviousSeason}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto transition-colors"
              >
                <Copy className="w-5 h-5" />
                <span>Copier depuis la saison précédente</span>
              </button>
            )}
          </div>
        ) : (
          templates.filter(t => t.is_active).map(template => (
            <div key={template.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-600">{template.description}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {getDocumentTypeLabel(template.document_type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {template.download_count || 0} téléchargements
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => downloadTemplate(template)}
                    className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                    title="Télécharger"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {selectedSeason === 'current' && (
                    <>
                      <button
                        onClick={() => setEditingTemplate(template)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de création de modèle */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                Nouveau modèle
              </h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du modèle *
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ex: Formulaire FFVB 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                  placeholder="Description du document..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de document *
                </label>
                <select
                  value={newTemplate.document_type}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, document_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="ffvbForm">Formulaire FFVB</option>
                  <option value="medicalCertificate">Certificat médical</option>
                  <option value="idPhoto">Photo d'identité</option>
                  <option value="parentalConsent">Autorisation parentale</option>
                  <option value="identityCopy">Copie pièce d'identité</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fichier à uploader *
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setNewTemplate(prev => ({ 
                        ...prev, 
                        file: file || null,
                        file_name: file?.name || ''
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  />
                  {newTemplate.file && (
                    <p className="text-xs text-gray-500 mt-1">
                      Fichier sélectionné : {newTemplate.file.name} ({Math.round(newTemplate.file.size / 1024)} KB)
                    </p>
                  )}
                </div>
              </div>

              {/* Info saison */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  📅 Ce modèle sera créé pour la saison courante : <strong>{currentSeason?.name}</strong>
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={createTemplate}
                  disabled={uploadingTemplate}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  {uploadingTemplate ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Upload...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Créer et uploader</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={uploadingTemplate}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'édition */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
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
                  Description
                </label>
                <textarea
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    if (editingTemplate) {
                      updateTemplate(editingTemplate.id, {
                        name: editingTemplate.name,
                        description: editingTemplate.description
                      });
                      setEditingTemplate(null);
                    }
                  }}
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

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Modèles cette saison</p>
              <p className="text-2xl font-bold text-gray-900">{templates.filter(t => t.is_active).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Download className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Téléchargements</p>
              <p className="text-2xl font-bold text-gray-900">
                {templates.reduce((sum, t) => sum + (t.download_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Types disponibles</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(templates.map(t => t.document_type)).size}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Saison</p>
              <p className="text-2xl font-bold text-gray-900">
                {selectedSeason === 'current' ? 'Courante' : 'Historique'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};