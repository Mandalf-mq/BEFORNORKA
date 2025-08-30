import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Upload, Download, CheckCircle, XCircle, FileText, X, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AccountCreatorProps {
  onSuccess: () => void;
}

interface AccountCSVImporterProps {
  onSuccess: () => void;
  onClose: () => void;
}

// Composant CSV pour créer des profils membres (pas de comptes auth)
const AccountCSVImporter: React.FC<AccountCSVImporterProps> = ({ onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'webmaster': return 'Webmaster';
      case 'administrateur': return 'Administrateur';
      case 'tresorerie': return 'Trésorerie';
      case 'entraineur': return 'Entraîneur';
      case 'member': return 'Membre';
      default: return 'Membre';
    }
  };

  const createAccountsWithEdgeFunction = async (accountsData: any[]) => {
    try {
      console.log('🚀 [AccountCreator] Appel Edge Function avec', accountsData.length, 'comptes');
      
      // Utiliser la fonction PostgreSQL existante pour créer les profils
      const { data, error } = await supabase.rpc('import_members_profiles_only', {
        p_csv_data: accountsData
      });

      if (error) throw error;

      // Adapter le résultat au format attendu
      return {
        success: data.success,
        total_processed: accountsData.length,
        success_count: data.imported_count,
        error_count: data.error_count,
        results: accountsData.map((account, index) => ({
          email: account.email,
          success: index < data.imported_count,
          error: index >= data.imported_count ? 'Erreur lors de la création' : null,
          role: account.role || 'member'
        }))
      };
    } catch (error: any) {
      console.error('❌ [AccountCreator] Erreur Edge Function:', error);
      throw new Error(`Erreur Edge Function: ${error.message}`);
    }
  };

  const downloadAccountTemplate = () => {
    const headers = [
      'first_name', 'last_name', 'email', 'phone', 'birth_date', 'role'
    ];
    
    const exampleRows = [
      ['Sophie', 'Martin', 'sophie.martin@email.com', '0612345678', '1995-03-15', 'member'],
      ['Paul', 'Durand', 'paul.durand@email.com', '0687654321', '1988-07-22', 'entraineur'],
      ['Marie', 'Dubois', 'marie.dubois@email.com', '0698765432', '2010-12-10', 'member'],
      ['Jean', 'Dupont', 'jean.dupont@email.com', '', '1975-05-18', 'administrateur']
    ];
    
    const csvContent = headers.join(';') + '\n' + 
      exampleRows.map(row => row.join(';')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modele_creation_comptes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseAccountsCSV = (content: string) => {
    try {
      const semicolonCount = (content.match(/;/g) || []).length;
      const commaCount = (content.match(/,/g) || []).length;
      const separator = semicolonCount > commaCount ? ';' : ',';
      
      const lines = content.trim().split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
      }
      
      const headers = lines[0].split(separator).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
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
            case 'birth_date':
            case 'date_naissance':
              if (value && value.includes('/')) {
                const parts = value.split('/');
                if (parts.length === 3) {
                  let [day, month, year] = parts;
                  if (year.length === 2) {
                    const yearNum = parseInt(year);
                    year = yearNum > 50 ? `19${year}` : `20${year}`;
                  }
                  row.birth_date = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
              } else {
                row.birth_date = value;
              }
              break;
            case 'role':
            case 'rôle':
              row.role = value || 'member';
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
    });
    
    return errors;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsedData = parseAccountsCSV(content);
        
        setCsvData(parsedData);
        setPreviewData(parsedData.slice(0, 5));
        
        const errors = validateAccountsData(parsedData);
        setValidationErrors(errors);
        
      } catch (error: any) {
        alert(`Erreur lors de la lecture du fichier: ${error.message}`);
        setFile(null);
        setCsvData([]);
        setPreviewData([]);
        setValidationErrors([]);
      }
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handleImport = async () => {
    if (!csvData.length || validationErrors.length > 0) return;
    
    setLoading(true);
    
    try {
      // Utiliser la fonction PostgreSQL qui fonctionne
      const { data, error } = await supabase.rpc('import_members_profiles_only', {
        p_csv_data: csvData
      });

      if (error) throw error;

      setImportResult(data);

      if (data.success) {
        alert(`✅ Import de profils réussi !

📊 Résultats :
• ${data.imported_count} profils membres créés
• ${data.error_count} erreurs

📋 INSTRUCTIONS POUR CHAQUE PERSONNE :
1. Aller sur : ${window.location.origin}/auth
2. Cliquer "Mot de passe oublié"
3. Entrer son email (celui du CSV)
4. Suivre le lien reçu par email
5. Créer son mot de passe personnel
6. Se connecter normalement

🔗 Le profil sera automatiquement lié !

💡 Communiquez ces instructions avec les emails !`);

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
              👤 Import CSV - Création de profils membres
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Info workflow */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">🔄 Comment ça marche</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>1. <strong>Vous importez</strong> : Profils membres créés dans la base</p>
                <p>2. <strong>Vous communiquez</strong> : L'email à chaque personne</p>
                <p>3. <strong>Ils s'inscrivent</strong> : Sur le site avec leur email</p>
                <p>4. <strong>Liaison automatique</strong> : Le système lie le compte au profil</p>
                <p>5. <strong>Accès complet</strong> : Documents, entraînements, profil</p>
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
                        Validation réussie - {csvData.length} profils prêts à créer
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
                              <td className="px-4 py-2 text-sm text-gray-500">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {getRoleLabel(account.role || 'member')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-green-600">{importResult.imported_count}</div>
                        <div className="text-sm text-green-700">Profils créés</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-red-600">{importResult.error_count}</div>
                        <div className="text-sm text-red-700">Erreurs</div>
                      </div>
                    </div>

                    {importResult.errors?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h5 className="font-medium text-red-800 mb-2">❌ Erreurs</h5>
                        <div className="space-y-1 text-sm text-red-700 max-h-32 overflow-y-auto">
                          {importResult.errors.map((error: string, index: number) => (
                            <div key={index}>• {error}</div>
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
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Création des profils...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Créer {csvData.length} profil(s) membre(s)</span>
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
    membershipFee: 200,
    role: 'member' // 👈 NOUVEAU : Sélection de rôle
  });
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Créer le profil avec la fonction PostgreSQL
      const { data, error } = await supabase.rpc('create_member_profile_only', {
        p_email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
        p_phone: formData.phone || null,
        p_birth_date: formData.birthDate || null
      });

      if (error) throw error;

      if (data.success) {
        // Créer aussi l'entrée dans users si c'est un rôle administratif
        if (formData.role !== 'member') {
          const { error: userError } = await supabase
            .from('users')
            .insert({
              email: formData.email,
              first_name: formData.firstName,
              last_name: formData.lastName,
              phone: formData.phone || null,
              role: formData.role,
              is_active: true
            });
          
          if (userError) {
            console.warn('Erreur création profil utilisateur:', userError);
          }
        }

        alert(`✅ Profil créé avec succès !
👤 ${formData.firstName} ${formData.lastName}
📧 Email : ${formData.email}
👨‍💼 Rôle : ${getRoleLabel(formData.role)}



📋 INSTRUCTIONS POUR LA PERSONNE :
1. Aller sur : ${window.location.origin}/auth
2. Cliquer "Mot de passe oublié"
3. Entrer son email : ${formData.email}
4. Suivre le lien reçu par email pour créer son mot de passe
5. Se connecter avec son email et nouveau mot de passe

🔗 Le profil sera automatiquement lié à son compte !`);

        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          birthDate: '',
          category: 'loisirs',
          membershipFee: 200,
          role: 'member'
        });

        onSuccess();
      } else {
        setError(data.error || 'Erreur lors de la création');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du profil');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'webmaster': return 'Webmaster';
      case 'administrateur': return 'Administrateur';
      case 'tresorerie': return 'Trésorerie';
      case 'entraineur': return 'Entraîneur';
      case 'member': return 'Membre';
      default: return 'Membre';
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
            <span>Créer un profil membre</span>
          </h2>
          <button
            onClick={() => setShowCSVImporter(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
        </div>

        {/* Info workflow */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-green-800 mb-2">🎯 Workflow simple et efficace</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>• <strong>Vous créez le profil</strong> : Toutes les infos du membre</p>
            <p>• <strong>Vous donnez l'email</strong> : À la personne concernée</p>
            <p>• <strong>Elle s'inscrit</strong> : Sur le site avec cet email</p>
            <p>• <strong>Liaison automatique</strong> : Son compte est lié au profil</p>
            <p>• <strong>Accès immédiat</strong> : À toutes ses données personnelles</p>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 👈 NOUVEAU : Sélection de rôle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="member">👤 Membre</option>
                <option value="entraineur">🏃‍♂️ Entraîneur</option>
                <option value="tresorerie">💰 Trésorerie</option>
                <option value="administrateur">👨‍💼 Administrateur</option>
                <option value="webmaster">💻 Webmaster</option>
              </select>
            </div>
          </div>

          {/* Informations spécifiques aux membres */}

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
                <span>Créer le compte {getRoleLabel(formData.role)}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};