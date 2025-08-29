import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, CheckCircle, XCircle, AlertCircle, X, Users, Baby, Crown, Link } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CSVImporterProps {
  onSuccess: () => void;
  onClose: () => void;
}

interface ImportResult {
  success: boolean;
  total_processed: number;
  members_created: number;
  accounts_created: number;
  families_linked: number;
  errors: Array<{
    line: number;
    message: string;
  }>;
}

interface ParsedMember {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  category?: string;
  membership_fee?: number;
  ffvb_license?: string;
  family_head_email?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  notes?: string;
}

interface Category {
  id: string;
  value: string;
  label: string;
  color: string;
  icon?: React.ComponentType;
}

const CSVImporter: React.FC<CSVImporterProps> = ({ onSuccess, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<ParsedMember[]>([]);
  const [previewData, setPreviewData] = useState<ParsedMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [createAccounts, setCreateAccounts] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, value, label, color')
        .order('label');
      
      if (error) throw error;
      
      const categoriesWithIcons = data.map(cat => ({
        ...cat,
        icon: Users
      }));
      
      setCategories(categoriesWithIcons);
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    const category = categories.find(cat => cat.value === categoryName);
    return category?.icon || Users;
  };

  const getCategoryBadgeColor = (categoryName: string) => {
    const category = categories.find(cat => cat.value === categoryName);
    if (!category) return 'bg-gray-100 text-gray-800';
    
    return category.color ? `bg-${category.color}-100 text-${category.color}-800` : 'bg-blue-100 text-blue-800';
  };

  const parseCSV = (content: string) => {
    try {
      // Détection du séparateur
      const separator = content.includes(';') ? ';' : ',';
      console.log(`🔍 Séparateur détecté: "${separator}"`);
      
      const lines = content.trim().split('\n').filter(line => line.trim());
      const headers = lines[0].split(separator).map(h => h.replace(/^"|"$/g, '').trim());
      
      console.log('🔍 HEADERS:', headers);
      
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // 🚨 CORRECTION : Split avec limite pour préserver les champs vides
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === separator && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim()); // Dernier champ
        
        // S'assurer qu'on a le bon nombre de colonnes
        while (values.length < headers.length) {
          values.push('');
        }
        
        console.log('🔍 LIGNE', i, ':', values);
        
        const row: any = {};
        
        // Mapping direct par index (plus fiable)
        headers.forEach((header, index) => {
          const value = values[index] || '';
          
          switch (header.toLowerCase()) {
            case 'first_name':
              row.first_name = value;
              break;
            case 'last_name':
              row.last_name = value;
              break;
            case 'email':
              row.email = value;
              break;
            case 'phone':
              row.phone = value;
              break;
            case 'birth_date':
              if (value) {
                // Conversion DD/MM/YY ou DD/MM/YYYY vers YYYY-MM-DD
                if (value.includes('/')) {
                  const parts = value.split('/');
                  if (parts.length === 3) {
                    let [day, month, year] = parts;
                    // Si année sur 2 chiffres, ajouter 19 ou 20
                    if (year.length === 2) {
                      const yearNum = parseInt(year);
                      year = yearNum > 50 ? `19${year}` : `20${year}`;
                    }
                    row.birth_date = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  } else {
                    row.birth_date = value;
                  }
                } else {
                  row.birth_date = value;
                }
              }
              break;
            case 'address':
              row.address = value;
              break;
            case 'postal_code':
              row.postal_code = value;
              break;
            case 'city':
              row.city = value;
              break;
            case 'category':
              row.category = value;
              break;
            case 'membership_fee':
              row.membership_fee = value ? parseFloat(value) : null;
              break;
            case 'ffvb_license':
              row.ffvb_license = value;
              break;
            case 'family_head_email':
              // family_head_email est optionnel - ne pas l'inclure s'il est vide
              if (value && value.trim()) {
                row.family_head_email = value.trim();
              }
              break;
            case 'emergency_contact':
              row.emergency_contact = value;
              break;
            case 'emergency_phone':
              row.emergency_phone = value;
              break;
            case 'notes':
              row.notes = value;
              break;
          }
        });
        
        data.push(row);
      }
      
      console.log('✅ Données finales:', data.slice(0, 2));
      return data;
      
    } catch (error) {
      console.error('❌ Erreur parsing CSV:', error);
      throw new Error('Erreur lors de l\'analyse du fichier CSV');
    }
  };

  const validateData = (data: ParsedMember[]): string[] => {
    const errors: string[] = [];
    const categoryNames = categories.map(cat => cat.name);
    
    console.log('🏷️ Catégories disponibles:', categoryNames);
    
    data.forEach((row, index) => {
      const lineNum = index + 2; // +2 car index 0 = ligne 2 (après header)
      
      // Validation champs obligatoires
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
      
      // Validation family_head_email si renseigné
      if (row.family_head_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.family_head_email)) {
        errors.push(`Ligne ${lineNum}: Format email chef de famille invalide (${row.family_head_email})`);
      }
      
      // Validation catégorie - STRICTE
      if (row.category && row.category.trim()) {
        const categoryExists = categories.some(cat => cat.value === row.category.trim());
        if (!categoryExists) {
          const availableCategories = categories.map(cat => cat.value).join(', ');
          errors.push(`Ligne ${lineNum}: Catégorie "${row.category}" introuvable. Catégories disponibles: ${availableCategories}`);
        }
      }
      
      // Validation date
      if (row.birth_date && row.birth_date.trim()) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(row.birth_date)) {
          errors.push(`Ligne ${lineNum}: Format de date invalide (${row.birth_date}). Format attendu: YYYY-MM-DD`);
        }
      }
    });
    
    return errors;
  };

  const detectFamilies = (data: ParsedMember[]) => {
    const familyGroups = new Map();
    
    data.forEach((member, index) => {
      if (member.family_head_email && member.family_head_email.trim()) {
        const headEmail = member.family_head_email.trim().toLowerCase();
        if (!familyGroups.has(headEmail)) {
          familyGroups.set(headEmail, []);
        }
        familyGroups.get(headEmail).push(index);
      }
    });
    
    return familyGroups;
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
          const parsedData = parseCSV(content);
          setCsvData(parsedData);
          setPreviewData(parsedData.slice(0, 10)); // Aperçu des 10 premières lignes
          
          // Validation
          const errors = validateData(parsedData);
          setValidationErrors(errors);
        } catch (error) {
          console.error('Erreur lors de la lecture du fichier:', error);
          setValidationErrors([`Erreur lors de la lecture du fichier: ${error}`]);
        }
      };
      reader.readAsText(selectedFile, 'UTF-8');
    }
  };

  // Fonction d'import direct sans RPC personnalisée
  const importMembersDirectly = async (membersData: ParsedMember[]) => {
    try {
      console.log('🚀 [CSVImporter] Début import direct de', membersData.length, 'membres');
      
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
      
      // Traiter chaque membre individuellement
      for (let i = 0; i < membersData.length; i++) {
        const member = membersData[i];
        setUploadProgress((i / membersData.length) * 100);
        
        try {
          // Vérifier si le membre existe déjà
          const { data: existingMember } = await supabase
            .from('members')
            .select('id')
            .eq('email', member.email)
            .single();
          
          if (existingMember) {
            errors.push(`${member.email}: Membre déjà existant`);
            error_count++;
            continue;
          }
          
          // Déterminer la catégorie (loisirs par défaut)
          const category = member.category && member.category.trim() ? member.category.trim() : 'loisirs';
          
          // Utiliser seulement le tarif spécifié dans le CSV (0€ si pas spécifié)
          const membership_fee = member.membership_fee !== undefined && member.membership_fee !== null ? member.membership_fee : 0;
          
          // Créer le membre
          const { data: newMember, error: memberError } = await supabase
            .from('members')
            .insert({
              first_name: member.first_name,
              last_name: member.last_name,
              email: member.email,
              phone: member.phone || null, // Explicitement NULL si vide
              birth_date: member.birth_date || null,
              address: member.address || null,
              postal_code: member.postal_code || null,
              city: member.city || null,
              category: category,
              membership_fee: membership_fee,
              ffvb_license: member.ffvb_license || null,
              emergency_contact: member.emergency_contact || null,
              emergency_phone: member.emergency_phone || null,
              notes: member.notes || null,
              status: 'pending',
              payment_status: 'pending',
              season_id: currentSeason.id
            })
            .select('id')
            .single();
          
          if (memberError) {
            console.error('❌ Erreur création membre:', memberError);
            errors.push(`${member.email}: ${memberError.message}`);
            error_count++;
            continue;
          }
          
          // Ajouter la catégorie principale dans member_categories
          const { error: categoryError } = await supabase
            .from('member_categories')
            .insert({
              member_id: newMember.id,
              category_value: category,
              is_primary: true
            });
          
          if (categoryError) {
            console.warn('⚠️ Erreur ajout catégorie:', categoryError);
            // Ne pas bloquer l'import pour cette erreur
          }
          
          imported_count++;
          console.log(`✅ Membre créé: ${member.first_name} ${member.last_name}`);
          
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
        accounts_created: 0, // Pas de comptes auth créés
        message: `Import terminé. ${imported_count} profils membres créés.`
      };
      
    } catch (error: any) {
      console.error('❌ Erreur générale import:', error);
      return {
        success: false,
        imported_count: 0,
        error_count: 1,
        errors: [error.message],
        accounts_created: 0,
        message: `Erreur d'import: ${error.message}`
      };
    }
  };

  const handleImport = async () => {
    if (!csvData.length || validationErrors.length > 0) return;
    
    setIsLoading(true);
    setUploadProgress(0);
    
    try {
      // Préparer les données en filtrant les champs vides
      const cleanedData = csvData.map(member => {
        const cleaned: any = { ...member };
        
        // Supprimer family_head_email s'il est vide pour éviter les erreurs
        if (!cleaned.family_head_email || !cleaned.family_head_email.trim()) {
          delete cleaned.family_head_email;
        }
        
        return cleaned;
      });
      
     console.log('🔍 [CSVImporter] Données à envoyer:', cleanedData.slice(0, 2));
     console.log('🔍 [CSVImporter] Nombre de membres:', cleanedData.length);
     console.log('🔍 [CSVImporter] Créer comptes:', createAccounts);
      
      // Import direct sans fonction RPC personnalisée
      const result = await importMembersDirectly(cleanedData);
      
     console.log('🔍 [CSVImporter] Résultat RPC:', result);
     
     if (!result) {
       throw new Error('Aucun résultat retourné par la fonction d\'import');
     }
     
      setUploadProgress(100);
      
     // Adapter le résultat au format attendu
     const adaptedResult = {
       success: result.success || false,
       total_processed: cleanedData.length,
       members_created: result.imported_count || 0,
       accounts_created: result.accounts_created || 0,
       families_linked: 0, // À implémenter plus tard
       errors: (result.errors || []).map((error: string, index: number) => ({
         line: index + 2,
         message: error
       }))
     };
     
     console.log('✅ [CSVImporter] Résultat adapté:', adaptedResult);
     setImportResult(adaptedResult);
      
     // Afficher un message détaillé avec les erreurs
     if (result.success) {
       if (result.imported_count > 0) {
         const message = `✅ Import terminé !
 
 📊 Résultats :
 • ${result.imported_count || 0} membres créés
 • ${result.accounts_created || 0} comptes utilisateurs créés
 • ${result.error_count || 0} erreurs
 
 ${createAccounts ? '🔑 Les identifiants temporaires ont été générés' : '👤 Seuls les profils membres ont été créés'}`;
         
         alert(message);
         
         setTimeout(() => {
           onSuccess();
         }, 2000);
       } else {
         // Aucun membre importé - afficher les erreurs
         const errorDetails = (result.errors || []).slice(0, 5).join('\n• ');
         const message = `⚠️ Aucun membre importé !
 
 📊 Résultats :
 • ${result.imported_count || 0} membres créés
 • ${result.error_count || 0} erreurs détectées
 
 🔍 Premières erreurs :
 • ${errorDetails}
 
 ${result.error_count > 5 ? `\n... et ${result.error_count - 5} autres erreurs` : ''}
 
 💡 Vérifiez votre fichier CSV et les catégories configurées.`;
         
         alert(message);
       }
     } else {
       alert(`❌ Erreur d'import : ${result.error || 'Erreur inconnue'}`);
     }
      
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
     alert(`❌ Erreur technique : ${error}`);
      setImportResult({
        success: false,
        total_processed: 0,
        members_created: 0,
        accounts_created: 0,
        families_linked: 0,
        errors: [{ line: 0, message: `Erreur générale: ${error}` }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'first_name', 'last_name', 'email', 'phone', 'birth_date',
      'address', 'postal_code', 'city', 'category', 'membership_fee',
      'ffvb_license', 'family_head_email', 'emergency_contact', 'emergency_phone', 'notes'
    ];
    
    const exampleData = [
      'Sophie', 'Martin', 'sophie.martin@email.com', '0612345678', '1995-03-15',
      '123 Rue de la Paix', '75001', 'Paris', 'Loisirs', '250',
      'FL123456', '', 'Paul Martin', '0687654321', 'Remarque exemple'
    ];
    
    const csvContent = headers.join(';') + '\n' + exampleData.join(';');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modele_import_membres.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const familyGroups = csvData.length > 0 ? detectFamilies(csvData) : new Map();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Upload className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Import CSV des Membres</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Section 1: Sélection de fichier */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">1. Sélection du fichier CSV</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center justify-center w-full max-w-md px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50">
                  <div className="space-y-2 text-center">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto" />
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-blue-600">Cliquez pour choisir</span>
                      <span> ou glissez votre fichier CSV</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileSelect}
                  />
                </label>

                <button
                  onClick={downloadTemplate}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le modèle</span>
                </button>
              </div>

              {file && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Fichier sélectionné: {file.name}</span>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">📋 Format CSV requis</h4>
                <p>• <strong>Encodage :</strong> UTF-8 (pour les accents)</p>
                <p>• <strong>Séparateur :</strong> Point-virgule <code>;</code> (France) ou virgule <code>,</code> (détection automatique)</p>
                <p>• <strong>Guillemets :</strong> Optionnels - utilisez <code>"</code> seulement si valeurs avec séparateurs</p>
              </div>
              
              <div className="mt-3 p-3 bg-amber-100 rounded-lg">
                <h5 className="font-semibold text-amber-800 mb-1">🔍 Exemple de ligne valide :</h5>
                <code className="text-xs text-amber-700 block">
                  Sophie;Martin;sophie@email.com;0612345678;1995-03-15;Loisirs;250
                </code>
                <p className="text-xs text-amber-600 mt-1">
                  ✅ Format français avec point-virgule (;) - Compatible Excel France
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Validation */}
          {csvData.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">2. Validation des données</h3>
              
              {validationErrors.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-red-800">Erreurs détectées ({validationErrors.length})</span>
                  </div>
                  <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
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
                      Validation réussie - {csvData.length} membres prêts à importer
                    </span>
                  </div>
                  {familyGroups.size > 0 && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-blue-700">
                      <Users className="w-4 h-4" />
                      <span>{familyGroups.size} famille(s) détectée(s)</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={createAccounts}
                    onChange={(e) => setCreateAccounts(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                    disabled={true}
                  />
                  <span className="text-sm text-gray-700">
                    Créer des comptes de connexion (non disponible - voir instructions)
                  </span>
                </label>
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-1">ℹ️ Comment ça marche</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• <strong>Import CSV :</strong> Crée les profils membres avec catégorie "loisirs" par défaut</p>
                    <p>• <strong>Comptes de connexion :</strong> Les membres s'inscrivent manuellement sur le site</p>
                    <p>• <strong>Liaison automatique :</strong> Le système lie le compte au profil via l'email</p>
                    <p>• <strong>Tarif :</strong> 200€ par défaut pour la catégorie "loisirs"</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Prévisualisation */}
          {previewData.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">3. Prévisualisation des données</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prénom</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Naissance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Famille</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.map((member, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{member.first_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{member.last_name}</td>
                          <td className="px-4 py-3 text-sm text-blue-600">{member.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {member.phone ? (
                              <span className="flex items-center space-x-1">
                                <span>📱</span>
                                <span>{member.phone}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400">Optionnel</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{member.birth_date}</td>
                          <td className="px-4 py-3">
                            {member.category ? (
                              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(member.category)}`}>
                                {React.createElement(getCategoryIcon(member.category), { className: "w-4 h-4" })}
                                <span>{member.category}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">(Vide)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {member.family_head_email ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                <Users className="w-3 h-3" />
                                <span>Indépendant</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                                <Baby className="w-3 h-3" />
                                <span>Indépendant</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.length > 10 && (
                  <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
                    Affichage de 10 lignes sur {csvData.length} au total
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Résultats d'import */}
          {importResult && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Résultats de l'import</h3>
              <div className={`border rounded-lg p-4 ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  {importResult.success ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-800">
                        Import réussi ! {importResult.members_created} membre(s) importé(s)
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="font-medium text-red-800">Échec de l'import</span>
                    </>
                  )}
                </div>
                
                {importResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Erreurs détectées :</p>
                    <ul className="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span>Ligne {error.line}: {error.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer avec actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center space-x-4">
            {isLoading && (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-600">Import en cours... {Math.round(uploadProgress)}%</span>
              </div>
            )}
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
              disabled={!csvData.length || validationErrors.length > 0 || isLoading}
              className={`px-6 py-2 rounded-md font-medium ${
                csvData.length && validationErrors.length === 0 && !isLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Import...</span>
                </div>
              ) : (
                `Importer ${csvData.length || 0} membre(s)`
              )}
            </button>
          </div>
        </div>

        {/* Barre de progression */}
        {isLoading && (
          <div className="h-1 bg-gray-200">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export { CSVImporter };
