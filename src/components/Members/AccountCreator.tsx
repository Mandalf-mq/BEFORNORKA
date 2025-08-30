import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Eye, EyeOff, RefreshCw, User, Mail, Phone, Calendar, Upload, Download, CheckCircle, XCircle, FileText, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AccountCreatorProps {
  onSuccess: () => void;
}

interface AccountCSVImporterProps {
  onSuccess: () => void;
  onClose: () => void;
}

// Composant CSV spécialisé pour la création de comptes
const AccountCSVImporter: React.FC<AccountCSVImporterProps> = ({ onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const downloadAccountTemplate = () => {
    const headers = [
      'first_name', 'last_name', 'email', 'phone', 'role'
    ];
    
    const exampleRows = [
      ['Sophie', 'Martin', 'sophie.martin@email.com', '0612345678', 'member'],
      ['Paul', 'Durand', 'paul.durand@email.com', '0687654321', 'entraineur'],
      ['Marie', 'Dubois', 'marie.dubois@email.com', '0698765432', 'administrateur'],
      ['Jean', 'Dupont', 'jean.dupont@email.com', '0634567890', 'tresorerie'],
      ['Admin', 'Site', 'admin@befornorka.fr', '0645678901', 'webmaster']
    ];
    
    const csvContent = headers.join(';') + '\n' + 
      exampleRows.map(row => row.join(';')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modele_creation_comptes_befornorka.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseAccountsCSV = (content: string) => {
    try {
      console.log('🔍 Parsing CSV content...');
      
      // Détection du séparateur
      const semicolonCount = (content.match(/;/g) || []).length;
      const commaCount = (content.match(/,/g) || []).length;
      const separator = semicolonCount > commaCount ? ';' : ',';
      
      console.log('🔍 Séparateur détecté:', separator);
      
      const lines = content.trim().split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
      }
      
      const headers = lines[0].split(separator).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
      console.log('🔍 Headers:', headers);
      
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(separator).map(v => v.replace(/^"|"$/g, '').trim());
        
        const row: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index] || '';
          
          switch (header) {
            case 'first_name':
            case 'prénom':
            case 'prenom':
              row.first_name = value;
              break;
            case 'last_name':
            case 'nom':
              row.last_name = value;
              break;
            case 'email':
            case 'e-mail':
              row.email = value;
              break;
            case 'phone':
            case 'téléphone':
            case 'telephone':
              row.phone = value;
              break;
            case 'role':
            case 'rôle':
              row.role = value;
              break;
          }
        });
        
        data.push(row);
      }
      
      return data;
      
    } catch (error) {
      console.error('Erreur parsing CSV:', error);
      throw new Error('Erreur lors de l\'analyse du fichier CSV');
    }
  };

  const validateAccountsData = (data: any[]): string[] => {
    const errors: string[] = [];
    const validRoles = ['member', 'entraineur', 'administrateur', 'tresorerie', 'webmaster'];
    
    data.forEach((row, index) => {
      const lineNum = index + 2;
      
      if (!row.first_name?.trim()) {
        errors.push(`Ligne ${lineNum}: Le prénom est obligatoire`);
      }
      if (!row.last_name?.trim()) {
        errors.push(`Ligne ${lineNum}: Le nom est obligatoire`);
      }
      if (!row.email?.trim()) {
        errors.push(`Ligne ${lineNum}: L'email est obligatoire`);
      }
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Ligne ${lineNum}: Format email invalide`);
      }
      if (!row.role || !validRoles.includes(row.role)) {
        errors.push(`Ligne ${lineNum}: Rôle invalide. Rôles valides: ${validRoles.join(', ')}`);
      }
    });
    
    return errors;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setImportResult(null);
      setValidationErrors([]);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsedData = parseAccountsCSV(content);
          setCsvData(parsedData);
          setPreviewData(parsedData.slice(0, 5));
          
          const errors = validateAccountsData(parsedData);
          setValidationErrors(errors);
        } catch (error) {
          console.error('Erreur lecture fichier:', error);
          setValidationErrors([`Erreur: ${error}`]);
        }
      };
      reader.readAsText(selectedFile, 'UTF-8');
    }
  };

  const handleImport = async () => {
    if (!csvData.length || validationErrors.length > 0) return;
    
    setLoading(true);
    
    try {
      // Préparer les données avec mots de passe temporaires
      const accountsWithPasswords = csvData.map(account => ({
        ...account,
        temporary_password: 'temp' + Math.random().toString(36).substr(2, 8)
      }));

      // Appeler l'Edge Function
      const { data, error } = await supabase.functions.invoke('create-user-accounts', {
        body: { accounts: accountsWithPasswords }
      });

      if (error) throw error;

      setImportResult(data);

      if (data.success) {
        const successfulAccounts = data.results.filter((r: any) => r.success);
        
        // Créer un message avec tous les identifiants
        const credentialsList = successfulAccounts
          .map((acc: any) => `${acc.email} : ${acc.temporary_password}`)
          .join('\n');

        alert(`✅ Import réussi !

📊 Résultats :
• ${data.success_count} comptes créés
• ${data.error_count} erreurs

🔑 Identifiants créés :
${credentialsList}

⚠️ IMPORTANT :
• Communiquez ces identifiants aux personnes
• Ils devront changer leur mot de passe à la première connexion
• Les membres peuvent maintenant se connecter sur le site !`);

        onSuccess();
      } else {
        alert(`❌ Erreur d'import : ${data.error}`);
      }
      
    } catch (error: any) {
      console.error('Erreur import:', error);
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header fixe */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">
              🔐 Import CSV - Création de comptes avec connexion
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Info importante */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2">✅ Comptes d'authentification réels</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p>• <strong>Vrais comptes Supabase</strong> : Les membres pourront se connecter</p>
                <p>• <strong>Mots de passe temporaires</strong> : Générés automatiquement</p>
                <p>• <strong>Changement obligatoire</strong> : À la première connexion</p>
                <p>• <strong>Profils membres</strong> : Créés automatiquement pour le rôle "member"</p>
                <p>• <strong>Accès immédiat</strong> : Aux données personnelles sur le site</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={downloadAccountTemplate}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger le modèle</span>
              </button>
              
              <label className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>Sélectionner CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {file && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span>Fichier sélectionné: {file.name}</span>
              </div>
            )}

            {/* Validation */}
            {csvData.length > 0 && (
              <div className="space-y-4">
                {validationErrors.length > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="font-medium text-red-800">Erreurs détectées ({validationErrors.length})</span>
                    </div>
                    <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-800">
                        Validation réussie - {csvData.length} comptes prêts à créer
                      </span>
                    </div>
                  </div>
                )}

                {/* Prévisualisation */}
                {previewData.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <h4 className="font-medium text-gray-800">Aperçu des données</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prénom</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData.map((account, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">{account.first_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{account.last_name}</td>
                              <td className="px-4 py-2 text-sm text-blue-600">{account.email}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{account.phone || 'Non renseigné'}</td>
                              <td className="px-4 py-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {account.role}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvData.length > 5 && (
                      <div className="px-4 py-2 bg-gray-50 border-t text-sm text-gray-500">
                        Affichage de 5 lignes sur {csvData.length} au total
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Résultats d'import */}
            {importResult && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">📊 Résultats de l'import</h4>
                {importResult.success ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-green-600">{importResult.success_count}</div>
                        <div className="text-sm text-green-700">Comptes créés</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-red-600">{importResult.error_count}</div>
                        <div className="text-sm text-red-700">Erreurs</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-blue-600">{importResult.total_processed}</div>
                        <div className="text-sm text-blue-700">Total traité</div>
                      </div>
                    </div>

                    {/* Liste des comptes créés avec identifiants */}
                    {importResult.results?.filter((r: any) => r.success).length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 className="font-medium text-green-800 mb-2">🔑 Identifiants créés</h5>
                        <div className="space-y-1 text-sm text-green-700 max-h-32 overflow-y-auto">
                          {importResult.results.filter((r: any) => r.success).map((result: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-white rounded">
                              <span>{result.email}</span>
                              <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded">
                                {result.temporary_password}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Erreurs */}
                    {importResult.results?.filter((r: any) => !r.success).length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h5 className="font-medium text-red-800 mb-2">❌ Erreurs</h5>
                        <div className="space-y-1 text-sm text-red-700 max-h-32 overflow-y-auto">
                          {importResult.results.filter((r: any) => !r.success).map((result: any, index: number) => (
                            <div key={index}>• {result.email}: {result.error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600">
                    ❌ Erreur : {importResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer avec boutons */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            
            {csvData.length > 0 && validationErrors.length === 0 && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Création des comptes...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Créer {csvData.length} compte(s) réel(s)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AccountCreator: React.FC<AccountCreatorProps> = ({ onSuccess }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    category: 'loisirs',
    temporaryPassword: '',
    role: 'member'
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, temporaryPassword: password }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Créer un seul compte via l'Edge Function
      const accountData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        temporary_password: formData.temporaryPassword
      };

      const { data, error } = await supabase.functions.invoke('create-user-accounts', {
        body: { accounts: [accountData] }
      });

      if (error) throw error;

      if (data.success && data.results[0]?.success) {
        const result = data.results[0];
        
        alert(`✅ Profil créé avec succès !

👤 ${formData.firstName} ${formData.lastName}
📧 ${formData.email}
🔑 Rôle : ${formData.role}

📋 PROCHAINES ÉTAPES :
• La personne doit s'inscrire sur le site avec son email
• Son profil sera automatiquement lié
• Elle aura accès à ses données personnelles
• Pas besoin de mot de passe temporaire !`);

        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          birthDate: '',
          category: 'loisirs',
          temporaryPassword: '',
          role: 'member'
        });

        onSuccess();
      } else {
        const errorMsg = data.results[0]?.error || data.error || 'Erreur inconnue';
        setError(errorMsg);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  if (showCSVImporter) {
    return (
      <AccountCSVImporter 
        onSuccess={() => {
          setShowCSVImporter(false);
          onSuccess();
        }}
        onClose={() => setShowCSVImporter(false)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
            <UserPlus className="w-6 h-6 text-primary-600" />
            <span>Créer un compte avec connexion</span>
          </h2>
          <button
            onClick={() => {
              alert(`ℹ️ Pour l'import CSV de profils membres, utilisez :

📍 Menu "Membres" → Bouton "Import CSV (Profils)"

✅ Cet import fonctionne parfaitement et crée des profils complets !`);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Import CSV → Voir "Membres"</span>
          </button>
        </div>

        {/* Info importante */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-green-800 mb-2">👤 Création de profil membre</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>• <strong>Profil membre créé</strong> : Avec toutes les informations</p>
            <p>• <strong>Inscription libre</strong> : La personne s'inscrit avec son email</p>
            <p>• <strong>Liaison automatique</strong> : Le système lie le compte au profil</p>
            <p>• <strong>Accès complet</strong> : Documents, entraînements, profil</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="member">👤 Membre</option>
              <option value="entraineur">🏐 Entraîneur</option>
              <option value="tresorerie">💰 Trésorerie</option>
              <option value="administrateur">👨‍💼 Administrateur</option>
              <option value="webmaster">👑 Webmaster</option>
            </select>
          </div>

          {/* Mot de passe temporaire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe temporaire *</label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.temporaryPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={generatePassword}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Générer</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Créer le compte réel</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};