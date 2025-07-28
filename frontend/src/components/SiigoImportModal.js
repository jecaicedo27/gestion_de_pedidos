import React, { useState, useEffect } from 'react';
import { X, FileText, User, Package } from 'lucide-react';
import api, { siigoService } from '../services/api';

const SiigoImportModal = ({ isOpen, onClose, invoice, onImportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [errors, setErrors] = useState({});
  
  useEffect(() => {
    if (isOpen && invoice) {
      setErrors({});
      loadInvoiceDetails();
    }
  }, [isOpen, invoice]);

  const loadInvoiceDetails = async () => {
    if (!invoice?.id) return;
    
    setLoadingDetails(true);
    try {
      const response = await api.get(`/siigo/invoices/${invoice.id}`);
      if (response.data.success) {
        setInvoiceDetails(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando detalles de factura:', error);
      setErrors({
        general: 'Error cargando detalles de la factura'
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setErrors({});
    
    try {
      const result = await siigoService.importInvoices({
        invoice_ids: [invoice.id]
      });
      
      if (result.success) {
        onImportSuccess(result.results?.[0] || result);
        onClose();
      } else {
        throw new Error(result.message || 'Error en la importación');
      }
    } catch (error) {
      console.error('❌ Error importando factura:', error);
      
      let errorMessage = 'Error importando factura';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrors({
        general: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !invoice) return null;

  const currentInvoice = invoiceDetails || invoice;
  const customer = currentInvoice.customer || {};
  const items = currentInvoice.items || [];

  // Función simplificada para extraer nombre del cliente
  const getCustomerName = () => {
    return customer.person?.first_name 
      ? `${customer.person.first_name} ${customer.person.last_name || ''}`.trim()
      : customer.company?.name 
      || customer.name 
      || customer.identification?.name
      || customer.commercial_name
      || 'N/A';
  };

  const getCustomerPhone = () => {
    return customer.phones?.[0]?.number 
      || customer.person?.phones?.[0]?.number
      || customer.company?.phones?.[0]?.number
      || customer.phone
      || 'N/A';
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <FileText className="h-6 w-6 text-blue-600 mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Importar Factura
              </h2>
              <p className="text-sm text-gray-500">
                #{invoice.number || invoice.name || invoice.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Información de la Factura */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Total:</span>
                <p className="font-semibold text-green-600">
                  ${(invoice.total || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Fecha:</span>
                <p className="font-medium">
                  {invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Items:</span>
                <p className="font-medium">{items.length}</p>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <User className="h-4 w-4 mr-2 text-blue-600" />
              Cliente
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Nombre:</span>
                  <p className="font-medium truncate">{getCustomerName()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Teléfono:</span>
                  <p className="font-medium">{getCustomerPhone()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones (solo si existen) */}
          {(currentInvoice.notes || currentInvoice.observations) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Observaciones
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  {loadingDetails ? 'Cargando...' : (currentInvoice.notes || currentInvoice.observations)}
                </p>
              </div>
            </div>
          )}

          {/* Información de qué pasará */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 mb-2">
              <span className="font-medium">Al importar:</span>
            </p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Se creará un pedido automáticamente</li>
              <li>• Pasará a revisión de cartera</li>
              <li>• Mantendrá trazabilidad con SIIGO</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Importar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SiigoImportModal;
