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

  const createAccountDirectly = async (accountData: any) => {
    try {
      console.log('🚀 [AccountCreator] Création directe du profil pour:', accountData.email);
      
      // Récupérer la saison courante
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();
      
      if (seasonError || !currentSeason) {
        throw new Error('Aucune saison courante trouvée');
      }

      // Créer SEULEMENT le profil membre (ignorer la table users)
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          first_name: accountData.firstName,
          last_name: accountData.lastName,
          email: accountData.email,
          phone: accountData.phone || null,
          birth_date: accountData.birthDate || null,
          category: 'loisirs',
          membership_fee: 200,
          status: 'pending',
          payment_status: 'pending',
          season_id: currentSeason.id
        })
        .select('id')
        .single();
      
      if (memberError) {
        console.error('❌ [AccountCreator] Erreur création membre:', memberError);
        throw new Error(`Erreur création membre: ${memberError.message}`);
      }
      
      console.log('✅ [AccountCreator] Membre créé:', newMember.id);
      
      // Ajouter la catégorie principale
      const { error: categoryError } = await supabase
        .from('member_categories')
        .insert({
          member_id: newMember.id,
          category_value: 'loisirs',
          is_primary: true
        });
      
      if (categoryError) {
        console.warn('⚠️ [AccountCreator] Erreur ajout catégorie:', categoryError);
      }
      
      return {
        success: true,
        member_id: newMember.id,
        email: accountData.email,
        role: accountData.role
      };
      
    } catch (error: any) {
      console.error('❌ [AccountCreator] Erreur création directe:', error);
      throw new Error(`Erreur création: ${error.message}`);
    }
  };

  const createAccountsDirectly = async (accountsData: any[]) => {
    try {
      console.log('🚀 [AccountCreator] Import direct avec', accountsData.length, 'comptes');
      
      let imported_count = 0;
      let error_count = 0;
      const errors: string[] = [];
      
      // Traiter chaque compte individuellement
      for (let i = 0; i < accountsData.length; i++) {
        const account = accountsData[i];
        
        try {
          const result = await createAccountDirectly(account);
          
          if (result.success) {
            imported_count++;
            console.log(`✅ Profil créé: ${account.first_name} ${account.last_name}`);
          } else {
            errors.push(`${account.email}: ${result.error}`);
            error_count++;
          }
          
        } catch (accountError: any) {
          console.error('❌ Erreur compte individuel:', accountError);
          errors.push(`${account.email}: ${accountError.message}`);
          error_count++;
        }
      }
      
      return {
        success: true,
        imported_count,
        error_count,
        errors,
        message: `Import terminé. ${imported_count} profils membres créés dans la table 'members'.`
      };
      
    } catch (error: any) {
      console.error('❌ Erreur générale import:', error);
      return {
        success: false,
        imported_count: 0,
        error_count: 1,
        errors: [error.message],
        message: `Erreur d'import: ${error.message}`
      };
    }
  };

  const createAccountsWithEdgeFunction = async (accountsData: any[]) => {
    try {
      console.log('🚀 [AccountCreator] Import direct avec', accountsData.length, 'comptes');
      
      // Import direct sans fonction RPC
      let imported_count = 0;
      let error_count = 0;
      const errors: string[] = [];
      
      // Récupérer la saison courante
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();
      
      if (seasonError || !currentSeason) {
        throw new Error('Aucune saison courante trouvée');
      }
      
      // Traiter chaque compte individuellement
      for (let i = 0; i < accountsData.length; i++) {
        const account = accountsData[i];
        
        try {
          // Pour les membres, créer un profil membre
          if (account.role === 'member') {
            // Vérifier si le membre existe déjà
            const { data: existingMember } = await supabase
              .from('members')
              .select('id')
              .eq('email', account.email)
              .single();
            
            if (existingMember) {
              errors.push(`${account.email}: Profil membre déjà existant`);
              error_count++;
              continue;
            }
            
            // Créer le profil membre
            const { data: newMember, error: memberError } = await supabase
              .from('members')
              .insert({
                first_name: account.first_name,
                last_name: account.last_name,
                email: account.email,
                phone: account.phone || null,
                birth_date: account.birth_date || null,
                category: 'loisirs',
                membership_fee: 200,
                status: 'pending',
                payment_status: 'pending',
                season_id: currentSeason.id
              })
              .select('id')
              .single();
            
            if (memberError) {
              errors.push(`${account.email}: ${memberError.message}`);
              error_count++;
              continue;
            }
            
            // Ajouter la catégorie principale
            await supabase
              .from('member_categories')
              .insert({
                member_id: newMember.id,
                category_value: 'loisirs',
                is_primary: true
              });
          }
          
          // Pour tous les rôles, créer l'entrée dans users
          const { error: userError } = await supabase
            .from('users')
            .insert({
              email: account.email,
              first_name: account.first_name,
              last_name: account.last_name,
              phone: account.phone || null,
              role: account.role || 'member',
              is_active: true
            });
          
          if (userError) {
            // Si l'utilisateur existe déjà dans users, c'est pas grave
            if (!userError.message.includes('duplicate key')) {
              console.warn('Erreur création user:', userError);
            }
          }
          
          imported_count++;
          
        } catch (accountError: any) {
          errors.push(`${account.email}: ${accountError.message}`);
          error_count++;
        }
      }

      return {
        success: true,
        total_processed: accountsData.length,
        success_count: imported_count,
        error_count: error_count,
        imported_count: imported_count,
        errors: errors,
        results: accountsData.map((account, index) => ({
          email: account.email,
          success: index < imported_count,
          error: index >= imported_count ? 'Erreur lors de la création' : null,
          role: account.role || 'member'
        }))
      };
    } catch (error: any) {
      console.error('❌ [AccountCreator] Erreur import direct:', error);
      throw new Error(`Erreur import: ${error.message}`);
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
      // Utiliser l'import direct qui fonctionne
      const data = await createAccountsDirectly(csvData);

      setImportResult(data);

      if (data.success) {
        alert(`✅ Import de profils réussi !

📊 Résultats :
• ${data.imported_count} profils membres créés
• ${data.error_count} erreurs
📍 Visible dans : Supabase → Table Editor → members

📋 INSTRUCTIONS POUR CHAQUE PERSONNE :
1. Aller sur : ${window.location.origin}/auth
2. S'inscrire avec son email (celui du CSV)
3. Créer son mot de passe
4. Se connecter normalement

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
                
                {/* Instructions pour les personnes */}
                {importResult && importResult.success_count > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-medium text-blue-800 mb-2">📋 Instructions à communiquer</h5>
                    <div className="text-sm text-blue-700 space-y-1">
                      <p>1. Aller sur : <strong>{window.location.origin}/auth</strong></p>
                      <p>2. Cliquer "Mot de passe oublié"</p>
                      <p>3. Entrer son email (celui du CSV)</p>
                      <p>4. Suivre le lien reçu par email</p>
                      <p>5. Créer son mot de passe personnel</p>
                      <p>6. Se connecter normalement</p>
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
                      <div className="bg-