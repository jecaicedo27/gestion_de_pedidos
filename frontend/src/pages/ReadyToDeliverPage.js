import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { carrierService, logisticsService, userService, systemConfigService } from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { computeCollectionAmounts, isCreditOrder } from '../utils/payments';
import audioFeedback from '../utils/audioUtils';
import { io } from 'socket.io-client';
import ChangeCarrierModal from '../components/ChangeCarrierModal';
import UploadEvidenceModal from '../components/UploadEvidenceModal';

function getDeliveryMethodLabel(method) {
  const labels = {
    domicilio_ciudad: 'Domicilio Ciudad',
    domicilio_nacional: 'Domicilio Nacional',
    recogida_tienda: 'Recogida en Tienda',
    envio_nacional: 'Envío Nacional',
    envio_internacional: 'Envío Internacional',
    contraentrega: 'Contraentrega',
    recoge_bodega: 'Recoge en Bodega',
    recoge_bodega_sin_cobro: 'Recoge en Bodega (Sin Cobro)'
  };
  return labels[method] || method || '-';
}

// Helpers mínimos para leer método de pago en crudo desde distintas formas
function __toText(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    if (typeof val.label === 'string') return val.label.trim();
    if (typeof val.value === 'string') return val.value.trim();
  }
  return '';
}
function __firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = __toText(v);
    const low = s.toLowerCase();
    if (s && low !== 'undefined' && low !== 'null' && low !== 'n/a' && low !== 'na') {
      return s;
    }
  }
  return '';
}
function __getPath(obj, path) {
  try {
    return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
  } catch {
    return undefined;
  }
}
function __getRawFromPaths(obj, paths) {
  for (const p of paths) {
    const v = __getPath(obj, p);
    const s = __firstNonEmpty(v);
    if (s) return s;
  }
  return '';
}
function getRawPaymentMethod(order) {
  const paths = [
    'payment_method', 'PaymentMethod', 'paymentMethod',
    'payment_method_raw', 'paymentMethodRaw',
    'payment_term', 'paymentTerm',
    'payment_condition', 'paymentCondition',
    'payment_type', 'paymentType',
    'payment', 'metodo_pago', 'metodoPago', 'METODO_PAGO',
    'payment.payment_method', 'payment.method', 'payment.details.method',
    'paymentInfo.method', 'payment_info.method', 'payment_info.payment_method',
    'siigo.payment_method', 'siigo_payment_method',
    'siigoInvoiceData.payment_method', 'invoice_data.payment_method',
    'metadata.payment_method', 'meta.payment_method'
  ];
  return __getRawFromPaths(order, paths) || '-';
}

function getOrderAmount(order) {
  return parseFloat(order.total ?? order.total_amount ?? 0);
}

