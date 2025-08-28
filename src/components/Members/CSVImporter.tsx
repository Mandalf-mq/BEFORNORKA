import React, { useState, useEffect } from 'react';
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
    if (categories.length === 0) {
      alert('❌ Aucune catégorie disponible !\n\nVeuillez d\'abord créer des catégories dans Paramètres → Catégories');
      return;
    }

    // Utiliser les vraies catégories de votre base de données
    const cat1 = categories[0] || { value: 'senior', label: 'Senior', membership_fee: 250 };
    const cat2 = categories[1] || cat1;
    const cat3 = categories[2] || cat1;
    
    // FORMAT FRANÇAIS avec point-virgule (;) - Compatible Excel France
    const csvTemplate = 'first_name;last_name;email;phone;birth_date;address;postal_code;city;category;membership_fee;ffvb_license;family_head_email;emergency_contact;emergency_phone;notes\n' +
      'Sophie;Martin;sophie.martin@email.com;0612345678;15/03/1995;123 Rue de la République;75001;Paris;' + cat1.value + ';' + cat1.membership_fee + ';;Marie Martin;0687654321;Mère de Lucas et Emma\n' +
      'Lucas;Dubois;lucas.dubois@email.com;0623456789;22/07/2010;123 Rue de la République;75001;Paris;' + cat2.value + ';' + cat2.membership_fee + ';12345678;sophie.martin@email.com;Sophie Martin;0612345678;Fils de Sophie - Très motivé\n' +
      'Emma;Leroy;emma.leroy@email.com;;08/11/2008;123 Rue de la République;75001;Paris;' + cat3.value + ';' + cat3.membership_fee + ';87654321;sophie.martin@email.com;Sophie Martin;0612345678;Fille de Sophie - Débutante\n' +
      'Pierre;Dupont;pierre.dupont@email.com;0645678901;05/12/1988;456 Avenue des Sports;92100;Boulogne;' + cat1.value + ';' + cat1.membership_fee + ';11223344;;Claire Dupont;0698765432;Joueur expérimenté - Capitaine potentiel\n' +
      'Marie;Dupont;marie.dupont@email.com;0656789012;18/06/2012;456 Avenue des Sports;92100;Boulogne;' + cat2.value + ';' + cat2.membership_fee + ';55667788;pierre.dupont@email.com;Pierre Dupont;0645678901;Fille de Pierre - Très sportive\n' +
      'Jean;Moreau;jean.moreau@email.com;0634567890;30/09/1975;789 Boulevard du Volleyball;94200;Ivry;' + cat1.value + ';' + cat1.membership_fee + ';99887766;;Sylvie Moreau;0676543210;Ancien joueur professionnel';
  }
}.value};${cat1.membership_fee};99887766;;Sylvie Moreau;0676543210;Ancien joueur professionnel

    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_membres_francais.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fonction pour convertir les dates françaises
  const convertFrenchDate = (dateStr: string): string => {
    if (!dateStr || dateStr.trim() === '') return '';
    
    // Format DD/MM/YY ou DD/MM/YYYY (support années 2 chiffres)
    const frenchDateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
    const match = dateStr.match(frenchDateRegex);
    
    if (match) {
      let [, day, month, year] = match;
      
      // Convertir année 2 chiffres en 4 chiffres
      if (year.length === 2) {
        const yearNum = parseInt(year);
        // Si > 30, c'est 19XX, sinon 20XX (pour gérer 1981 = 81)
        year = yearNum > 30 ? '19' + year : '20' + year;
      }
      
      // Retourner au format ISO (YYYY-MM-DD)
      return year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');
    }
    
    // Si déjà au bon format, retourner tel quel
    return dateStr;
  };

  const parseCSV = (csvText: string) => {
    console.log('🔍 [CSVImporter] Début du parsing CSV');
    console.log('🔍 [CSVImporter] Contenu brut (100 premiers caractères):', csvText.substring(0, 100));
    
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log('🔍 [CSVImporter] Nombre de lignes après filtrage:', lines.length);
    
    if (lines.length < 2) {
      throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données');
    }
    
    console.log('🔍 [CSVImporter] Première ligne (header):', lines[0]);
    console.log('🔍 [CSVImporter] Deuxième ligne (data):', lines[1]);
    
    // Parser CSV avec gestion des guillemets
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
  // Fonction pour convertir les dates françaises
  const convertFrenchDate = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // Format DD/MM/YY ou DD/MM/YYYY
    const frenchDateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
    const match = dateStr.match(frenchDateRegex);
    
    if (match) {
      let [, day, month, year] = match;
      
      // Convertir année 2 chiffres en 4 chiffres
      if (year.length === 2) {
        const yearNum = parseInt(year);
        // Si > 50, c'est 19XX, sinon 20XX
      let inQuotes = false;
      const separator = line.includes(';') ? ';' : ',';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
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
    
    console.log('🔍 [CSVImporter] Headers détectés:', headers);
    console.log('🔍 [CSVImporter] Nombre de headers:', headers.length);
    
    const data = lines.slice(1).map(line => {
      console.log('🔍 [CSVImporter] Parsing ligne:', line);
      const values = parseCSVLine(line).map(v => v.replace(/"/g, '').trim());
      console.log('🔍 [CSVImporter] Valeurs extraites:', values);
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      console.log('🔍 [CSVImporter] Objet créé:', row);
      
      // Convertir la date de naissance si nécessaire
      if (row.birth_date) {
        row.birth_date = convertFrenchDate(row.birth_date);
      }
      
      // Mapper la catégorie "Loisirs" vers une catégorie valide
      if (row.category === 'Loisirs' || row.category === 'loisirs') {
        row.category = 'senior'; // Mapper vers senior par défaut
      }
      
      console.log('🔍 [CSVImporter] Ligne parsée:', row);
      return row;
    });
    
    console.log('🔍 [CSVImporter] Données complètes:', data);
    return data;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      alert('❌ Veuillez sélectionner un fichier CSV');
      return;
    }
    
    setFile(selectedFile);
    setResult(null); // Reset les résultats précédents
    setCsvData([]); // Reset les données précédentes
    setShowPreview(false); // Reset la prévisualisation
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      try {
        console.log('🔍 [CSVImporter] Contenu CSV brut:', csvText.substring(0, 500));
        const parsedData = parseCSV(csvText);
        console.log('🔍 [CSVImporter] Données parsées:', parsedData);
        setCsvData(parsedData);
        setShowPreview(true);
      } catch (error) {
        console.error('❌ [CSVImporter] Erreur parsing CSV:', error);
        alert(`❌ Erreur lors de la lecture du fichier CSV: ${error.message}\n\nVérifiez :\n• L'encodage du fichier (UTF-8)\n• Le format des colonnes\n• La présence d'une ligne d'en-tête`);
        setShowPreview(false);
        setCsvData([]);
      }
    };
    reader.readAsText(selectedFile, 'UTF-8'); // Forcer l'encodage UTF-8
  };

  const validateCSVData = (data: any[]) => {
    const errors: string[] = [];
    const requiredFields = ['first_name', 'last_name', 'email']; // birth_date devient optionnel
    
    if (data.length === 0) {
      errors.push('Le fichier CSV est vide ou mal formaté');
      return errors;
    }
    
    console.log('🔍 [CSVImporter] Validation de', data.length, 'lignes');
    console.log('🔍 [CSVImporter] Première ligne:', data[0]);
    
    data.forEach((row, index) => {
      const lineNumber = index + 2; // +2 car index 0 = ligne 2 (après header)
      
      console.log(`🔍 [CSVImporter] Validation ligne ${lineNumber}:`, row);
      
      requiredFields.forEach(field => {
        const value = row[field];
        if (!value || value.toString().trim() === '') {
          errors.push(`Ligne ${lineNumber}: Champ "${field}" manquant`);
        }
      });
      
      // Validation email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (row.email && row.email.trim() !== '' && !emailRegex.test(row.email.trim())) {
        errors.push(`Ligne ${lineNumber}: Email invalide`);
      }
      
      // Validation téléphone (optionnel mais doit être valide si fourni)
      if (row.phone && row.phone.trim() !== '') {
        const phoneRegex = /^[0-9\s\-\+\(\)\.]{8,}$/;
        if (!phoneRegex.test(row.phone.replace(/\s/g, ''))) {
          // Téléphone invalide mais pas bloquant
          console.warn(`⚠️ Ligne ${lineNumber}: Téléphone "${row.phone}" pourrait être invalide`);
        }
      }
      
      // Validation date (optionnelle)
      if (row.birth_date && row.birth_date.trim() !== '') {
        const convertedDate = convertFrenchDate(row.birth_date);
        if (!convertedDate || isNaN(Date.parse(convertedDate))) {
          console.warn(`⚠️ Ligne ${lineNumber}: Date "${row.birth_date}" invalide, sera ignorée`);
          row.birth_date = ''; // Vider la date invalide
        }
      }
      
      // Validation catégorie (avec mapping automatique)
      if (row.category && row.category.trim() !== '') {
        const categoryLower = row.category.toLowerCase().trim();
        const validCategory = categories.some(cat => 
          cat.value === row.category || 
          cat.label.toLowerCase() === categoryLower
        );
        if (!validCategory && categories.length > 0) {
          console.warn(`⚠️ Ligne ${lineNumber}: Catégorie "${row.category}" non trouvée dans la base`);
          // Ne pas mapper automatiquement - laisser l'erreur pour que l'admin crée la catégorie
        }
      }
    });
    
    console.log('🔍 [CSVImporter] Erreurs de validation:', errors);
    return errors;
  };

  const importMembers = async () => {
    try {
      setImporting(true);
      
      // Validation des données
      const validationErrors = validateCSVData(csvData);
      if (validationErrors.length > 0) {
        const errorMessage = `❌ Erreurs de validation détectées :\n\n${validationErrors.slice(0, 10).join('\n')}${validationErrors.length > 10 ? `\n\n... et ${validationErrors.length - 10} autres erreurs` : ''}`;
        alert(errorMessage);
        return;
      }

      console.log('🔍 [CSVImporter] Données à importer:', csvData);
      console.log('🔍 [CSVImporter] Envoi emails:', sendEmails);
      
      // Import via nouvelle fonction avec création de comptes
      const { data, error } = await supabase.rpc('import_members_with_accounts', {
        p_csv_data: csvData,
        p_send_emails: sendEmails
      });

      if (error) throw error;

      console.log('🔍 [CSVImporter] Résultat import:', data);
      setResult(data);
      
      if (data.imported_count > 0) {
        alert(`✅ Import réussi !\n\n📊 ${data.imported_count} membres importés\n🔑 ${data.accounts_created || 0} comptes créés\n${data.error_count > 0 ? `⚠️ ${data.error_count} erreurs` : ''}`);
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
              ✅ Modèle généré avec vos {categories.length} catégories actives : {categories.map(c => c.label).join(', ')}
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
                ✅ Modèle généré avec vos {categories.length} catégories actives : {categories.map(c => c.label).join(', ')}
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
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Catégorie</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Famille</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {csvData.slice(0, 5).map((row, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">{row.first_name || '❌ Manquant'}</td>
                      <td className="px-3 py-2">{row.last_name || '❌ Manquant'}</td>
                      <td className="px-3 py-2">{row.email || '❌ Manquant'}</td>
                      <td className="px-3 py-2">{row.phone || '📞 Optionnel'}</td>
                      <td className="px-3 py-2">{row.birth_date || '❌ Manquant'}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          {row.category || 'senior'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.family_head_email ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            👶 Enfant
                          </span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            👨‍👩 Indépendant
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
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white rounded-lg p-3">
              <div className="text-lg font-bold text-blue-600">{csvData.length}</div>
              <div className="text-xs text-gray-600">Total lignes</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-lg font-bold text-green-600">
                {csvData.filter(row => row.first_name && row.last_name && row.email && row.birth_date).length}
              </div>
              <div className="text-xs text-gray-600">Lignes valides</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-lg font-bold text-purple-600">
                {csvData.filter(row => row.family_head_email && row.family_head_email.trim() !== '').length}
              </div>
              <div className="text-xs text-gray-600">Enfants</div>
            </div>
            <div className="bg-white rounded-lg p-3">
              <div className="text-lg font-bold text-orange-600">
                {csvData.filter(row => row.phone && row.phone.trim() !== '').length}
              </div>
              <div className="text-xs text-gray-600">Avec téléphone</div>
            </div>
          </div>
        </div>
      )}

      {/* Étape 4: Import */}
      {showPreview && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">4. Lancer l'import</h4>
          
          {/* Validation avant import */}
          {(() => {
            const validationErrors = validateCSVData(csvData);
            if (validationErrors.length > 0) {
              return (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <h5 className="font-semibold text-red-800 mb-2">❌ Erreurs détectées :</h5>
                  <div className="text-sm text-red-700 max-h-32 overflow-y-auto space-y-1">
                    {validationErrors.slice(0, 10).map((error, index) => (
                      <p key={index}>• {error}</p>
                    ))}
                    {validationErrors.length > 10 && (
                      <p className="font-medium">... et {validationErrors.length - 10} autres erreurs</p>
                    )}
                  </div>
                  <p className="text-xs text-red-600 mt-2 font-medium">
                    ⚠️ Corrigez ces erreurs dans votre fichier CSV avant l'import
                  </p>
                </div>
              );
            }
            return null;
          })()}
          
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
              disabled={importing || validateCSVData(csvData).length > 0}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              {importing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Création des comptes...</span>
                </>
              ) : validateCSVData(csvData).length > 0 ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>Corrigez les erreurs d'abord</span>
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
          <p>• <strong>Colonnes obligatoires :</strong> <code>first_name</code>, <code>last_name</code>, <code>email</code>, <code>birth_date</code></p>
          <p>• <strong>Colonnes optionnelles :</strong> phone, address, postal_code, city, category, membership_fee, ffvb_license, family_head_email, emergency_contact, emergency_phone, notes</p>
          <p>• <strong>Format date :</strong> <code>YYYY-MM-DD</code> (ex: <code>1995-03-15</code>)</p>
          <p>• <strong>Format téléphone :</strong> Minimum 8 chiffres (ex: <code>0612345678</code>)</p>
          <p>• <strong>Encodage :</strong> UTF-8 recommandé pour les accents</p>
          <p>• <strong>Séparateur :</strong> Point-virgule <code>;</code> (France) ou virgule <code>,</code> (détection automatique)</p>
          <p>• <strong>Guillemets :</strong> Optionnels - utilisez <code>"</code> seulement si valeurs avec séparateurs</p>
        </div>
        
        <div className="mt-3 p-3 bg-amber-100 rounded-lg">
          <h5 className="font-semibold text-amber-800 mb-1">🔍 Exemple de ligne valide :</h5>
          <code className="text-xs text-amber-700 block">
            Sophie;Martin;sophie@email.com;0612345678;1995-03-15;senior;250
          </code>
          <p className="text-xs text-amber-600 mt-1">
            ✅ Format français avec point-virgule (;) - Compatible Excel France
          </p>
        </div>
      </div>
    </div>
  );
};