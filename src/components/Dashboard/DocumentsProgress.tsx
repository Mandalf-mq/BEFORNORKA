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
      'ffvbForm': 'Formulaire FFVB',
      'medicalCertificate': 'Certificat médical',
      'idPhoto': 'Photo d\'identité',
      'parentalConsent': 'Autorisation parentale'
    };
    return labels[type] || type;
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'ffvbForm':
        return FileText;
      case 'medicalCertificate':
        return CheckCircle;
      case 'idPhoto':
        return AlertCircle;
      case 'parentalConsent':
        return Clock;
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
        </div>
      ) : (
        <div className="space-y-6">
          {stats.map((doc) => {
            const Icon = getDocumentIcon(doc.document_type);
            
            return (
              <div key={doc.document_type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-900">
                      {getDocumentLabel(doc.document_type)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {doc.completion_rate}%
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${doc.completion_rate}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    <CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />
                    {doc.total_validated} validés
                  </span>
                  <span>
                    <Clock className="w-3 h-3 inline mr-1 text-yellow-500" />
                    {doc.total_pending} en attente
                  </span>
                  <span>Total: {doc.total_uploaded}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};