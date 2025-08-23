import React, { useState, useEffect } from 'react';
import { FileText, Download, Upload, CheckCircle, XCircle, Clock, AlertCircle, Eye, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Document {
  id: string;
  document_type: string;
  file_name: string;
  status: string;
  uploaded_at: string;
  rejection_reason?: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  document_type: string;
  file_name: string;
  file_path?: string;
}

interface MemberData {
  id: string;
  email: string;
  season_id?: string;
  birth_date?: string;
}

interface Season {
  id: string;
  name: string;
  is_current: boolean;
}

export const MemberDocuments: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('current');
  const [allSeasons, setAllSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);

  useEffect(() => {
    fetchSeasons();
    fetchMemberData();
  }, []);

  useEffect(() => {
    if (memberData && currentSeason) {
      fetchDocuments();
      fetchTemplates();
    }
  }, [memberData, currentSeason, selectedSeason]);

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 18; // Valeur par défaut si pas de date de naissance
    
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

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

  const fetchMemberData = async () => {
    try {
      if (!user) return;

      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id, email, season_id, birth_date')
        .eq('email', user.email)
        .maybeSingle();

      if (memberError) {
        console.error('Erreur lors du chargement du profil membre:', memberError);
        return;
      }

      setMemberData(member);
    } catch (error) {
      console.error('Erreur lors du chargement du profil membre:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      if (!user || !memberData || !currentSeason) return;

      // Déterminer la saison à utiliser
      const seasonId = selectedSeason === 'current' ? currentSeason.id : selectedSeason;

      // Récupérer les documents du membre
      const { data, error } = await supabase
        .from('member_documents')
        .select('*')
        .eq('member_id', memberData.id)
        .eq('season_id', seasonId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      if (!currentSeason) return;

      // Déterminer la saison à utiliser
      const seasonId = selectedSeason === 'current' ? currentSeason.id : selectedSeason;

      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('is_active', true)
        .eq('season_id', seasonId)
        .order('document_type');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des modèles:', error);
    }
  };

  const downloadTemplate = async (template: Template) => {
    try {
      if (!template.file_path) {
        alert('Fichier non disponible');
        return;
      }

      const { data, error } = await supabase.storage
        .from('document_templates')
        .createSignedUrl(template.file_path, 3600); // 1 heure

      if (error) throw error;

      if (data?.signedUrl) {
        // Incrémenter le compteur de téléchargement
        await supabase
          .from('document_templates')
          .update({ download_count: (template as any).download_count + 1 })
          .eq('id', template.id);

        // Créer un lien temporaire pour télécharger
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = template.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error: any) {
      console.error('Erreur lors du téléchargement:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const handleFileUpload = async (file: File, documentType: string) => {
    try {
      setUploading(documentType);

      if (!user) throw new Error('Utilisateur non connecté');
      if (!memberData) throw new Error('Aucun profil membre trouvé');
      if (!currentSeason) throw new Error('Aucune saison courante trouvée');

      // Validation du fichier
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      
      if (file.size > maxSize) {
        throw new Error('Le fichier est trop volumineux (max 10MB)');
      }
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Format non supporté (PDF, JPG, PNG uniquement)');
      }

      // Créer le chemin du fichier
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentType}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('member_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

     // Enregistrer dans la base de données
const insertData = {
  member_id: memberData.id,
  document_type: documentType,
  file_name: file.name,
  file_path: filePath,
  file_size: file.size,
  mime_type: file.type,
  status: 'pending',
  season_id: currentSeason.id
};

// 🔍 DEBUG - Ajoutez ces lignes ICI
console.log('🔍 Type de document envoyé:', documentType);
console.log('🔍 Données complètes à insérer:', insertData);
console.log('🔍 Type de variable documentType:', typeof documentType);
console.log('🔍 Valeur exacte:', JSON.stringify(documentType));

      const { error: dbError } = await supabase
        .from('member_documents')
        .insert(insertData);

      if (dbError) throw dbError;

      await fetchDocuments();
      alert('✅ Document uploadé avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de l\'upload:', error);
      alert(`❌ ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  const viewDocument = async (document: Document) => {
    try {
      // Récupérer l'URL signée du document
      const { data, error } = await supabase.storage
        .from('member_documents')
        .createSignedUrl(document.file_path, 3600); // 1 heure

      if (error) throw error;

      if (data?.signedUrl) {
        // Si c'est une image, ouvrir dans une modal
        if (document.mime_type?.startsWith('image/')) {
          setViewingDocument(document);
        } else {
          // Sinon ouvrir dans un nouvel onglet
          window.open(data.signedUrl, '_blank');
        }
      } else {
        throw new Error('Impossible de générer l\'URL du document');
      }
    } catch (error: any) {
      console.error('Erreur lors de la visualisation:', error);
      alert(`❌ Erreur lors de la visualisation: ${error.message}`);
    }
  };

  const deleteDocument = async (document: Document) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      setDeleting(document.id);

      // Supprimer le fichier du stockage
      const { error: storageError } = await supabase.storage
        .from('member_documents')
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Supprimer l'enregistrement de la base de données
      const { error: dbError } = await supabase
        .from('member_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      await fetchDocuments();
      alert('✅ Document supprimé avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la suppression:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'validated':
        return 'Validé';
      case 'rejected':
        return 'Rejeté';
      default:
        return 'En attente';
    }
  };

 const getRequiredDocuments = () => {
  if (!memberData?.birth_date) return [];
  
  const age = calculateAge(memberData.birth_date);
  const baseDocuments = [
  'medical_certificate',
  'photo',
  'registration_form',
  'identity_copy'
];

if (age < 18) {
  baseDocuments.push('parental_authorization');
}

  return baseDocuments;
};

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de vos documents...</p>
        </div>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Aucun profil membre trouvé
          </h2>
          <p className="text-gray-600">
            Vous devez d'abord vous inscrire comme membre pour accéder aux documents.
          </p>
        </div>
      </div>
    );
  }

  const requiredDocuments = getRequiredDocuments();
  const canUpload = selectedSeason === 'current' && currentSeason?.is_current;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">📁 Mes Documents</h1>
          <p className="text-gray-600">
            Gérez vos documents d'inscription et de licence
          </p>
        </div>

        {/* Sélecteur de saison */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📅 Saison
          </label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="current">Saison courante ({currentSeason?.name})</option>
            {allSeasons.filter(s => !s.is_current).map(season => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>

        {/* Modèles de documents */}
        {templates.length > 0 && (
          <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📄 Modèles de documents à télécharger
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="font-medium text-gray-800">{template.name}</h3>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadTemplate(template)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents requis */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📋 Documents requis
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {requiredDocuments.map((docType) => {
              const existingDoc = documents.find(d => d.document_type === docType);
              const template = templates.find(t => t.document_type === docType);
              
              const getDocumentTitle = (type: string) => {
                const titles: { [key: string]: string } = {
                  'medical_certificate': '🏥 Certificat médical',
                  'photo': '📸 Photo d\'identité',
                  'registration_form': '📝 Formulaire d\'inscription',
                  'parental_authorization': '👨‍👩‍👧‍👦 Autorisation parentale',
                  'identity_copy': '🆔 Copie pièce d\'identité',
                  'ffvbForm': '📋 Formulaire FFVB',
                  'medicalCertificate': '🏥 Certificat médical',
                  'idPhoto': '📸 Photo d\'identité',
                  'parentalConsent': '👨‍👩‍👧‍👦 Autorisation parentale',
                  'identityCopy': '🆔 Copie pièce d\'identité'
                };
                return titles[type] || type;
              };

              return (
                <div
                  key={docType}
                  className={`border-2 rounded-lg p-4 ${
                    existingDoc?.status === 'validated' 
                      ? 'border-green-200 bg-green-50' 
                      : existingDoc?.status === 'rejected'
                      ? 'border-red-200 bg-red-50'
                      : existingDoc
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800 mb-1">
                        {getDocumentTitle(docType)}
                      </h3>
                      {existingDoc && (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(existingDoc.status)}
                            <span className="text-sm font-medium">
                              {getStatusText(existingDoc.status)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            📁 {existingDoc.file_name}
                          </p>
                          {existingDoc.file_size && (
                            <p className="text-xs text-gray-500">
                              💾 {formatFileSize(existingDoc.file_size)}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            📅 {new Date(existingDoc.uploaded_at).toLocaleDateString('fr-FR')}
                          </p>
                          {existingDoc.status === 'rejected' && existingDoc.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
                              <strong>Motif:</strong> {existingDoc.rejection_reason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      {template && (
                        <button
                          onClick={() => downloadTemplate(template)}
                          className="text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-300 rounded text-sm flex items-center space-x-1 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Modèle</span>
                        </button>
                      )}
                      
                      {existingDoc && (
                        <>
                          <button
                            onClick={() => viewDocument(existingDoc)}
                            className="text-gray-600 hover:text-gray-800 px-3 py-1 border border-gray-300 rounded text-sm flex items-center space-x-1 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Voir</span>
                          </button>
                          
                          {canUpload && existingDoc.status !== 'validated' && (
                            <button
                              onClick={() => deleteDocument(existingDoc)}
                              disabled={deleting === existingDoc.id}
                              className="text-red-600 hover:text-red-800 px-3 py-1 border border-red-300 rounded text-sm flex items-center space-x-1 transition-colors disabled:opacity-50"
                            >
                              {deleting === existingDoc.id ? (
                                <>
                                  <div className="w-3 h-3 border border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                  <span>...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3 h-3" />
                                  <span>Suppr.</span>
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    
                    {(!existingDoc || existingDoc.status === 'rejected') && canUpload && (
                      <label className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center space-x-2 transition-colors">
                        {uploading === docType ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Upload...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>{existingDoc ? 'Remplacer' : 'Uploader'}</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, docType);
                            }
                          }}
                          disabled={uploading === docType}
                        />
                      </label>
                    )}
                    
                    {!canUpload && !existingDoc && (
                      <span className="text-xs text-gray-500 px-3 py-2 bg-gray-100 rounded-lg">
                        Saison fermée
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progression */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">📊 Progression de votre dossier</h3>
          <div className="mb-2">
            <span className="text-sm text-gray-600">
              Saison : {selectedSeason === 'current' ? currentSeason?.name : allSeasons.find(s => s.id === selectedSeason)?.name}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Documents uploadés</span>
              <span>{documents.length} / {requiredDocuments.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${requiredDocuments.length > 0 ? (documents.length / requiredDocuments.length) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Validés: {documents.filter(d => d.status === 'validated').length}</span>
              <span>En attente: {documents.filter(d => d.status === 'pending').length}</span>
              <span>Rejetés: {documents.filter(d => d.status === 'rejected').length}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-2">💡 Instructions</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>1. Téléchargez les modèles de documents ci-dessus</p>
            <p>2. Complétez et signez chaque document</p>
            <p>3. Scannez ou photographiez les documents complétés</p>
            <p>4. Uploadez-les ici (formats acceptés : PDF, JPG, PNG - max 10MB)</p>
            <p>5. Attendez la validation par un administrateur</p>
            <p className="font-medium">📅 Les documents sont liés à la saison courante : {currentSeason?.name}</p>
          </div>
        </div>
      </div>

      {/* Modal de prévisualisation */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">
                  {viewingDocument.file_name}
                </h3>
                <p className="text-sm text-gray-600">
                  {viewingDocument.file_size && formatFileSize(viewingDocument.file_size)}
                </p>
              </div>
              <button
                onClick={() => setViewingDocument(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              {viewingDocument.mime_type?.startsWith('image/') ? (
                <img
                  src={`${supabase.supabaseUrl}/storage/v1/object/public/member_documents/${viewingDocument.file_path}`}
                  alt={viewingDocument.file_name}
                  className="max-w-full h-auto rounded"
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">
                    Prévisualisation non disponible pour ce type de fichier.
                  </p>
                  <button
                    onClick={() => {
                      // Ouvrir le fichier dans un nouvel onglet
                      supabase.storage
                        .from('member_documents')
                        .createSignedUrl(viewingDocument.file_path, 3600)
                        .then(({ data }) => {
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                          }
                        });
                    }}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                  >
                    Ouvrir dans un nouvel onglet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
