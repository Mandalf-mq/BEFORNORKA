import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Upload, Download, CheckCircle, XCircle, FileText, X, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AccountCreatorProps {
  onSuccess: () => void;
}

interface AccountCSVImporterProps {
  onSuccess: () => void;
  onClose: () => void;
}

// Fonction utilitaire pour les labels de rôles
const getRoleLabel = (role: string) => {
  switch (role) {
    case 'webmaster': return 'Webmaster';
    case 'administrateur': return 'Administrateur';
    case 'tresorerie': return 'Trésorerie';
    case 'entraineur': return 'Entraîneur';
    case 'member': return 'Membre';
    default: return 'Utilisateur';
  }
};

// Fonction pour créer un vrai compte d'authentification
const createRealAuthAccount = async (email: string, password: string, userData: any) => {
  try {
    console.log('🔐 [AccountCreator] Création compte auth pour:', email);
    
    // 1. Créer le compte d'authentification
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role || 'member',
          phone: userData.phone || null
        }
      }
    });

    if (authError) {
      console.error('❌ [AccountCreator] Erreur auth:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Aucun utilisateur créé');
    }

    console.log('✅ [AccountCreator] Compte auth créé:', authData.user.id);

    // 2. Créer l'entrée dans la table users
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone: userData.phone || null,
        role: userData.role || 'member',
        is_active: true
      });

    if (userError) {
      console.warn('⚠️ [AccountCreator] Erreur table users:', userError);
      // Ne pas bloquer pour cette erreur
    }

    // 3. Si c'est un membre, créer le profil membre
    let memberId = null;
    if (userData.role === 'member' || !userData.role) {
      // Récupérer la saison courante
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();

      if (seasonError || !currentSeason) {
        console.warn('⚠️ [AccountCreator] Aucune saison courante trouvée');
      }

      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: email,
          phone: userData.phone || null,
          birth_date: userData.birth_date || null,
          category: userData.category || 'loisirs',
          membership_fee: userData.membership_fee || 200,
          status: 'pending',
          payment_status: 'pending',
          season_id: currentSeason?.id || null
        })
        .select('id')
        .single();

      if (memberError) {
        console.warn('⚠️ [AccountCreator] Erreur profil membre:', memberError);
      } else {
        memberId = newMember.id;
        
        // Ajouter la catégorie principale
        const { error: categoryError } = await supabase
          .from('member_categories')
          .insert({
            member_id: memberId,
            category_value: userData.category || 'loisirs',
            is_primary: true
          });

        if (categoryError) {
          console.warn('⚠️ [AccountCreator] Erreur catégorie:', categoryError);
        }
      }
    }

    return {
      success: true,
      user_id: authData.user.id,
      member_id: memberId,
      email: email,
      password: password
    };

  } catch (error: any) {
    console.error('❌ [AccountCreator] Erreur création compte:', error);
    return {
      success: false,
      error: error.message,
      email: email
    };
  }
};

