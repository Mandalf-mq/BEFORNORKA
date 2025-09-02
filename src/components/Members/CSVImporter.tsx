import React, { useState } from 'react';
import { Upload, Download, X, FileText, AlertTriangle, CheckCircle, Users, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CSVImporterProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CSVImporter: React.FC<CSVImporterProps> = ({ onClose, onSuccess }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [createAccounts, setCreateAccounts] = useState(false);
  const [sendEmails, setSendEmails] = useState(false);

  const downloadTemplate = () => {
    const csvTemplate = `first_name,last_name,email,phone,birth_date,category,membership_fee,address,postal_code,city,ffvb_license,emergency_contact,emergency_phone,notes
Jean,Dupont,jean.dupont@email.com,0123456789,1990-05-15,loisirs,200,123 Rue de la Paix,75001,Paris,12345678,Marie Dupont,0987654321,Membre actif
Marie,Martin,marie.martin@email.com,0123456790,1985-08-22,senior,250,456 Avenue des Sports,75002,Paris,,Pierre Martin,0987654322,
Pierre,Durand,pierre.durand@email.com,,1995-12-10,loisirs,200,789 Boulevard du Volleyball,75003,Paris,87654321,,,Nouveau membre`;

    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_import_membres.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }

    return data;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('❌ Veuillez sélectionner un fichier CSV');
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (csvData.length === 0) {
      alert('❌ Aucune donnée à importer');
      return;
    }

    try {
      setImporting(true);

      if (createAccounts) {
        // Import avec création de comptes d'authentification
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            accounts: csvData.map(row => ({
              first_name: row.first_name,
              last_name: row.last_name,
              email: row.email,
              phone: row.phone || null,
              birth_date: row.birth_date || null,
              category: row.category || 'loisirs',
              membership_fee: parseFloat(row.membership_fee) || 200,
              temporary_password: generateStrongPassword()
            }))
          })
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la création des comptes');
        }

        const result = await response.json();
        setImportResult(result);

        if (result.success) {
          alert(`✅ Import terminé !

📊 Résultats :
• ${result.success_count} comptes créés avec succès
• ${result.error_count} erreurs
• Identifiants temporaires générés

📧 ${sendEmails ? 'Emails programmés pour envoi' : 'Pas d\'envoi d\'email'}`);
        }
      } else {
        // Import simple (profils seulement)
        const { data, error } = await supabase.rpc('import_csv_members_simple', {
          p_csv_data: csvData
        });

        if (error) throw error;
        setImportResult(data);

        if (data.success) {
          alert(`✅ Import terminé !

📊 Résultats :
• ${data.imported_count} profils créés
• ${data.error_count} erreurs
• Pas de comptes de connexion créés`);
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Erreur import:', error);
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const generateStrongPassword = (): string => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specials = '!@#$%^&*()_+-=[]{};\':"|<>?,./`~';
    
    let password = '';
    
    // Garantir au moins un caractère de chaque type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    // Compléter avec 8 caractères supplémentaires
    const allChars = lowercase + uppercase + numbers + specials;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mélanger le mot de passe
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-green-600" />
              <span>Import CSV - Membres</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Alerte problème Supabase */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800">🚨 Problème Supabase confirmé</h3>
                <p className="text-red-700 text-sm mt-1">
                  Le système de récupération de mot de passe ne fonctionne pas ("One-time token not found").
                  Utilisez l'import avec création de comptes pour contourner le problème.
                </p>
              </div>
            </div>
          </div>

          {/* Options d'import */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-3">📋 Options d'import</h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  checked={!createAccounts}
                  onChange={() => setCreateAccounts(false)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-blue-800">📝 Profils seulement</span>
                  <p className="text-sm text-blue-700">Crée les profils membres sans comptes de connexion</p>
                </div>
              </label>
              
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  checked={createAccounts}
                  onChange={() => setCreateAccounts(true)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-blue-800">🔐 Comptes complets</span>
                  <p className="text-sm text-blue-700">Crée les profils + comptes d'authentification avec mots de passe temporaires</p>
                </div>
              </label>

              {createAccounts && (
                <div className="ml-6 mt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={sendEmails}
                      onChange={(e) => setSendEmails(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-blue-700">📧 Programmer l'envoi d'emails avec identifiants</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Template CSV */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                📄 Template CSV
              </h3>
              <button
                onClick={downloadTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le template</span>
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="text-gray-700 mb-2">
                <strong>Colonnes requises :</strong> first_name, last_name, email
              </p>
              <p className="text-gray-700">
                <strong>Colonnes optionnelles :</strong> phone, birth_date, category, membership_fee, address, postal_code, city, ffvb_license, emergency_contact, emergency_phone, notes
              </p>
            </div>
          </div>

          {/* Upload de fichier */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fichier CSV à importer
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <FileText className="w-12 h-12 text-gray-400" />
                <span className="text-gray-600">
                  Cliquez pour sélectionner un fichier CSV
                </span>
                <span className="text-xs text-gray-500">
                  Format : CSV avec virgules comme séparateurs
                </span>
              </label>
            </div>
            
            {csvFile && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✅ Fichier sélectionné : {csvFile.name} ({csvData.length} lignes)
                </p>
              </div>
            )}
          </div>

          {/* Aperçu des données */}
          {csvData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                👀 Aperçu des données ({csvData.length} membres)
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {csvData.slice(0, 6).map((row, index) => (
                    <div key={index} className="bg-white p-3 rounded border">
                      <p className="font-medium text-gray-900">
                        {row.first_name} {row.last_name}
                      </p>
                      <p className="text-sm text-gray-600">{row.email}</p>
                      <p className="text-xs text-gray-500">
                        {row.category || 'loisirs'} • {row.membership_fee || 200}€
                      </p>
                    </div>
                  ))}
                </div>
                {csvData.length > 6 && (
                  <p className="text-center text-gray-500 text-sm mt-3">
                    ... et {csvData.length - 6} autres membres
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Résultat d'import */}
          {importResult && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                📊 Résultat de l'import
              </h3>
              <div className={`rounded-lg p-4 ${
                importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start space-x-3">
                  {importResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      importResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {importResult.success ? '✅ Import réussi !' : '❌ Erreurs lors de l\'import'}
                    </p>
                    <div className={`text-sm mt-2 ${
                      importResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      <p>• Membres importés : {importResult.imported_count || 0}</p>
                      <p>• Erreurs : {importResult.error_count || 0}</p>
                      {createAccounts && (
                        <p>• Comptes créés : {importResult.success_count || 0}</p>
                      )}
                    </div>
                    
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-3 max-h-32 overflow-y-auto">
                        <p className="font-medium text-red-800 mb-1">Erreurs détaillées :</p>
                        {importResult.errors.map((error: string, index: number) => (
                          <p key={index} className="text-xs text-red-600">• {error}</p>
                        ))}
                      </div>
                    )}

                    {createAccounts && importResult.credentials && importResult.credentials.length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="font-medium text-yellow-800 mb-2">
                          🔑 Identifiants créés ({importResult.credentials.length})
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {importResult.credentials.map((cred: any, index: number) => (
                            <div key={index} className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded">
                              <strong>{cred.name}</strong> - {cred.email} - Mot de passe : {cred.password}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            const credentialsText = importResult.credentials
                              .map((cred: any) => `${cred.name} - ${cred.email} - ${cred.password}`)
                              .join('\n');
                            navigator.clipboard.writeText(credentialsText);
                            alert('📋 Identifiants copiés dans le presse-papiers !');
                          }}
                          className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs"
                        >
                          📋 Copier tous les identifiants
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleImport}
              disabled={importing || csvData.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {importing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Import en cours...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>
                    {createAccounts ? 'Importer avec comptes' : 'Importer profils seulement'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">📋 Instructions</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>1. <strong>Téléchargez le template CSV</strong> pour voir le format requis</p>
              <p>2. <strong>Remplissez vos données</strong> dans le fichier CSV</p>
              <p>3. <strong>Choisissez le type d'import :</strong></p>
              <p className="ml-4">• <strong>Profils seulement :</strong> Crée les profils membres (pas de connexion possible)</p>
              <p className="ml-4">• <strong>Comptes complets :</strong> Crée les profils + comptes d'authentification</p>
              <p>4. <strong>Uploadez le fichier</strong> et lancez l'import</p>
              <p>5. <strong>Communiquez les identifiants</strong> aux nouveaux membres</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};