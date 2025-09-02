import React, { useState } from 'react';
import { Calendar, Download, Link, Copy, Smartphone, Monitor, Globe, RefreshCw, Eye, EyeOff, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { generateICSFile, downloadICSFile, generateSyncURL, getGoogleCalendarInstructions, getCalendarInstructions } from '../../utils/calendarExport';

interface CalendarExportProps {
  memberData: any;
  sessions: any[];
  onClose: () => void;
}

export const CalendarExport: React.FC<CalendarExportProps> = ({ memberData, sessions, onClose }) => {
  const [showSyncUrl, setShowSyncUrl] = useState(false);
  const [showInstructions, setShowInstructions] = useState<'google' | 'other' | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [currentToken, setCurrentToken] = useState(memberData.calendar_token);

  const syncUrl = generateSyncURL(currentToken);
  const memberName = `${memberData.first_name} ${memberData.last_name}`;

  const handleDownloadICS = () => {
    const icsContent = generateICSFile(sessions, memberName);
    const fileName = `BE_FOR_NOR_KA_Entrainements_${memberName.replace(/\s+/g, '_')}.ics`;
    
    downloadICSFile(icsContent, fileName);
    
    alert(`📅 Fichier calendrier téléchargé !

📁 Fichier : ${fileName}
📊 ${sessions.length} entraînements inclus

💡 Ouvrez ce fichier pour l'importer dans votre calendrier.
🔄 Pour une synchronisation automatique, utilisez plutôt l'URL de synchronisation.`);
  };

  const handleCopySyncUrl = () => {
    navigator.clipboard.writeText(syncUrl);
    alert('🔗 URL de synchronisation copiée !');
  };

  const handleRegenerateToken = async () => {
    if (!confirm('⚠️ Régénérer le token de synchronisation ?\n\nCela invalidera l\'ancien lien et vous devrez reconfigurer vos calendriers.')) {
      return;
    }

    try {
      setRegenerating(true);
      
      // Appeler la fonction PostgreSQL pour régénérer le token
      const { data, error } = await supabase.rpc('regenerate_calendar_token', {
        p_member_id: memberData.id
      });

      if (error) throw error;

      if (data.success) {
        setCurrentToken(data.new_token);
        alert('✅ Nouveau token généré !\n\n🔗 Votre nouvelle URL de synchronisation est prête.\n⚠️ Reconfigurez vos calendriers avec la nouvelle URL.');
      } else {
        throw new Error('Erreur lors de la régénération');
      }
    } catch (error: any) {
      console.error('Erreur régénération token:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              <span>📅 Intégration Calendrier</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Résumé */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">📊 Vos entraînements</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>{sessions.length} entraînements</strong> programmés</p>
                <p>• <strong>Filtrage automatique</strong> selon vos catégories</p>
                <p>• <strong>Mise à jour automatique</strong> si changements</p>
                <p>• <strong>Rappels intégrés</strong> : 2h et 30min avant</p>
              </div>
            </div>

            {/* Option 1: Téléchargement ponctuel */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Download className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">📁 Téléchargement ponctuel</h3>
                  <p className="text-sm text-gray-600">Fichier .ics à importer manuellement</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800 mb-2">✅ Avantages</h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>• Simple et rapide</p>
                    <p>• Fonctionne avec tous les calendriers</p>
                    <p>• Pas de configuration complexe</p>
                  </div>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-3">
                  <h4 className="font-medium text-yellow-800 mb-2">⚠️ Inconvénients</h4>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <p>• Pas de mise à jour automatique</p>
                    <p>• À refaire à chaque changement</p>
                  </div>
                </div>
                
                <button
                  onClick={handleDownloadICS}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors font-semibold"
                >
                  <Download className="w-5 h-5" />
                  <span>Télécharger le fichier .ics</span>
                </button>
              </div>
            </div>

            {/* Option 2: Synchronisation automatique */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Link className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">🔄 Synchronisation automatique</h3>
                  <p className="text-sm text-gray-600">URL de synchronisation pour mise à jour automatique</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <h4 className="font-medium text-green-800 mb-2">✅ Avantages (RECOMMANDÉ)</h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>• <strong>Mise à jour automatique</strong> toutes les 15min-1h</p>
                    <p>• <strong>Notifications natives</strong> de votre téléphone</p>
                    <p>• <strong>Synchronisation multi-appareils</strong> (phone, PC, tablette)</p>
                    <p>• <strong>Rappels personnalisés</strong> intégrés</p>
                  </div>
                </div>

                {/* URL de synchronisation */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-800">🔗 URL de synchronisation</h4>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowSyncUrl(!showSyncUrl)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title={showSyncUrl ? 'Masquer URL' : 'Afficher URL'}
                      >
                        {showSyncUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleCopySyncUrl}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Copier URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {showSyncUrl ? (
                    <div className="bg-white border border-gray-200 rounded p-3">
                      <code className="text-xs text-gray-600 break-all font-mono">
                        {syncUrl}
                      </code>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded p-3 text-center">
                      <span className="text-gray-500 text-sm">••••••••••••••••••••••••••••••••••••••••</span>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ Gardez cette URL secrète - elle donne accès à vos entraînements
                  </p>
                </div>

                {/* Boutons d'instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowInstructions('google')}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Globe className="w-5 h-5" />
                    <span>Google Calendar</span>
                  </button>
                  
                  <button
                    onClick={() => setShowInstructions('other')}
                    className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>Autres calendriers</span>
                  </button>
                </div>

                {/* Régénération du token */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-red-800">🔒 Sécurité</h4>
                      <p className="text-sm text-red-700">
                        Si vous pensez que votre URL a été compromise, régénérez-la.
                      </p>
                    </div>
                    <button
                      onClick={handleRegenerateToken}
                      disabled={regenerating}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
                    >
                      {regenerating ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Régénérer</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions détaillées */}
            {showInstructions && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800">
                    {showInstructions === 'google' ? '📱 Google Calendar' : '📅 Autres calendriers'}
                  </h4>
                  <button
                    onClick={() => setShowInstructions(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="bg-white rounded-lg p-4">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {showInstructions === 'google' 
                      ? getGoogleCalendarInstructions(syncUrl)
                      : getCalendarInstructions(syncUrl)
                    }
                  </pre>
                </div>
                
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={handleCopySyncUrl}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copier l'URL</span>
                  </button>
                  
                  {showInstructions === 'google' && (
                    <button
                      onClick={() => window.open('https://calendar.google.com', '_blank')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Ouvrir Google Calendar</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Statistiques */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{sessions.length}</div>
                <div className="text-xs text-blue-600">Entraînements</div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  {sessions.filter(s => new Date(s.date) >= new Date()).length}
                </div>
                <div className="text-xs text-green-600">À venir</div>
              </div>
              
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-700">2</div>
                <div className="text-xs text-purple-600">Rappels</div>
              </div>
              
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-700">Auto</div>
                <div className="text-xs text-orange-600">Sync</div>
              </div>
            </div>

            {/* Informations importantes */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important</h4>
                  <div className="text-sm text-yellow-700 space-y-1">
                    <p>• <strong>URL secrète :</strong> Ne partagez jamais votre URL de synchronisation</p>
                    <p>• <strong>Délai de sync :</strong> Mise à jour toutes les 15min à 1h selon votre calendrier</p>
                    <p>• <strong>Filtrage automatique :</strong> Seuls VOS entraînements apparaissent</p>
                    <p>• <strong>Révocation :</strong> Régénérez le token si URL compromise</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex space-x-3 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
              
              <button
                onClick={handleDownloadICS}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger .ics</span>
              </button>
              
              <button
                onClick={() => setShowInstructions('google')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Link className="w-4 h-4" />
                <span>Synchroniser</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};