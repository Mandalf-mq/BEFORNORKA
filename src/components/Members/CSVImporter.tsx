import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, X, AlertCircle, CheckCircle, Users, Copy, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CSVImporterProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  imported_count: number;
  error_count: number;
  errors: string[];
  credentials?: Array<{
    email: string;
    name: string;
    password: string;
    member_id: string;
  }>;
}

export const CSVImporter: React.FC<CSVImporterProps> = ({ onClose, onSuccess }) => {
  const { userProfile } = useAuth();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importMode, setImportMode] = useState<'profiles' | 'accounts'>('profiles');
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('value, label, membership_fee')
        .eq('is_active', true);

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    }
  };

  const generateStrongPassword = () => {
    const lowercase = 'abcdefghijkmnpqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const specials = '!@#$%^&*()_+-=[]{}';
    
    let password = '';
    
    // Garantir au moins un caractère de chaque type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    // Compléter avec 8 caractères supplémentaires pour avoir 12 au total
    const allChars = lowercase + uppercase + numbers + specials;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mélanger le mot de passe
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const downloadTemplate = () => {
    const csvContent = `first_name,last_name,email,phone,birth_date,category,membership_fee,address,postal_code,city,ffvb_license,emergency_contact,emergency_phone,notes
Jean,Dupont,jean.dupont@email.com,0123456789,1990-05-15,loisirs,200,"123 Rue de la Paix",75001,Paris,12345678,"Marie Dupont",0987654321,"Membre actif"
Marie,Martin,marie.martin@email.com,0234567890,1985-08-22,senior,250,"456 Avenue des Sports",69001,Lyon,,"Pierre Martin",0876543210,"Nouvelle membre"
Pierre,Durand,pierre.durand@email.com,,1995-12-03,loisirs,200,"789 Boulevard du Volleyball",13001,Marseille,87654321,"Sophie Durand",0765432109,"Joueur expérimenté"`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_import_membres.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('❌ Veuillez sélectionner un fichier CSV');
      return;
    }

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('❌ Le fichier CSV doit contenir au moins un en-tête et une ligne de données');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setCsvData(data);
    };
    
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.length) {
      alert('❌ Veuillez d\'abord charger un fichier CSV');
      return;
    }

    try {
      setLoading(true);

      if (importMode === 'accounts') {
        // Mode avec création de comptes via Edge Function
        const csvDataWithPasswords = csvData.map(row => ({
          ...row,
          temporary_password: generateStrongPassword()
        }));

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            accounts: csvDataWithPasswords
          })
        });

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          setImportResult({
            success: true,
            imported_count: result.success_count,
            error_count: result.error_count || 0,
            errors: result.results?.filter((r: any) => !r.success).map((r: any) => `${r.email}: ${r.error}`) || [],
            credentials: result.results?.filter((r: any) => r.success).map((r: any) => ({
              email: r.email,
              name: csvDataWithPasswords.find(c => c.email === r.email)?.first_name + ' ' + csvDataWithPasswords.find(c => c.email === r.email)?.last_name,
              password: r.temporary_password,
              member_id: r.user_id
            })) || []
          });

          alert(`✅ Import avec comptes terminé !

📊 Résultats :
• ${result.success_count} comptes créés avec authentification
• ${result.error_count || 0} erreurs
• Identifiants prêts à communiquer

🔑 Les utilisateurs peuvent maintenant se connecter directement !`);
        } else {
          throw new Error(result.error || 'Erreur inconnue');
        }

      } else {
        // Mode profils seulement (sans comptes de connexion)
        const { data, error } = await supabase.rpc('import_csv_members_simple', {
          p_csv_data: csvData
        });

        if (error) throw error;
        
        setImportResult({
          success: true,
          imported_count: data.imported_count,
          error_count: data.error_count,
          errors: data.errors || [],
          credentials: data.credentials || []
        });

        if (data.success) {
          alert(`✅ Import profils terminé !

📊 Résultats :
• ${data.imported_count} profils membres créés
• ${data.error_count} erreurs
• Pas de comptes de connexion (profils seulement)

📋 Les membres devront s'inscrire manuellement sur /auth`);
        }
      }

    } catch (error: any) {
      console.error('Erreur lors de l\'import:', error);
      alert(`❌ Erreur lors de l'import: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCredentialsToClipboard = () => {
    if (!importResult?.credentials) return;

    const credentialsText = importResult.credentials
      .map(cred => `${cred.name} - ${cred.email} - Mot de passe: ${cred.password}`)
      .join('\n');

    navigator.clipboard.writeText(credentialsText);
    alert('📋 Identifiants copiés dans le presse-papiers !');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              📊 Import CSV - Membres
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {!importResult ? (
            <div className="space-y-6">
              {/* Mode d'import */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🎯 Mode d'import
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    importMode === 'profiles' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="profiles"
                      checked={importMode === 'profiles'}
                      onChange={(e) => setImportMode(e.target.value as 'profiles' | 'accounts')}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">Profils seulement</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Crée les profils membres sans comptes de connexion
                      </p>
                      <p className="text-xs text-blue-600 mt-2">
                        ✅ Simple • Les membres s'inscrivent eux-mêmes
                      </p>
                    </div>
                  </label>

                  <label className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    importMode === 'accounts' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      value="accounts"
                      checked={importMode === 'accounts'}
                      onChange={(e) => setImportMode(e.target.value as 'profiles' | 'accounts')}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <h4 className="font-semibold text-gray-900">Comptes complets</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Crée profils + comptes de connexion Supabase
                      </p>
                      <p className="text-xs text-green-600 mt-2">
                        🚀 Avancé • Connexion immédiate possible
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Template CSV */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3">📋 Format CSV requis</h4>
                <div className="text-sm text-blue-700 space-y-1 mb-3">
                  <p><strong>Colonnes obligatoires :</strong> first_name, last_name, email</p>
                  <p><strong>Colonnes optionnelles :</strong> phone, birth_date, category, membership_fee, address, postal_code, city, ffvb_license, emergency_contact, emergency_phone, notes</p>
                  <p><strong>Catégories disponibles :</strong> {categories.map(c => c.value).join(', ')}</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le template CSV</span>
                </button>
              </div>

              {/* Upload de fichier */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📁 Charger le fichier CSV
                </h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      Cliquez pour sélectionner un fichier CSV
                    </p>
                    <p className="text-sm text-gray-500">
                      Formats acceptés : .csv (max 5MB)
                    </p>
                  </label>
                </div>

                {csvFile && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">{csvFile.name}</p>
                        <p className="text-sm text-green-600">
                          {csvData.length} lignes détectées
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Aperçu des données */}
              {csvData.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    👀 Aperçu des données ({csvData.length} membres)
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="text-sm">
                      {csvData.slice(0, 3).map((row, index) => (
                        <div key={index} className="mb-2 p-2 bg-white rounded border">
                          <strong>{row.first_name} {row.last_name}</strong> - {row.email}
                          {row.category && <span className="ml-2 text-blue-600">({row.category})</span>}
                        </div>
                      ))}
                      {csvData.length > 3 && (
                        <p className="text-gray-500 text-center">
                          ... et {csvData.length - 3} autres membres
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || csvData.length === 0}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Import en cours...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        {importMode === 'accounts' 
                          ? 'Importer avec comptes de connexion' 
                          : 'Importer profils seulement'
                        }
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Résultats de l'import */
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-green-800 mb-2">
                  Import terminé !
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-100 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-700">{importResult.imported_count}</div>
                    <div className="text-sm text-green-600">Importés</div>
                  </div>
                  <div className="bg-red-100 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-700">{importResult.error_count}</div>
                    <div className="text-sm text-red-600">Erreurs</div>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-700">{csvData.length}</div>
                    <div className="text-sm text-blue-600">Total traité</div>
                  </div>
                </div>
              </div>

              {/* Identifiants créés */}
              {importResult.credentials && importResult.credentials.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-green-800">
                      🔑 Identifiants créés ({importResult.credentials.length})
                    </h4>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span>{showPasswords ? 'Masquer' : 'Afficher'}</span>
                      </button>
                      <button
                        onClick={copyCredentialsToClipboard}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copier tout</span>
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {importResult.credentials.map((cred, index) => (
                      <div key={index} className="bg-white p-3 rounded border text-sm">
                        <div className="font-medium text-gray-900">{cred.name}</div>
                        <div className="text-gray-600">{cred.email}</div>
                        <div className="text-gray-800">
                          Mot de passe: {showPasswords ? cred.password : '••••••••••••'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-green-700 mt-3">
                    💡 Communiquez ces identifiants aux utilisateurs pour qu'ils puissent se connecter
                  </p>
                </div>
              )}

              {/* Erreurs */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-3">
                    ❌ Erreurs ({importResult.errors.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResult.errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-700">
                        • {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Boutons */}
              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setImportResult(null);
                    setCsvData([]);
                    setCsvFile(null);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Nouvel import
                </button>
                <button
                  onClick={() => {
                    onSuccess();
                    onClose();
                  }}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};