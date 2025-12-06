/* eslint-disable */
import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';

export default function ReasonModal({
  isOpen,
  onClose,
  order,
  mode = 'reject', // 'reject' | 'failed'
  onConfirm,
  loading = false
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const minLen = 3;

  const titles = {
    reject: 'Rechazar pedido',
    failed: 'Marcar entrega fallida',
    return: 'Devolver a Facturación',
    reason: 'Cliente canceló pedido'
  };

  const subtitles = {
    reject: 'Explica brevemente por qué rechazas este pedido',
    failed: 'Explica brevemente por qué no se pudo completar la entrega',
    return: 'Explica brevemente por qué se devuelve el pedido a facturación',
    reason: 'Explica brevemente el motivo de la cancelación del cliente'
  };

  const quickReasons = useMemo(() => {
    if (mode === 'reject') {
      return [
        'Ruta muy lejana',
        'Horario incompatible',
        'Carga excesiva',
        'Dirección insegura',
        'Error de asignación',
        'Problemas mecánicos'
      ];
    }
    if (mode === 'return') {
      return [
        'Error en forma de pago',
        'Error en método de envío',
        'Inconsistencia en SIIGO',
        'Datos de factura incompletos',
        'Requiere corrección en facturación'
      ];
    }
    if (mode === 'reason') {
      return [
        'Cliente se arrepintió',
        'Doble pedido',
        'Error en dirección',
        'No desea recibir',
        'Tiempo de entrega no adecuado',
        'Error en datos del cliente'
      ];
    }
    return [
      'Cliente ausente',
      'Dirección incorrecta',
      'Pago no disponible',
      'Problema de seguridad',
      'Clima/Accidente',
      'Reprogramación solicitada'
    ];
  }, [mode]);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTouched(false);
    }
  }, [isOpen, order?.id, mode]);

  if (!isOpen) return null;

  const remain = Math.max(0, minLen - (reason?.trim().length || 0));
  const valid = reason?.trim().length >= minLen;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onClose?.()} />
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div className="w-full max-w-lg rounded-xl shadow-2xl bg-white overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                const cfg =
                  mode === 'reject'
                    ? { cls: 'bg-orange-50 text-orange-600', icon: <Icons.X className="w-5 h-5" /> }
                    : mode === 'return'
                      ? { cls: 'bg-blue-50 text-blue-600', icon: <Icons.RotateCcw className="w-5 h-5" /> }
                      : mode === 'reason'
                        ? { cls: 'bg-red-50 text-red-600', icon: <Icons.XCircle className="w-5 h-5" /> }
                        : { cls: 'bg-yellow-50 text-yellow-600', icon: <Icons.AlertTriangle className="w-5 h-5" /> };
                return (
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${cfg.cls}`}>
                    {cfg.icon}
                  </span>
                );
              })()}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{titles[mode]}</h3>
                <p className="text-xs text-gray-500">{subtitles[mode]}</p>
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
                <label className="block text-sm font-medium text-gray-700">Detalle del motivo</label>
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
                placeholder={
                  mode === 'reject'
                    ? 'Ej: No puedo tomar este pedido por la distancia y el tiempo disponible...'
                    : mode === 'return'
                      ? 'Ej: Método de pago o envío incorrecto. Se devuelve a facturación para corrección...'
                      : mode === 'reason'
                        ? 'Ej: Cliente se arrepintió / Doble pedido / No desea recibir...'
                        : 'Ej: Cliente no estaba en el lugar, se reprograma la entrega...'
                }
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
                El motivo se registrará en la línea de tiempo del pedido para auditoría.
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
              onClick={() => !loading && valid && onConfirm?.({ reason: reason.trim() })}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-white disabled:opacity-50 ${
                mode === 'reject'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : mode === 'return'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : mode === 'reason'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
              disabled={!valid || loading}
            >
              {mode === 'reject' ? <Icons.X className="w-4 h-4" /> : mode === 'return' ? <Icons.RotateCcw className="w-4 h-4" /> : <Icons.AlertTriangle className="w-4 h-4" />}
              {loading
                ? 'Procesando...'
                : mode === 'reject'
                  ? 'Rechazar pedido'
                  : mode === 'return'
                    ? 'Devolver a Facturación'
                    : mode === 'reason'
                      ? 'Cancelar pedido'
                      : 'Marcar como fallida'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
