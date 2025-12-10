import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { getLocalISOString } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

const ContraentregaModal = ({ isOpen, onClose, order, onConfirm }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    actualPaymentMethod: '', // 'efectivo' o 'transferencia'
    amountReceived: order?.total_amount || 0,
    notes: '',
    transferenceReference: '', // Para transferencias
    transferenceBank: '', // Para transferencias
    transferenceDate: '' // Para transferencias
  });

  const [loading, setLoading] = useState(false);

  // Detección simple del canal desde texto (para autocompletar sin mostrar campos)
  const detectProviderFromStringLocal = (text = '') => {
    const t = String(text).toLowerCase();
    if (t.includes('nequi')) return 'nequi';
    if (t.includes('daviplata')) return 'daviplata';
    if (t.includes('bancolombia') || t.includes('banco')) return 'bancolombia';
    if (t.includes('mercadopago')) return 'mercadopago';
    if (t.includes('bold')) return 'bold';
    return 'otro';
  };

  // Autocompletar datos de transferencia (ocultos) para no pedirlos al mensajero
  useEffect(() => {
    if (formData.actualPaymentMethod === 'transferencia') {
      const fromOrder = (order?.electronic_payment_type || order?.payment_provider || '').toString().trim();
      const detected = detectProviderFromStringLocal(order?.notes || '');
      const bank = (fromOrder || detected || 'otro').toLowerCase();
      const ref = `auto - ${Date.now()} `;
      const dateStr = getLocalISOString().slice(0, 10);
      setFormData(prev => ({
        ...prev,
        transferenceBank: bank,
        transferenceReference: ref,
        transferenceDate: dateStr
      }));
    }
  }, [formData.actualPaymentMethod, order]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleConfirmPayment = async () => {
    if (!formData.actualPaymentMethod) {
      toast.error('Debe seleccionar el método de pago real');
      return;
    }

    if (formData.actualPaymentMethod === 'efectivo' && !formData.amountReceived) {
      toast.error('Debe ingresar el monto recibido en efectivo');
      return;
    }

    // Para transferencia, los datos (banco, referencia, fecha) se autocompletan de forma oculta

    setLoading(true);
    try {
      const paymentData = {
        orderId: order.id,
        actualPaymentMethod: formData.actualPaymentMethod,
        amountReceived: parseFloat(formData.amountReceived),
        notes: formData.notes,
        ...(formData.actualPaymentMethod === 'transferencia' && {
          transferenceReference: formData.transferenceReference,
          transferenceBank: formData.transferenceBank,
          transferenceDate: formData.transferenceDate || getLocalISOString().slice(0, 10)
        })
      };

      await onConfirm(paymentData);
      onClose();

      if (formData.actualPaymentMethod === 'efectivo') {
        toast.success('Pago en efectivo registrado. Se agregó al total del mensajero.');
      } else {
        toast.success('Transferencia registrada. Pendiente de confirmación por cartera.');
      }
    } catch (error) {
      console.error('Error registrando pago contraentrega:', error);
      toast.error('Error registrando el pago');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransference = async () => {
    if (user?.role !== 'cartera') {
      toast.error('Solo cartera puede confirmar transferencias');
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        orderId: order.id,
        action: 'confirm_transference',
        notes: formData.notes
      });
      onClose();
      toast.success('Transferencia confirmada. Pedido marcado como completado.');
    } catch (error) {
      console.error('Error confirmando transferencia:', error);
      toast.error('Error confirmando la transferencia');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !order) return null;

  // Determinar qué vista mostrar según el rol y estado del pedido
  const isMessengerView = user?.role === 'mensajero' && order.status === 'en_reparto';
  const isWalletView = user?.role === 'cartera' && order.contraentrega_status === 'received';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isMessengerView ? 'Registrar Pago Contraentrega' : 'Confirmar Transferencia'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pedido: {order.order_number} - ${order.total_amount?.toLocaleString('es-CO')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isMessengerView && (
            <>
              {/* Vista del Mensajero */}
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Icons.Info className="w-5 h-5 text-blue-500 mt-0.5 mr-3" />
                    <div>
                      <h4 className="font-medium text-blue-900">Pago Contraentrega</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        El cliente debe pagar ${order.total_amount?.toLocaleString('es-CO')} al recibir el pedido.
                        Seleccione cómo realizó el pago.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Método de pago real */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Cómo pagó el cliente? *
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="actualPaymentMethod"
                        value="efectivo"
                        checked={formData.actualPaymentMethod === 'efectivo'}
                        onChange={(e) => handleInputChange('actualPaymentMethod', e.target.value)}
                        className="mr-3 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Efectivo</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="actualPaymentMethod"
                        value="transferencia"
                        checked={formData.actualPaymentMethod === 'transferencia'}
                        onChange={(e) => handleInputChange('actualPaymentMethod', e.target.value)}
                        className="mr-3 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Transferencia</span>
                    </label>
                  </div>
                </div>

                {/* Campos específicos para efectivo */}
                {formData.actualPaymentMethod === 'efectivo' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto Recibido en Efectivo *
                    </label>
                    <input
                      type="number"
                      value={formData.amountReceived}
                      onChange={(e) => handleInputChange('amountReceived', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Este monto se agregará a su total de efectivo para entregar
                    </p>
                  </div>
                )}

                {/* Campos específicos para transferencia */}
                {formData.actualPaymentMethod === 'transferencia' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <Icons.Info className="w-4 h-4 text-blue-500 mt-0.5 mr-2" />
                        <p className="text-sm text-blue-700">
                          Datos de transferencia (banco, referencia y fecha) se registran automáticamente. No requiere ingresar información.
                        </p>
                      </div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <Icons.AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 mr-2" />
                        <p className="text-sm text-yellow-700">
                          Las transferencias requieren confirmación de cartera antes de completar el pedido.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Observaciones sobre la entrega o el pago..."
                  />
                </div>
              </div>
            </>
          )}

          {isWalletView && (
            <>
              {/* Vista de Cartera */}
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Icons.CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-3" />
                    <div>
                      <h4 className="font-medium text-green-900">Confirmar Transferencia</h4>
                      <p className="text-sm text-green-700 mt-1">
                        El mensajero reportó que el cliente pagó por transferencia.
                        Verifique que el pago haya sido recibido.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Información de la transferencia */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Datos de la Transferencia</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Referencia:</span>
                      <span className="ml-2 font-medium">{order.transference_reference || 'No especificada'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Banco:</span>
                      <span className="ml-2 font-medium">{order.transference_bank || 'No especificado'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Fecha:</span>
                      <span className="ml-2 font-medium">{order.transference_date || 'No especificada'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Monto:</span>
                      <span className="ml-2 font-medium text-green-600">
                        ${order.total_amount?.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notas de confirmación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notas de Confirmación
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Observaciones sobre la verificación del pago..."
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancelar
          </button>

          {isMessengerView && (
            <button
              onClick={handleConfirmPayment}
              disabled={loading || !formData.actualPaymentMethod}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Icons.DollarSign className="w-4 h-4 mr-2" />
              )}
              Registrar Pago
            </button>
          )}

          {isWalletView && (
            <button
              onClick={handleConfirmTransference}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            >
              {loading ? (
                <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Icons.CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar Transferencia
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContraentregaModal;