// Helpers para detectar Camión Externo de forma robusta
function __norm(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function isExternalTruckOrder(order, carriersMap) {
  const carrierName =
    (carriersMap?.[order?.carrier_id]?.name) || '';
  const dm = order?.delivery_method || '';
  const ch = order?.channel || order?.shipping_channel || order?.shippingChannel || '';
  const text = [carrierName, dm, ch].map(__norm).join(' ');
  return text.includes('camion') && text.includes('externo');
}

// Derivar canal de entrega a partir del método y/o carrier
function getChannelLabel(order, carrierName) {
  const dm = (order?.delivery_method || '').toLowerCase();

  // Entrega en bodega/tienda
  if (
    dm === 'recoge_bodega' ||
    dm === 'recogida_tienda' ||
    dm === 'recoge_bodega_sin_cobro' ||
    (dm.includes('recoge') && dm.includes('bodega'))
  ) {
    return 'Bodega';
  }

  // Mensajería/local (domicilios ciudad/urbana)
  if (dm === 'domicilio' || dm === 'domicilio_local' || dm === 'domicilio_ciudad' || dm === 'mensajeria_urbana') {
    return 'Mensajería Local';
  }

  // Envíos nacionales (transportadora)
  if (dm === 'envio_nacional' || dm === 'nacional' || dm.includes('nacional')) {
    return 'Transportadora';
  }

  // Fallback por nombre del carrier
  const cn = (carrierName || '').toLowerCase();
  if (cn.includes('local')) return 'Mensajería Local';
  if (cn) return 'Transportadora';

  return '-';
}

export default function ReadyToDeliverPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [carriersMap, setCarriersMap] = useState({}); // id -> carrier object
  const [refreshing, setRefreshing] = useState(false);

  // Referencia para controlar actualizaciones sin reiniciar timers
  const modalsOpenRef = React.useRef(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevIdsRef = React.useRef(new Set());
  const socketRef = React.useRef(null);

  // Modales y datos auxiliares
  const [paymentModal, setPaymentModal] = useState({ open: false, order: null, method: 'efectivo', amount: '', notes: '', file: null });
  const [assignModal, setAssignModal] = useState({ open: false, order: null, messengerId: '' });
  const [changeCarrierModal, setChangeCarrierModal] = useState({ open: false, order: null });
  const [returnModal, setReturnModal] = useState({ open: false, order: null, reason: '' });
  const [uploadEvidenceModal, setUploadEvidenceModal] = useState({ open: false, order: null, file: null });
  const [truckGuideModal, setTruckGuideModal] = useState({
    open: false,
    order: null,
    // Conductor
    plate: '',
    driver: '',
    whatsapp: '',
    boxes: '',
    notes: '',
    // Remitente
    sender: {
      name: '',
      nit: '',
      phone: '',
      address: '',
      city: '',
      department: '',
      email: ''
    },
    // Receptor (editable)
    recipient: {
      name: '',
      phone: '',
      address: '',
      city: '',
      department: '',
      nit: '',
      email: ''
    },
    saveSenderDefault: true
  });
  const [messengers, setMessengers] = useState([]);
  const [externalDrivers, setExternalDrivers] = useState([]);
  // UI toggles for compact external truck guide modal
  const [showSenderForm, setShowSenderForm] = useState(false);
  const [showRecipientForm, setShowRecipientForm] = useState(false);

  // Agrupar pedidos por canal/carrier para mostrar en tarjetas separadas
  const grouped = useMemo(() => {
    const buckets = {
      'Bodega': [],
      'Mensajería Local': [],
      'Otros': []
    };

    (orders || []).forEach(order => {
      const carrierName = carriersMap?.[order?.carrier_id]?.name || '';
      const channel = getChannelLabel(order, carrierName);

      if (channel === 'Bodega') {
        buckets['Bodega'].push(order);
      } else if (channel === 'Mensajería Local') {
        buckets['Mensajería Local'].push(order);
      } else if (channel === 'Transportadora') {
        const key = carrierName || 'Transportadora (Sin asignar)';
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(order);
      } else {
        buckets['Otros'].push(order);
      }
    });

    const carrierKeys = Object.keys(buckets)
      .filter(k => !['Bodega', 'Mensajería Local', 'Otros'].includes(k))
      .sort((a, b) => a.localeCompare(b, 'es'));

    return [
      { key: 'Bodega', title: `Bodega (${buckets['Bodega'].length})`, items: buckets['Bodega'] },
      { key: 'Mensajería Local', title: `Mensajería Local (${buckets['Mensajería Local'].length})`, items: buckets['Mensajería Local'] },
      ...carrierKeys.map(k => ({ key: k, title: `${k} (${buckets[k].length})`, items: buckets[k] })),
      { key: 'Otros', title: `Otros (${buckets['Otros'].length})`, items: buckets['Otros'] }
    ];
  }, [orders, carriersMap]);

  const loadReadyOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Usar endpoint consolidado de Logística que expone flags de caja/cartera
      const resp = await logisticsService.getReadyForDelivery({ _ts: Date.now() });
      const grouped = resp?.data?.groupedOrders || resp?.groupedOrders || {};
      // Aplanar grupos en una sola lista
      const merged = Object.values(grouped).reduce((acc, list) => acc.concat(list || []), []);

      setOrders(merged);
      try {
        prevIdsRef.current = new Set((merged || []).map(o => Number(o.id)));
        setLastUpdated(new Date().toISOString());
      } catch (_) { }
    } catch (e) {
      console.error('Error cargando pedidos listos para entregar:', e);
      setError('Error cargando pedidos listos para entregar');
      toast.error('Error cargando pedidos listos para entregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReadyOrders();
  }, [loadReadyOrders]);

  // Sincronizar ref de modales
  useEffect(() => {
    modalsOpenRef.current =
      paymentModal.open || assignModal.open || truckGuideModal.open || changeCarrierModal.open || returnModal.open || uploadEvidenceModal.open;
  }, [paymentModal.open, assignModal.open, truckGuideModal.open, changeCarrierModal.open, returnModal.open, uploadEvidenceModal.open]);

  // Carga silenciosa para polling
  const silentReload = useCallback(async () => {
    if (modalsOpenRef.current) return; // No actualizar si hay modales abiertos

    try {
      const resp = await logisticsService.getReadyForDelivery({ _ts: Date.now() });
      const groupedData = resp?.data?.groupedOrders || resp?.groupedOrders || {};
      const merged = Object.values(groupedData).reduce((acc, list) => acc.concat(list || []), []);

      // Actualizar estado sin activar loading spinner y detectar nuevos pedidos
      try {
        const prev = prevIdsRef.current || new Set();
        const current = new Set((merged || []).map(o => Number(o.id)));
        let newCount = 0;
        for (const id of current) {
          if (!prev.has(id)) newCount++;
        }
        setOrders(merged);
        prevIdsRef.current = current;
        setLastUpdated(new Date().toISOString());
        if (newCount > 0) {
          toast.success(`${newCount} pedido(s) nuevo(s) listos para entregar`);
          try { audioFeedback.playStatusAlert(); } catch { }
        }
      } catch {
        setOrders(merged);
      }
    } catch (e) {
      console.error('Error en auto-actualización:', e);
    }
  }, []);

  // Deshabilitado: evitamos auto-refresh periódico para Logística.
  // La página se actualiza por:
  // - WebSocket 'order-status-changed' (tiempo real)
  // - Evento de foco/visibilidad (al volver a la pestaña)
  // - Botón "Actualizar"
  // Si se necesitara un fallback, considerar un polling con backoff y solo si el socket no está disponible.

  // Refrescar al volver el foco o pestaña visible
  useEffect(() => {
    const onFocus = () => silentReload();
    const onVisibility = () => {
      if (!document.hidden) silentReload();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [silentReload]);

  // Socket: refresco instantáneo como en Empaque (sin F5)
  useEffect(() => {
    try {
      const socket = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        try { socket.emit('join-orders-updates'); } catch { }
      });

      const handleStatusChanged = (payload) => {
        try {
          const to = String(payload?.to_status || '').toLowerCase();
          const from = String(payload?.from_status || '').toLowerCase();

          // Nuevo pedido listo para entregar -> alertar y recargar
          if (to === 'listo_para_entrega') {
            toast.success('🆕 Pedido listo para entregar');
            try { audioFeedback.playStatusAlert(); } catch { }
            silentReload();
            return;
          }

          // Cambios que sacan o mueven pedidos de esta vista -> recargar silencioso
          const affectsList = (
            from === 'listo_para_entrega' ||
            ['en_reparto', 'entregado_transportadora', 'entregado_cliente', 'cancelado', 'enviado'].includes(to)
          );
          if (affectsList) {
            silentReload();
          }
        } catch { }
      };

      socket.on('order-status-changed', handleStatusChanged);

      return () => {
        try {
          socket.off('order-status-changed', handleStatusChanged);
          socket.disconnect();
        } catch { }
        socketRef.current = null;
      };
    } catch {
      // No bloquear si socket falla
    }
  }, [silentReload]);

  // Cargar transportadoras activas para mapear carrier_id -> nombre
  useEffect(() => {
    (async () => {
      try {
        const resp = await carrierService.getActive();
        const list = resp?.data || [];
        const map = {};
        list.forEach(c => { if (c?.id != null) map[c.id] = c; });
        setCarriersMap(map);
      } catch (e) {
        // No bloquear la vista si falla
        console.error('Error cargando carriers:', e?.message || e);
      }
    })();
  }, []);

  // Cargar mensajeros activos para asignación (solo una vez)
  useEffect(() => {
    (async () => {
      try {
        const resp = await userService.getUsers({ role: 'mensajero', active: true });
        setMessengers(resp?.data?.users || resp?.data || resp?.users || []);
      } catch (e) {
        console.error('Error cargando mensajeros:', e?.message || e);
      }
    })();
  }, []);

  // Cargar conductores externos
  const loadExternalDrivers = useCallback(async () => {
    try {
      const resp = await logisticsService.getExternalDrivers();
      setExternalDrivers(resp?.data || []);
    } catch (e) {
      console.error('Error cargando conductores externos:', e);
    }
  }, []);

  useEffect(() => {
    loadExternalDrivers();
  }, [loadExternalDrivers]);

  // Descargar planilla PDF por transportadora para un grupo
  const downloadCarrierManifest = async (group) => {
    try {
      const first = (group.items || [])[0];
      const carrierId = first?.carrier_id;
      if (!carrierId) {
        toast.error('No hay transportadora asignada para este grupo');
        return;
      }
      // Permitir descarga aunque la transportadora esté inactiva (backend soporta inactivas)
      const carrier = carriersMap?.[carrierId];
      if (!carrier) {
        console.warn('Transportadora inactiva o no listada; continuando con descarga de planilla');
      }

      const resp = await logisticsService.downloadCarrierManifest({ carrierId });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = (() => {
        const cd = resp.headers?.['content-disposition'] || '';
        const m = cd.match(/filename="?([^"]+)"?/i);
        return m ? m[1] : `planilla-${group.key}-${new Date().toISOString().slice(0, 10)}.pdf`;
      })();
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Planilla descargada');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'No se pudo descargar la planilla');
    }
  };

  // Descargar planilla PDF para Mensajería Local
  // - Si se pasa messengerId, filtra por ese mensajero
  // - Si no, descarga la planilla agregada
  const downloadLocalManifest = async (messengerId) => {
    try {
      const params = messengerId ? { messengerId } : {};
      const resp = await logisticsService.downloadLocalManifest(params);
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = (() => {
        const cd = resp.headers?.['content-disposition'] || '';
        const m = cd.match(/filename="?([^"]+)"?/i);
        if (m) return m[1];
        const date = new Date().toISOString().slice(0, 10);
        const suffix = messengerId ? `mensajeria_local_${String(messengerId)}` : 'mensajeria_local';
        return `planilla-${suffix}-${date}.pdf`;
      })();
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Planilla de Mensajería Local descargada');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'No se pudo descargar la planilla de Mensajería Local');
    }

  };


  const handleUploadEvidence = async () => {
    try {
      if (!uploadEvidenceModal.file) {
        toast.error('Seleccione un archivo');
        return;
      }
      const formData = new FormData();
      formData.append('photo', uploadEvidenceModal.file);

      await logisticsService.uploadPaymentEvidence(uploadEvidenceModal.order.id, formData);

      toast.success('Comprobante subido exitosamente');
      setUploadEvidenceModal({ open: false, order: null, file: null });
      loadReadyOrders();
    } catch (error) {
      console.error('Error subiendo comprobante:', error);
      toast.error('Error al subir el comprobante');
    }
  };

  const isCarrierGroup = (group) =>
    !['Bodega', 'Mensajería Local', 'Otros'].includes(group?.key) &&
    (group?.items || []).some(o => o?.carrier_id);

  // Detectar grupo de Mensajería Local de forma tolerante (con/sin tildes, variantes)
  const isLocalGroupKey = (key) => {
    const k = __norm(String(key || ''));
    return k.includes('mensajeria local') || k === 'mensajeria_local';
  };
  // En algunos escenarios el key puede variar; usar también el title como respaldo
  const isLocalGroup = (g) => {
    const byKey = isLocalGroupKey(g?.key);
    const titleNorm = __norm(String(g?.title || ''));
    const byTitle = titleNorm.includes('mensajeria local');
    return byKey || byTitle;
  };
  // Fallback definitivo: detectar por los ítems del grupo (derivando canal por pedido)
  const isLocalGroupByItems = (g) => {
    try {
      return (g?.items || []).some(o => {
        const carrierName = carriersMap?.[o?.carrier_id]?.name || '';
        return getChannelLabel(o, carrierName) === 'Mensajería Local';
      });
    } catch {
      return false;
    }
  };
  // Detección adicional: por método de entrega de los ítems (domicilios / mensajería urbana)
  const isLocalByMethod = (g) => {
    try {
      return (g?.items || []).some(o => {
        const dm = String(o?.delivery_method || '').toLowerCase();
        return (
          dm === 'domicilio' ||
          dm === 'domicilio_local' ||
          dm === 'domicilio_ciudad' ||
          dm === 'mensajeria_urbana' ||
          (dm.includes('domicilio') && !dm.includes('nacional'))
        );
      });
    } catch {
      return false;
    }
  };

  // Variantes de color (estáticas) para mejorar visibilidad de los botones por mensajero.
  // Usamos una lista de clases Tailwind explícitas para evitar problemas con el purge/JIT.
  const messengerColorClass = (idx) => {
    const variants = [
      'bg-indigo-600 hover:bg-indigo-700',
      'bg-emerald-600 hover:bg-emerald-700',
      'bg-amber-600 hover:bg-amber-700',
      'bg-rose-600 hover:bg-rose-700',
      'bg-sky-600 hover:bg-sky-700',
      'bg-violet-600 hover:bg-violet-700',
      'bg-teal-600 hover:bg-teal-700',
    ];
    return variants[idx % variants.length];
  };

  // Abrir/Imprimir guía en nueva pestaña para Transportadora (reimpresión siempre disponible)
  const openGuideInNewTab = (ord) => {
    try {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/logistics/generate-guide-html';
      form.target = '_blank';

      const formDataGuide = {
        orderId: ord?.id,
        // Notas opcionales
        notes: [ord?.siigo_observations, ord?.observations, ord?.notes].filter(Boolean).join('\\n')
      };

      Object.keys(formDataGuide).forEach((key) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = formDataGuide[key] || '';
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      form.remove();
      toast.success('Guía abierta en nueva ventana. Use Ctrl+P para imprimir o guardar como PDF');
    } catch (error) {
      console.error('Error generando guía:', error);
      toast.error('Error generando guía de envío');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos por Entregar</h1>
          <p className="text-gray-600 mt-1">
            Listado de pedidos empacados, listos para recoger o en reparto.
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Última actualización: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('es-CO') : '-'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <a
            href="/cashier-collections"
            className="btn btn-outline"
            title="Entrega de efectivo a Cartera"
          >
            <Icons.Wallet className="w-4 h-4 mr-1" />
            Entrega a Cartera
          </a>
          <button
            onClick={async () => { try { setRefreshing(true); await loadReadyOrders(); } finally { setRefreshing(false); } }}
            className="btn btn-secondary"
            title="Actualizar"
          >
            <Icons.RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={downloadLocalManifest}
            className="btn btn-primary"
            title="Descargar planilla agregada de Mensajería Local"
          >
            <Icons.Download className="w-4 h-4 mr-2" />
            Descargar planilla
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-content p-0">
          {loading ? (
            <div className="p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-48 mb-3"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Icons.Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              No hay pedidos listos para entregar.
            </div>
          ) : (
            <>
              {grouped.filter(g => (g.items || []).length > 0).map(g => (
                <div key={g.key} className="mb-8">
                  {/* Debug: registro de detección para cada grupo */}
                  {(() => {
                    try {
                      const byKey = isLocalGroup(g);
                      const byItems = isLocalGroupByItems(g);
                      const byMethod = isLocalByMethod(g);
                      // Log visible en consola del navegador
                      // eslint-disable-next-line no-console
                      console.log('[ReadyToDeliver] Grupo:', { key: g?.key, title: g?.title, byKey, byItems, byMethod });
                    } catch (e) {
                      // noop
                    }
                    return null;
                  })()}
                  <div className="px-6 pt-4 flex items-center justify-between flex-nowrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 flex-shrink-0 mr-3">{g.title}</h2>
                      {(() => {
                        try {
                          const byKey = isLocalGroup(g);
                          const byItems = isLocalGroupByItems(g);
                          const byMethod = isLocalByMethod(g);
                          const byTitle = __norm(String(g?.title || '')).includes('mensajeria local');
                          const byKeyText = __norm(String(g?.key || '')).includes('mensajeria local');
                          const isLocal = byKey || byItems || byMethod || byTitle || byKeyText;
                          if (!isLocal) return null;

                          // Construir lista de mensajeros con conteos
                          const map = {};
                          const tryParseId = (v) => {
                            const n = Number(v);
                            return Number.isFinite(n) && n > 0 ? n : null;
                          };
                          const findIdByName = (label) => {
                            const t = __norm(String(label || ''));
                            if (!t) return null;
                            const m = (messengers || []).find(mm => {
                              const pool = [mm?.full_name, mm?.username, mm?.name].map(x => __norm(String(x || '')));
                              return pool.includes(t);
                            });
                            return m ? Number(m.id) : null;
                          };
                          (g.items || []).forEach(o => {
                            let id =
                              tryParseId(o?.assigned_messenger_id) ??
                              tryParseId(o?.assigned_messenger);
                            if (!id) {
                              id = findIdByName(o?.messenger_name) || findIdByName(o?.assigned_messenger_name);
                            }
                            const fallbackName =
                              (messengers || []).find(m => Number(m.id) === id)?.full_name ||
                              (id ? `ID ${id}` : null);
                            const name = o?.messenger_name || o?.assigned_messenger_name || fallbackName;
                            if (!id || !name) return;
                            if (!map[id]) map[id] = { id, name, count: 0 };
                            map[id].count += 1;
                          });
                          const list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'es'));
                          if (list.length === 0) return null;

                          // Chips a la derecha del título (con scroll horizontal)
                          return (
                            <div className="ml-3 flex-1 min-w-0 flex items-center gap-2 overflow-x-auto whitespace-nowrap pr-2">
                              {list.map((m, i) => (
                                <button
                                  key={m.id}
                                  onClick={() => downloadLocalManifest(m.id)}
                                  className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full text-white shadow-sm ring-1 ring-black/5 ${messengerColorClass(i)}`}
                                  title={`Descargar planilla de ${m.name}`}
                                >
                                  <Icons.Download className="w-3 h-3 mr-1 opacity-90" />
                                  {m.name} ({m.count})
                                </button>
                              ))}
                            </div>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">

                      {isCarrierGroup(g) && (
                        <button
                          onClick={() => downloadCarrierManifest(g)}
                          className="btn btn-primary"
                          title="Descargar planilla para esta transportadora"
                        >
                          <Icons.Download className="w-4 h-4 mr-2" />
                          Descargar planilla
                        </button>
                      )}

                      {(() => {
                        try {
                          const byKey = isLocalGroup(g);
                          const byItems = isLocalGroupByItems(g);
                          const byMethod = isLocalByMethod(g);
                          const byTitle = __norm(String(g?.title || '')).includes('mensajeria local');
                          const byKeyText = __norm(String(g?.key || '')).includes('mensajeria local');
                          const directKey = String(g?.key || '') === 'Mensajería Local';
                          const anyLocal = directKey || byKey || byItems || byMethod || byTitle || byKeyText;
                          return anyLocal ? (
                            <button
                              onClick={downloadLocalManifest}
                              className="btn btn-primary"
                              title="Descargar planilla agregada de Mensajería Local"
                            >
                              <Icons.Download className="w-4 h-4 mr-2" />
                              Descargar planilla
                            </button>
                          ) : null;
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                  {/* Mensajería Local: chips renderizados en la barra de acciones (derecha). Bloque viejo eliminado. */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Código
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cliente
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Valor
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Método de Envío
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Canal
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Transportadora
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Método de Pago
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {g.items.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {order.order_number || order.code || order.id}
                            </td>
                            <td className="px-6 py-4">
                              <div className="max-w-xs">
                                <div className="text-sm font-medium text-gray-900 break-words leading-tight">
                                  {order.customer_name || order.client_name || '-'}
                                </div>
                                <div className="text-sm text-gray-500 whitespace-nowrap">
                                  {order.customer_phone || order.client_phone || ''}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>
                                ${getOrderAmount(order).toLocaleString('es-CO')}
                                {(() => {
                                  try {
                                    const { productDue, shippingDue } = computeCollectionAmounts(order);
                                    if (productDue > 0 || shippingDue > 0) {
                                      return (
                                        <div className="mt-1 space-x-2">
                                          {productDue > 0 && (
                                            <span className="inline-flex px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold">
                                              Productos ${productDue.toLocaleString('es-CO')}
                                            </span>
                                          )}
                                          {shippingDue > 0 && (
                                            <span className="inline-flex px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold">
                                              Domicilio ${shippingDue.toLocaleString('es-CO')}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }
                                  } catch (_) { }
                                  return null;
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                {getDeliveryMethodLabel(order.delivery_method)}
                              </span>
                            </td>
                            {/* Canal de entrega */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(() => {
                                const carrierNameForLogic = carriersMap?.[order?.carrier_id]?.name || '';
                                const channel = getChannelLabel(order, carrierNameForLogic);
                                const badgeClass =
                                  channel === 'Bodega' ? 'bg-purple-100 text-purple-800' :
                                    channel === 'Mensajería Local' ? 'bg-blue-100 text-blue-800' :
                                      channel === 'Transportadora' ? 'bg-green-100 text-green-800' :
                                        'bg-gray-100 text-gray-800';
                                return (
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badgeClass}`}>
                                    {channel}
                                  </span>
                                );
                              })()}
                            </td>
                            {/* Transportadora */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(() => {
                                const carrier = carriersMap?.[order?.carrier_id];
                                if (carrier?.name) {
                                  return (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                      {carrier.name}
                                    </span>
                                  );
                                }
                                // Si no hay carrier, mostrar indicador según canal
                                const dm = (order?.delivery_method || '').toLowerCase();
                                if (dm === 'recoge_bodega' || dm === 'recogida_tienda') {
                                  return <span className="text-xs text-gray-500">-</span>;
                                }
                                return <span className="text-xs text-gray-500">Sin asignar</span>;
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(() => {
                                try {
                                  const raw = getRawPaymentMethod(order);
                                  const { productDue } = computeCollectionAmounts(order);
                                  const credit = isCreditOrder(order);
                                  return (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {raw ? (
                                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                          {raw}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-500">-</span>
                                      )}
                                      {credit ? (
                                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                          🧾 CRÉDITO
                                        </span>
                                      ) : productDue > 0 ? (
                                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                                          💰 COBRAR
                                        </span>
                                      ) : (
                                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                                          ✅ SIN COBRO
                                        </span>
                                      )}
                                    </div>
                                  );
                                } catch {
                                  return (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                      {getRawPaymentMethod(order)}
                                    </span>
                                  );
                                }
                              })()}
                            </td>
                            {/* Acciones (reutilizamos la misma lógica por fila) */}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                              {(() => {
                                const carrierNameForLogic2 = carriersMap?.[order?.carrier_id]?.name || '';
                                const channel = getChannelLabel(order, carrierNameForLogic2);
                                const isExternalTruckAction = isExternalTruckOrder(order, carriersMap);

                                const ActionButton = ({ onClick, title, color = 'blue', children, disabled = false }) => (
                                  <button
                                    onClick={onClick}
                                    disabled={disabled}
                                    className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-${color}-600 text-white hover:bg-${color}-700 ml-2 ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                                    title={title}
                                  >
                                    {children}
                                  </button>
                                );

                                return (
                                  <div className="flex items-center justify-end">
                                    {/* Botón para subir comprobante (Cartera) - Visible si está pendiente O si es efectivo (para cuando cambian a transferencia) */}
                                    {(() => {
                                      const isPending = Boolean(order.is_pending_payment_evidence) || String(order.is_pending_payment_evidence) === '1';
                                      const pm = String(order.payment_method || getRawPaymentMethod(order) || '').toLowerCase();
                                      const isCash = pm === 'efectivo' || pm === 'contraentrega';

                                      // Mostrar si está marcado como pendiente, O si es efectivo (para permitir subir comprobante si cambian de opinión)
                                      // NO mostrar si ya es transferencia (se asume que ya tiene evidencia)
                                      if (isPending || isCash) {
                                        return (
                                          <ActionButton
                                            color={isPending ? "orange" : "blue"}
                                            title={isPending ? "Subir comprobante (Pendiente)" : "Subir comprobante (Cambio a Transferencia)"}
                                            onClick={() => setUploadEvidenceModal({ open: true, order, file: null })}
                                          >
                                            <Icons.Upload className="w-3 h-3 mr-1" />
                                            {isPending ? "Subir Pendiente" : "Subir Comprobante"}
                                          </ActionButton>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {/* Bodega: registrar pago / entregar */}
                                    {channel === 'Bodega' && (
                                      (() => {
                                        const credit = isCreditOrder(order);
                                        const regCount = Number(order?.cash_register_count || 0);
                                        const { productDue } = computeCollectionAmounts(order);

                                        // Para determinar si esperamos a Cartera, necesitamos diferenciar:
                                        // - hasAnyPayment: hay ALGÚN tipo de pago registrado (caja o wallet)
                                        // - hasCashCollected: específicamente hay efectivo cobrado y aceptado
                                        // - hasWalletApproved: hay validación de wallet aprobada (transferencias)
                                        const hasAnyPayment = regCount > 0 || String(order?.has_payment || '') === '1';
                                        const hasCashCollected = Number(order?.cash_register_collected_count || 0) > 0;
                                        const hasWalletApproved = Number(order?.wallet_validations_approved || 0) > 0 || Number(order?.has_cash_collected || 0) === 1;

                                        // mustWaitForCartera solo si:
                                        // - No es crédito
                                        // - Hay pago registrado en CAJA (no wallet)
                                        // - Ese pago de caja NO ha sido aceptado aún
                                        const mustWaitForCartera = !credit && regCount > 0 && !hasCashCollected;

                                        return (
                                          <>
                                            {/* Botón Registrar Pago solo si no es crédito y aún no hay registro */}
                                            {(() => {
                                              const { productDue } = computeCollectionAmounts(order);
                                              const shouldShow = !credit && regCount === 0 && productDue > 0;

                                              // Debug para FV-2-15584 y otros pedidos con pago mixto
                                              if (order.order_number === 'FV-2-15584' || productDue > 0) {
                                                console.log(`[DEBUG ${order.order_number}] Registrar Pago:`, {
                                                  credit,
                                                  regCount,
                                                  productDue,
                                                  shouldShow,
                                                  payment_method: order.payment_method,
                                                  payment_amount: order.payment_amount,
                                                  siigo_balance: order.siigo_balance,
                                                  total: order.total_amount,
                                                  paid_amount: order.paid_amount
                                                });
                                              }

                                              // Mostrar botón si:
                                              // - No es crédito
                                              // - No hay registro de caja aún
                                              // - Hay dinero pendiente por cobrar (productDue > 0)
                                              // Esto incluye pagos 100% efectivo Y pagos mixtos (transfer + efectivo)
                                              return shouldShow;
                                            })() && (
                                                <ActionButton
                                                  color="amber"
                                                  title="Registrar pago en bodega"
                                                  onClick={() => {
                                                    const { productDue } = computeCollectionAmounts(order);
                                                    // Para pagos mixtos, siempre preseleccionar "efectivo" 
                                                    // porque estamos cobrando la parte en efectivo (productDue)
                                                    setPaymentModal({
                                                      open: true,
                                                      order,
                                                      method: 'efectivo', // Siempre efectivo cuando hay productDue > 0
                                                      amount: String(productDue || getOrderAmount(order) || ''),
                                                      notes: '',
                                                      file: null
                                                    });
                                                  }}
                                                >
                                                  <Icons.DollarSign className="w-3 h-3 mr-1" />
                                                  Registrar Pago
                                                </ActionButton>
                                              )}

                                            {/* Chips de estado de pago */}
                                            {!credit && hasCashCollected && (
                                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-700 ml-2" title="Pago en efectivo aceptado por Cartera">
                                                <Icons.Check className="w-3 h-3 mr-1" />
                                                Efectivo Pagado
                                              </span>
                                            )}
                                            {!credit && hasWalletApproved && !hasCashCollected && productDue > 0 && (
                                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md bg-blue-100 text-blue-700 ml-2" title="Transferencia aprobada, falta efectivo">
                                                <Icons.Check className="w-3 h-3 mr-1" />
                                                Transfer OK
                                              </span>
                                            )}
                                            {!credit && regCount > 0 && !hasCashCollected && (
                                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-800 ml-2" title="Pago registrado, pendiente aceptación">
                                                <Icons.Clock className="w-3 h-3 mr-1" />
                                                Pago registrado
                                              </span>
                                            )}

                                            {mustWaitForCartera ? (
                                              <>
                                                {(() => {
                                                  const pmLow = String(order?.payment_method || '').toLowerCase();
                                                  const cashLike = pmLow.includes('efectivo') || pmLow.includes('contado') || pmLow.includes('contraentrega') || pmLow.includes('cash');
                                                  if (!cashLike) return null;
                                                  return (
                                                    <ActionButton
                                                      color="emerald"
                                                      title="Aceptar pago (Bodega)"
                                                      onClick={async () => {
                                                        try {
                                                          const res = await logisticsService.receivePickupPayment({
                                                            orderId: order.id,
                                                            payment_method: 'efectivo',
                                                            amount: Number(getOrderAmount(order) || 0),
                                                            notes: 'Aceptación desde Logística'
                                                          });
                                                          toast.success(res?.message || 'Pago aceptado');
                                                          loadReadyOrders();
                                                        } catch (e) {
                                                          toast.error(e?.response?.data?.message || 'No se pudo aceptar el pago');
                                                        }
                                                      }}
                                                    >
                                                      <Icons.Check className="w-3 h-3 mr-1" />
                                                      Aceptar pago
                                                    </ActionButton>
                                                  );
                                                })()}
                                                <button
                                                  type="button"
                                                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-gray-200 text-gray-600 ml-2 cursor-not-allowed"
                                                  title="Pendiente aceptación de Cartera"
                                                  aria-disabled="true"
                                                >
                                                  <Icons.Clock className="w-3 h-3 mr-1" />
                                                  Pendiente Cartera
                                                </button>
                                              </>
                                            ) : (
                                              <ActionButton
                                                color="green"
                                                title="Entregar en bodega"
                                                onClick={async () => {











                                                  try {
                                                    const res = await logisticsService.markPickupDelivered({ orderId: order.id, delivery_notes: 'Entregado en bodega' });
                                                    toast.success(res?.message || 'Entregado en bodega');
                                                    // Optimista: quitar el pedido de la lista inmediatamente
                                                    setOrders(prev => prev.filter(o => o.id !== order.id));
                                                    loadReadyOrders();
                                                  } catch (e) {
                                                    const msg = e?.response?.data?.message || '';
                                                    if (msg.toLowerCase().includes('primero registra el pago')) {
                                                      setPaymentModal({
                                                        open: true,
                                                        order,
                                                        method: String(order?.payment_method || '').toLowerCase().includes('transfer') ? 'transferencia' : 'efectivo',
                                                        amount: String(getOrderAmount(order) || ''),
                                                        notes: '',
                                                        file: null
                                                      });
                                                    } else {
                                                      toast.error(msg || 'No se pudo entregar en bodega');
                                                    }
                                                  }
                                                }}
                                              >
                                                <Icons.CheckCircle className="w-3 h-3 mr-1" />
                                                Entregar
                                              </ActionButton>
                                            )}
                                          </>
                                        );
                                      })()
                                    )}

                                    {/* Mensajería Local: asignar o reasignar mensajero */}
                                    {channel === 'Mensajería Local' && (() => {
                                      const statusNorm = String(order?.messenger_status || order?.status || '').toLowerCase();
                                      const hasLegacyAssigned = (() => {
                                        const v = order?.assigned_messenger;
                                        if (v === 0) return true;
                                        const s = String(v ?? '').trim();
                                        return s.length > 0;
                                      })();
                                      const hasMessengerNames = Boolean(order?.messenger_name || order?.assigned_messenger_name);
                                      const isAssigned =
                                        Boolean(order?.assigned_messenger_id) ||
                                        hasLegacyAssigned ||
                                        hasMessengerNames;
                                      const messengerDisplayName =
                                        order?.messenger_name ||
                                        order?.assigned_messenger_name ||
                                        (order?.assigned_messenger_id ? `ID ${order.assigned_messenger_id}` : null);
                                      const hasAcceptedOrInRoute =
                                        ['accepted', 'in_delivery', 'en_reparto'].includes(statusNorm);

                                      return (
                                        <>
                                          {isAssigned && messengerDisplayName && (
                                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 ml-2">
                                              Asignado: {messengerDisplayName}
                                            </span>
                                          )}
                                          {!isAssigned && (
                                            <ActionButton
                                              color="indigo"
                                              title="Asignar mensajero"
                                              onClick={() => setAssignModal({ open: true, order, messengerId: '' })}
                                            >
                                              <Icons.UserPlus className="w-3 h-3 mr-1" />
                                              Asignar Mensajero
                                            </ActionButton>
                                          )}
                                          {isAssigned && !hasAcceptedOrInRoute && (
                                            <ActionButton
                                              color="indigo"
                                              title="Reasignar mensajero (aún no aceptado)"
                                              onClick={() => setAssignModal({ open: true, order, messengerId: '' })}
                                            >
                                              <Icons.UserPlus className="w-3 h-3 mr-1" />
                                              Reasignar
                                            </ActionButton>
                                          )}
                                        </>
                                      );
                                    })()}

                                    {/* Transportadora: marcar entregado a transportadora (ocultar para Camión Externo) */}
                                    {channel === 'Transportadora' && !isExternalTruckAction && (
                                      <>
                                        <ActionButton
                                          color="rose"
                                          title="Ver / Reimprimir Guía (Transportadora)"
                                          onClick={() => openGuideInNewTab(order)}
                                        >
                                          <Icons.FileText className="w-3 h-3 mr-1" />
                                          Ver Guía
                                        </ActionButton>
                                        <ActionButton
                                          color="blue"
                                          title="Cambiar transportadora"
                                          onClick={() => setChangeCarrierModal({ open: true, order })}
                                        >
                                          <Icons.RefreshCcw className="w-3 h-3 mr-1" />
                                          Cambiar Transportadora
                                        </ActionButton>
                                        <ActionButton
                                          color="purple"
                                          title="Entregar a transportadora"
                                          onClick={async () => {
                                            try {
                                              const res = await logisticsService.markDeliveredToCarrier({ orderId: order.id, delivery_notes: null });
                                              toast.success(res?.message || 'Marcado como entregado a transportadora');
                                              loadReadyOrders();
                                            } catch (e) {
                                              toast.error(e?.response?.data?.message || 'No se pudo marcar como entregado a transportadora');
                                            }
                                          }}
                                        >
                                          <Icons.Send className="w-3 h-3 mr-1" />
                                          Entregar Transportadora
                                        </ActionButton>
                                      </>
                                    )}

                                    {/* Camión externo (detectar por nombre de carrier) -> Ver/Editar Guía y Entregar */}
                                    {(() => {
                                      if (isExternalTruckAction) {
                                        const openTruckGuide = async (ord) => {
                                          try {
                                            // Reset toggles on open
                                            setShowSenderForm(false);
                                            setShowRecipientForm(false);
                                            // Cargar remitente por defecto
                                            const senderDefault = await systemConfigService.getSenderDefault();
                                            const sender = senderDefault || {
                                              name: 'PERLAS EXPLOSIVAS COLOMBIA SAS',
                                              nit: '901749888',
                                              phone: '3105244298',
                                              address: 'Calle 50 # 31-46',
                                              city: 'Medellín',
                                              department: 'Antioquia',
                                              email: 'logistica@perlas-explosivas.com'
                                            };
                                            // Prefill receptor desde el pedido (prioridad parsed_shipping_data)
                                            const parsed = ord.parsed_shipping_data || {};
                                            const recipient = {
                                              name: parsed.name || ord.customer_name || '',
                                              phone: parsed.phone || ord.customer_phone || ord.phone || '',
                                              address: parsed.address || ord.customer_address || ord.address || '',
                                              city: parsed.city || ord.customer_city || ord.city || '',
                                              department: parsed.department || ord.customer_department || ord.department || '',
                                              nit: parsed.nit || ord.customer_nit || '',
                                              email: ord.customer_email || ord.email || ''
                                            };
                                            setTruckGuideModal(p => ({
                                              ...p,
                                              open: true,
                                              order: ord,
                                              plate: '',
                                              driver: '',
                                              whatsapp: '',
                                              boxes: '',
                                              notes: '',
                                              sender,
                                              recipient,
                                              saveSenderDefault: senderDefault ? false : true
                                            }));
                                          } catch (e) {
                                            // Fallback sin bloquear
                                            setTruckGuideModal(p => ({
                                              ...p,
                                              open: true,
                                              order: ord
                                            }));
                                          }
                                        };
                                        return (
                                          <>
                                            <ActionButton
                                              color="rose"
                                              title="Ver / Editar guía (Camión Externo)"
                                              onClick={() => openTruckGuide(order)}
                                            >
                                              <Icons.FileText className="w-3 h-3 mr-1" />
                                              Ver Guía
                                            </ActionButton>
                                            <ActionButton
                                              color="purple"
                                              title="Entregar a Camión Externo"
                                              onClick={async () => {
                                                try {
                                                  const res = await logisticsService.markDeliveredToCarrier({
                                                    orderId: order.id,
                                                    delivery_notes: 'Entregado a camión externo'
                                                  });
                                                  toast.success(res?.message || 'Marcado como entregado a camión externo');
                                                  loadReadyOrders();
                                                } catch (e) {
                                                  toast.error(e?.response?.data?.message || 'No se pudo marcar como entregado a camión externo');
                                                }
                                              }}
                                            >
                                              <Icons.Truck className="w-3 h-3 mr-1" />
                                              Entregar Camión
                                            </ActionButton>
                                          </>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <ActionButton
                                      color="gray"
                                      title="Devolver a Empaque"
                                      onClick={() => setReturnModal({ open: true, order, reason: '' })}
                                    >
                                      <Icons.RotateCcw className="w-3 h-3 mr-1" />
                                      Devolver a Empaque
                                    </ActionButton>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      {/* Modal Registrar Pago en Bodega */}
      {paymentModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <h3 className="text-lg font-semibold mb-2">Registrar pago en bodega</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Método de pago</label>
                <select
                  value={paymentModal.method}
                  onChange={(e) => setPaymentModal(p => ({ ...p, method: e.target.value }))}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Monto</label>
                <input
                  type="number"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal(p => ({ ...p, amount: e.target.value }))}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                <textarea
                  value={paymentModal.notes}
                  onChange={(e) => setPaymentModal(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border px-3 py-2 rounded"
                />
              </div>
              {paymentModal.method === 'transferencia' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Comprobante (foto)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPaymentModal(p => ({ ...p, file: e.target.files?.[0] || null }))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Obligatorio para transferencia.</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setPaymentModal({ open: false, order: null, method: 'efectivo', amount: '', notes: '', file: null })}
                className="px-3 py-1 rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await logisticsService.receivePickupPayment({
                      orderId: paymentModal.order.id,
                      payment_method: paymentModal.method,
                      amount: Number(paymentModal.amount) || 0,
                      notes: paymentModal.notes,
                      file: paymentModal.file
                    });
                    // Caso de uso: después de registrar el pago, el pedido debe permanecer en la vista
                    // y solo salir cuando se marque como ENTREGADO.
                    toast.success('Pago registrado');
                    // Actualización optimista: marcar pago en el estado local sin sacar el pedido de la lista
                    setOrders(prev => prev.map(o => {
                      if (Number(o.id) !== Number(paymentModal.order.id)) return o;
                      const count = Number(o.cash_register_count || 0);
                      return { ...o, cash_register_count: count + 1, has_payment: 1 };
                    }));
                    setPaymentModal({ open: false, order: null, method: 'efectivo', amount: '', notes: '', file: null });
                    // Refrescar para mantener consistencia sin cambiar el bucket
                    loadReadyOrders();
                  } catch (e) {
                    toast.error(e?.response?.data?.message || 'No se pudo registrar el pago');
                  }
                }}
                className="px-3 py-1 rounded bg-blue-600 text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignar Mensajero */}
      {assignModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <h3 className="text-lg font-semibold mb-2">Asignar mensajero</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Mensajero</label>
                <select
                  value={assignModal.messengerId}
                  onChange={(e) => setAssignModal(p => ({ ...p, messengerId: e.target.value }))}
                  className="w-full border px-3 py-2 rounded"
                >
                  <option value="">Selecciona un mensajero</option>
                  {(messengers || []).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name || m.username || `ID ${m.id}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setAssignModal({ open: false, order: null, messengerId: '' })}
                className="px-3 py-1 rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!assignModal.messengerId) {
                    toast.error('Selecciona un mensajero');
                    return;
                  }
                  try {
                    const res = await logisticsService.assignMessenger({
                      orderId: assignModal.order.id,
                      messengerId: Number(assignModal.messengerId)
                    });
                    toast.success(res?.message || 'Mensajero asignado');
                    // Optimista: actualizar datos del pedido y mantenerlo visible
                    setOrders(prev => {
                      const idNum = Number(assignModal.order.id);
                      const messengerNum = Number(assignModal.messengerId);
                      const selected = (messengers || []).find(m => Number(m.id) === messengerNum);
                      const displayName = selected?.full_name || selected?.username || `ID ${messengerNum}`;
                      return prev.map(o => {
                        if (Number(o.id) !== idNum) return o;
                        return {
                          ...o,
                          assigned_messenger_id: messengerNum,
                          assigned_messenger: String(messengerNum),
                          messenger_status: 'assigned',
                          messenger_name: displayName,
                          assigned_messenger_name: displayName
                        };
                      });
                    });
                    setAssignModal({ open: false, order: null, messengerId: '' });
                    // Refrescar para asegurar consistencia con backend
                    loadReadyOrders();
                  } catch (e) {
                    toast.error(e?.response?.data?.message || 'No se pudo asignar el mensajero');
                  }
                }}
                className="px-3 py-1 rounded bg-indigo-600 text-white"
              >
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {truckGuideModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Guía - Camión Externo</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Columna Izquierda: Datos de Transporte y Remitente */}
              <div className="space-y-4">
                {/* Datos de transporte */}
                <div className="border rounded p-3 bg-white">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-indigo-700">Datos de transporte</h4>
                    <select
                      className="text-xs border rounded px-2 py-1 max-w-[200px]"
                      onChange={(e) => {
                        const d = externalDrivers.find(ed => String(ed.id) === e.target.value);
                        if (d) {
                          setTruckGuideModal(p => ({
                            ...p,
                            driver: d.name,
                            plate: d.plate || '',
                            whatsapp: d.phone || ''
                          }));
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Cargar conductor...</option>
                      {Object.entries(
                        externalDrivers.reduce((acc, d) => {
                          const city = d.city ? d.city.toUpperCase() : 'GENERAL';
                          if (!acc[city]) acc[city] = [];
                          acc[city].push(d);
                          return acc;
                        }, {})
                      ).sort((a, b) => a[0].localeCompare(b[0])).map(([city, drivers]) => (
                        <optgroup key={city} label={city}>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Placa del vehículo</label>
                      <input
                        type="text"
                        value={truckGuideModal.plate}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, plate: e.target.value }))}
                        className="w-full border px-3 py-2 rounded"
                        placeholder="ABC123"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Nombre del conductor</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={truckGuideModal.driver}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, driver: e.target.value }))}
                          className="w-full border px-3 py-2 rounded"
                          placeholder="Nombre y Apellido"
                        />
                        {truckGuideModal.driver && !externalDrivers.some(d => d.name.toLowerCase() === truckGuideModal.driver.toLowerCase()) && (
                          <button
                            onClick={async () => {
                              try {
                                await logisticsService.createExternalDriver({
                                  name: truckGuideModal.driver,
                                  plate: truckGuideModal.plate,
                                  phone: truckGuideModal.whatsapp,
                                  city: truckGuideModal.recipient.city
                                });
                                toast.success('Conductor guardado');
                                loadExternalDrivers();
                              } catch (e) {
                                toast.error('Error guardando conductor');
                              }
                            }}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                            title="Guardar nuevo conductor"
                          >
                            <Icons.Save className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">WhatsApp</label>
                      <input
                        type="text"
                        value={truckGuideModal.whatsapp}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, whatsapp: e.target.value }))}
                        className="w-full border px-3 py-2 rounded"
                        placeholder="+57 300..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Cajas</label>
                      <input
                        type="number"
                        min="0"
                        value={truckGuideModal.boxes}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, boxes: e.target.value }))}
                        className="w-full border px-3 py-2 rounded"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Forma de Pago Flete</label>
                      <select
                        value={truckGuideModal.shippingPaymentMethod || ''}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, shippingPaymentMethod: e.target.value }))}
                        className="w-full border px-3 py-2 rounded text-xs"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="CONTADO">Contado (Pago en Origen)</option>
                        <option value="CONTRA ENTREGA">Contra Entrega (Pago en Destino)</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-medium mb-1">Notas (opcional)</label>
                    <textarea
                      value={truckGuideModal.notes}
                      onChange={(e) => setTruckGuideModal(p => ({ ...p, notes: e.target.value }))}
                      className="w-full border px-3 py-2 rounded h-20"
                      placeholder="Indicaciones adicionales..."
                    />
                  </div>
                </div>

                {/* Remitente */}
                <div className="border rounded p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Remitente</h4>
                    <div className="text-right">
                      <label className="text-xs inline-flex items-center mr-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={truckGuideModal.saveSenderDefault}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, saveSenderDefault: e.target.checked }))}
                          className="mr-1"
                        />
                        Guardar default
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSenderForm(s => !s)}
                        className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-100"
                      >
                        {showSenderForm ? 'Ocultar' : 'Editar'}
                      </button>
                    </div>
                  </div>

                  {!showSenderForm ? (
                    <div className="text-xs text-gray-600">
                      <p className="font-medium">{truckGuideModal.sender?.name || 'Sin empresa'}</p>
                      <p>{truckGuideModal.sender?.city || '-'}, {truckGuideModal.sender?.department || '-'}</p>
                      <p>{truckGuideModal.sender?.address}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-medium text-gray-500">Empresa</label>
                        <input
                          type="text"
                          value={truckGuideModal.sender.name}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, sender: { ...p.sender, name: e.target.value } }))}
                          className="w-full border px-2 py-1 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500">NIT</label>
                        <input
                          type="text"
                          value={truckGuideModal.sender.nit}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, sender: { ...p.sender, nit: e.target.value } }))}
                          className="w-full border px-2 py-1 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500">Teléfono</label>
                        <input
                          type="text"
                          value={truckGuideModal.sender.phone}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, sender: { ...p.sender, phone: e.target.value } }))}
                          className="w-full border px-2 py-1 rounded text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-medium text-gray-500">Dirección</label>
                        <input
                          type="text"
                          value={truckGuideModal.sender.address}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, sender: { ...p.sender, address: e.target.value } }))}
                          className="w-full border px-2 py-1 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500">Ciudad</label>
                        <input
                          type="text"
                          value={truckGuideModal.sender.city}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, sender: { ...p.sender, city: e.target.value } }))}
                          className="w-full border px-2 py-1 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500">Depto</label>
                        <input
                          type="text"
                          value={truckGuideModal.sender.department}
                          onChange={(e) => setTruckGuideModal(p => ({ ...p, sender: { ...p.sender, department: e.target.value } }))}
                          className="w-full border px-2 py-1 rounded text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Receptor */}
              <div className="border rounded p-4 bg-gray-50 h-full">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">Receptor</h4>
                  <button
                    type="button"
                    onClick={() => setShowRecipientForm(s => !s)}
                    className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-100"
                  >
                    {showRecipientForm ? 'Ocultar' : 'Editar'}
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Nombre Completo</label>
                    <input
                      type="text"
                      value={truckGuideModal.recipient.name}
                      onChange={(e) => setTruckGuideModal(p => ({ ...p, recipient: { ...p.recipient, name: e.target.value } }))}
                      className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600">NIT / CC</label>
                      <input
                        type="text"
                        value={truckGuideModal.recipient.nit}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, recipient: { ...p.recipient, nit: e.target.value } }))}
                        className="w-full border px-3 py-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600">Teléfono</label>
                      <input
                        type="text"
                        value={truckGuideModal.recipient.phone}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, recipient: { ...p.recipient, phone: e.target.value } }))}
                        className="w-full border px-3 py-2 rounded"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Dirección de Entrega</label>
                    <input
                      type="text"
                      value={truckGuideModal.recipient.address}
                      onChange={(e) => setTruckGuideModal(p => ({ ...p, recipient: { ...p.recipient, address: e.target.value } }))}
                      className="w-full border px-3 py-2 rounded"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600">Ciudad</label>
                      <input
                        type="text"
                        value={truckGuideModal.recipient.city}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, recipient: { ...p.recipient, city: e.target.value } }))}
                        className="w-full border px-3 py-2 rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-600">Departamento</label>
                      <input
                        type="text"
                        value={truckGuideModal.recipient.department}
                        onChange={(e) => setTruckGuideModal(p => ({ ...p, recipient: { ...p.recipient, department: e.target.value } }))}
                        className="w-full border px-3 py-2 rounded"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-600">Email</label>
                    <input
                      type="text"
                      value={truckGuideModal.recipient.email}
                      onChange={(e) => setTruckGuideModal(p => ({ ...p, recipient: { ...p.recipient, email: e.target.value } }))}
                      className="w-full border px-3 py-2 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setTruckGuideModal({ open: false, order: null, plate: '', driver: '', whatsapp: '', boxes: '', notes: '', shippingPaymentMethod: '' })}
                className="px-4 py-2 rounded border text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    // Validaciones
                    if (!truckGuideModal.shippingPaymentMethod) {
                      toast.error('Debe seleccionar la Forma de Pago Flete');
                      return;
                    }
                    if (!truckGuideModal.boxes || Number(truckGuideModal.boxes) <= 0) {
                      toast.error('Debe ingresar el número de cajas');
                      return;
                    }

                    // Guardar remitente por defecto si aplica
                    if (truckGuideModal.saveSenderDefault) {
                      try {
                        await systemConfigService.saveSenderDefault(truckGuideModal.sender);
                      } catch (e) {
                        console.warn('No se pudo guardar remitente por defecto:', e?.message);
                      }
                    }
                    const extra = [
                      truckGuideModal.notes ? `Notas: ${truckGuideModal.notes}` : null
                    ].filter(Boolean).join(' | ');

                    const payload = {
                      orderId: truckGuideModal.order.id,
                      shippingMethod: 'camion_externo',
                      transportCompany: 'Camión Externo',
                      // Nuevos objetos
                      sender: { ...truckGuideModal.sender },
                      recipient: {
                        ...truckGuideModal.recipient,
                        paymentMethod: truckGuideModal.shippingPaymentMethod // Enviar selección explícita
                      },
                      driver: {
                        plate: truckGuideModal.plate,
                        name: truckGuideModal.driver,
                        whatsapp: truckGuideModal.whatsapp,
                        boxes: truckGuideModal.boxes
                      },
                      // Notas libres
                      notes: extra
                    };
                    const resp = await logisticsService.generateGuide(payload);
                    // Descargar blob
                    const blob = new Blob([resp.data], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `guia-envio-${truckGuideModal.order.order_number}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    toast.success('Guía generada');
                    setTruckGuideModal({
                      open: false, order: null,
                      plate: '', driver: '', whatsapp: '', boxes: '', notes: '', shippingPaymentMethod: '',
                      sender: {
                        name: '', nit: '', phone: '', address: '', city: '', department: '', email: ''
                      },
                      recipient: {
                        name: '', phone: '', address: '', city: '', department: '', nit: '', email: ''
                      },
                      saveSenderDefault: false
                    });
                  } catch (e) {
                    toast.error(e?.response?.data?.message || 'No se pudo generar la guía');
                  }
                }}
                className="px-4 py-2 rounded bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
              >
                Generar Guía
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Devolver a Empaque */}
      {returnModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <h3 className="text-lg font-semibold mb-2">Devolver a Empaque</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Motivo</label>
                <textarea
                  value={returnModal.reason}
                  onChange={(e) => setReturnModal(p => ({ ...p, reason: e.target.value }))}
                  className="w-full border px-3 py-2 rounded"
                  placeholder="Ej: Cliente solicita adicionar producto"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setReturnModal({ open: false, order: null, reason: '' })}
                className="px-3 py-1 rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await logisticsService.returnToPackaging({
                      orderId: returnModal.order.id,
                      reason: returnModal.reason
                    });
                    toast.success('Pedido devuelto a Empaque');
                    setOrders(prev => prev.filter(o => Number(o.id) !== Number(returnModal.order.id)));
                    setReturnModal({ open: false, order: null, reason: '' });
                    loadReadyOrders();
                  } catch (e) {
                    toast.error(e?.response?.data?.message || 'No se pudo devolver a Empaque');
                  }
                }}
                className="px-3 py-1 rounded bg-gray-700 text-white"
              >
                Devolver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Transportadora */}
      {changeCarrierModal.open && (
        <ChangeCarrierModal
          order={changeCarrierModal.order}
          onClose={() => setChangeCarrierModal({ open: false, order: null })}
          onSuccess={({ orderId, newCarrierId }) => {
            try {
              setOrders(prev => prev.map(o => {
                if (Number(o.id) !== Number(orderId)) return o;
                return { ...o, carrier_id: newCarrierId, shipping_guide_generated: 0, shipping_guide_path: null };
              }));
            } catch { }
            loadReadyOrders();
          }}
        />
      )}
      {/* Modal Subir Comprobante */}
      {/* Modal Subir Comprobante */}
      <UploadEvidenceModal
        isOpen={uploadEvidenceModal.open}
        onClose={() => setUploadEvidenceModal({ open: false, order: null, file: null })}
        order={uploadEvidenceModal.order}
        onSuccess={() => {
          loadReadyOrders();
          setUploadEvidenceModal({ open: false, order: null, file: null });
        }}
      />
    </div>
  );
}
