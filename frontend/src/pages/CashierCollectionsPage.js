import React, { useEffect, useMemo, useState } from 'react';
import api, { carteraService, messengerService, treasuryService, userService, systemConfigService, logisticsService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { getPaymentMethodLabel, getPaymentBadgeClass } from '../utils/payments';
import ExtraIncomeModal from '../components/ExtraIncomeModal';
import CashWithdrawalModal from '../components/CashWithdrawalModal';

const DEPOSIT_REASON_OPTIONS = [
  { value: 'consignacion_cliente', label: 'Consignación de cliente' },
  { value: 'consignacion_varios', label: 'Consignación varios' },
  { value: 'ajuste', label: 'Ajuste de caja' },
  { value: 'otros', label: 'Otros' },
];

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

  // Balance de Cartera
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balance, setBalance] = useState({ base: 0, inflows: { bodega: 0, mensajero: 0 }, outflows: { deposits: 0 }, balance: 0 });
  const [refreshing, setRefreshing] = useState(false);

  // Modal de consignación
  const [depositOpen, setDepositOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({ amount: '', bank_name: '', reference_number: '', reason_code: '', reason_text: '', deposited_at: new Date().toISOString().slice(0, 10), notes: '', evidence: null });
  const [depositDetails, setDepositDetails] = useState({});
  const [depositSearch, setDepositSearch] = useState('');
  const [tolerance, setTolerance] = useState(300);
  const [depositCandidates, setDepositCandidates] = useState([]);


  // Modal Base de Cartera
  const [baseOpen, setBaseOpen] = useState(false);
  const [baseAmount, setBaseAmount] = useState('');

  const loadBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await treasuryService.getCashBalance();
      const data = res?.data || res || { base: 0, inflows: { bodega: 0, mensajero: 0 }, outflows: { deposits: 0 }, balance: 0 };
      setBalance({
        base: Number(data.base || 0),
        inflows: { bodega: Number(data.inflows?.bodega || 0), mensajero: Number(data.inflows?.mensajero || 0), extra_income: Number(data.inflows?.extra_income || 0) },
        outflows: { deposits: Number(data.outflows?.deposits || 0), withdrawals: Number(data.outflows?.withdrawals || 0) },
        balance: Number(data.balance || 0)
      });
    } catch (e) {
      // handled by interceptor
    } finally {
      setBalanceLoading(false);
    }
  };

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

  // Formatea un valor de fecha a YYYY-MM-DD (robusto ante zonas horarias y strings ISO)
  const dateOnly = (value) => {
    if (!value) return '';
    // Si es string y empieza con una fecha, recortar primeros 10 caracteres (evita desfase por TZ)
    if (typeof value === 'string') {
      const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
    }
    // Si es Date o parseable, usar toISOString para mantener día UTC estable
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    } catch (_) { }
    // Fallback seguro
    return String(value).slice(0, 10);
  };

  // Cargar tolerancia de cruce de consignaciones (system_config.cartera_deposit_tolerance)
  const loadTolerance = async () => {
    try {
      const resp = await systemConfigService.getAll();
      const list = resp?.data?.data || resp?.data || [];
      const found = Array.isArray(list) ? list.find(c => c.config_key === 'cartera_deposit_tolerance') : null;
      const val = Number(found?.config_value || 300);
      if (!isNaN(val)) setTolerance(val);
    } catch (e) { }
  };

  // Cargar facturas candidatas para cruce de consignación:
  // facturas con efectivo aceptado (mensajero o bodega) menos lo ya asignado a consignaciones.
  const loadDepositCandidates = async () => {
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const res = await treasuryService.getDepositCandidates(params);
      // Normalizar a arreglo
      const rows = res?.data || res || [];
      setDepositCandidates(rows);
    } catch (e) {
      // manejado por interceptor
      setDepositCandidates([]);
    }
  };

  const loadHandoverDetails = async (handoverOrId) => {
    try {
      let res;
      if (typeof handoverOrId === 'number' || typeof handoverOrId === 'string') {
        // Compatibilidad: si recibimos solo el ID, vamos por el detalle normal
        res = await carteraService.getHandoverDetails(handoverOrId);
      } else if (handoverOrId && String(handoverOrId?.source || '').startsWith('bodega')) {
        // Detalle consolidado por día para Bodega, con origen
        const origin = handoverOrId.source.includes('logistica') ? 'logistica' : (handoverOrId.source.includes('cartera') ? 'cartera' : undefined);
        res = await carteraService.getBodegaHandoverDetails(dateOnly(handoverOrId.closing_date), origin);
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
    loadBalance();
    loadTolerance();
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.messengerId, filters.from, filters.to]);

  // Cuando se abre el modal de consignación, refrescar candidatos (filtrados por rango si aplica)
  useEffect(() => {
    if (depositOpen) {
      loadDepositCandidates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositOpen, filters.from, filters.to]);

  const totals = useMemo(() => {
    const rows = pending.filter(p => String(p.payment_method || '').toLowerCase() !== 'reposicion');
    const expected = rows.reduce((acc, p) => acc + Number(p.expected_amount || 0), 0);
    const declared = rows.reduce((acc, p) => acc + Number(p.declared_amount || 0), 0);
    return { expected, declared, diff: declared - expected };
  }, [pending]);

  // Totales de cruce para consignación
  const depositAssignedTotal = useMemo(() => {
    return Object.values(depositDetails || {}).reduce((acc, v) => acc + Number(v || 0), 0);
  }, [depositDetails]);

  const depositDifference = useMemo(() => {
    const amt = Number(depositForm.amount || 0);
    return Math.abs(amt - depositAssignedTotal);
  }, [depositForm.amount, depositAssignedTotal]);

  const fmt = (n) =>
    Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  // Clave única para seleccionar acta (incluye consolidado de bodega con origen)
  const handoverKey = (h) => (h?.id ?? `bodega:${String(h?.source || '')}:${dateOnly(h?.closing_date)}`);

  // URL del recibo según fuente (mensajero o bodega) con token por query
  const getHandoverReceiptUrl = (h) => {
    try {
      const token = localStorage.getItem('token');
      const base = api?.defaults?.baseURL || (process.env.REACT_APP_API_URL || 'http://localhost:3001/api');
      const src = String(h?.source || '');
      if (src.startsWith('bodega')) {
        const d = dateOnly(h.closing_date);
        const origin = src.includes('logistica') ? 'logistica' : (src.includes('cartera') ? 'cartera' : '');
        const qs = new URLSearchParams();
        if (token) qs.set('token', token);
        if (origin) qs.set('origin', origin);
        const q = qs.toString();
        return `${base}/cartera/handovers/bodega/${encodeURIComponent(d)}/receipt${q ? `?${q}` : ''}`;
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

  const handleRegisterPayment = async (row) => {
    try {
      const orderId = row?.order_id;
      if (!orderId) return toast.error('Pedido inválido');
      await logisticsService.receivePickupPayment({ orderId, payment_method: 'efectivo', amount: row?.expected_amount, notes: 'Registrado desde Cartera' });
      toast.success('Pago registrado por Cartera');
      await loadData();
      await loadBalance(); // Actualizar tarjeta de balance inmediatamente
    } catch (e) {
      // handled by interceptor
    }
  };

  const handleAcceptCash = async (row) => {
    try {
      if (row?.source === 'bodega' && row?.cash_register_id) {
        await carteraService.acceptCashRegister(row.cash_register_id);
      } else if (row?.source === 'messenger_adhoc' && row?.adhoc_id) {
        await carteraService.acceptAdhocPayment(row.adhoc_id);
      } else {
        await messengerService.acceptCashForOrder(row.order_id);
      }
      toast.success('Efectivo aceptado');
      await loadData();
      await loadBalance(); // Refrescar balance de cartera inmediatamente
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
          onClick={async () => {
            try {
              setRefreshing(true);
              await Promise.all([loadData(), loadBalance()]);
              toast.success('Cartera actualizada');
            } finally {
              setRefreshing(false);
            }
          }}
          className="btn btn-secondary"
          title="Actualizar"
        >
          <Icons.RefreshCw className={`w-4 h-4 ${(loading || balanceLoading || refreshing) ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filtros + Balance */}
      <div className="card mb-6">
        <div className="card-content grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div className="flex items-end">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded w-full">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-emerald-700">Balance de Cartera</div>
                <button className="text-xs text-emerald-700 hover:text-emerald-900" onClick={loadBalance} title="Actualizar balance">
                  <Icons.RefreshCw className={`w-3 h-3 ${balanceLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="text-2xl font-bold text-emerald-800">{fmt(balance.balance)}</div>
              <div className="mt-1 text-[11px] text-emerald-700">
                <div>Base: {fmt(balance.base)}</div>
                <div>Ingresos (Bodega + Mensajero + Extra): {fmt((balance.inflows.bodega || 0) + (balance.inflows.mensajero || 0) + (balance.inflows.extra_income || 0))}</div>
                <div className="text-[11px]">- Extra: {fmt(balance.inflows.extra_income || 0)}</div>
                <div>Egresos (Consignaciones + Retiros): {fmt((balance.outflows.deposits || 0) + (balance.outflows.withdrawals || 0))}</div>
                <div className="text-[11px]">- Retiros: {fmt(balance.outflows.withdrawals || 0)}</div>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <button onClick={() => setDepositOpen(true)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded">
                  Registrar consignación
                </button>
                <button onClick={() => setExtraOpen(true)} className="px-2 py-1 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs rounded">
                  Ingreso extra
                </button>
                <button onClick={() => setWithdrawOpen(true)} className="px-2 py-1 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs rounded">
                  Retiro de caja
                </button>
                <button onClick={() => { setBaseAmount(String(balance.base || '')); setBaseOpen(true); }} className="px-2 py-1 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs rounded" title="Editar base de caja">
                  Editar base
                </button>
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
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Mensajero</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Forma de pago</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Recibido por</th>
                    <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase">Importe</th>
                    <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pending.map((row) => (
                    <tr key={row.order_id} className="hover:bg-gray-50">
                      <td className="px-2 py-1">
                        <div className="text-sm font-medium text-gray-900">{row.order_number}</div>
                        <div className="text-xs text-gray-500">{new Date(row.delivered_at).toLocaleString('es-CO')}</div>
                        <div className="text-xs text-gray-400">{row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('es-CO') : '-'}</div>
                      </td>
                      <td className="px-2 py-1">
                        <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">{row.customer_name}</div>
                      </td>
                      <td className="px-2 py-1 hidden md:table-cell">
                        <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">{row.messenger_name || `ID ${row.messenger_id}`}</div>
                      </td>
                      <td className="px-2 py-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentBadgeClass(row.payment_method)}`}>
                          {getPaymentMethodLabel(row.payment_method)}
                        </span>
                      </td>
                      <td className="px-2 py-1 hidden lg:table-cell">
                        <div className="text-xs sm:text-sm text-gray-900">
                          {row.source === 'bodega'
                            ? `${row.registered_by_name || '-'}` + (row.registered_by_role ? ` (${row.registered_by_role})` : '')
                            : '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right text-xs sm:text-sm">
                        <div>
                          <span className="text-gray-500">Esperado:</span>{' '}
                          <span className="font-semibold">
                            {fmt(String(row.payment_method || '').toLowerCase() === 'reposicion' ? 0 : row.expected_amount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Declarado:</span>{' '}
                          <span>
                            {fmt(String(row.payment_method || '').toLowerCase() === 'reposicion' ? 0 : row.declared_amount)}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {String(row.payment_method || '').toLowerCase() === 'reposicion' ? (
                            <span
                              className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600"
                              title="Reposición — no cobrable por mensajero"
                            >
                              No cobrable
                            </span>
                          ) : row.source === 'bodega_eligible' ? (
                            <button
                              onClick={() => handleRegisterPayment(row)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded inline-flex items-center"
                              title="Registrar pago en bodega (Cartera)"
                            >
                              <Icons.Check className="w-3 h-3" />
                              <span className="ml-1 hidden sm:inline">Registrar Pago</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handlePrintReceipt(row)}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs rounded inline-flex items-center"
                                title="Imprimir recibo por factura"
                              >
                                <Icons.Printer className="w-3 h-3" />
                                <span className="ml-1 hidden sm:inline">Imprimir</span>
                              </button>
                              <button
                                onClick={() => handleAcceptCash(row)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded inline-flex items-center"
                                title="Aceptar efectivo"
                              >
                                <Icons.Check className="w-3 h-3" />
                                <span className="ml-1 hidden sm:inline">Aceptar</span>
                              </button>
                            </>
                          )}
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
                      <td className="px-2 py-6 text-center text-sm text-gray-500" colSpan={7}>
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
                      <tr className={`hover:bg-gray-50 ${selectedHandover === handoverKey(h) ? 'bg-gray-50' : ''}`}>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">
                            {String(h.source || '').startsWith('bodega') ? `Bodega (${h.closing_date})` : `#${h.id}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {String(h.source || '').startsWith('bodega') ? 'Consolidado diario' : h.closing_date}
                            {typeof h.items_count === 'number' && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700" title="Ítems del acta">
                                {h.items_count} ítems
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-900">{h.messenger_name || (h.messenger_id ? `ID ${h.messenger_id}` : '-')}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${h.status === 'completed'
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
                                setSelectedHandover(handoverKey(h));
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
                            {!String(h.source || '').startsWith('bodega') && h.status !== 'completed' && (
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

                      {selectedHandover === handoverKey(h) && handoverDetails && (handoverDetails.handover?.id === h.id || String(h.source || '').startsWith('bodega')) && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="p-0">
                            <div className="border-t">
                              <div className="p-4 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                  {String(h.source || '').startsWith('bodega') ? (
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
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cobrado por</th>
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
                                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${it.collection_status === 'collected'
                                                ? 'bg-green-100 text-green-800'
                                                : it.collection_status === 'partial'
                                                  ? 'bg-yellow-100 text-yellow-800'
                                                  : 'bg-gray-100 text-gray-800'
                                              }`}
                                          >
                                            {it.collection_status || 'pending'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-700">
                                          {it.accepted_by_name || '-'}
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

      {/* Modal Base de Cartera */}
      {baseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded shadow-lg w-full max-w-sm">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Editar base de Cartera</h3>
              <button onClick={() => setBaseOpen(false)} className="text-gray-600 hover:text-gray-900"><Icons.X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm mb-1">Base (COP)</label>
                <input type="number" value={baseAmount} onChange={e => setBaseAmount(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="0" />
                <p className="mt-1 text-xs text-gray-500">Este valor se suma a los ingresos y disminuye cuando registras consignaciones.</p>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end space-x-2">
              <button onClick={() => setBaseOpen(false)} className="px-3 py-2 text-gray-700 hover:text-gray-900">Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    const val = String(Number(baseAmount || 0));
                    await systemConfigService.setConfigs([{ config_key: 'cartera_base_balance', config_value: val }]);
                    toast.success('Base actualizada');
                    setBaseOpen(false);
                    await loadBalance();
                  } catch (e) { }
                }}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Consignación */}
      {depositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Registrar consignación</h3>
              <button onClick={() => { setDepositOpen(false); setDepositDetails({}); setDepositSearch(''); }} className="text-gray-600 hover:text-gray-900"><Icons.X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1">Monto</label>
                    <input type="number" value={depositForm.amount} onChange={e => setDepositForm(f => ({ ...f, amount: e.target.value }))} className="w-full px-3 py-2 border rounded" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Banco</label>
                    <input type="text" value={depositForm.bank_name} onChange={e => setDepositForm(f => ({ ...f, bank_name: e.target.value }))} className="w-full px-3 py-2 border rounded" placeholder="Bancolombia" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Referencia</label>
                    <input type="text" value={depositForm.reference_number} onChange={e => setDepositForm(f => ({ ...f, reference_number: e.target.value }))} className="w-full px-3 py-2 border rounded" placeholder="# de consignación" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Motivo</label>
                    <select
                      value={depositForm.reason_code}
                      onChange={(e) => setDepositForm(f => ({ ...f, reason_code: e.target.value }))}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">Seleccionar...</option>
                      {DEPOSIT_REASON_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Detalle del motivo</label>
                    <input type="text" value={depositForm.reason_text} onChange={e => setDepositForm(f => ({ ...f, reason_text: e.target.value }))} className="w-full px-3 py-2 border rounded" placeholder="Detalle del motivo" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Fecha</label>
                    <input type="date" value={depositForm.deposited_at} onChange={e => setDepositForm(f => ({ ...f, deposited_at: e.target.value }))} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Notas</label>
                    <textarea value={depositForm.notes} onChange={e => setDepositForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2 border rounded" rows={3} placeholder="Opcional" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Evidencia (imagen o PDF)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setDepositForm(f => ({ ...f, evidence: e.target.files?.[0] || null }))} />
                  </div>

                </div>
                <div className="pl-4 border-l border-gray-200">
                  {/* Cruce con facturas (opcional) */}
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold">Cruzar con facturas (opcional)</label>
                    <span className="text-xs text-gray-500">Tolerancia: {tolerance?.toLocaleString('es-CO')} COP</span>
                  </div>
                  <input
                    type="text"
                    value={depositSearch}
                    onChange={(e) => setDepositSearch(e.target.value)}
                    placeholder="Buscar factura (número)..."
                    className="w-full px-3 py-2 border rounded mb-2"
                  />
                  <div className="max-h-80 overflow-auto border rounded">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2">Sel</th>
                          <th className="px-3 py-2 text-left">Factura</th>
                          <th className="px-3 py-2 text-right">Esperado</th>
                          <th className="px-3 py-2 text-right">Asignar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {(depositCandidates || [])
                          .filter(p => !depositSearch || String(p.order_number || '').toLowerCase().includes(depositSearch.toLowerCase()))
                          .slice(0, 20)
                          .map((p) => {
                            const val = Number(depositDetails[p.order_id] || 0);
                            return (
                              <tr key={p.order_id}>
                                <td className="px-3 py-1 text-center">
                                  <input
                                    type="checkbox"
                                    checked={val > 0}
                                    onChange={(e) => {
                                      setDepositDetails(prev => {
                                        const copy = { ...prev };
                                        if (e.target.checked) {
                                          const remaining = Math.max(0, Number(depositForm.amount || 0) - Object.values(prev).reduce((s, v) => s + Number(v || 0), 0));
                                          const suggested = Math.min(remaining, Number(p.expected_amount || 0));
                                          copy[p.order_id] = suggested > 0 ? suggested : Number(p.expected_amount || 0);
                                        } else {
                                          delete copy[p.order_id];
                                        }
                                        return copy;
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-1">{p.order_number}</td>
                                <td className="px-3 py-1 text-right">{fmt(p.expected_amount)}</td>
                                <td className="px-3 py-1 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={val}
                                    onChange={(e) => {
                                      const n = Number(e.target.value || 0);
                                      setDepositDetails(prev => ({ ...prev, [p.order_id]: n }));
                                    }}
                                    className="w-24 px-2 py-1 border rounded text-right"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        {(!depositCandidates || depositCandidates.length === 0) && (
                          <tr>
                            <td className="px-3 py-3 text-center text-gray-500" colSpan={4}>No hay facturas disponibles para cruzar</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-xs text-gray-700">
                    <div className="flex justify-between">
                      <span>Asignado a facturas:</span>
                      <span className="font-semibold">{fmt(depositAssignedTotal)}</span>
                    </div>
                    <div className={`${depositDifference <= tolerance ? 'text-green-700' : 'text-red-700'} flex justify-between`}>
                      <span>Diferencia vs Monto consignado:</span>
                      <span className="font-semibold">{fmt(depositDifference)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end space-x-2">
              <button onClick={() => { setDepositOpen(false); setDepositDetails({}); setDepositSearch(''); }} className="px-3 py-2 text-gray-700 hover:text-gray-900">Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    const amt = Number(depositForm.amount || 0);
                    if (!(amt > 0)) return toast.error('Ingresa un monto válido');
                    const detailsArr = Object.entries(depositDetails || {})
                      .map(([order_id, assigned_amount]) => ({ order_id: Number(order_id), assigned_amount: Number(assigned_amount || 0) }))
                      .filter(d => d.order_id && d.assigned_amount > 0);
                    if (detailsArr.length > 0 && depositDifference > tolerance) {
                      return toast.error(`La diferencia asignada supera la tolerancia de ${tolerance.toLocaleString('es-CO')} COP`);
                    }
                    await treasuryService.createDeposit({ ...depositForm, details: detailsArr });
                    toast.success('Consignación registrada');
                    setDepositOpen(false);
                    setDepositForm({ amount: '', bank_name: '', reference_number: '', reason_code: '', reason_text: '', deposited_at: new Date().toISOString().slice(0, 10), notes: '', evidence: null });
                    setDepositDetails({});
                    setDepositSearch('');
                    await loadBalance();
                    await loadData();
                  } catch (e) {
                    // handled by interceptor
                  }
                }}
                disabled={Object.keys(depositDetails || {}).length > 0 && depositDifference > tolerance}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {extraOpen && (
        <ExtraIncomeModal
          open={extraOpen}
          onClose={() => setExtraOpen(false)}
          onSaved={async () => { await loadBalance(); await loadData(); }}
        />
      )}
      {withdrawOpen && (
        <CashWithdrawalModal
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          onSaved={async () => { await loadBalance(); await loadData(); }}
        />
      )}
    </div>
  );
};

export default CashierCollectionsPage;
