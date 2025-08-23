import React from 'react';
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface DocumentsProgressProps {
  stats: Array<{
    document_type: string;
    total_uploaded: number;
    total_validated: number;
    total_pending: number;
    completion_rate: number;
  }>;
}

export const DocumentsProgress: React.FC<DocumentsProgressProps> = ({ stats }) => {
  const getDocumentLabel = (type: string) => {
    const labels: Record<string, string> = {
      // Nouveaux formats standardisés
      'medical_certificate': 'Certificat médical',
      'photo': 'Photo d\'identité',
      'registration_form': 'Formulaire d\'inscription',
      'parental_authorization': 'Autorisation parentale',
      'identity_copy': 'Pièce d\'identité',
      // Anciens formats pour compatibilité
      'ffvbForm': 'Formulaire FFVB',
      'medicalCertificate': 'Certificat médical',
      'idPhoto': 'Photo d\'identité',
      'parentalConsent': 'Autorisation parentale'
    };
    return labels[type] || type;
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'medical_certificate':
      case 'medicalCertificate':
        return CheckCircle;
      case 'photo':
      case 'idPhoto':
        return AlertCircle;
      case 'registration_form':
      case 'ffvbForm':
        return FileText;
      case 'parental_authorization':
      case 'parentalConsent':
        return Clock;
      case 'identity_copy':
        return FileText;
      default:
        return FileText;
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <FileText className="w-5 h-5 text-primary-600" />
        <span>Progression des documents</span>
      </h3>

      {stats.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun document uploadé</p>
          <p className="text-xs text-gray-400 mt-1">
            Les statistiques apparaîtront quand des membres uploaderont des documents
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {stats.map((doc) => {
            const Icon = getDocumentIcon(doc.document_type);
            const completionRate = Math.max(0, Math.min(100, doc.completion_rate || 0));
            
            return (
              <div key={doc.document_type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-900">
                      {getDocumentLabel(doc.document_type)}
                    </span>
                    <span className="text-xs text-gray-500">({doc.document_type})</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {completionRate}%
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    <CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />
                    {doc.total_validated || 0} validés
                  </span>
                  <span>
                    <Clock className="w-3 h-3 inline mr-1 text-yellow-500" />
                    {doc.total_pending || 0} en attente
                  </span>
                  <span>Total: {doc.total_uploaded || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};