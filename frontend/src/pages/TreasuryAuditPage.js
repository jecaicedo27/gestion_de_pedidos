import React, { useEffect, useMemo, useState } from 'react';
import { treasuryAdminService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

// Componente para mostrar evidencia (imagen o PDF) con diagnóstico
const EvidenceViewer = ({ file }) => {
  const [imgError, setImgError] = useState(false);
  try {
    const f = String(file || '').trim();
    if (!f) return <div className="text-sm text-gray-500">Sin evidencia adjunta</div>;
    const src = `/uploads/deposits/${encodeURIComponent(f)}`;
    const isPdf = f.toLowerCase().endsWith('.pdf');
    return (
      <div>
        {isPdf ? (
          <iframe
            src={src}
            title="Evidencia consignación"
            className="w-full h-[420px] border rounded"
          />
        ) : imgError ? (
          <div className="text-sm text-red-600">
            No se pudo cargar la imagen.
            {' '}
            <a className="underline" href={src} target="_blank" rel="noopener noreferrer">Abrir</a>
          </div>
        ) : (
          <img
            src={src}
            alt="Evidencia de consignación"
            className="max-h-[420px] w-full object-contain rounded border bg-white"
            onError={() => setImgError(true)}
          />
        )}
        <div className="mt-1 text-xs">
          <a
            className="text-blue-600 hover:text-blue-800 underline"
            href={src}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir en pestaña nueva
          </a>
        </div>
      </div>
    );
  } catch {
    return <div className="text-sm text-gray-500">Sin evidencia adjunta</div>;
  }
};

const DepositExpansionRow = ({ d, details }) => {
  const items = details?.items || [];
  const totals = details?.totals || {};
  const file = (details?.header?.evidence_file || d?.evidence_file) || '';
  return (
    <tr className="bg-white">
      <td className="px-4 py-3" colSpan={10}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8">
            {items.length === 0 && <div className="text-sm text-gray-500">Sin facturas relacionadas</div>}
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-gray-500 uppercase text-[10px]">
                  <th className="px-2 py-1 text-left">Factura</th>
                  <th className="px-2 py-1 text-left">Cliente</th>
                  <th className="px-2 py-1 text-left">Fecha</th>
                  <th className="px-2 py-1 text-right">Asignado</th>
                  <th className="px-2 py-1 text-left">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => (
                  <tr key={it.order_id}>
                    <td className="px-2 py-1 font-medium">{it.order_number}</td>
                    <td className="px-2 py-1 text-gray-700 truncate max-w-[420px]">{it.customer_name || '-'}</td>
                    <td className="px-2 py-1 text-gray-500">{it.invoice_date ? new Date(it.invoice_date).toLocaleDateString('es-CO') : '-'}</td>
                    <td className="px-2 py-1 text-right">
                      {Number(it.assigned_amount || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-1">
                      <a
                        href={`/orders/${it.order_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Ver detalle
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 border-t pt-2 text-xs">
              <div className="flex justify-between">
                <span>Asignado:</span>
                <span className="font-semibold">
                  {Number(totals.assigned_total || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Consignación:</span>
                <span className="font-semibold">
                  {Number(totals.deposit_amount || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className={`flex justify-between ${Number(totals.difference || 0) <= Number(totals.tolerance || 0) ? 'text-green-700' : 'text-red-700'}`}>
                <span>Diferencia:</span>
                <span className="font-semibold">
                  {Number(totals.difference || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 md:mt-0 md:col-span-4">
            <div className="text-xs text-gray-500 mb-1">Evidencia</div>
            <EvidenceViewer file={file} />
          </div>
        </div>
      </td>
    </tr>
  );
};

const TreasuryAuditPage = () => {
  const [tab, setTab] = useState('deposits'); // 'deposits' | 'base'
  const [filters, setFilters] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [baseChanges, setBaseChanges] = useState([]);
  const [openDepositId, setOpenDepositId] = useState(null);
  const [depositDetailsMap, setDepositDetailsMap] = useState({});
  const [loadingDetailsId, setLoadingDetailsId] = useState(null);
  const [updatingSiigoId, setUpdatingSiigoId] = useState(null);

  const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      if (tab === 'deposits') {
        const res = await treasuryAdminService.getDepositsAudit(params);
        setDeposits(res?.data || []);
      } else {
        const res = await treasuryAdminService.getBaseChanges(params);
        setBaseChanges(res?.data || []);
      }
    } catch (e) {
      // mensaje centralizado por interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filters.from, filters.to]);

  const depositTotals = useMemo(() => {
    const total = deposits.reduce((acc, d) => acc + Number(d.amount || 0), 0);
    return { total };
  }, [deposits]);

  const toggleDepositDropdown = async (id) => {
    if (openDepositId === id) {
      setOpenDepositId(null);
      return;
    }
    setOpenDepositId(id);
    if (!depositDetailsMap[id]) {
      setLoadingDetailsId(id);
      try {
        const res = await treasuryAdminService.getDepositDetails(id);
        const data = res?.data || res;
        setDepositDetailsMap(prev => ({ ...prev, [id]: data }));
      } catch (e) {
        // manejar por interceptor
      } finally {
        setLoadingDetailsId(null);
      }
    }
  };

  const handleSetSiigoClosed = async (deposit, closed = true) => {
    if (!deposit?.id) return;
    setUpdatingSiigoId(deposit.id);
    try {
      const res = await treasuryAdminService.setDepositSiigoClosed(deposit.id, closed);
      const updated = res?.data || res;
      setDeposits(prev => prev.map(d => d.id === deposit.id ? { ...d, ...(updated || {}), siigo_closed: closed } : d));
      toast.success(closed ? 'Marcado como cerrado en Siigo' : 'Marcado como pendiente en Siigo');
    } catch (e) {
      // manejar por interceptor
    } finally {
      setUpdatingSiigoId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría de Cartera</h1>
          <p className="text-gray-600 mt-1">Historial de consignaciones y cambios de base</p>
        </div>
        <button onClick={loadData} className="btn btn-secondary" title="Actualizar">
          <Icons.RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setTab('deposits')}
            className={`${tab === 'deposits' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Consignaciones
          </button>
          <button
            onClick={() => setTab('base')}
            className={`${tab === 'base' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Cambios de Base
          </button>
        </nav>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="card-content grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))} className="w-full px-3 py-2 border rounded" />
          </div>
          {tab === 'deposits' && (
            <div className="flex items-end">
              <div className="p-3 bg-gray-50 border rounded w-full">
                <div className="text-xs text-gray-500">Resumen</div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total consignado:</span>
                  <span className="font-semibold">{fmt(depositTotals.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'deposits' ? (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Icons.Banknote className="w-5 h-5 mr-2 text-emerald-600" />
              Auditoría de Consignaciones
            </h2>
          </div>
          <div className="card-content p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha consignación</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Banco</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detalle</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notas</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Facturas</th>

                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Registrado por</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Siigo</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deposits.map((d) => (
                    <React.Fragment key={d.id}>
                      <tr className={`${d.siigo_closed ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2 text-sm">{d.deposited_at ? new Date(d.deposited_at).toLocaleString('es-CO') : '-'}</td>
                        <td className="px-4 py-2 text-right text-sm font-semibold">{fmt(d.amount)}</td>
                        <td className="px-4 py-2 text-sm">{d.bank_name || '-'}</td>
                        <td className="px-4 py-2 text-sm">{d.reference_number || '-'}</td>
                        <td className="px-4 py-2 text-sm">{d.reason_code || '-'}</td>
                        <td className="px-4 py-2 text-sm">{d.reason_text || '-'}</td>
                        <td className="px-4 py-2 text-sm">{d.notes || '-'}</td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => toggleDepositDropdown(d.id)}
                            className="text-blue-600 hover:text-blue-800 underline text-sm"
                            title="Ver facturas relacionadas"
                          >
                            Ver facturas
                          </button>
                        </td>
                        <td className="px-4 py-2 text-sm">{d.deposited_by ? `ID ${d.deposited_by}` : '-'}</td>
                        <td className="px-4 py-2 text-sm">
                          {d.siigo_closed ? (
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded">
                                Cerrado
                              </span>
                              <button
                                onClick={() => handleSetSiigoClosed(d, false)}
                                disabled={updatingSiigoId === d.id}
                                className="text-xs text-gray-500 underline hover:text-gray-700 disabled:opacity-60"
                                title="Desmarcar cierre en Siigo"
                              >
                                {updatingSiigoId === d.id ? '...' : 'Desmarcar'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSetSiigoClosed(d, true)}
                              disabled={updatingSiigoId === d.id}
                              className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                              title="Marcar consignación como cerrada en Siigo"
                            >
                              {updatingSiigoId === d.id ? 'Guardando...' : 'Pendiente por cerrar en Siigo'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {openDepositId === d.id && (
                        loadingDetailsId === d.id
                          ? (
                            <tr className="bg-white">
                              <td className="px-4 py-3" colSpan={10}>
                                <div className="text-sm text-gray-500">Cargando...</div>
                              </td>
                            </tr>
                          )
                          : <DepositExpansionRow d={d} details={depositDetailsMap[d.id]} />
                      )}
                    </React.Fragment>
                  ))}
                  {deposits.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={10}>Sin registros</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Icons.Settings className="w-5 h-5 mr-2 text-emerald-600" />
              Cambios de Base
            </h2>
          </div>
          <div className="card-content p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Base anterior</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Base nueva</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {baseChanges.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{r.created_at ? new Date(r.created_at).toLocaleString('es-CO') : '-'}</td>
                      <td className="px-4 py-2 text-right text-sm">{fmt(r.previous_base)}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold">{fmt(r.new_base)}</td>
                      <td className="px-4 py-2 text-sm">{r.changed_by ? `ID ${r.changed_by}` : '-'}</td>
                    </tr>
                  ))}
                  {baseChanges.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={4}>Sin registros</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasuryAuditPage;
