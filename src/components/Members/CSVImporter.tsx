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

    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_membres_francebeach.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(/[;,]/).map(h => h.replace(/"/g, '').trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      data.push(row);
    }

    return data;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      alert('⚠️ Veuillez sélectionner un fichier CSV');
      return;
    }

    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        
        if (data.length === 0) {
          alert('❌ Fichier CSV vide ou invalide');
          return;
        }

        setCsvData(data);
        setShowPreview(true);
        console.log('📊 Données CSV parsées:', data);
      } catch (error) {
        console.error('Erreur lecture CSV:', error);
        alert('❌ Erreur lors de la lecture du fichier CSV');
      }
    };

    reader.readAsText(uploadedFile, 'UTF-8');
  };

  const validateCSVData = (data: any[]) => {
    const errors: string[] = [];
    const requiredFields = ['first_name', 'last_name', 'email', 'birth_date'];
    
    data.forEach((row, index) => {
      const lineNumber = index + 2; // +2 car ligne 1 = en-têtes

      // Validation des champs obligatoires
      requiredFields.forEach(field => {
        if (!row[field] || row[field].toString().trim() === '') {
          errors.push(`Ligne ${lineNumber}: Champ "${field}" manquant`);
        }
      });

      // Validation email
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Ligne ${lineNumber}: Email invalide "${row.email}"`);
      }

      // Validation date de naissance
      if (row.birth_date) {
        const dateStr = row.birth_date.toString().trim();
        // Accepter DD/MM/YYYY ou YYYY-MM-DD
        const frenchDateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const isoDateRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
        
        if (frenchDateRegex.test(dateStr)) {
          const [, day, month, year] = dateStr.match(frenchDateRegex)!;
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > new Date().getFullYear()) {
            errors.push(`Ligne ${lineNumber}: Date de naissance invalide "${dateStr}"`);
          } else {
            // Convertir en format ISO pour la DB
            row.birth_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        } else if (isoDateRegex.test(dateStr)) {
          const [, year, month, day] = dateStr.match(isoDateRegex)!;
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > new Date().getFullYear()) {
            errors.push(`Ligne ${lineNumber}: Date de naissance invalide "${dateStr}"`);
          }
        } else {
          errors.push(`Ligne ${lineNumber}: Format de date invalide "${dateStr}" (attendu: DD/MM/YYYY ou YYYY-MM-DD)`);
        }
      }

      // Validation téléphone
      if (row.phone && row.phone.toString().trim()) {
        const phone = row.phone.toString().replace(/\s/g, '');
        if (!/^\d{8,15}$/.test(phone)) {
          errors.push(`Ligne ${lineNumber}: Téléphone invalide "${row.phone}"`);
        }
      }

      // Validation catégorie - CORRESPONDANCE EXACTE UNIQUEMENT
      if (row.category && row.category.trim() !== '') {
        const originalCategory = row.category.trim();
        
        console.log(`🔍 Ligne ${lineNumber}: Validation catégorie "${originalCategory}"`);
        console.log(`🔍 Catégories configurées:`, categories.map(c => `"${c.label}" (${c.value})`));
        
        // 🔒 RECHERCHE EXACTE UNIQUEMENT - Pas de fallback vers "senior"
        const exactMatch = categories.find(cat => 
          cat.label === originalCategory || cat.value === originalCategory
        );
        
        if (!exactMatch) {
          // 📋 Lister toutes les catégories disponibles pour l'utilisateur
          const availableCategories = categories.map(c => `"${c.label}"`).join(', ');
          errors.push(`❌ Ligne ${lineNumber}: Catégorie "${originalCategory}" introuvable. Catégories exactes disponibles : ${availableCategories}`);
        } else {
          // ✅ Utiliser la valeur officielle de la catégorie trouvée
          row.category = exactMatch.value;
          console.log(`✅ Ligne ${lineNumber}: "${originalCategory}" → "${exactMatch.value}" (${exactMatch.label})`);
        }
      } else {
        // 📝 Colonne vide → reste vide (pas de défaut)
        row.category = '';
        console.log(`📝 Ligne ${lineNumber}: Catégorie vide - pas de défaut appliqué`);
      }

      // Validation code postal français (si fourni)
      if (row.postal_code && row.postal_code.toString().trim()) {
        const postalCode = row.postal_code.toString().trim();
        if (!/^\d{5}$/.test(postalCode)) {
          errors.push(`Ligne ${lineNumber}: Code postal français invalide "${postalCode}" (5 chiffres attendus)`);
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

      let imported_count = 0;
      let error_count = 0;
      const errors: string[] = [];

      // Import membre par membre
      for (const [index, row] of csvData.entries()) {
        try {
          // Préparer les données du membre
          const memberData = {
            first_name: row.first_name?.trim(),
            last_name: row.last_name?.trim(),
            email: row.email?.trim()?.toLowerCase(),
            phone: row.phone?.trim() || null,
            birth_date: row.birth_date?.trim(),
            address: row.address?.trim() || null,
            postal_code: row.postal_code?.trim() || null,
            city: row.city?.trim() || null,
            category: row.category?.trim() || null,
            membership_fee: parseFloat(row.membership_fee) || 0,
            ffvb_license: row.ffvb_license?.trim() || null,
            family_head_email: row.family_head_email?.trim()?.toLowerCase() || null,
            emergency_contact: row.emergency_contact?.trim() || null,
            emergency_phone: row.emergency_phone?.trim() || null,
            notes: row.notes?.trim() || null,
            payment_status: 'pending',
            status: 'active'
          };

          // Insérer le membre
          const { data: member, error: memberError } = await supabase
            .from('members')
            .insert([memberData])
            .select()
            .single();

          if (memberError) {
            throw new Error(`Erreur membre: ${memberError.message}`);
          }

          // Créer un compte utilisateur si demandé
          if (sendEmails && member) {
            try {
              const password = Math.random().toString(36).slice(-8);
              const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: memberData.email!,
                password: password,
                email_confirm: true,
                user_metadata: {
                  full_name: `${memberData.first_name} ${memberData.last_name}`,
                  role: 'member',
                  member_id: member.id
                }
              });

              if (authError) {
                console.warn(`Compte non créé pour ${memberData.email}: ${authError.message}`);
              } else {
                console.log(`✅ Compte créé pour ${memberData.email}`);
              }
            } catch (authError: any) {
              console.warn(`Erreur création compte pour ${memberData.email}:`, authError);
            }
          }

          imported_count++;
          console.log(`✅ Membre importé: ${memberData.first_name} ${memberData.last_name}`);

        } catch (error: any) {
          error_count++;
          const errorMsg = `Ligne ${index + 2}: ${error.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Résultat final
      const result: ImportResult = {
        success: imported_count > 0,
        imported_count,
        error_count,
        errors,
        message: `Import terminé: ${imported_count} membres importés, ${error_count} erreurs`,
        accounts_created: imported_count,
        send_emails_requested: sendEmails
      };

      setResult(result);
      
      if (imported_count > 0) {
        onSuccess();
      }

    } catch (error: any) {
      console.error('Erreur lors de l\'import:', error);
      setResult({
        success: false,
        imported_count: 0,
        error_count: csvData.length,
        errors: [error.message],
        message: `Erreur critique: ${error.message}`
      });
    } finally {
      setImporting(false);
    }
  };

  const getCategoryLabel = (categoryValue: string) => {
    if (!categoryValue) return '(Vide)';
    
    const category = categories.find(cat => cat.value === categoryValue || cat.label === categoryValue);
    return category ? category.label : categoryValue;
  };

  const getFamilyTypeLabel = (member: any) => {
    if (member.family_head_email && member.family_head_email.trim()) {
      return '👶 Enfant';
    }
    
    const hasChildren = csvData.some(other => 
      other.family_head_email === member.email
    );
    
    return hasChildren ? '👑 Chef de famille' : '😊 Indépendant';
  };

  if (loadingCategories) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
            <span>Chargement des catégories...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Upload className="h-6 w-6" />
            Import CSV des membres
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Télécharger le modèle */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Download className="h-5 w-5" />
              1. Télécharger le modèle
            </h4>
            <p className="text-sm text-blue-700 mb-3">
              Téléchargez le modèle CSV avec les en-têtes corrects et des exemples de données.
            </p>
            <button
              onClick={downloadTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Télécharger le modèle CSV
            </button>
          </div>

          {/* Upload du fichier */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              2. Sélectionner votre fichier CSV
            </h4>
            <div className="space-y-3">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
              />
              {file && (
                <p className="text-sm text-green-700">
                  ✅ Fichier sélectionné : {file.name}
                </p>
              )}
            </div>
          </div>

          {/* Configuration */}
          {file && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-800 mb-2">⚙️ Configuration</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sendEmails}
                    onChange={(e) => setSendEmails(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-purple-700">
                    Créer des comptes utilisateurs et envoyer les identifiants par email
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Prévisualisation des données */}
          {showPreview && csvData.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-3">3. Prévisualisation des données</h4>
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full bg-white border border-gray-300 rounded-lg">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prénom</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Naissance</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Famille</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {csvData.slice(0, 5).map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{row.first_name}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row.last_name}</td>
                        <td className="px-3 py-2 text-sm text-blue-600">{row.email}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {row.phone ? (
                            <span className="flex items-center gap-1">
                              📱 {row.phone}
                            </span>
                          ) : (
                            <span className="text-gray-400 flex items-center gap-1">
                              📱 Optionnel
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row.birth_date}</td>
                        <td className="px-3 py-2 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            row.category ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {getCategoryLabel(row.category)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                            {getFamilyTypeLabel(row)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 5 && (
                  <p className="text-center text-gray-500 text-sm mt-2">
                    ... et {csvData.length - 5} autres lignes
                  </p>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">
                <strong>{csvData.length} membres à importer</strong>
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={importMembers}
                  disabled={importing}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importation...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Valider l'import ({csvData.length} membres)
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
              <p>• <strong>Format date :</strong> <code>YYYY-MM-DD</code> (ex: <code>1995-03-15</code>) ou <code>DD/MM/YYYY</code> (ex: <code>15/03/1995</code>)</p>
              <p>• <strong>Format téléphone :</strong> Minimum 8 chiffres (ex: <code>0612345678</code>)</p>
              <p>• <strong>Catégories :</strong> Doit correspondre exactement aux catégories configurées (sensible à la casse)</p>
              <p>• <strong>Encodage :</strong> UTF-8 recommandé pour les accents</p>
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
      </div>
    </div>
  );
};
