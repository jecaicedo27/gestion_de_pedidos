import React, { useEffect, useMemo, useState } from 'react';
import api, { carteraService, messengerService, userService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';

const CashierCollectionsPage = () => {
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [selectedHandover, setSelectedHandover] = useState(null);
  const [handoverDetails, setHandoverDetails] = useState(null);
  const [messengers, setMessengers] = useState([]);

  const [filters, setFilters] = useState({
    messengerId: '',
    from: '',
    to: ''
  });

  const loadMessengers = async () => {
    try {
      const res = await userService.getUsers({ role: 'mensajero', active: true });
      const users = res?.data?.data?.users || res?.data?.users || [];
      setMessengers(users);
    } catch (e) {
      // no-op
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.messengerId) params.messengerId = filters.messengerId;
      if (filters.from) params.from = new Date(filters.from).toISOString();
      if (filters.to) {
        // Extender fin del día para el filtro 'to'
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        params.to = end.toISOString();
      }

      const [pendingRes, handoversRes] = await Promise.all([
        carteraService.getPendingCashOrders(params),
        carteraService.getHandovers({ ...params, status: '' })
      ]);

      setPending(pendingRes?.data || []);
      setHandovers(handoversRes?.data || []);
    } catch (error) {
      toast.error('Error cargando datos de cartera');
    } finally {
      setLoading(false);
    }
  };

  // Formatea un valor de fecha a YYYY-MM-DD (sin zona horaria)
  const dateOnly = (value) => {
    if (!value) return '';
    // Si ya viene en formato YYYY-MM-DD
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (!isNaN(d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return String(value).slice(0, 10);
  };

  const loadHandoverDetails = async (handoverOrId) => {
    try {
      let res;
      if (typeof handoverOrId === 'number' || typeof handoverOrId === 'string') {
        // Compatibilidad: si recibimos solo el ID, vamos por el detalle normal
        res = await carteraService.getHandoverDetails(handoverOrId);
      } else if (handoverOrId?.source === 'bodega') {
        // Detalle consolidado por día para Bodega
        res = await carteraService.getBodegaHandoverDetails(dateOnly(handoverOrId.closing_date));
      } else if (handoverOrId) {
        // Detalle normal por id de acta de mensajero
        res = await carteraService.getHandoverDetails(handoverOrId.id);
      }
      setHandoverDetails(res?.data || null);
    } catch (e) {
      toast.error('Error cargando detalle de acta');
    }
  };

  useEffect(() => {
    loadMessengers();
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.messengerId, filters.from, filters.to]);

  const totals = useMemo(() => {
    const expected = pending.reduce((acc, p) => acc + Number(p.expected_amount || 0), 0);
    const declared = pending.reduce((acc, p) => acc + Number(p.declared_amount || 0), 0);
    return { expected, declared, diff: declared - expected };
  }, [pending]);

  const fmt = (n) =>
    Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  // URL del recibo según fuente (mensajero o bodega) con token por query
  const getHandoverReceiptUrl = (h) => {
    try {
      const token = localStorage.getItem('token');
      const base = api?.defaults?.baseURL || (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');
      if (h?.source === 'bodega') {
        const d = dateOnly(h.closing_date);
        return `${base}/cartera/handovers/bodega/${encodeURIComponent(d)}/receipt${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      }
      return `${base}/cartera/handovers/${h.id}/receipt${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    } catch {
      return '#';
    }
  };

  const handlePrintReceipt = (row) => {
    try {
      const token = localStorage.getItem('token');
      const base = api?.defaults?.baseURL || (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');

      let url;
      if (row?.source === 'bodega' && row?.cash_register_id) {
        // Recibo para cobro registrado en bodega
        url = `${base}/cartera/cash-register/${row.cash_register_id}/receipt${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      } else {
        // Recibo para flujo de mensajero
        url = `${base}/messenger/orders/${row?.order_id}/cash-receipt${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error('No se pudo abrir el recibo para imprimir');
    }
  };

  const handleAcceptCash = async (row) => {
    try {
      if (row?.source === 'bodega' && row?.cash_register_id) {
        await carteraService.acceptCashRegister(row.cash_register_id);
      } else {
        await messengerService.acceptCashForOrder(row.order_id);
      }
      toast.success('Efectivo aceptado');
      await loadData();
      if (selectedHandover) {
        await loadHandoverDetails(selectedHandover);
      }
    } catch (e) {
      // Error handler centralizado en interceptor
    }
  };

  const handleCloseHandover = async (handoverId) => {
    try {
      await carteraService.closeHandover(handoverId);
      toast.success('Acta cerrada');
      setSelectedHandover(null);
      setHandoverDetails(null);
      await loadData();
    } catch (e) {
      // handled by interceptor
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartera - Entrega de Efectivo</h1>
          <p className="text-gray-600 mt-1">Recibe el efectivo de los mensajeros por factura</p>
        </div>
        <button
          onClick={loadData}
          className="btn btn-secondary"
          title="Actualizar"
        >
          <Icons.RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="card-content grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensajero</label>
            <select
              value={filters.messengerId}
              onChange={(e) => setFilters((f) => ({ ...f, messengerId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
            >
              <option value="">Todos</option>
              {messengers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.name || m.username || `Mensajero ${m.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <div className="p-3 bg-gray-50 border rounded w-full">
              <div className="text-xs text-gray-500">Resumen pendientes</div>
              <div className="flex items-center justify-between text-sm">
                <span>Esperado:</span>
                <span className="font-semibold">{fmt(totals.expected)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Declarado:</span>
                <span className="font-semibold">{fmt(totals.declared)}</span>
              </div>
              <div className={`flex items-center justify-between text-sm ${totals.diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>Diferencia:</span>
                <span className="font-semibold">{fmt(totals.diff)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pendientes por aceptar */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Icons.Coins className="w-5 h-5 mr-2 text-emerald-600" />
              Facturas pendientes por recibir efectivo
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                {pending.length}
              </span>
            </h2>
          </div>
          <div className="card-content p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mensajero</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Esperado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Declarado</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha Factura</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pending.map((row) => (
                    <tr key={row.order_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="text-sm font-medium text-gray-900">{row.order_number}</div>
                        <div className="text-xs text-gray-500">{new Date(row.delivered_at).toLocaleString('es-CO')}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-sm text-gray-900">{row.customer_name}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-sm text-gray-900">{row.messenger_name || `ID ${row.messenger_id}`}</div>
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold">{fmt(row.expected_amount)}</td>
                      <td className="px-4 py-2 text-right text-sm">{fmt(row.declared_amount)}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('es-CO') : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handlePrintReceipt(row)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs rounded inline-flex items-center"
                            title="Imprimir recibo por factura"
                          >
                            <Icons.Printer className="w-3 h-3 mr-1" />
                            Imprimir
                          </button>
                          <button
                            onClick={() => handleAcceptCash(row)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded"
                            title="Aceptar efectivo"
                          >
                            Aceptar
                          </button>
                          {row.closing_id ? (
                            <a
                              className="text-blue-600 hover:text-blue-800 text-xs underline"
                              href={`/api/cartera/handovers/${row.closing_id}/receipt`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver recibo del acta"
                            >
                              Recibo
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pending.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>
                        No hay facturas pendientes por recibir efectivo con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Actas / Cierres */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Icons.FileText className="w-5 h-5 mr-2 text-indigo-600" />
              Actas de entrega (cierres de caja)
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                {handovers.length}
              </span>
            </h2>
          </div>
          <div className="card-content p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acta</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mensajero</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Esperado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Declarado</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {handovers.map((h) => (
                    <React.Fragment key={h.id || `${h.source}-${h.closing_date}`}>
                      <tr className={`hover:bg-gray-50 ${selectedHandover === h.id ? 'bg-gray-50' : ''}`}>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">
                            {h.source === 'bodega' ? `Bodega (${h.closing_date})` : `#${h.id}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {h.source === 'bodega' ? 'Consolidado diario' : h.closing_date}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-900">{h.messenger_name || (h.messenger_id ? `ID ${h.messenger_id}` : '-')}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              h.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : h.status === 'partial'
                                ? 'bg-yellow-100 text-yellow-800'
                                : h.status === 'discrepancy'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-sm">{fmt(h.expected_amount)}</td>
                        <td className="px-4 py-2 text-right text-sm">{fmt(h.declared_amount)}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={async () => {
                                setSelectedHandover(h.id);
                                await loadHandoverDetails(h);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              Detalle
                            </button>
                            <a
                              className="text-blue-600 hover:text-blue-800 text-xs underline"
                              href={getHandoverReceiptUrl(h)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Recibo
                            </a>
                            {h.source !== 'bodega' && h.status !== 'completed' && (
                              <button
                                onClick={() => handleCloseHandover(h.id)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded"
                                title={
                                  Number(h.expected_amount || 0) === Number(h.declared_amount || 0)
                                    ? 'Cerrar acta'
                                    : 'Forzar cierre con diferencia (si hay facturas pendientes)'
                                }
                              >
                                {Number(h.expected_amount || 0) === Number(h.declared_amount || 0)
                                  ? 'Cerrar acta'
                                  : 'Cerrar con diferencia'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {selectedHandover === h.id && handoverDetails && (handoverDetails.handover?.id === h.id || h.source === 'bodega') && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="p-0">
                            <div className="border-t">
                              <div className="p-4 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                  {h.source === 'bodega' ? (
                                    <>
                                      Detalle Bodega - Cierre del día:{' '}
                                      <span className="font-semibold">{handoverDetails.handover?.closing_date || h.closing_date}</span>
                                    </>
                                  ) : (
                                    <>
                                      Detalle Acta #{handoverDetails.handover?.id} - Mensajero:{' '}
                                      <span className="font-semibold">
                                        {handoverDetails.handover?.messenger_name || `ID ${handoverDetails.handover?.messenger_id}`}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedHandover(null);
                                    setHandoverDetails(null);
                                  }}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Cerrar detalle"
                                >
                                  <Icons.X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="px-4 pb-4 overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha Factura</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Esperado</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Declarado</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aceptación</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {handoverDetails.items?.map((it) => (
                                      <tr key={it.detail_id || `${it.order_id}-${it.detail_id || 'x'}`} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm">{it.order_number}</td>
                                        <td className="px-4 py-2 text-sm">{it.customer_name}</td>
                                        <td className="px-4 py-2 text-sm text-gray-500">
                                          {it.invoice_date ? new Date(it.invoice_date).toLocaleDateString('es-CO') : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm">{fmt(it.expected_amount)}</td>
                                        <td className="px-4 py-2 text-right text-sm">{fmt(it.declared_amount)}</td>
                                        <td className="px-4 py-2 text-sm">
                                          <span
                                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                              it.collection_status === 'collected'
                                                ? 'bg-green-100 text-green-800'
                                                : it.collection_status === 'partial'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-gray-100 text-gray-800'
                                            }`}
                                          >
                                            {it.collection_status || 'pending'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-right text-xs text-gray-500">
                                          {it.collected_at ? new Date(it.collected_at).toLocaleString('es-CO') : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    {(!handoverDetails.items || handoverDetails.items.length === 0) && (
                                      <tr>
                                        <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>
                                          El acta no tiene ítems.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {handovers.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={6}>
                        No hay actas con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashierCollectionsPage;