// Composant CSV pour créer des comptes avec authentification
const AccountCSVImporter: React.FC<AccountCSVImporterProps> = ({ onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateStrongPassword = () => {
    const lowercase = 'abcdefghijkmnpqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // Garantir EXACTEMENT un caractère de chaque type requis
    let password = '';
    
    // 1. Un caractère de chaque type OBLIGATOIRE
    password += lowercase[Math.floor(Math.random() * lowercase.length)];  // a-z
    password += uppercase[Math.floor(Math.random() * uppercase.length)];  // A-Z
    password += numbers[Math.floor(Math.random() * numbers.length)];      // 0-9
    password += specials[Math.floor(Math.random() * specials.length)];    // Spéciaux
    
    // 2. Compléter avec 8 caractères supplémentaires
    const allChars = lowercase + uppercase + numbers + specials;
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // 3. Mélanger COMPLÈTEMENT le mot de passe
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const createAccountsWithAuth = async (accountsData: any[]) => {
    try {
      console.log('🚀 [AccountCreator] Création de', accountsData.length, 'comptes avec authentification');
      
      let imported_count = 0;
      let error_count = 0;
      const errors: string[] = [];
      const credentials: any[] = [];
      
      // Traiter chaque compte individuellement
      for (let i = 0; i < accountsData.length; i++) {
        const account = accountsData[i];
        setProgress(Math.round((i / accountsData.length) * 100));
        
        try {
          // Générer un mot de passe temporaire
          const tempPassword = generateStrongPassword();
          
          // Créer le compte complet
          const result = await createRealAuthAccount(account.email, tempPassword, {
            first_name: account.first_name,
            last_name: account.last_name,
            phone: account.phone,
            birth_date: account.birth_date,
            category: account.category || 'loisirs',
            role: account.role || 'member',
            membership_fee: account.membership_fee || 200
          });
          
          if (result.success) {
            credentials.push({
              email: account.email,
              name: `${account.first_name} ${account.last_name}`,
              password: tempPassword,
              role: account.role || 'member'
            });
            imported_count++;
            console.log(`✅ [AccountCreator] Compte créé: ${account.email}`);
          } else {
            errors.push(`${account.email}: ${result.error}`);
            error_count++;
          }
          
          // Petite pause pour éviter de surcharger l'API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error: any) {
          console.error('❌ [AccountCreator] Erreur compte individuel:', error);
          errors.push(`${account.email}: ${error.message}`);
          error_count++;
        }
      }
      
      setProgress(100);
      
      return {
        success: imported_count > 0,
        imported_count,
        error_count,
        errors,
        credentials,
        message: `Import terminé: ${imported_count} comptes créés, ${error_count} erreurs`
      };
      
    } catch (error: any) {
      console.error('❌ [AccountCreator] Erreur générale:', error);
      return {
        success: false,
        imported_count: 0,
        error_count: 1,
        errors: [error.message],
        credentials: [],
        message: `Erreur d'import: ${error.message}`
      };
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
            case 'category':
            case 'catégorie':
              row.category = value || 'loisirs';
              break;
            case 'membership_fee':
            case 'cotisation':
              row.membership_fee = value ? parseFloat(value) : 200;
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
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Ligne ${lineNum}: Format email invalide`);
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
    setProgress(0);
    
    try {
      console.log('🚀 [AccountCreator] Tentative Edge Function create-auth-accounts');
      
      // Préparer les données avec mots de passe temporaires
      const accountsWithPasswords = csvData.map(account => ({
        ...account,
        temporary_password: generateStrongPassword()
      }));
      
      console.log('🔍 [AccountCreator] Données préparées:', accountsWithPasswords.length, 'comptes');
      
      // Appeler l'Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-auth-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          accounts: accountsWithPasswords
        })
      });
      
      console.log('📡 [AccountCreator] Réponse Edge Function status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AccountCreator] Erreur Edge Function:', errorText);
        throw new Error(`Edge Function error (${response.status}): ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ [AccountCreator] Résultat Edge Function:', result);
      
      setImportResult(result);
      
      if (result.success && result.success_count > 0) {
        const credentialsText = result.results
          .filter((r: any) => r.success)
          .map((r: any) => `${r.email}: ${r.temporary_password}`)
          .join('\n');

        alert(`✅ Comptes créés avec succès !

📊 Résultats :
• ${result.success_count} comptes créés
• ${result.error_count} erreurs

🔑 IDENTIFIANTS DE CONNEXION :

${credentialsText}

🌐 Site de connexion : ${window.location.origin}/auth

⚠️ Communiquez ces identifiants aux personnes !`);

        onSuccess();
      } else {
        // Afficher les erreurs détaillées
        const errorDetails = result.results
          ?.filter((r: any) => !r.success)
          .map((r: any) => `• ${r.email}: ${r.error}`)
          .join('\n') || 'Erreurs inconnues';

        alert(`❌ Erreur d'import :

📊 Résultats :
• ${result.success_count || 0} comptes créés
• ${result.error_count || 0} erreurs

🔍 Détails des erreurs :
${errorDetails}`);
      }
      
    } catch (error: any) {
      console.error('Erreur import:', error);
      
      alert(`❌ Erreur : ${error.message}

💡 Solution alternative :
Utilisez l'import CSV normal dans "Membres" → "Import CSV (Profils)"
Les membres créeront ensuite leur compte eux-mêmes.`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header fixe */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">
              🔐 Import CSV - Création de comptes de connexion
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2">🎯 Création de vrais comptes</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p>1. <strong>Comptes d'authentification</strong> : Créés dans Supabase Auth</p>
                <p>2. <strong>Mots de passe temporaires</strong> : Générés automatiquement</p>
                <p>3. <strong>Connexion immédiate</strong> : Les gens peuvent se connecter tout de suite</p>
                <p>4. <strong>Profils complets</strong> : Membres + utilisateurs créés</p>
                <p>5. <strong>Identifiants fournis</strong> : À communiquer aux personnes</p>
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
              <div className="flex items-center space-x-2 text-green-600">
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
                      {validationErrors.map((error: string, index: number) => (
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

            {/* Barre de progression */}
            {loading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">Création des comptes en cours...</span>
                  <span className="text-sm text-blue-600">{progress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
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
                        <div className="text-sm text-green-700">Comptes créés</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <div className="text-2xl font-bold text-red-600">{importResult.error_count}</div>
                        <div className="text-sm text-red-700">Erreurs</div>
                      </div>
                    </div>

                    {/* Identifiants créés */}
                    {importResult.credentials?.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 className="font-medium text-green-800 mb-2">🔑 Identifiants créés</h5>
                        <div className="space-y-2 text-sm text-green-700 max-h-32 overflow-y-auto">
                          {importResult.credentials.map((cred: any, index: number) => (
                            <div key={index} className="bg-white rounded p-2 border border-green-200">
                              <div className="font-medium">{cred.name}</div>
                              <div className="text-xs">Email: {cred.email}</div>
                              <div className="text-xs">Mot de passe: <strong>{cred.password}</strong></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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

        {/* Footer fixe */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                    <span>Créer {csvData.length} compte(s) de connexion</span>
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
    role: 'member'
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
      console.error('Erreur lors du chargement des catégories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Générer un mot de passe temporaire
      const tempPassword = generatePassword();
      
      // Créer le compte complet
      const result = await createRealAuthAccount(formData.email, tempPassword, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        birth_date: formData.birthDate,
        category: formData.category,
        role: formData.role,
        membership_fee: formData.membershipFee
      });

      if (result.success) {
        alert(`✅ Compte créé avec succès !

👤 ${formData.firstName} ${formData.lastName}
📧 Email: ${formData.email}
🔑 Mot de passe temporaire: ${tempPassword}

🌐 Site de connexion: ${window.location.origin}/auth

⚠️ Communiquez ces identifiants à la personne !`);

        // Reset du formulaire
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
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('❌ [AccountCreator] Erreur:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
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
            <span>Créer un compte de connexion</span>
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">🔐 Création de compte complet</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>Compte d'authentification</strong> : Créé dans Supabase Auth</p>
            <p>• <strong>Mot de passe temporaire</strong> : Généré automatiquement</p>
            <p>• <strong>Connexion immédiate</strong> : La personne peut se connecter tout de suite</p>
            <p>• <strong>Profil complet</strong> : Utilisateur + membre créés</p>
            <p>• <strong>Identifiants fournis</strong> : À communiquer à la personne</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="member">👤 Membre</option>
                <option value="entraineur">🏐 Entraîneur</option>
                <option value="tresorerie">💰 Trésorerie</option>
                <option value="administrateur">👨‍💼 Administrateur</option>
                <option value="webmaster">👑 Webmaster</option>
              </select>
            </div>
          </div>

          {/* Catégorie et cotisation (seulement pour les membres) */}
          {formData.role === 'member' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cotisation (€)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.membershipFee}
                  onChange={(e) => setFormData(prev => ({ ...prev, membershipFee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

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
                <span>Créer le compte de connexion</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};