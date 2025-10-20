import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

const DeleteSiigoOrderModal = ({ 
  isOpen, 
  onClose, 
  order, 
  onConfirm, 
  loading = false 
}) => {
  if (!isOpen || !order) return null;

  const handleConfirm = () => {
    onConfirm(order.id);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">
              Eliminar Pedido
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            ¿Eliminar el pedido <span className="font-semibold">{order.order_number}</span>?
          </p>
          
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Cliente:</span>
                <p className="font-medium truncate">{order.customer_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Monto:</span>
                <p className="font-medium">${order.total_amount?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <span className="font-medium">⚠️ Esta acción es irreversible.</span><br/>
              La factura volverá a estar disponible en SIIGO para reimportación.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSiigoOrderModal;
