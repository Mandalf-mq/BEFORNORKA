import React, { useState } from 'react';
import { Upload, Download, FileText, CheckCircle, XCircle, AlertCircle, X, Users, Baby, Crown, Link } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CSVImporterProps {
  onSuccess: () => void;
  onClose: () => void;
}

interface ImportResult {
  success: boolean;
  imported_count: number;
  error_count: number;
  errors: string[];
  message: string;
  accounts_created?: number;
  credentials_to_send?: any[];
  send_emails_requested?: boolean;
}

export const CSVImporter: React.FC<CSVImporterProps> = ({ onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [sendEmails, setSendEmails] = useState(true);
  const [showCredentials, setShowCredentials] = useState(false);

  // Charger les catégories réelles depuis la DB
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

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
    } finally {
      setLoadingCategories(false);
    }
  };
  const downloadTemplate = () => {
    // Utiliser les vraies catégories de la DB ou des valeurs par défaut
    const defaultCategory = categories.length > 0 ? categories[0].value : 'senior';
    const seniorCategory = categories.find(c => c.value === 'senior') || categories[0];
    const juniorCategory = categories.find(c => c.age_range?.includes('junior') || c.label?.toLowerCase().includes('junior')) || categories[1];
    const minorCategory = categories.find(c => c.age_range?.includes('mineur') || c.label?.toLowerCase().includes('mineur')) || categories[2];
    
    // Générer des exemples avec les vraies catégories
    const csvTemplate = `"first_name","last_name","email","phone","birth_date","address","postal_code","city","category","membership_fee","ffvb_license","family_head_email","emergency_contact","emergency_phone","notes"
"Sophie","Martin","sophie.martin@email.com","0612345678","1995-03-15","123 Rue de la République","75001","Paris","${seniorCategory?.value || 'senior'}","${seniorCategory?.membership_fee || 250}","","","Marie Martin","0687654321","Mère de Lucas et Emma"
"Lucas","Dubois","lucas.dubois@email.com","0623456789","2010-07-22","123 Rue de la République","75001","Paris","${minorCategory?.value || defaultCategory}","${minorCategory?.membership_fee || 160}","12345678","sophie.martin@email.com","Sophie Martin","0612345678","Fils de Sophie - Très motivé"
"Emma","Leroy","emma.leroy@email.com","","2008-11-08","123 Rue de la République","75001","Paris","${minorCategory?.value || defaultCategory}","${minorCategory?.membership_fee || 180}","87654321","sophie.martin@email.com","Sophie Martin","0612345678","Fille de Sophie - Débutante"
"Pierre","Dupont","pierre.dupont@email.com","0645678901","1988-12-05","456 Avenue des Sports","92100","Boulogne","${seniorCategory?.value || 'senior'}","${seniorCategory?.membership_fee || 250}","11223344","","Claire Dupont","0698765432","Joueur expérimenté - Capitaine potentiel"
"Marie","Dupont","marie.dupont@email.com","0656789012","2012-06-18","456 Avenue des Sports","92100","Boulogne","${juniorCategory?.value || defaultCategory}","${juniorCategory?.membership_fee || 200}","55667788","pierre.dupont@email.com","Pierre Dupont","0645678901","Fille de Pierre - Très sportive"
"Jean","Moreau","jean.moreau@email.com","0634567890","1975-09-30","789 Boulevard du Volleyball","94200","Ivry","${seniorCategory?.value || 'senior'}","${seniorCategory?.membership_fee || 200}","99887766","","Sylvie Moreau","0676543210","Ancien joueur professionnel"
"Thomas","Petit","thomas.petit@email.com","","1992-11-25","654 Allée des Champions","93200","Saint-Denis","${seniorCategory?.value || 'senior'}","${seniorCategory?.membership_fee || 250}","","","","","Étudiant - Tarif réduit possible"`;

    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_membres_complet.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    
    // Parser CSV avec gestion des guillemets
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
    
    const data = lines.slice(1).map(line => {
      const values = parseCSVLine(line).map(v => v.replace(/"/g, '').trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      return row;
    });
    
    return data;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      alert('❌ Veuillez sélectionner un fichier CSV');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      try {
        const parsedData = parseCSV(csvText);
        setCsvData(parsedData);
        setShowPreview(true);
      } catch (error) {
        console.error('Erreur parsing CSV:', error);
        alert('❌ Erreur lors de la lecture du fichier CSV');
      }
    };
    reader.readAsText(selectedFile);
    setFile(selectedFile);
  };

  const validateCSVData = (data: any[]) => {
    const errors: string[] = [];
    const requiredFields = ['first_name', 'last_name', 'email', 'birth_date']; // Téléphone maintenant optionnel
    
    data.forEach((row, index) => {
      const lineNumber = index + 2; // +2 car index 0 = ligne 2 (après header)
      
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push(`Ligne ${lineNumber}: Champ "${field}" manquant`);
        }
      });
      
      // Validation email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (row.email && !emailRegex.test(row.email)) {
        errors.push(`Ligne ${lineNumber}: Email invalide`);
      }
      
      // Validation téléphone (optionnel mais doit être valide si fourni)
      if (row.phone && row.phone.trim() !== '') {
        const phoneRegex = /^[0-9\s\-\+\(\)\.]{8,}$/;
        if (!phoneRegex.test(row.phone.replace(/\s/g, ''))) {
          errors.push(`Ligne ${lineNumber}: Téléphone invalide (minimum 8 chiffres)`);
        }
      }
      
      // Validation date
      if (row.birth_date && isNaN(Date.parse(row.birth_date))) {
        errors.push(`Ligne ${lineNumber}: Date de naissance invalide (format: YYYY-MM-DD)`);
      }
      
      // Validation family_head_email (optionnel mais doit être valide si fourni)
      if (row.family_head_email && row.family_head_email.trim() !== '') {
        if (!emailRegex.test(row.family_head_email)) {
          errors.push(`Ligne ${lineNumber}: Email chef de famille invalide`);
        }
      }
    });
    
    return errors;
  };

  const importMembers = async () => {
    try {
      setImporting(true);
      
      // Validation des données
      const validationErrors = validateCSVData(csvData);
      if (validationErrors.length > 0) {
        alert(`❌ Erreurs de validation :\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? '\n...' : ''}`);
        return;
      }

      // Import via nouvelle fonction avec création de comptes
      const { data, error } = await supabase.rpc('import_members_with_accounts', {
      });

      if (error) throw error;

      setResult(data);
      
      if (data.imported_count > 0) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'import:', error);
      alert(`❌ Erreur lors de l'import: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          📥 Import CSV de membres
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Étape 1: Télécharger le modèle */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">1. Téléchargez le modèle CSV</h4>
        <div className="text-sm text-blue-700 mb-3">
          <p>Utilisez notre modèle pour formater correctement vos données</p>
          {loadingCategories ? (
            <p className="text-xs mt-1">⏳ Chargement des catégories...</p>
          ) : categories.length === 0 ? (
            <p className="text-xs mt-1 text-red-600">
              ⚠️ Aucune catégorie trouvée ! Créez d'abord des catégories dans Paramètres → Catégories
            </p>
          ) : (
            <p className="text-xs mt-1 text-green-600">
              ✅ Modèle généré avec vos {categories.length} catégories actives
            </p>
          )}
        </div>
        <button
          onClick={downloadTemplate}
          disabled={loadingCategories || categories.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>
            {loadingCategories ? 'Chargement...' : 
             categories.length === 0 ? 'Créez d\'abord des catégories' :
             'Télécharger le modèle'}
          </span>
        </button>
      </div>

      {/* Étape 2: Upload du fichier */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 mb-2">2. Uploadez votre fichier CSV</h4>
        <div className="space-y-3">
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                Cliquez pour sélectionner votre fichier CSV
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </label>
          
          {file && (
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900">{file.name}</span>
                <span className="text-xs text-gray-500">({Math.round(file.size / 1024)} KB)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Étape 3: Prévisualisation */}
      {showPreview && csvData.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">3. Prévisualisation des données</h4>
          <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Prénom</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Nom</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Téléphone</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Naissance</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Famille</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {csvData.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">{row.first_name}</td>
                      <td className="px-3 py-2">{row.last_name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.phone}</td>
                      <td className="px-3 py-2">{row.birth_date}</td>
                      <td className="px-3 py-2">
                        {row.family_head_email ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            👶 Enfant
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            👨‍👩 Chef de famille
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.length > 5 && (
              <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center">
                ... et {csvData.length - 5} autres lignes
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {csvData.length} membre{csvData.length > 1 ? 's' : ''} à importer
          </p>
        </div>
      )}

      {/* Étape 4: Import */}
      {showPreview && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">4. Lancer l'import</h4>
          
          {/* Option envoi d'emails */}
          <div className="mb-4">
            <label className="flex items-center space-x-3 p-3 bg-white border border-green-300 rounded-lg">
              <input
                type="checkbox"
                checked={sendEmails}
                onChange={(e) => setSendEmails(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div>
                <span className="font-medium text-green-800">
                  📧 Créer des comptes et envoyer les identifiants par email
                </span>
                <p className="text-sm text-green-700">
                  {sendEmails 
                    ? "✅ Les membres recevront leurs identifiants de connexion par email"
                    : "❌ Import silencieux - Aucun email envoyé (comptes créés quand même)"
                  }
                </p>
              </div>
            </label>
          </div>
          
          {/* Option envoi d'emails */}
          <div className="mb-4">
            <label className="flex items-center space-x-3 p-3 bg-white border border-green-300 rounded-lg">
              <input
                type="checkbox"
                checked={sendEmails}
                onChange={(e) => setSendEmails(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div>
                <span className="font-medium text-green-800">
                  📧 Créer des comptes et envoyer les identifiants par email
                </span>
                <p className="text-sm text-green-700">
                  {sendEmails 
                    ? "✅ Les membres recevront leurs identifiants de connexion par email"
                    : "❌ Import silencieux - Aucun email envoyé (comptes créés quand même)"
                  }
                </p>
              </div>
            </label>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={importMembers}
              disabled={importing}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              {importing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Création des comptes...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Créer {csvData.length} comptes membres</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowPreview(false);
                setFile(null);
                setCsvData([]);
              }}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Résultats de l'import */}
      {result && (
        <div className={`border rounded-lg p-4 ${
          result.error_count === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${
            result.error_count === 0 ? 'text-green-800' : 'text-yellow-800'
          }`}>
            📊 Résultats de l'import
          </h4>
          <div className={`text-sm space-y-1 ${
            result.error_count === 0 ? 'text-green-700' : 'text-yellow-700'
          }`}>
            <p>✅ Membres importés avec succès : {result.imported_count}</p>
            {result.error_count > 0 && (
              <>
                <p>❌ Erreurs : {result.error_count}</p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 10).map((error, index) => (
                    <p key={index} className="text-xs text-red-600">• {error}</p>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-xs text-red-500">... et {result.errors.length - 10} autres erreurs</p>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => {
              setResult(null);
              onClose();
            }}
            className="mt-3 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="font-semibold text-amber-800 mb-2">💡 Instructions</h4>
        <div className="text-sm text-amber-700 space-y-1">
          <p>• <strong>Colonnes obligatoires :</strong> first_name, last_name, email, birth_date</p>
          <p>• <strong>Colonnes optionnelles :</strong> phone, address, postal_code, city, category, membership_fee, ffvb_license, family_head_email, emergency_contact, emergency_phone, notes</p>
          <p>• <strong>Format date :</strong> YYYY-MM-DD (ex: 1995-03-15)</p>
          <p>• <strong>Format téléphone :</strong> Minimum 8 chiffres (ex: 0612345678 ou 06 12 34 56 78)</p>
          <p>• <strong>Catégorie :</strong> Si vide, calculée automatiquement selon l'âge (baby, poussin, benjamin, minime, cadet, junior, senior, veteran)</p>
          <p>• <strong>Tarif :</strong> Si vide, calculé automatiquement selon la catégorie (120€-250€)</p>
          <p>• <strong>Licence FFVB :</strong> Numéro de licence officielle (optionnel)</p>
          <p>• <strong>Statut initial :</strong> Tous les membres importés seront en "pending"</p>
          <p>• <strong>Gestion familiale :</strong> Si family_head_email renseigné, l'enfant sera lié au parent</p>
          <p>• <strong>Réduction familiale :</strong> 10% automatique à partir du 2ème enfant</p>
          <p>• <strong>Contact d'urgence :</strong> emergency_contact et emergency_phone pour les mineurs</p>
          <p>• <strong>Notes :</strong> Informations complémentaires sur le membre</p>
          <p>• <strong>Guillemets :</strong> Utilisez des guillemets pour les valeurs contenant des virgules</p>
        </div>
      </div>
    </div>
  );
};