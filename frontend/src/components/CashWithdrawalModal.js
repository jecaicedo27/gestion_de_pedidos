import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { movementService, systemConfigService } from '../services/api';

const WITHDRAW_REASON_OPTIONS = [
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'peajes', label: 'Peajes' },
  { value: 'compras_oficina', label: 'Compras de oficina' },
  { value: 'viaticos', label: 'Viáticos' },
  { value: 'otros', label: 'Otros' },
];

const CashWithdrawalModal = ({ open, onClose, onSaved }) => {
  const [form, setForm] = useState({
    amount: '',
    reason_code: '',
    reason_text: '',
    notes: '',
    evidence: null,
  });
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(200000);

  useEffect(() => {
    (async () => {
      try {
        const resp = await systemConfigService.getAll();
        const list = resp?.data?.data || resp?.data || [];
        const found = Array.isArray(list) ? list.find(c => c.config_key === 'cartera_withdrawal_approval_threshold') : null;
        const val = Number(found?.config_value || 200000);
        if (!isNaN(val)) setThreshold(val);
      } catch (e) {
        // no-op
      }
    })();
  }, []);

  const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const label = useMemo(() => {
    const r = String(form.reason_code || '').toLowerCase();
    const opt = WITHDRAW_REASON_OPTIONS.find(o => o.value === r);
    return opt ? opt.label : '';
  }, [form.reason_code]);

  if (!open) return null;

  const handleFile = (e) => {
    const f = e.target.files?.[0] || null;
    setForm(prev => ({ ...prev, evidence: f }));
  };

  const handleSave = async () => {
    try {
      const amt = Number(form.amount || 0);
      if (!(amt > 0)) return toast.error('Ingresa un monto válido (> 0)');
      if (!form.reason_code) return toast.error('Selecciona un motivo');
      setLoading(true);
      await movementService.create({
        type: 'withdrawal',
        amount: amt,
        reason_code: form.reason_code || null,
        reason_text: form.reason_text || null,
        notes: form.notes || null,
        evidence: form.evidence || null
      });
      toast.success(amt > threshold
        ? 'Retiro registrado (requiere aprobación de administrador)'
        : 'Retiro registrado');
      setForm({ amount: '', reason_code: '', reason_text: '', notes: '', evidence: null });
      if (typeof onSaved === 'function') await onSaved();
      if (typeof onClose === 'function') onClose();
    } catch (e) {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const amt = Number(form.amount || 0);
  const needsApproval = amt > Number(threshold || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded shadow-lg w-full max-w-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <Icons.MinusCircle className="w-5 h-5 mr-2 text-red-600" />
            Registrar retiro de caja
          </h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Monto (COP)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
                placeholder="0"
                min="0"
              />
              <div className="text-xs text-gray-500 mt-1">{fmt(form.amount)}</div>
            </div>
            <div>
              <label className="block text-sm mb-1">Motivo</label>
              <select
                value={form.reason_code}
                onChange={(e) => setForm(f => ({ ...f, reason_code: e.target.value }))}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Seleccionar...</option>
                {WITHDRAW_REASON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Detalle</label>
            <input
              type="text"
              value={form.reason_text}
              onChange={(e) => setForm(f => ({ ...f, reason_text: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              placeholder={label ? `Detalle para "${label}"` : 'Detalle del motivo'}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
              rows={3}
              placeholder="Observaciones..."
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Evidencia (imagen o PDF) — opcional</label>
            <input type="file" accept="image/*,application/pdf" onChange={handleFile} />
          </div>

          <div className={`text-xs ${needsApproval ? 'text-red-700' : 'text-gray-600'}`}>
            Umbral de aprobación: {Number(threshold || 0).toLocaleString('es-CO')} COP. {needsApproval ? 'Este retiro quedará pendiente de aprobación.' : 'Este retiro se aprueba automáticamente.'}
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-gray-700 hover:text-gray-900"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-60"
            disabled={loading || !(Number(form.amount || 0) > 0) || !form.reason_code}
            title="Guardar"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashWithdrawalModal;
