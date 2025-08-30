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

// Composant CSV pour créer des profils membres SEULEMENT
const AccountCSVImporter: React.FC<AccountCSVImporterProps> = ({ onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const createMemberProfileOnly = async (memberData: any) => {
    try {
      console.log('🚀 [AccountCreator] Création profil membre pour:', memberData.email);
      
      // Récupérer la saison courante
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();
      
      if (seasonError || !currentSeason) {
        throw new Error('Aucune saison courante trouvée');
      }

      // Vérifier si le membre existe déjà
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('email', memberData.email)
        .single();
      
      if (existingMember) {
        throw new Error('Profil membre déjà existant');
      }

      // Créer SEULEMENT le profil membre
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          first_name: memberData.first_name,
          last_name: memberData.last_name,
          email: memberData.email,
          phone: memberData.phone || null,
          birth_date: memberData.birth_date || null,
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
        email: memberData.email
      };
      
    } catch (error: any) {
      console.error('❌ [AccountCreator] Erreur création profil:', error);
      throw new Error(`Erreur création: ${error.message}`);
    }
  };

  const importMembersDirectly = async (membersData: any[]) => {
    try {
      console.log('🚀 [AccountCreator] Import direct de', membersData.length, 'profils membres');
      
      let imported_count = 0;
      let error_count = 0;
      const errors: string[] = [];
      
      // Traiter chaque membre individuellement
      for (let i = 0; i < membersData.length; i++) {
        const member = membersData[i];
        
        try {
          const result = await createMemberProfileOnly(member);
          
          if (result.success) {
            imported_count++;
            console.log(`✅ Profil créé: ${member.first_name} ${member.last_name}`);
          } else {
            errors.push(`${member.email}: ${result.error}`);
            error_count++;
          }
          
        } catch (memberError: any) {
          console.error('❌ Erreur membre individuel:', memberError);
          errors.push(`${member.email}: ${memberError.message}`);
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

  const downloadAccountTemplate = () => {
    const headers = [
      'first_name', 'last_name', 'email', 'phone', 'birth_date'
    ];
    
    const exampleRows = [
      ['Sophie', 'Martin', 'sophie.martin@email.com', '0612345678', '1995-03-15'],
      ['Paul', 'Durand', 'paul.durand@email.com', '0687654321', '1988-07-22'],
      ['Marie', 'Dubois', 'marie.dubois@email.com', '0698765432', '2010-12-10'],
      ['Jean', 'Dupont', 'jean.dupont@email.com', '', '1975-05-18']
    ];
    
    const csvContent = headers.join(';') + '\n' + 
      exampleRows.map(row => row.join(';')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modele_creation_profils_membres.csv');
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
      
      // Validation email
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Ligne ${lineNum}: Format email invalide (${row.email})`);
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
      const data = await importMembersDirectly(csvData);

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
                <p>1. <strong>Vous importez</strong> : Profils membres créés dans la table 'members'</p>
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
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Naissance</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData.map((account, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900">{account.first_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{account.last_name}</td>
                              <td className="px-4 py-2 text-sm text-blue-600">{account.email}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{account.phone || 'Non renseigné'}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{account.birth_date || 'Non renseigné'}</td>
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
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <h5 className="font-medium text-yellow-800 mb-2">⚠️ Erreurs détectées</h5>
                        <ul className="text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
                          {importResult.errors.map((error: string, index: number) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700">❌ {importResult.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer avec actions */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {csvData.length > 0 && `${csvData.length} ligne(s) détectée(s)`}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              
              <button
                onClick={handleImport}
                disabled={!csvData.length || validationErrors.length > 0 || loading}
                className={`px-6 py-2 rounded-md font-medium ${
                  csvData.length && validationErrors.length === 0 && !loading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Import...</span>
                  </div>
                ) : (
                  `Importer ${csvData.length || 0} profil(s)`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AccountCreator: React.FC<AccountCreatorProps> = ({ onSuccess }) => {
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    role: 'member'
  });
  const [loading, setLoading] = useState(false);

  const handleCreateSingleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🚀 [AccountCreator] Création profil individuel pour:', formData.email);
      
      // Récupérer la saison courante
      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();
      
      if (seasonError || !currentSeason) {
        throw new Error('Aucune saison courante trouvée');
      }

      // Vérifier si le membre existe déjà
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('email', formData.email)
        .single();
      
      if (existingMember) {
        throw new Error('Un profil membre existe déjà avec cet email');
      }

      // Créer SEULEMENT le profil membre
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone || null,
          birth_date: formData.birthDate || null,
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

      alert(`✅ Profil membre créé avec succès !

👤 ${formData.firstName} ${formData.lastName}
📧 Email : ${formData.email}
📍 Visible dans : Supabase → Table Editor → members

📋 INSTRUCTIONS POUR LA PERSONNE :
1. Aller sur : ${window.location.origin}/auth
2. S'inscrire avec son email : ${formData.email}
3. Créer son mot de passe
4. Se connecter normalement

🔗 Le profil sera automatiquement lié à son compte !`);

      // Reset du formulaire
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        birthDate: '',
        role: 'member'
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      alert(`❌ Erreur : ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2 mb-6">
          <UserPlus className="w-6 h-6 text-primary-600" />
          <span>Créer des profils membres</span>
        </h2>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">ℹ️ Comment ça marche</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>Vous créez des profils</strong> : Informations stockées dans la base de données</p>
            <p>• <strong>Pas de compte de connexion</strong> : Les personnes s'inscrivent elles-mêmes</p>
            <p>• <strong>Liaison automatique</strong> : Le système lie le compte au profil via l'email</p>
            <p>• <strong>Sécurisé</strong> : Chaque personne choisit son propre mot de passe</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Création individuelle */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              👤 Création individuelle
            </h3>
            
            <form onSubmit={handleCreateSingleAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optionnel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de naissance
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Création...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Créer le profil membre</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Import CSV */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📄 Import CSV
            </h3>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Importez plusieurs profils membres en une fois depuis un fichier CSV.
              </p>
              
              <button
                onClick={() => setShowCSVImporter(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Importer depuis CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Importer Modal */}
      {showCSVImporter && (
        <AccountCSVImporter
          onSuccess={() => {
            setShowCSVImporter(false);
            onSuccess();
          }}
          onClose={() => setShowCSVImporter(false)}
        />
      )}
    </div>
  );
};