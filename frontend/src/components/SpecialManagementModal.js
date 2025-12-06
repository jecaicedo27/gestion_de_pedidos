/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';

export default function SpecialManagementModal({
  isOpen,
  onClose,
  order,
  onConfirm,
  loading = false
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const minLen = 3;

  const quickReasons = useMemo(
    () => [
      'Error en facturación',
      'Solicitud del cliente',
      'Reprocesar en otro flujo',
      'Inconsistencia de datos',
      'Stock no disponible',
      'Anulación por cliente',
      'Bloqueo por validación pendiente',
      'Pedido duplicado'
    ],
    []
  );

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTouched(false);
    }
  }, [isOpen, order?.id]);

  const remain = Math.max(0, minLen - (reason?.trim().length || 0));
  const valid = reason?.trim().length >= minLen;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onClose?.()} />
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div className="w-full max-w-lg rounded-xl shadow-2xl bg-white overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-600">
                <Icons.Flag className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Marcar gestión especial</h3>
                <p className="text-xs text-gray-500">Este pedido saldrá del flujo estándar y quedará como "Gestión Especial"</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !loading && onClose?.()}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
              disabled={loading}
              aria-label="Cerrar"
              title="Cerrar"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Order badge */}
            {order && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 font-medium">
                    #{order.order_number || order.id}
                  </span>
                  <span className="text-gray-500 truncate max-w-[260px]" title={order.customer_name || order.client_name || ''}>
                    {order.customer_name || order.client_name || 'Sin nombre'}
                  </span>
                </div>
              </div>
            )}

            {/* Quick reasons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motivos rápidos</label>
              <div className="flex flex-wrap gap-2">
                {quickReasons.map((r) => {
                  const active = reason.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setTouched(true);
                        if (!reason) return setReason(r);
                        if (active) {
                          // Remove
                          setReason(
                            reason
                              .split(' • ')
                              .filter((x) => x !== r)
                              .join(' • ')
                          );
                        } else {
                          setReason((prev) => (prev ? prev + ' • ' + r : r));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full border text-xs transition ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Text area */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Motivo detallado</label>
                <span className="text-xs text-gray-500">{reason.length}/500</span>
              </div>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => {
                  setTouched(true);
                  if (e.target.value.length <= 500) setReason(e.target.value);
                }}
                className={`w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 ${
                  touched && !valid
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-gray-300 focus:ring-blue-200'
                }`}
                placeholder="Describe brevemente por qué este pedido debe quedar en gestión especial..."
              />
              <div className="mt-1 flex items-center justify-between">
                <div className="text-xs">
                  {touched && !valid ? (
                    <span className="text-red-600">Faltan {remain} caracteres para el mínimo</span>
                  ) : (
                    <span className="text-gray-500">Mínimo {minLen} caracteres</span>
                  )}
                </div>
                {touched && !valid && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <Icons.AlertTriangle className="w-4 h-4" />
                    <span>Motivo requerido</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800 flex items-start gap-2">
              <Icons.Info className="w-4 h-4 mt-0.5" />
              <p>
                Esta acción no avanza el pedido a Cartera, Logística o Empaque. Quedará visible en "Todos los pedidos" con el estado
                <span className="font-semibold"> Gestión Especial</span> y el motivo registrado en la línea de tiempo.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => !loading && onClose?.()}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => !loading && valid && onConfirm?.({ orderId: order?.id, reason: reason.trim() })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              disabled={!valid || loading}
            >
              <Icons.Flag className="w-4 h-4" />
              {loading ? 'Aplicando...' : 'Marcar gestión especial'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
