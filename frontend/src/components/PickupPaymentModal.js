import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const PickupPaymentModal = ({ isOpen, order, onClose, onConfirm }) => {
  const [method, setMethod] = useState('efectivo');
  const [amount, setAmount] = useState(0);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      const defaultAmount = Number(order.total_amount || 0);
      setAmount(defaultAmount);
      setMethod((order.payment_method || 'efectivo').toLowerCase());
      setFile(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const requiresPhoto = method === 'transferencia';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(String(amount).replace(',', '.')) || 0;
    if (amt <= 0) {
      toast.error('Monto inválido');
      return;
    }
    if (requiresPhoto && !file) {
      toast.error('Debes adjuntar una foto de evidencia para transferencia');
      return;
    }
    try {
      setSubmitting(true);
      // El modal delega el envío al padre
      await onConfirm({
        orderId: order.id,
        method,
        amount: amt,
        file
      });
      setSubmitting(false);
      onClose();
    } catch (err) {
      setSubmitting(false);
      // onConfirm ya debe haber mostrado toast si falla
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Icons.Wallet className="w-5 h-5 mr-2 text-emerald-600" />
            Recibir Pago en Bodega
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pedido
            </label>
            <div className="text-sm text-gray-900">{order.order_number}</div>
            <div className="text-xs text-gray-500">{order.customer_name}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de pago
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {method === 'transferencia'
                ? 'Debes adjuntar la foto del comprobante.'
                : 'Opcional adjuntar evidencia fotográfica.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto recibido (COP)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto evidencia {requiresPhoto && <span className="text-red-600">*</span>}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files && e.target.files[0])}
              className="w-full text-sm"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PickupPaymentModal;
