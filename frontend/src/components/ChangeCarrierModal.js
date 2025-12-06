import React, { useEffect, useMemo, useState } from 'react';
import { logisticsService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChangeCarrierModal({ order, onClose, onSuccess }) {
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [carrierId, setCarrierId] = useState('');
  const [reason, setReason] = useState('');
  const [generateGuideNow, setGenerateGuideNow] = useState(true);

  const currentCarrierId = order?.carrier_id ?? null;
  const deliveryMethod = String(order?.delivery_method || '').toLowerCase();

  const isPickup = deliveryMethod === 'recoge_bodega' || deliveryMethod === 'recogida_tienda';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await logisticsService.getCarriers();
        if (!mounted) return;
        setCarriers(Array.isArray(list) ? list : []);
        // Preseleccionar una diferente a la actual si existe
        const firstDifferent = (list || []).find(c => Number(c.id) !== Number(currentCarrierId));
        setCarrierId(firstDifferent ? String(firstDifferent.id) : '');
      } catch (e) {
        toast.error('No se pudieron cargar las transportadoras');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [currentCarrierId]);

  const carriersOptions = useMemo(() => {
    const sorted = [...carriers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
    return sorted.map(c => ({
      value: String(c.id),
      label: c.name || `Carrier ${c.id}`,
      disabled: Number(c.id) === Number(currentCarrierId)
    }));
  }, [carriers, currentCarrierId]);

  const handleSubmit = async () => {
    if (isPickup) {
      toast.error('Recoge en Bodega/Tienda no requiere transportadora');
      return;
    }
    if (!carrierId) {
      toast.error('Selecciona una transportadora');
      return;
    }
    if (!reason || reason.trim().length < 3) {
      toast.error('Ingresa un motivo (mín. 3 caracteres)');
      return;
    }
    try {
      setSubmitting(true);
      await logisticsService.changeCarrier({
        orderId: order.id,
        carrierId: Number(carrierId),
        reason: reason.trim(),
        override: false
      });
      toast.success('Transportadora cambiada');
      // Generar guía con la nueva transportadora si aplica
      try {
        if (generateGuideNow) {
          // Abrir en nueva pestaña el endpoint estandarizado de guía
          const url = `/api/logistics/orders/${order.id}/shipping-guide`;
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        // noop
      }
      if (typeof onSuccess === 'function') onSuccess({ orderId: order.id, newCarrierId: Number(carrierId) });
      if (typeof onClose === 'function') onClose();
    } catch (e) {
      const msg = e?.response?.data?.message || 'No se pudo cambiar la transportadora';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">Cambiar transportadora</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <div className="text-sm text-gray-600">
            <p>
              Pedido: <span className="font-semibold">{order?.order_number || order?.id}</span>
            </p>
            {currentCarrierId ? (
              <p className="mt-0.5">
                Transportadora actual:{' '}
                <span className="font-semibold">{order?.carrier_name || '-'}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-amber-700">Este pedido no tiene transportadora asignada.</p>
            )}
          </div>

          {isPickup ? (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              Este pedido es de <strong>Recoge en Bodega/Tienda</strong> y no requiere transportadora.
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium mb-1">Nueva transportadora</label>
            {loading ? (
              <div className="h-9 w-full rounded bg-gray-100 animate-pulse" />
            ) : (
              <select
                value={carrierId}
                onChange={(e) => setCarrierId(e.target.value)}
                className="w-full border px-3 py-2 rounded"
                disabled={loading}
              >
                <option value="">Selecciona una transportadora</option>
                {carriersOptions.map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}{opt.disabled ? ' (actual)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Motivo del cambio</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="Ej: No tiene cobertura, muy costoso, cliente solicitó otra transportadora..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded bg-gray-50 border">
            <div className="text-sm text-gray-700">
              <p className="font-medium">Regenerar guía</p>
              <p className="text-xs text-gray-600">Se anulará la guía anterior en el sistema y se generará una nueva con la transportadora seleccionada.</p>
            </div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={generateGuideNow}
                onChange={(e) => setGenerateGuideNow(e.target.checked)}
              />
              Generar ahora
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading || isPickup}
            className={`px-3 py-1 rounded text-white ${submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {submitting ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
