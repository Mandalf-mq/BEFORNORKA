import React, { useState } from 'react';
import { UserPlus, Save, Eye, EyeOff, RefreshCw, User, Mail, Phone, Calendar, Upload, Download, CheckCircle, XCircle, FileText, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
    
    alert('📥 Template téléchargé !\n\n📋 Format :\n• Séparateur : point-virgule (;)\n• Encodage : UTF-8\n• 5 exemples inclus\n\n✏️ Modifiez le fichier avec vos vraies données avant import.');
  };

  const handleCsvFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setPreviewData(parsedData.slice(0, 5)); // Aperçu des 5 premières lignes
          
          // Validation
          const errors = validateAccountsData(parsedData);
          setValidationErrors(errors);
        } catch (error) {
          console.error('Erreur lors de la lecture du fichier:', error);
          setValidationErrors([`Erreur lors de la lecture du fichier: ${error}`]);
        }
      };
      reader.readAsText(selectedFile, 'UTF-8');
    }
  };

  const parseAccountsCSV = (content: string) => {
    // Détection plus robuste du séparateur
    const semicolonCount = (content.match(/;/g) || []).length;
    const commaCount = (content.match(/,/g) || []).length;
    const separator = semicolonCount > commaCount ? ';' : ',';
    
    console.log('🔍 [parseAccountsCSV] Séparateur détecté:', separator);
    console.log('🔍 [parseAccountsCSV] Contenu brut (100 premiers chars):', content.substring(0, 100));
    
    const lines = content.trim().split(/\r?\n/).filter(line => line.trim());
    console.log('🔍 [parseAccountsCSV] Nombre de lignes:', lines.length);
    console.log('🔍 [parseAccountsCSV] Première ligne (header):', lines[0]);
    
    if (lines.length < 2) {
      throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
    }
    
    // Parser la ligne d'en-tête avec gestion des guillemets
    const headers = parseCSVLine(lines[0], separator);
    console.log('🔍 [parseAccountsCSV] Headers parsés:', headers);
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      console.log('🔍 [parseAccountsCSV] Ligne', i, ':', line);
      
      const values = parseCSVLine(line, separator);
      console.log('🔍 [parseAccountsCSV] Valeurs parsées:', values);
      
      const row: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        const headerLower = header.toLowerCase().trim();
        
        console.log('🔍 [parseAccountsCSV] Mapping:', headerLower, '→', value);
        
        switch (headerLower) {
          case 'first_name':
          case 'prenom':
          case 'prénom':
            row.first_name = value;
            break;
          case 'last_name':
          case 'nom':
            row.last_name = value;
            break;
          case 'email':
          case 'e-mail':
          case 'mail':
            row.email = value;
            break;
          case 'phone':
          case 'telephone':
          case 'téléphone':
            row.phone = value;
            break;
          case 'role':
          case 'rôle':
            row.role = value;
            break;
          default:
            console.log('🔍 [parseAccountsCSV] Header non reconnu:', headerLower);
        }
      });
      
      console.log('🔍 [parseAccountsCSV] Objet final ligne', i, ':', row);
      data.push(row);
    }
    
    console.log('✅ [parseAccountsCSV] Données finales:', data);
    return data;
  };

  // Fonction utilitaire pour parser une ligne CSV avec gestion des guillemets
  const parseCSVLine = (line: string, separator: string): string[] => {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // Ajouter la dernière valeur
    values.push(currentValue.trim());
    
    return values;
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

  const handleAccountsImport = async () => {
    if (!csvData.length || validationErrors.length > 0) return;
    
    setLoading(true);
    
    try {
      // Pour l'instant, simulation car la vraie fonctionnalité nécessite une Edge Function
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setImportResult({
        success: true,
        accounts_created: csvData.length,
        message: `${csvData.length} comptes seraient créés (fonctionnalité en développement)`
      });
      
      alert(`✅ Simulation d'import réussie !
      
📊 Résultats simulés :
• ${csvData.length} comptes utilisateurs seraient créés
• Rôles assignés selon le CSV
• Mots de passe temporaires générés

⚠️ Cette fonctionnalité nécessite une Edge Function Supabase pour créer de vrais comptes d'authentification.

💡 Pour l'instant, utilisez la création individuelle de comptes.`);
      
    } catch (error: any) {
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            📥 Import CSV - Création de comptes
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Différence importante */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">🔐 Création de comptes utilisateurs</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Objectif :</strong> Créer des comptes de connexion (auth.users)</p>
              <p>• <strong>Rôles :</strong> member, entraineur, administrateur, tresorerie, webmaster</p>
              <p>• <strong>Authentification :</strong> Comptes Supabase fonctionnels</p>
              <p>• <strong>Différence :</strong> Pas de profil membre automatique (sauf si rôle = member)</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 mb-2">⚠️ Fonctionnalité en développement</h4>
            <div className="text-sm text-amber-700 space-y-1">
              <p>• Cette fonctionnalité nécessite une Edge Function Supabase</p>
              <p>• Pour l'instant, utilisez la création individuelle de comptes</p>
              <p>• L'import CSV de membres (dans "Membres") fonctionne parfaitement</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={downloadAccountTemplate}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le modèle (comptes)</span>
            </button>
            
            <label className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>Sélectionner CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Fichier sélectionné */}
          {file && (
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Fichier sélectionné: {file.name}</span>
            </div>
          )}

          {/* Validation des données CSV */}
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
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{account.role}</span>
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

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            
            {csvData.length > 0 && validationErrors.length === 0 && (
              <button
                onClick={handleAccountsImport}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Import...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Importer {csvData.length} compte(s)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Résultats d'import */}
          {importResult && (
            <div className="mt-4">
              <div className={`border rounded-lg p-4 ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center space-x-2">
                  {importResult.success ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-800">
                        {importResult.message}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="font-medium text-red-800">Échec de l'import</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface AccountCreatorProps {
  onSuccess: () => void;
}

export const AccountCreator: React.FC<AccountCreatorProps> = ({ onSuccess }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    category: '',
    temporaryPassword: '',
    role: 'member'
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les catégories depuis la base de données
  React.useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      
      console.log('🔍 [AccountCreator] Tentative de chargement des catégories...');
      console.log('🔍 [AccountCreator] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('🔍 [AccountCreator] Supabase Key présente:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      
      console.log('✅ [AccountCreator] Catégories chargées:', data?.length || 0);
      setCategories(data || []);

       if (data && data.length > 0 && !formData.category) {
      setFormData(prev => ({ ...prev, category: data[0].value }));
    }
      
    } catch (error) {
      console.error('❌ [AccountCreator] Erreur détaillée:', error);
      console.error('❌ [AccountCreator] Type d\'erreur:', typeof error);
      console.error('❌ [AccountCreator] Message:', error?.message);
      console.error('Erreur lors du chargement des catégories:', error);
      // En cas d'erreur, afficher un message mais ne pas bloquer l'interface
      setCategories([]);
      setError(`Erreur lors du chargement des catégories: ${error?.message || error}. Vérifiez votre connexion Supabase.`);
    } finally {
      setLoadingCategories(false);
    }
  };

  const roles = [
    { 
      value: 'member', 
      label: '👤 Membre', 
      description: 'Accès à son profil et documents uniquement',
      needsCategory: true,
      needsCotisation: true
    },
    { 
      value: 'entraineur', 
      label: '🏐 Entraîneur', 
      description: 'Membre + gestion des entraînements et WhatsApp',
      needsCategory: false,
      needsCotisation: false
    },
    { 
      value: 'tresorerie', 
      label: '💰 Trésorerie', 
      description: 'Membre + gestion des paiements et tarifs',
      needsCategory: false,
      needsCotisation: false
    },
    { 
      value: 'administrateur', 
      label: '👨‍💼 Administrateur', 
      description: 'Membre + gestion des membres et documents',
      needsCategory: false,
      needsCotisation: false
    },
    { 
      value: 'webmaster', 
      label: '👑 Webmaster', 
      description: 'Accès technique complet à toutes les fonctionnalités',
      needsCategory: false,
      needsCotisation: false
    }
  ];

  const selectedRole = roles.find(r => r.value === formData.role);

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
    setError(null);
    setLoading(true);

    if (!formData.temporaryPassword) {
      setError('Veuillez générer un mot de passe temporaire');
      setLoading(false);
      return;
    }

    try {
   const { data, error } = await supabase.rpc('create_member_account_with_password', {
  p_email: formData.email,
  p_first_name: formData.firstName,
  p_last_name: formData.lastName,
  p_temporary_password: formData.temporaryPassword,  // 👈 Maintenant en 4ème position
  p_phone: formData.phone,
  p_birth_date: formData.birthDate,
  p_category: formData.category,
  p_role: formData.role
});

      if (error) throw error;

      if (data.success) {
        const roleLabel = roles.find(r => r.value === formData.role)?.label;
        
        // Message personnalisé selon le rôle
        const message = formData.role === 'member' 
          ? `✅ Compte membre créé avec succès !

👤 Nom : ${formData.firstName} ${formData.lastName}
📧 Email : ${formData.email}
🔑 Rôle : ${roleLabel}
🏐 Catégorie : ${formData.category}
💰 Cotisation : ${categories.find(c => c.value === formData.category)?.membership_fee}€
🔑 Mot de passe temporaire : ${formData.temporaryPassword}

⚠️ IMPORTANT :
• Communiquez ces identifiants au membre
• Il devra changer son mot de passe à la première connexion
• Le membre est en statut "pending" - pensez à le valider
• Il pourra ensuite uploader ses documents`
          : `✅ Compte ${roleLabel} créé avec succès !

👤 Nom : ${formData.firstName} ${formData.lastName}
📧 Email : ${formData.email}
🔑 Rôle : ${roleLabel}
🔑 Mot de passe temporaire : ${formData.temporaryPassword}

⚠️ IMPORTANT :
• Communiquez ces identifiants à la personne
• Elle devra changer son mot de passe à la première connexion
• Accès immédiat aux fonctionnalités de son rôle
• Pas de profil membre ni de cotisation (rôle administratif)`;

        alert(message);

        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          birthDate: '',
         category: categories.length > 0 ? categories[0].value : '',
          temporaryPassword: '',
          role: 'member'
        });

        onSuccess();
      } else {
        setError(data.error || 'Erreur lors de la création du compte');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  if (loadingCategories) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-lg text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des catégories...</p>
        </div>
      </div>
    );
  }

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
            <span>Créer un compte</span>
          </h2>
          <button
            onClick={() => setShowCSVImporter(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            title="Import CSV pour création de comptes utilisateurs"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV (Comptes)</span>
          </button>
        </div>

        {/* Info importante */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">🔐 Création de compte avec authentification</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Un compte Supabase sera créé avec le rôle sélectionné</p>
            <p>• Vous définissez un mot de passe temporaire</p>
            <p>• La personne devra le changer à sa première connexion</p>
            <p>• Le téléphone est optionnel (peut être ajouté plus tard)</p>
            <p>• <strong>Membre :</strong> Profil membre + cotisation créés automatiquement</p>
            <p>• <strong>Admin/Entraîneur/Trésorerie :</strong> Compte utilisateur seulement</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">👤 Informations personnelles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="06 12 34 56 78 (optionnel)"
                  />
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Le téléphone est optionnel mais recommandé pour les notifications WhatsApp
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Rôle dans l'association */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">🔑 Rôle dans l'association</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sélectionner le rôle *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              
              {/* Description du rôle sélectionné */}
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>📋 Description :</strong> {selectedRole?.description}
                </p>
                <div className="mt-2 flex items-center space-x-4 text-xs">
                  <span className={`px-2 py-1 rounded-full ${
                    selectedRole?.needsCategory ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selectedRole?.needsCategory ? '✅ Catégorie requise' : '❌ Pas de catégorie'}
                  </span>
                  <span className={`px-2 py-1 rounded-full ${
                    selectedRole?.needsCotisation ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selectedRole?.needsCotisation ? '✅ Cotisation calculée' : '❌ Pas de cotisation'}
                  </span>
                </div>
              </div>

              {/* Avertissement pour webmaster */}
              {formData.role === 'webmaster' && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ⚠️ <strong>Attention :</strong> Seul un Webmaster peut créer d'autres Webmasters
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Catégorie (seulement pour les membres) */}
          {selectedRole?.needsCategory && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-4">🏐 Catégorie volleyball</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie selon l'âge
                </label>
                {categories.length === 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-red-700">
                      ⚠️ Aucune catégorie disponible. Veuillez d'abord créer des catégories dans Paramètres → Catégories.
                    </p>
                  </div>
                ) : null}
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={categories.length === 0}
                >
                  {categories.length === 0 && (
                    <option value="">Aucune catégorie disponible</option>
                  )}
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label} {category.age_range ? `(${category.age_range})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  La catégorie est purement informative (âge, niveau) - utilisée pour organiser les entraînements
                </p>
              </div>
            </div>
          )}

          {/* Info pour rôles administratifs */}
          {!selectedRole?.needsCategory && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Rôle administratif</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Pas de profil membre</strong> créé (rôle administratif)</p>
                <p>• <strong>Pas de cotisation</strong> à payer</p>
                <p>• <strong>Accès immédiat</strong> aux fonctionnalités de son rôle</p>
                <p>• <strong>Peut gérer</strong> les membres selon ses permissions</p>
              </div>
            </div>
          )}

          {/* Génération du mot de passe temporaire */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">🔐 Authentification</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe temporaire *
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.temporaryPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                    placeholder="Générez ou tapez un mot de passe"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Générer</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                La personne devra changer ce mot de passe à sa première connexion
              </p>
            </div>
          </div>

          {/* Résumé avant création */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-2">📋 Résumé de la création</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>• <strong>Nom :</strong> {formData.firstName} {formData.lastName}</p>
              <p>• <strong>Email :</strong> {formData.email}</p>
              <p>• <strong>Rôle :</strong> {selectedRole?.label}</p>
              <p>• <strong>Téléphone :</strong> {formData.phone || 'Non renseigné'}</p>
              {selectedRole?.needsCategory && (
                <>
                  <p>• <strong>Catégorie :</strong> {categories.find(c => c.value === formData.category)?.label || formData.category}</p>
                  <p>• <strong>Cotisation :</strong> Calculée automatiquement selon la catégorie</p>
                </>
              )}
              <p>• <strong>Profil membre :</strong> {selectedRole?.needsCategory ? 'Oui' : 'Non (rôle administratif)'}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (selectedRole?.needsCategory && categories.length === 0)}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Créer le compte {selectedRole?.label}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};