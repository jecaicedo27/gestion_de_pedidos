import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import audioFeedback from '../utils/audioUtils';
import { packagingEvidenceService } from '../services/api';
import { io } from 'socket.io-client';

const PackagingPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [stats, setStats] = useState({});
  const [hasEvidenceUploaded, setHasEvidenceUploaded] = useState(false);
  // Estados para alertas y comparación
  const [prevPendingIds, setPrevPendingIds] = useState([]);
  const [prevStatsSnapshot, setPrevStatsSnapshot] = useState(null);

  // Verificar si hay un orderId en la URL para procesar directamente
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId) {
      console.log('🎯 ID de pedido detectado en URL:', orderId);
      toast('🎯 Iniciando empaque del pedido específico...');
      startPackaging(parseInt(orderId));
      // Limpiar el parámetro de la URL después de procesar
      setSearchParams({});
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Socket: refresco instantáneo cuando llegan pedidos a Empaque
  const socketRef = React.useRef(null);
  const lastNewToastAtRef = React.useRef(0);
  const initializedRef = React.useRef(false);
  const newOrdersToastGuardRef = React.useRef(false);
  const isPrimaryInstanceRef = React.useRef(false);
  const claimPrimaryInstance = () => {
    try {
      if (!window.__packagingPrimary) {
        window.__packagingPrimary = true;
        isPrimaryInstanceRef.current = true;
      }
    } catch { }
  };
  // Reclamar instancia primaria y liberarla al desmontar
  useEffect(() => {
    claimPrimaryInstance();
    return () => {
      try {
        if (isPrimaryInstanceRef.current) {
          delete window.__packagingPrimary;
        }
      } catch { }
    };
  }, []);
  useEffect(() => {
    // Solo escuchar cuando estamos viendo "Pendientes" y esta es la instancia primaria
    if (activeTab !== 'pending' || !isPrimaryInstanceRef.current) return;

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
        if (to === 'en_empaque') {
          // Actualizar lista en silencio y notificar UNA sola vez por evento
          try { loadPendingOrders(true); } catch { }

          if (isPrimaryInstanceRef.current) {
            const now = Date.now();
            const globalLast = typeof window !== 'undefined' ? (window.__packagingLastToastAt || 0) : 0;
            if (!newOrdersToastGuardRef.current && now - Math.max(globalLast, (lastNewToastAtRef.current || 0)) > 4000) {
              newOrdersToastGuardRef.current = true;
              lastNewToastAtRef.current = now;
              try { if (typeof window !== 'undefined') window.__packagingLastToastAt = now; } catch { }
              const label = payload?.order_number ? `Pedido ${payload.order_number}` : 'Nuevo pedido';
              toast.success(`🆕 ${label} por empacar`, { id: `packaging-order-${payload?.orderId || ''}`, duration: 4000 });
              setTimeout(() => { newOrdersToastGuardRef.current = false; }, 5000);
            }
          }
        } else if (to === 'listo_para_entrega' || to === 'empacado') {
          // un pedido salió de la cola de empaque
          loadPendingOrders(true);
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
  }, [activeTab]);

  // Auto-refresh/polling: refrescar pendientes y estadísticas sin recargar
  useEffect(() => {
    // Evitar duplicados si hay doble montaje (StrictMode) o múltiples instancias
    if (!isPrimaryInstanceRef.current) return;
    let timer;
    const tick = async (silentRun = false) => {
      try {
        if (document.visibilityState !== 'visible') return;
        if (activeTab === 'pending') {
          await loadPendingOrders(silentRun); // generar alertas si hay nuevos
          await loadStats(silentRun);
        }
      } catch (e) {
        // no romper el intervalo por errores intermitentes
      }
    };
    timer = setInterval(() => tick(false), 10000); // cada 10s
    // primer ciclo en silencio para evitar toasts dobles al ingresar
    tick(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tick(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        await loadPendingOrders();
      }
      await loadStats();
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando información');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingOrders = async (silent = false) => {
    try {
      const pendingUrl = `/api/packaging/pending-orders?t=${Date.now()}`;
      const response = await fetch(pendingUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        const incoming = Array.isArray(data.data) ? data.data : [];
        // Orden FIFO estable en cliente: updated_at ASC, luego created_at ASC, luego id ASC
        const sorted = [...incoming].sort((a, b) => {
          const ua = new Date(a?.updated_at || a?.created_at || 0).getTime();
          const ub = new Date(b?.updated_at || b?.created_at || 0).getTime();
          if (ua !== ub) return ua - ub;
          const ca = new Date(a?.created_at || 0).getTime();
          const cb = new Date(b?.created_at || 0).getTime();
          if (ca !== cb) return ca - cb;
          return (a?.id || 0) - (b?.id || 0);
        });
        // Detectar nuevos pedidos
        try {
          const incomingIds = sorted.map(o => o.id);
          // Evitar alertas al primer render: solo inicializamos snapshot y salimos
          if (!initializedRef.current) {
            setPrevPendingIds(incomingIds);
            setPendingOrders(sorted);
            initializedRef.current = true;
            return;
          }
          const prevIds = (prevPendingIds || []);
          // Evitar alerta en la primera carga (solo alertar cuando hay ingresos posteriores)
          const isInitialLoad = (pendingOrders || []).length === 0 && (prevPendingIds || []).length === 0;
          const newIds = incomingIds.filter(id => !prevIds.includes(id));
          if (isPrimaryInstanceRef.current && !silent && !isInitialLoad && newIds.length > 0) {
            const now = Date.now();
            const globalLast = typeof window !== 'undefined' ? (window.__packagingLastToastAt || 0) : 0;
            if (!newOrdersToastGuardRef.current && now - Math.max(globalLast, (lastNewToastAtRef.current || 0)) > 4000) {
              // Guardar primero para evitar condición de carrera entre múltiples llamadas concurrentes y entre instancias
              newOrdersToastGuardRef.current = true;
              lastNewToastAtRef.current = now;
              try { if (typeof window !== 'undefined') window.__packagingLastToastAt = now; } catch { }
              toast.success(`🆕 Nuevos pedidos por empacar: ${newIds.length}`, { id: 'packaging-new-orders', duration: 4000 });
              setTimeout(() => { newOrdersToastGuardRef.current = false; }, 5000);
            }
          }
          setPrevPendingIds(incomingIds);
        } catch { }
        setPendingOrders(sorted);
      } else {
        throw new Error('Error cargando pedidos pendientes');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando pedidos pendientes');
    }
  };

  const loadStats = async (silent = false) => {
    try {
      const statsUrl = `/api/packaging/stats?t=${Date.now()}`;
      const response = await fetch(statsUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        const next = data.data || {};
        // Alertas útiles: incremento en pendientes/revisión
        try {
          if (prevStatsSnapshot) {
            // Silenciar alertas basadas en estadísticas para evitar notificaciones excesivas en Empaque
          }
          setPrevStatsSnapshot(next);
        } catch { }
        setStats(next);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // =========================
  // Helpers de bloqueo empaque
  // =========================
  const heartbeatRef = React.useRef(null);
  const currentLockOrderIdRef = React.useRef(null);

  const clearHeartbeat = () => {
    try {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    } catch { }
  };

  const startHeartbeat = async (orderId) => {
    clearHeartbeat();
    // Enviar latido inmediato y luego programar cada 30s
    const token = localStorage.getItem('token');
    const sendBeat = async () => {
      try {
        const resp = await fetch(`/api/packaging/heartbeat/${orderId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ttl_minutes: 10 })
        });
        if (!resp.ok) {
          // Si perdimos el lock, detener latidos y notificar
          clearHeartbeat();
          const err = await resp.json().catch(() => ({}));
          toast.error(err?.message || 'Perdiste el lock de empaque de este pedido');
        }
      } catch (e) {
        // Silencioso: red seguirá intentando en el próximo intervalo
        console.warn('heartbeat error', e?.message || e);
      }
    };
    await sendBeat();
    heartbeatRef.current = setInterval(sendBeat, 30 * 1000);
  };

  const acquirePackagingLock = async (orderId) => {
    const token = localStorage.getItem('token');
    const resp = await fetch(`/api/packaging/lock/${orderId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ttl_minutes: 10 })
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const lockedBy = payload?.data?.packaging_lock_user_id;
      if (String(lockedBy) === String(user?.id)) {
        // El lock pertenece a este mismo usuario: reanudar en cliente
        return { success: false, sameOwner: true, data: payload?.data };
      }
      throw new Error(payload?.message || 'No se pudo adquirir el lock (otro usuario está empacando)');
    }
    return { success: true, data: payload?.data || payload };
  };

  const pausePackaging = async (orderId, reason = 'pausa_usuario') => {
    let ok = false;
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/packaging/pause/${orderId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err?.message || 'No se pudo pausar el empaque');
        return false;
      }
      ok = true;
      toast.success('Empaque pausado');
      return true;
    } catch (e) {
      console.warn('pausePackaging error', e?.message || e);
      toast.error('Error pausando empaque');
      return false;
    } finally {
      if (ok) {
        clearHeartbeat();
        currentLockOrderIdRef.current = null;
      }
    }
  };

  const blockPackaging = async (orderId, type, reason = '') => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/packaging/block/${orderId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, reason })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.message || 'No se pudo bloquear el pedido');
      toast.success(data?.message || 'Pedido bloqueado');
    } catch (e) {
      toast.error(e?.message || 'Error bloqueando pedido');
    } finally {
      clearHeartbeat();
      currentLockOrderIdRef.current = null;
      setActiveTab('pending');
      setCurrentOrder(null);
      setChecklist([]);
      try { await loadData(); } catch { }
    }
  };

  // Limpieza al desmontar o al salir de checklist
  React.useEffect(() => {
    return () => {
      const orderId = currentLockOrderIdRef.current;
      if (orderId) {
        pausePackaging(orderId, 'cleanup_unmount');
      }
    };
  }, []);

  const startPackaging = async (orderId) => {
    try {
      // 1) Tomar lock exclusivo (o reanudar si el lock es del mismo usuario)
      const lockRes = await acquirePackagingLock(orderId);
      if (lockRes?.sameOwner) {
        currentLockOrderIdRef.current = orderId;
        await startHeartbeat(orderId);
        await loadChecklist(orderId);
        setActiveTab('checklist');
        toast.success('Reanudando empaque en progreso.');
        return;
      }
      currentLockOrderIdRef.current = orderId;
      await startHeartbeat(orderId);

      // 2) Asegurar estado en_preparacion (flujo actual)
      const response = await fetch(`/api/packaging/start/${orderId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await loadChecklist(orderId);
        setActiveTab('checklist');
        toast.success('Lock adquirido. Empieza a empacar.');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error iniciando empaque');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error?.message || 'Error iniciando proceso de empaque');
    }
  };

  const loadChecklist = async (orderId) => {
    try {
      const response = await fetch(`/api/packaging/checklist/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentOrder(data.data.order);
        setChecklist(data.data.checklist);
        // Reiniciar bandera de evidencia al cambiar de pedido
        setHasEvidenceUploaded(false);
      } else {
        throw new Error('Error cargando checklist');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando checklist');
    }
  };

  const verifyItem = async (itemId, itemData) => {
    try {
      const response = await fetch(`/api/packaging/verify-item/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(itemData)
      });

      if (response.ok) {
        toast.success('Item verificado');
        await loadChecklist(currentOrder.id);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.message || '';
        if (response.status === 409 && /empaque activo/i.test(msg) && /completed/i.test(msg)) {
          // Idempotencia: el backend ya dejó el pedido en 'completed'. Re-sincronizar y tratar como éxito.
          await loadChecklist(currentOrder.id);
          toast.success('Estado de empaque actualizado');
          return;
        }
        toast.error(errorData.message || 'Error verificando item');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error verificando item');
    }
  };

  const completePackaging = async (orderId, notes, qualityPassed) => {
    try {
      const response = await fetch(`/api/packaging/complete/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          packaging_notes: notes,
          quality_check_passed: qualityPassed
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        // Backend libera lock best-effort; limpiamos heartbeat local
        clearHeartbeat();
        currentLockOrderIdRef.current = null;
        setActiveTab('pending');
        setCurrentOrder(null);
        setChecklist([]);
        await loadData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error completando empaque');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error completando empaque');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'requires_review': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'Pendiente',
      'in_progress': 'En Proceso',
      'completed': 'Completado',
      'requires_review': 'Requiere Revisión'
    };
    return labels[status] || status;
  };

  // Badge de pendientes con colores diferenciados
  const getPendingBadgeClass = (pending, total) => {
    if (!Number.isFinite(pending) || pending <= 0) return 'bg-green-100 text-green-800';
    const ratio = total ? pending / total : 1;
    if (ratio >= 0.75 || pending >= 10) return 'bg-red-100 text-red-800';
    if (ratio >= 0.4 || pending >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getPendingLabel = (pending) => {
    return pending <= 0 ? 'Listo' : `Pendientes ${pending}`;
  };

  const renderStats = () => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-4 md:gap-6 mb-4 md:mb-6">
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
        <div className="flex items-center">
          <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg">
            <Icons.Package className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-600" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-[11px] sm:text-sm text-gray-600">Pendientes</p>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.pending_packaging || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
        <div className="flex items-center">
          <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
            <Icons.Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-[11px] sm:text-sm text-gray-600">En Empaque</p>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.in_packaging || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
        <div className="flex items-center">
          <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
            <Icons.CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-600" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-[11px] sm:text-sm text-gray-600">Listos</p>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.ready_shipping || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6 col-span-3 sm:col-span-1">
        <div className="flex items-center">
          <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
            <Icons.AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-red-600" />
          </div>
          <div className="ml-3 sm:ml-4">
            <p className="text-[11px] sm:text-sm text-gray-600">Requieren Revisión</p>
            <p className="text-lg sm:text-xl md:text-2xl font-semibold">{stats.requires_review || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPendingOrders = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Pedidos Pendientes de Empaque</h3>
        <p className="text-sm text-gray-600 mt-1">Pedidos que llegaron desde logística</p>
      </div>

      {/* Lista móvil (cards) */}
      <div className="md:hidden p-4 space-y-3">
        {pendingOrders.map((order) => (
          <div key={order.id} className="rounded-lg border bg-white shadow-sm p-3">
            <div className="flex items-start justify-between">
              <div className="pr-3 min-w-0">
                <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                <p className="text-sm text-gray-700 truncate">{order.customer_name}</p>
                {(() => {
                  const roleText = order.packaging_locked_by_role
                    ? ` (${String(order.packaging_locked_by_role).toLowerCase() === 'logistica' ? 'Logística' : 'Empaque'})`
                    : '';
                  if (order.packaging_status === 'in_progress' && order.packaging_lock_user_id) {
                    return (
                      <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        <Icons.Lock className="w-3 h-3 mr-1" />
                        Empacando: {order.packaging_locked_by || 'Usuario'}{roleText}
                      </div>
                    );
                  }
                  if (order.packaging_status === 'paused') {
                    return (
                      <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                        <Icons.Pause className="w-3 h-3 mr-1" />
                        Pausado
                      </div>
                    );
                  }
                  if (order.packaging_status === 'blocked_faltante') {
                    return (
                      <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                        <Icons.AlertTriangle className="w-3 h-3 mr-1" />
                        Bloqueado: Faltante
                      </div>
                    );
                  }
                  if (order.packaging_status === 'blocked_novedad') {
                    return (
                      <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                        <Icons.AlertOctagon className="w-3 h-3 mr-1" />
                        Bloqueado: Novedad
                      </div>
                    );
                  }
                  return null;
                })()}
                {(() => {
                  const pending = typeof order.pending_items === 'number'
                    ? order.pending_items
                    : Math.max((order.item_count || 0) - (order.verified_items || 0), 0);
                  return (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
                      </span>
                      <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${getPendingBadgeClass(pending, order.item_count)}`}>
                        {getPendingLabel(pending)}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-base font-bold text-green-600">${order.total_amount?.toLocaleString('es-CO')}</p>
              </div>
            </div>
            <button
              onClick={() => startPackaging(order.id)}
              className={`mt-3 w-full inline-flex items-center justify-center px-3 py-2 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${(order.started ? true : false)
                  ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
            >
              <Icons.Play className="w-4 h-4 mr-2" /> {(order.started ? true : false) ? 'Continuar Empacando' : 'Iniciar Empaque'}
            </button>
          </div>
        ))}
        {pendingOrders.length === 0 && (
          <div className="text-center py-8">
            <Icons.Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pedidos pendientes</h3>
            <p className="mt-1 text-sm text-gray-500">Todos los pedidos están empacados o en proceso</p>
          </div>
        )}
      </div>

      {/* Tabla escritorio */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pedido
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pendingOrders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                    <div className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{order.customer_name}</div>
                  {(() => {
                    const roleText = order.packaging_locked_by_role
                      ? ` (${String(order.packaging_locked_by_role).toLowerCase() === 'logistica' ? 'Logística' : 'Empaque'})`
                      : '';
                    if (order.packaging_status === 'in_progress' && order.packaging_lock_user_id) {
                      return (
                        <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                          <Icons.Lock className="w-3 h-3 mr-1" />
                          Empacando: {order.packaging_locked_by || 'Usuario'}{roleText}
                        </div>
                      );
                    }
                    if (order.packaging_status === 'paused') {
                      return (
                        <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                          <Icons.Pause className="w-3 h-3 mr-1" />
                          Pausado
                        </div>
                      );
                    }
                    if (order.packaging_status === 'blocked_faltante') {
                      return (
                        <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          <Icons.AlertTriangle className="w-3 h-3 mr-1" />
                          Bloqueado: Faltante
                        </div>
                      );
                    }
                    if (order.packaging_status === 'blocked_novedad') {
                      return (
                        <div className="mt-1 text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                          <Icons.AlertOctagon className="w-3 h-3 mr-1" />
                          Bloqueado: Novedad
                        </div>
                      );
                    }
                    return null;
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{order.item_count} items</div>
                  {(() => {
                    const pending = typeof order.pending_items === 'number'
                      ? order.pending_items
                      : Math.max((order.item_count || 0) - (order.verified_items || 0), 0);
                    return (
                      <div className="mt-0.5">
                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${getPendingBadgeClass(pending, order.item_count)}`}>
                          {getPendingLabel(pending)}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">${order.total_amount?.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => startPackaging(order.id)}
                    className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${(order.started ? true : false)
                        ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                        : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                      }`}
                  >
                    <Icons.Play className="w-4 h-4 mr-2" /> {(order.started ? true : false) ? 'Continuar Empacando' : 'Iniciar Empaque'}
                  </button>
                  {order.packaging_status === 'in_progress' && order.packaging_lock_user_id && String(order.packaging_lock_user_id) !== String(user?.id) && (
                    <div className="mt-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-1">
                      El pedido está siendo empacado por: <span className="font-semibold">{order.packaging_locked_by || 'Usuario'}</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pendingOrders.length === 0 && (
          <div className="text-center py-8">
            <Icons.Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pedidos pendientes</h3>
            <p className="mt-1 text-sm text-gray-500">Todos los pedidos están empacados o en proceso</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderChecklist = () => {
    if (!currentOrder) return null;

    const verifiedCount = checklist.filter(item => item.is_verified).length;
    const totalCount = checklist.length;
    const progress = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Información del pedido */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Checklist de Empaque - Pedido {currentOrder.order_number}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!currentOrder) return;
                  const toastId = toast.loading('Sincronizando con SIIGO...');
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/orders/${currentOrder.id}/sync`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    const data = await res.json();

                    if (res.ok) {
                      toast.success('Sincronización completada', { id: toastId });
                      // Recargar checklist
                      await loadChecklist(currentOrder.id);
                    } else {
                      toast.error(data.message || 'Error al sincronizar', { id: toastId });
                    }
                  } catch (error) {
                    console.error('Error syncing:', error);
                    toast.error('Error de conexión al sincronizar', { id: toastId });
                  }
                }}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="Sincronizar cantidades desde SIIGO (Mantiene verificaciones)"
              >
                <Icons.RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={async () => {
                  if (!currentOrder) return;
                  const reason = prompt('Motivo de pausa (opcional):', 'pausa_usuario') || 'pausa_usuario';
                  const ok = await pausePackaging(currentOrder.id, reason);
                  if (ok) {
                    setActiveTab('pending');
                    setCurrentOrder(null);
                    setChecklist([]);
                    setHasEvidenceUploaded(false);
                  }
                }}
                className="px-3 py-1 rounded text-sm bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                title="Pausar y liberar para que otro empacador pueda continuar"
              >
                Pausar
              </button>
              <button
                onClick={async () => {
                  if (!currentOrder) return;
                  const reason = prompt('Describe la novedad:', 'producto con novedad') || 'novedad';
                  await blockPackaging(currentOrder.id, 'novedad', reason);
                }}
                className="px-3 py-1 rounded text-sm bg-red-100 text-red-800 hover:bg-red-200"
                title="Bloquear por novedad y liberar lock"
              >
                Bloquear Novedad
              </button>
              <button
                onClick={async () => {
                  if (!currentOrder) return;
                  const reason = prompt('Describe el faltante:', 'faltante de producto') || 'faltante';
                  await blockPackaging(currentOrder.id, 'faltante', reason);
                }}
                className="px-3 py-1 rounded text-sm bg-orange-100 text-orange-800 hover:bg-orange-200"
                title="Bloquear por faltante y liberar lock"
              >
                Bloquear Faltante
              </button>
              <button
                onClick={async () => {
                  if (currentOrder) {
                    const ok = await pausePackaging(currentOrder.id, 'salir_checklist');
                    if (!ok) return;
                  }
                  setActiveTab('pending');
                  setCurrentOrder(null);
                  setChecklist([]);
                  setHasEvidenceUploaded(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {currentOrder.packaging_status === 'requires_review' && (
            <div className="mb-4 p-3 border border-yellow-300 bg-yellow-50 rounded flex items-start">
              <Icons.AlertTriangle className="w-5 h-5 text-yellow-700 mr-2 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-900 font-medium">Pedido actualizado desde Facturación</p>
                <p className="text-xs text-yellow-800">
                  Se detectaron cambios (sabor/presentación). Los nuevos ítems deben ser escaneados obligatoriamente.
                </p>
                <div className="mt-2">
                  <button
                    onClick={async () => {
                      const toastId = toast.loading('Sincronizando con SIIGO...');
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch(`/api/orders/${currentOrder.id}/sync`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });
                        const data = await res.json();

                        if (res.ok) {
                          toast.success('Sincronización completada', { id: toastId });
                          await loadChecklist(currentOrder.id);
                        } else {
                          toast.error(data.message || 'Error al sincronizar', { id: toastId });
                        }
                      } catch (error) {
                        console.error('Error syncing:', error);
                        toast.error('Error de conexión al sincronizar', { id: toastId });
                      }
                    }}
                    className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                  >
                    Refrescar checklist
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Cliente</p>
              <p className="font-medium">{currentOrder.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="font-medium">${currentOrder.total_amount?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Progreso</p>
              <p className="font-medium">{verifiedCount}/{totalCount} items</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Estado</p>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentOrder.packaging_status)}`}>
                {getStatusLabel(currentOrder.packaging_status)}
              </span>
            </div>
            {(currentOrder.invoice_number || currentOrder.siigo_invoice_number || currentOrder.invoice_code || currentOrder.siigo_invoice) && (
              <div className="col-span-2 md:col-span-2">
                <p className="text-sm text-gray-600">Factura SIIGO</p>
                <p className="font-medium">{currentOrder.invoice_number || currentOrder.siigo_invoice_number || currentOrder.invoice_code || currentOrder.siigo_invoice}</p>
              </div>
            )}
          </div>

          {/* Barra de progreso */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Notas del Pedido SIIGO */}
          {currentOrder.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Icons.FileText className="w-4 h-4 mr-2" />
                  Notas del Pedido Original
                </h4>
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Información importante del cliente:</strong>
                </p>
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentOrder.notes}</p>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  💡 Esta información puede contener detalles sobre instrucciones especiales de empaque,
                  manejo del producto u otras observaciones importantes para el proceso.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Validación de Empaque (default: código de barras con foco) */}
        <FastPackagingValidation
          orderId={currentOrder.id}
          checklist={checklist}
          onVerifyItem={(itemId, itemData) => verifyItem(itemId, itemData)}
          onVerifyAll={() => verifyAllItems()}
          onReload={() => loadChecklist(currentOrder.id)}
          autoFocusScanner={true}
        />

        {/* Evidencia fotográfica de empaque */}
        <PackagingEvidenceCapture orderId={currentOrder.id} onEvidenceChange={(count) => setHasEvidenceUploaded(count > 0)} />

        {/* Finalizar empaque - Siempre disponible cuando hay items */}
        {totalCount > 0 && (
          <CompletePackagingForm
            orderId={currentOrder.id}
            onComplete={(notes, qualityPassed) => completePackaging(currentOrder.id, notes, qualityPassed)}
            verifiedCount={verifiedCount}
            totalCount={totalCount}
            packagingStatus={currentOrder.packaging_status}
            requireEvidenceUploaded={true}
            hasEvidence={hasEvidenceUploaded}
          />
        )}
      </div>
    );
  };

  const verifyAllItems = async () => {
    try {
      const response = await fetch(`/api/packaging/verify-all/${currentOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          verification_notes: 'Verificación rápida - Todo correcto'
        })
      });

      if (response.ok) {
        toast.success('Todos los items verificados correctamente');
        await loadChecklist(currentOrder.id);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error verificando items');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error verificando items');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Empaque</h1>
          <p className="mt-2 text-gray-600">
            Control de calidad y verificación de productos antes del envío
          </p>
        </div>

        {/* Estadísticas */}
        {renderStats()}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Icons.Package className="w-5 h-5 inline mr-2" />
              Pedidos Pendientes
            </button>
            {currentOrder && (
              <button
                onClick={() => setActiveTab('checklist')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'checklist'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Icons.CheckSquare className="w-5 h-5 inline mr-2" />
                Checklist Activo
              </button>
            )}
          </nav>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icons.Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Cargando...</span>
          </div>
        ) : (
          <>
            {activeTab === 'pending' && renderPendingOrders()}
            {activeTab === 'checklist' && renderChecklist()}
          </>
        )}
      </div>
    </div>
  );
};

// Componente para item individual del checklist
const PackagingItem = ({ item, onVerify }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    packed_quantity: item.packed_quantity || '',
    packed_weight: item.packed_weight || '',
    packed_flavor: item.packed_flavor || '',
    packed_size: item.packed_size || '',
    verification_notes: item.verification_notes || '',
    is_verified: item.is_verified || false
  });

  const handleSave = () => {
    onVerify(formData);
  };

  const availableFlavors = item.available_flavors ? JSON.parse(item.available_flavors) : [];
  const qualityChecks = item.quality_checks ? JSON.parse(item.quality_checks) : [];
  const commonErrors = item.common_errors ? JSON.parse(item.common_errors) : [];

  return (
    <div className={`bg-white rounded-lg shadow border-l-4 ${item.is_verified ? 'border-green-500' : 'border-red-500'}`}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${item.is_verified ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <h4 className="text-lg font-medium text-gray-900">{item.item_name}</h4>
              {item.is_verified && (
                <Icons.CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Cantidad:</span> {item.required_quantity} {item.required_unit}
              </div>
              {item.required_weight && (
                <div>
                  <span className="font-medium">Peso:</span> {item.required_weight}kg
                </div>
              )}
              {item.required_flavor && (
                <div>
                  <span className="font-medium">Sabor:</span> {item.required_flavor}
                </div>
              )}
              {item.required_size && (
                <div>
                  <span className="font-medium">Tamaño:</span> {item.required_size}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? (
              <Icons.ChevronUp className="w-5 h-5" />
            ) : (
              <Icons.ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-6 space-y-6">
            {/* Instrucciones */}
            {item.packaging_instructions && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">📋 Instrucciones de Empaque</h5>
                <p className="text-blue-800 text-sm">{item.packaging_instructions}</p>
              </div>
            )}

            {/* Controles de calidad */}
            {qualityChecks.length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h5 className="font-medium text-green-900 mb-2">✅ Controles de Calidad</h5>
                <ul className="text-green-800 text-sm space-y-1">
                  {qualityChecks.map((check, index) => (
                    <li key={index}>• {check}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errores comunes */}
            {commonErrors.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h5 className="font-medium text-yellow-900 mb-2">⚠️ Errores Comunes a Evitar</h5>
                <ul className="text-yellow-800 text-sm space-y-1">
                  {commonErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Formulario de verificación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad Empacada
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.packed_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, packed_quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${item.required_quantity} ${item.required_unit}`}
                />
              </div>

              {item.required_weight && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Peso Empacado (kg)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.packed_weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, packed_weight: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`${item.required_weight}kg`}
                  />
                </div>
              )}

              {availableFlavors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sabor Empacado
                  </label>
                  <select
                    value={formData.packed_flavor}
                    onChange={(e) => setFormData(prev => ({ ...prev, packed_flavor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar sabor</option>
                    {availableFlavors.map((flavor) => (
                      <option key={flavor} value={flavor}>{flavor}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas de Verificación
                </label>
                <textarea
                  value={formData.verification_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, verification_notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`verified-${item.id}`}
                  checked={formData.is_verified}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_verified: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`verified-${item.id}`} className="ml-2 text-sm text-gray-900">
                  Item verificado y correcto
                </label>
              </div>

              <button
                onClick={handleSave}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Icons.Save className="w-4 h-4 mr-2" />
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para finalizar empaque
const CompletePackagingForm = ({ orderId, onComplete, verifiedCount, totalCount, packagingStatus, requireEvidenceUploaded = false, hasEvidence = false }) => {
  const [notes, setNotes] = useState('');
  const [qualityPassed, setQualityPassed] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = () => {
    const mustVerifyAll = packagingStatus === 'requires_review';
    if (mustVerifyAll && verifiedCount !== totalCount) {
      toast.error('Debes verificar todos los items antes de finalizar.');
      setShowConfirm(false);
      return;
    }
    if (requireEvidenceUploaded && !hasEvidence) {
      toast.error('Debes subir al menos una foto de evidencia de empaque antes de finalizar.');
      setShowConfirm(false);
      return;
    }
    if (showConfirm) {
      onComplete(notes, qualityPassed);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  const isPartiallyVerified = verifiedCount > 0 && verifiedCount < totalCount;
  const isFullyVerified = verifiedCount === totalCount;
  const mustVerifyAll = packagingStatus === 'requires_review';
  const canFinalize = (!requireEvidenceUploaded || hasEvidence) && (!mustVerifyAll || isFullyVerified);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Finalizar Empaque
        </h3>
        <div className="flex items-center space-x-2">
          {isFullyVerified ? (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              ✅ Todo verificado
            </span>
          ) : isPartiallyVerified ? (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
              ⚠️ Parcial {verifiedCount}/{totalCount}
            </span>
          ) : (
            <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
              ❌ No verificado
            </span>
          )}
        </div>
      </div>

      {/* Advertencia para empaque parcial */}
      {isPartiallyVerified && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <Icons.AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <div>
              <h4 className="font-medium text-yellow-900">Empaque Parcial</h4>
              <p className="text-sm text-yellow-800 mt-1">
                Solo {verifiedCount} de {totalCount} items están verificados. ¿Deseas continuar?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Revisión obligatoria por cambios SIIGO */}
      {mustVerifyAll && !isFullyVerified && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <Icons.AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h4 className="font-medium text-red-900">Verificación obligatoria</h4>
              <p className="text-sm text-red-800 mt-1">
                Cambios desde Facturación (SIIGO). Debes escanear/verificar todos los items antes de finalizar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Advertencia para empaque sin verificar */}
      {verifiedCount === 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <Icons.XCircle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h4 className="font-medium text-red-900">Sin Verificar</h4>
              <p className="text-sm text-red-800 mt-1">
                Ningún item ha sido verificado aún. Considera verificar al menos algunos antes de finalizar.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Control de Calidad Final
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={qualityPassed === true}
                onChange={() => setQualityPassed(true)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-900">✅ Aprobado - Enviar a reparto</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={qualityPassed === false}
                onChange={() => setQualityPassed(false)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-900">❌ Requiere revisión</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas Finales del Empaque
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Observaciones generales del proceso de empaque..."
          />
        </div>

        {showConfirm && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <Icons.AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
              <h4 className="font-medium text-yellow-900">Confirmar Finalización</h4>
            </div>
            <p className="text-yellow-800 text-sm mt-2">
              {qualityPassed
                ? '¿Estás seguro de que quieres marcar este empaque como completado y enviarlo a reparto?'
                : '¿Estás seguro de que quieres marcar este empaque como que requiere revisión?'
              }
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canFinalize}
            className={`px-4 py-2 border border-transparent rounded-md text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${qualityPassed
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              }`}
            title={
              (!hasEvidence && requireEvidenceUploaded) ? 'Debe subir al menos 1 foto de evidencia' :
                (!isFullyVerified && mustVerifyAll) ? 'Debe verificar todos los items' :
                  undefined
            }
          >
            <Icons.CheckCircle className="w-4 h-4 mr-2 inline" />
            {showConfirm ? 'Confirmar' : 'Finalizar Empaque'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente de Validación Dual
const FastPackagingValidation = ({ orderId, checklist, onVerifyItem, onVerifyAll, onReload, autoFocusScanner = false }) => {
  const [validationMode, setValidationMode] = useState('barcode'); // default: barcode
  const [globalNotes, setGlobalNotes] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanningActive, setScanningActive] = useState(false);
  const barcodeInputRef = React.useRef(null);
  const itemRefs = React.useRef({});
  const [highlightedId, setHighlightedId] = useState(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [packingMode, setPackingMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  React.useEffect(() => {
    if (autoFocusScanner) {
      setValidationMode('barcode');
      setTimeout(() => {
        try { barcodeInputRef.current?.focus(); setScanningActive(true); } catch { }
      }, 0);
    }
  }, [autoFocusScanner]);

  // Enfocar siempre el input cuando cambia el modo o la lista
  React.useEffect(() => {
    if (validationMode === 'barcode') {
      setTimeout(() => {
        try { barcodeInputRef.current?.focus(); } catch { }
      }, 0);
    }
  }, [validationMode, checklist]);

  // Al cambiar a modo 'barcode', limpiar timers de guardado parcial y evitar que sobrescriban conteos del escaneo QR
  React.useEffect(() => {
    if (validationMode === 'barcode') {
      try { flushPendingSaves(true); } catch { }
      try {
        const ids = Object.keys(saveDebounceRef.current || {});
        ids.forEach((id) => {
          try { clearTimeout(saveDebounceRef.current[id]); } catch { }
          delete saveDebounceRef.current[id];
        });
      } catch { }
    }
  }, [validationMode]);

  // Bloqueo de scroll manual en modo "Empacando" + barcode
  React.useEffect(() => {
    if (!packingMode || validationMode !== 'barcode') return;
    const preventScroll = (e) => {
      const t = e && e.target;
      if (t && typeof t.closest === 'function' && t.closest('#scannerBar')) {
        // Permitir gestos dentro de la barra flotante (botones, scroll horizontal del input, etc.)
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [packingMode, validationMode]);

  // Añadir/remover clase global para bloquear overscroll en móvil/iPad cuando se empaca
  React.useEffect(() => {
    try {
      if (packingMode && validationMode === 'barcode') {
        document.body.classList.add('packing-lock');
      } else {
        document.body.classList.remove('packing-lock');
      }
    } catch { }
    return () => {
      try { document.body.classList.remove('packing-lock'); } catch { }
    };
  }, [packingMode, validationMode]);

  // Refocus continuo del input mientras se empaca
  React.useEffect(() => {
    if (!packingMode || validationMode !== 'barcode') return;
    const refocus = (e) => {
      try {
        const t = e && e.target;
        if (t && t.closest && t.closest('input, textarea, select, button, a, [contenteditable]')) {
          return;
        }
      } catch { }
      try { barcodeInputRef.current?.focus(); } catch { }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        try { barcodeInputRef.current?.focus(); } catch { }
      }
    };
    window.addEventListener('click', refocus, true);
    window.addEventListener('focus', refocus, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('click', refocus, true);
      window.removeEventListener('focus', refocus, true);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [packingMode, validationMode]);

  // Helpers: autoscroll al item y resaltado temporal
  const scrollToItem = (id) => {
    if (!autoScrollEnabled) return;
    const el = itemRefs.current?.[id];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const highlightItem = (id) => {
    setHighlightedId(id);
    setTimeout(() => {
      setHighlightedId(prev => (prev === id ? null : prev));
    }, 1200);
  };

  const [itemCounters, setItemCounters] = useState({});
  const itemCountersRef = React.useRef({});
  React.useEffect(() => { itemCountersRef.current = itemCounters; }, [itemCounters]);
  const checklistRef = React.useRef([]);
  React.useEffect(() => { checklistRef.current = checklist; }, [checklist]);

  // Debounce por item para guardar progreso parcial sin saturar el backend
  const saveDebounceRef = React.useRef({});
  // Asegurar persistencia: forzar guardado de pendientes al desmontar/navegar
  const flushPendingSaves = (silent = false) => {
    const pendingIds = Object.keys(saveDebounceRef.current || {});
    if (!pendingIds.length) return;
    pendingIds.forEach((id) => {
      const itemId = Number(id);
      const item = (checklistRef.current || []).find(it => it.id === itemId);
      const required = Math.floor(parseFloat((item && (item.required_scans || item.required_quantity)) || 0)) || 0;
      try { clearTimeout(saveDebounceRef.current[itemId]); } catch { }
      delete saveDebounceRef.current[itemId];
      const count = (itemCountersRef.current && itemCountersRef.current[itemId]) || 0;
      savePartial(itemId, count, required || null);
    });
    if (!silent) {
      try { console.debug('flushPendingSaves: items', pendingIds); } catch { }
    }
  };
  React.useEffect(() => {
    return () => {
      try { flushPendingSaves(true); } catch (e) { console.warn('flushPendingSaves cleanup error', e); }
    };
  }, []);
  React.useEffect(() => {
    const handler = () => {
      try { flushPendingSaves(true); } catch { }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const savePartial = async (itemId, count, required) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/packaging/partial/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scanned_count: count,
          required_scans: required ?? undefined
        })
      });
      // No toasts aquí para evitar ruido
    } catch (e) {
      console.error('Error guardando progreso parcial:', e);
    }
  };

  const scheduleSavePartial = (itemId, count, required) => {
    // Evitar carreras: si estamos en modo 'barcode', no programar guardado parcial manual
    if (validationMode === 'barcode') return;
    // Cancelar timer previo
    if (saveDebounceRef.current[itemId]) {
      clearTimeout(saveDebounceRef.current[itemId]);
    }
    // Programar nuevo
    saveDebounceRef.current[itemId] = setTimeout(() => {
      savePartial(itemId, count, required);
      delete saveDebounceRef.current[itemId];
    }, 350);
  };

  // Inicializar contadores desde lo que venga del backend (scanned_count persistido)
  React.useEffect(() => {
    const init = {};
    checklist.forEach(it => {
      const reqQty = Math.floor(parseFloat(it.required_quantity) || 0);
      if (reqQty > 1) {
        init[it.id] = typeof it.scanned_count === 'number' ? it.scanned_count : 0;
      }
    });
    setItemCounters(init);
  }, [checklist]);

  const verifyItemQuick = (item, isCorrect, overrideCount = null) => {
    // Llevar la vista al producto y resaltarlo al verificar manualmente
    scrollToItem(item.id);
    highlightItem(item.id);
    const requiredQty = Math.floor(parseFloat(item.required_quantity) || 0);

    // Si es cantidad > 1 y está marcando como correcto, verificar conteo
    if (requiredQty > 1 && isCorrect) {
      const currentCount = overrideCount !== null ? overrideCount : (itemCounters[item.id] || 0);
      if (currentCount !== requiredQty) {
        toast.error(`⚠️ Debe contar exactamente ${requiredQty} unidades. Actualmente: ${currentCount}`);
        // 🔊 Reproducir sonido de error para conteo incorrecto
        audioFeedback.playError();
        return;
      }
    }

    const finalCount = overrideCount !== null ? overrideCount : (itemCounters[item.id] || 0);
    const itemData = {
      packed_quantity: requiredQty > 1 ? finalCount : item.required_quantity,
      packed_weight: item.required_weight || '',
      packed_flavor: item.required_flavor || '',
      packed_size: item.required_size || '',
      verification_notes: isCorrect ? `Verificado - ${requiredQty > 1 ? `Contadas ${finalCount} unidades` : 'Todo correcto'}` : 'Requiere atención',
      is_verified: isCorrect
    };
    onVerifyItem(item.id, itemData);

    // 🔊 Reproducir sonido apropiado para verificación manual
    if (isCorrect) {
      if (requiredQty > 1 && finalCount === requiredQty) {
        audioFeedback.playComplete(); // Completado para múltiples
      } else {
        audioFeedback.playSuccess(); // Éxito para unitarios
      }
    } else {
      audioFeedback.playError(); // Error para marcados como incorrectos
    }

    // Limpiar contador después de verificar
    if (requiredQty > 1) {
      setItemCounters(prev => ({ ...prev, [item.id]: 0 }));
    }
  };

  const updateItemCounter = (item, increment) => {
    setItemCounters(prev => {
      const required = Math.floor(parseFloat(item.required_scans || item.required_quantity) || 0);
      const current = prev[item.id] || 0;
      const newCount = Math.max(0, required ? Math.min(required, current + increment) : Math.max(0, current + increment));
      const next = { ...prev, [item.id]: newCount };
      scheduleSavePartial(item.id, newCount, required || null);
      return next;
    });
  };

  const resetItemCounter = (item) => {
    setItemCounters(prev => {
      const next = { ...prev, [item.id]: 0 };
      const required = Math.floor(parseFloat(item.required_scans || item.required_quantity) || 0);
      scheduleSavePartial(item.id, 0, required || null);
      return next;
    });
  };

  // Entrada directa por teclado para el contador
  const clampCount = (item, n) => {
    const required = Math.floor(parseFloat(item.required_scans || item.required_quantity) || 0);
    const safe = Math.max(0, Number.isFinite(n) ? n : 0);
    return required ? Math.min(required, safe) : safe;
  };

  const handleCountInputChange = (item, raw) => {
    const digits = String(raw).replace(/[^\d]/g, '');
    const num = digits.length ? parseInt(digits, 10) : 0;
    const nextVal = clampCount(item, num);
    setItemCounters(prev => {
      const next = { ...prev, [item.id]: nextVal };
      const required = Math.floor(parseFloat(item.required_scans || item.required_quantity) || 0);
      scheduleSavePartial(item.id, nextVal, required || null);
      return next;
    });
  };

  const handleCountInputKeyDown = (e, item) => {
    const current = itemCountersRef.current[item.id] || 0;
    if (current < 3) {
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateItemCounter(item, 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateItemCounter(item, -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const required = Math.floor(parseFloat(item.required_quantity) || 0);
      const val = clampCount(item, current);
      if (required > 1 && val === required) {
        // Confirmar directamente si coincide con lo requerido
        verifyItemQuick(item, true, val);
      } else {
        // Solo confirmar edición
        e.currentTarget.blur && e.currentTarget.blur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.blur && e.currentTarget.blur();
    }
  };

  const handleBarcodeInput = async (barcode) => {
    // Buscar el item que coincida con el código de barras
    const matchedItem = checklist.find(item =>
      item.product_code === barcode ||
      item.barcode === barcode ||
      item.item_name.toLowerCase().includes(barcode.toLowerCase())
    );

    if (matchedItem && !matchedItem.is_verified) {
      // Mover la vista hacia el producto encontrado y resaltarlo
      scrollToItem(matchedItem.id);
      highlightItem(matchedItem.id);
      const requiredQty = Math.floor(parseFloat(matchedItem.required_quantity) || 0);

      if (requiredQty > 1) {
        // Para cantidades múltiples, incrementar el contador
        const currentCount = itemCounters[matchedItem.id] || 0;
        const newCount = currentCount + 1;

        // Actualizar el estado del contador
        setItemCounters(prev => ({ ...prev, [matchedItem.id]: newCount }));

        if (newCount === requiredQty) {
          // Si se completó el conteo, verificar automáticamente pasando el contador correcto
          verifyItemQuick(matchedItem, true, newCount);
          toast.success(`✅ ${matchedItem.item_name} - ${newCount}/${requiredQty} unidades completadas y verificado`);
          // 🔊 Reproducir sonido de completado
          audioFeedback.playComplete();
        } else if (newCount < requiredQty) {
          toast.success(`📊 ${matchedItem.item_name} - ${newCount}/${requiredQty} unidades escaneadas`);
          // 🔊 Reproducir sonido de progreso
          audioFeedback.playProgress();
        } else {
          // Si se excede, mostrar advertencia pero no incrementar más allá del requerido
          setItemCounters(prev => ({ ...prev, [matchedItem.id]: requiredQty }));
          toast.error(`⚠️ ${matchedItem.item_name} - Ya se escanearon todas las ${requiredQty} unidades requeridas`);
          // 🔊 Reproducir sonido de ya escaneado
          audioFeedback.playAlreadyScanned();
        }
      } else {
        // Para cantidad única, verificar directamente
        verifyItemQuick(matchedItem, true);
        toast.success(`✅ ${matchedItem.item_name} verificado por código de barras`);
        // 🔊 Reproducir sonido de éxito
        audioFeedback.playSuccess();
      }
      setBarcodeInput('');
    } else if (matchedItem && matchedItem.is_verified) {
      toast(`⚠️ ${matchedItem.item_name} ya está verificado`);
      scrollToItem(matchedItem.id);
      highlightItem(matchedItem.id);
      setBarcodeInput('');
      // 🔊 Reproducir sonido de ya escaneado
      audioFeedback.playAlreadyScanned();
    } else {
      toast.error(`❌ Código ${barcode} no encontrado en este pedido`);
      setBarcodeInput('');
      // 🔊 Reproducir sonido de error
      audioFeedback.playError();
    }
  };

  const handleBarcodeInputServer = async (barcode) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`/api/packaging/verify-barcode/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ barcode })
      });
      if (resp.ok) {
        const payload = await resp.json();
        const data = payload.data || {};
        const id = data.itemId;
        if (id) {
          scrollToItem(id);
          highlightItem(id);
        }
        if (data?.already_verified) {
          toast(payload.message || 'Producto ya verificado');
          audioFeedback.playAlreadyScanned();
        } else if (data?.is_verified) {
          toast.success(payload.message || 'Producto verificado completamente');
          audioFeedback.playComplete();
        } else {
          toast.success(payload.message || 'Escaneo registrado');
          audioFeedback.playProgress();
        }
        onReload && onReload();
      } else {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.message || `❌ Código ${barcode} no encontrado en este pedido`);
        audioFeedback.playError();
      }
    } catch (e) {
      console.error('Error procesando escaneo:', e);
      toast.error('Error procesando el escaneo');
      audioFeedback.playError();
    } finally {
      setBarcodeInput('');
    }
  };

  const handleBarcodeKeyPress = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      await handleBarcodeInputServer(barcodeInput.trim());
    }
  };

  const verifiedCount = checklist.filter(item => item.is_verified).length;
  const totalCount = checklist.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">⚡ Validación de Empaque</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {verifiedCount}/{totalCount} verificados
          </span>
          <div className="w-16 h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Selector de Modo de Validación */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">🔧 Modo de Validación</h4>
          <button
            onClick={() => audioFeedback.toggleEnabled()}
            className={`flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${audioFeedback.isEnabled()
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            title={`${audioFeedback.isEnabled() ? 'Desactivar' : 'Activar'} sonidos`}
          >
            {audioFeedback.isEnabled() ? (
              <>
                <Icons.Volume2 className="w-3 h-3 mr-1" />
                🔊 ON
              </>
            ) : (
              <>
                <Icons.VolumeX className="w-3 h-3 mr-1" />
                🔇 OFF
              </>
            )}
          </button>
        </div>
        <div className="flex space-x-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="validationMode"
              value="manual"
              checked={validationMode === 'manual'}
              onChange={(e) => setValidationMode(e.target.value)}
              className="mr-2 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex items-center">
              <Icons.Hand className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Manual Mejorada</span>
            </div>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="validationMode"
              value="barcode"
              checked={validationMode === 'barcode'}
              onChange={(e) => setValidationMode(e.target.value)}
              className="mr-2 text-purple-600 focus:ring-purple-500"
            />
            <div className="flex items-center">
              <Icons.Scan className="w-4 h-4 mr-2 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">Código de Barras</span>
            </div>
          </label>
        </div>
        {audioFeedback.isEnabled() && (
          <div className="mt-2 text-xs text-blue-700">
            🔊 Sonidos activados - Escucharás feedback de audio durante el escaneo
          </div>
        )}
      </div>

      {/* Modo Manual Mejorado */}
      {validationMode === 'manual' && (
        <>
          {/* Botones de acción rápida */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-blue-900">🚀 Acciones Rápidas</h4>
              <div className="flex space-x-3">
                <button
                  onClick={onVerifyAll}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Icons.CheckCircle className="w-4 h-4 mr-2" />
                  Todo Correcto
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Notas Generales (opcional)
              </label>
              <input
                type="text"
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Todo en perfecto estado, sin observaciones..."
              />
            </div>
          </div>

          {/* Lista compacta de items - Diseño Ultra Compacto */}
          <div className="space-y-1">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`p-2 rounded border transition-colors ${item.is_verified
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 bg-white hover:border-blue-300'
                  }`}
              >
                <div className="w-full md:flex md:items-center md:justify-between space-y-2 md:space-y-0">
                  {/* Sección izquierda - Info del producto */}
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {/* Estado visual compacto */}
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {item.is_verified ? (
                        <Icons.CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                      )}
                    </div>

                    {/* Cantidad compacta */}
                    <div className={`px-2 py-1 text-sm font-bold rounded flex-shrink-0 ${item.is_verified
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                      }`}>
                      {Math.floor(parseFloat(item.required_quantity) || 0)}x
                    </div>

                    {/* Nombre del producto compacto */}
                    <div className="flex-1 min-w-0">
                      <h5 className={`font-medium text-sm break-words whitespace-normal leading-snug ${item.is_verified ? 'text-green-800' : 'text-gray-900'
                        }`}>
                        {item.item_name}
                      </h5>

                      {/* Info adicional en una sola línea */}
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>📦{item.required_unit}</span>
                        {item.required_weight && <span>⚖️{item.required_weight}kg</span>}
                        {item.required_flavor && <span>🎨{item.required_flavor}</span>}
                      </div>

                      {/* Códigos compactos en línea horizontal */}
                      {(item.product_code || item.barcode) && (
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                          {item.product_code && (
                            <div className="bg-blue-100 px-2 py-1 rounded border border-blue-300 flex items-center space-x-1">
                              <span className="text-xs text-blue-700 font-bold">CÓDIGO:</span>
                              <span className="font-mono text-blue-900 font-bold text-xs">{item.product_code}</span>
                            </div>
                          )}
                          {item.barcode && (
                            <div className="bg-gray-100 px-2 py-1 rounded border border-gray-300 flex items-center space-x-1">
                              <span className="text-xs text-gray-700 font-bold">📊</span>
                              <span className="font-mono text-gray-900 font-bold text-xs">{item.barcode}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sección derecha - Controles compactos */}
                  <div className="flex items-center space-x-1 flex-wrap md:flex-nowrap md:justify-end flex-shrink-0 mt-2 md:mt-0">
                    {!item.is_verified && (
                      <>
                        {/* Contador compacto para múltiples */}
                        {Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                          <div className="flex items-center bg-gray-100 rounded px-2 mr-1">
                            <button
                              onClick={() => updateItemCounter(item, -1)}
                              className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded text-sm flex items-center justify-center"
                            >
                              <Icons.Minus className="w-3 h-3" />
                            </button>
                            <div className="px-1 text-center min-w-[54px]">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                value={typeof itemCounters[item.id] === 'number' ? itemCounters[item.id] : 0}
                                onChange={(e) => handleCountInputChange(item, e.target.value)}
                                onKeyDown={(e) => handleCountInputKeyDown(e, item)}
                                disabled={(itemCounters[item.id] || 0) < 3}
                                className={`w-16 text-sm font-bold text-center border border-gray-300 rounded ${(itemCounters[item.id] || 0) < 3 ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'bg-white'}`}
                                aria-label={`Cantidad escaneada de ${item.item_name}`}
                                title={(itemCounters[item.id] || 0) < 3 ? 'Se habilita al registrar 3 unidades' : 'Editar cantidad'}
                              />
                              <div className="text-[12px] text-gray-500 leading-3">/{Math.floor(parseFloat(item.required_quantity) || 0)}</div>
                            </div>
                            <button
                              onClick={() => updateItemCounter(item, 1)}
                              className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded text-sm flex items-center justify-center"
                            >
                              <Icons.Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Botones de acción compactos */}
                        <button
                          onClick={() => verifyItemQuick(item, true)}
                          className="w-8 h-6 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded flex items-center justify-center transition-colors"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => verifyItemQuick(item, false)}
                          className="w-8 h-6 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded flex items-center justify-center transition-colors"
                        >
                          ✗
                        </button>

                        {/* Reset compacto */}
                        {Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                          <button
                            onClick={() => resetItemCounter(item)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${(itemCounters[item.id] || 0) > 0
                                ? 'text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100'
                                : 'text-transparent cursor-default'
                              }`}
                            title="Reset contador"
                            disabled={(itemCounters[item.id] || 0) === 0}
                          >
                            <Icons.RotateCcw className="w-2 h-2" />
                          </button>
                        )}
                      </>
                    )}

                    {item.is_verified && (
                      <div className="flex items-center space-x-1">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          ✅ OK
                        </span>
                        <button
                          onClick={() => verifyItemQuick(item, false)}
                          className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-gray-100 transition-colors"
                          title="Desmarcar"
                        >
                          <Icons.RotateCcw className="w-2 h-2" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modo Código de Barras */}
      {validationMode === 'barcode' && (
        <>
          {/* Escáner sticky en la parte superior - siempre visible */}
          <div id="scannerBar" className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-2xl" style={{ top: 'max(env(safe-area-inset-top, 8px), 8px)' }}>
            <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded border border-purple-200 shadow-md backdrop-blur">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-purple-900 flex items-center text-sm">
                  <Icons.Scan className="w-4 h-4 mr-2" />
                  🔫 Escáner QR/Código de Barras
                </h4>
                <div className="flex items-center space-x-2">
                  <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${scanningActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    <div className={`w-2 h-2 rounded-full mr-1 ${scanningActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    {scanningActive ? 'Activo' : 'Inactivo'}
                  </div>
                  <button
                    onClick={() => setAutoScrollEnabled(v => !v)}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${autoScrollEnabled ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title={`${autoScrollEnabled ? 'Desactivar' : 'Activar'} autodesplazamiento`}
                  >
                    {autoScrollEnabled ? 'Autoscroll ON' : 'Autoscroll OFF'}
                  </button>
                  <button
                    onClick={() => setPackingMode(v => !v)}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${packingMode ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title={`${packingMode ? 'Desactivar' : 'Activar'} modo Empacando (bloquea scroll y mantiene enfoque)`}
                  >
                    {packingMode ? 'Empacando ON' : 'Empacando OFF'}
                  </button>
                  <button
                    onClick={() => setCollapsed(c => !c)}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-white text-purple-700 border border-purple-300 hover:bg-purple-50"
                    title={collapsed ? 'Expandir' : 'Contraer'}
                  >
                    {collapsed ? 'Expandir' : 'Contraer'}
                  </button>
                </div>
              </div>
              {!collapsed && (
                <>
                  <div className="flex space-x-2">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyPress={handleBarcodeKeyPress}
                      onFocus={() => setScanningActive(true)}
                      onBlur={() => { setScanningActive(false); if (packingMode) setTimeout(() => { try { barcodeInputRef.current?.focus(); } catch { } }, 0); }}
                      className="flex-1 px-3 py-2 border border-purple-300 rounded text-base md:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                      placeholder="Escanea aquí o escribe..."
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      inputMode="none"
                      enterKeyHint="done"
                      autoFocus={validationMode === 'barcode'}
                    />
                    <button
                      onClick={() => handleBarcodeInputServer(barcodeInput.trim())}
                      disabled={!barcodeInput.trim()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm rounded transition-colors"
                    >
                      <Icons.Search className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-purple-700">
                    💡 Escanea código o escribe manualmente • Sistema verifica automáticamente
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="h-24 md:h-20"></div>

          {/* Lista Ultra Compacta de Items */}
          <div className="space-y-1">
            <h5 className="font-medium text-gray-900 flex items-center mb-2 text-sm">
              <Icons.List className="w-4 h-4 mr-1" />
              📦 {checklist.length} productos
            </h5>
            {checklist.map((item) => (
              <div
                key={item.id}
                ref={(el) => { if (el) itemRefs.current[item.id] = el; }}
                className={`scroll-mt-24 p-2 rounded border transition-colors ${item.is_verified
                    ? 'border-green-400 bg-green-50'
                    : 'border-red-300 bg-white hover:border-red-400'
                  } ${highlightedId === item.id ? 'ring-2 ring-red-400' : ''}`}
              >
                <div className="w-full md:flex md:items-center md:justify-between space-y-2 md:space-y-0">
                  {/* Info del Producto Ultra Compacta */}
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {/* Estado + Cantidad */}
                    <div className="flex items-center space-x-1">
                      {item.is_verified ? (
                        <Icons.CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Icons.AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )}
                      <div className={`px-2 py-1 text-sm font-bold rounded text-white ${item.is_verified ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                        {Math.floor(parseFloat(item.required_quantity) || 0)}x
                      </div>
                    </div>

                    {/* Nombre del Producto */}
                    <div className="flex-1 min-w-0">
                      <h6 className="font-medium text-sm break-words whitespace-normal leading-snug">{item.item_name}</h6>

                      {/* Info + códigos en una línea compacta */}
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500 mt-0.5">
                        <span>📦{item.required_unit}</span>
                        {item.required_weight && <span>⚖️{item.required_weight}kg</span>}
                        {item.required_flavor && <span>🎨{item.required_flavor}</span>}

                        {/* Códigos compactos inline */}
                        {item.product_code && (
                          <span className="bg-blue-100 px-1 rounded text-blue-800 font-mono font-bold text-xs">#{item.product_code}</span>
                        )}
                        {item.barcode && (
                          <span className="bg-gray-200 px-1 rounded text-gray-800 font-mono font-bold text-xs">📊{item.barcode}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Controles Ultra Compactos */}
                  <div className="flex items-center space-x-1 flex-wrap md:flex-nowrap md:justify-end flex-shrink-0 mt-2 md:mt-0">
                    {!item.is_verified && (
                      <>
                        {/* Contador ultra compacto para múltiples */}
                        {Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                          <div className="flex items-center bg-gray-100 rounded mr-1">
                            <button
                              onClick={() => updateItemCounter(item, -1)}
                              className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-l text-sm flex items-center justify-center"
                            >
                              <Icons.Minus className="w-3 h-3" />
                            </button>
                            <div className="px-1 text-center min-w-[45px] bg-white">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                value={typeof itemCounters[item.id] === 'number' ? itemCounters[item.id] : 0}
                                onChange={(e) => handleCountInputChange(item, e.target.value)}
                                onKeyDown={(e) => handleCountInputKeyDown(e, item)}
                                disabled={(itemCounters[item.id] || 0) < 3}
                                className={`w-12 text-sm font-bold text-center border border-gray-300 rounded ${(itemCounters[item.id] || 0) < 3 ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'bg-white'}`}
                                aria-label={`Cantidad escaneada de ${item.item_name}`}
                                title={(itemCounters[item.id] || 0) < 3 ? 'Se habilita al registrar 3 unidades' : 'Editar cantidad'}
                              />
                              <div className="text-[12px] text-gray-400 leading-3">/{Math.floor(parseFloat(item.required_quantity) || 0)}</div>
                            </div>
                            <button
                              onClick={() => updateItemCounter(item, 1)}
                              className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-r text-sm flex items-center justify-center"
                            >
                              <Icons.Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Botones compactos */}
                        <button
                          onClick={() => resetItemCounter(item)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${(itemCounters[item.id] || 0) > 0
                              ? 'text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100'
                              : 'text-transparent cursor-default'
                            }`}
                          title="Reset contador"
                          disabled={(itemCounters[item.id] || 0) === 0}
                        >
                          ✗
                        </button>

                        {/* Reset ultra compacto */}
                        {Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                          <button
                            onClick={() => resetItemCounter(item)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${(itemCounters[item.id] || 0) > 0
                                ? 'text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100'
                                : 'text-transparent cursor-default'
                              }`}
                            title="Reset"
                            disabled={(itemCounters[item.id] || 0) === 0}
                          >
                            <Icons.RotateCcw className="w-2 h-2" />
                          </button>
                        )}
                      </>
                    )}

                    {item.is_verified && (
                      <div className="flex items-center space-x-1">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          ✅ OK
                        </span>
                        <button
                          onClick={() => handleBarcodeInputServer(barcodeInput.trim())}
                          disabled={!barcodeInput.trim()}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm rounded transition-colors"
                        >
                          <Icons.RotateCcw className="w-2 h-2" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instrucción inline solo para múltiples no verificados */}
                {!item.is_verified && Math.floor(parseFloat(item.required_quantity) || 0) > 1 && (
                  <div className="text-xs text-purple-600 mt-1">
                    ℹ️ Requiere {Math.floor(parseFloat(item.required_quantity) || 0)} unidades
                    {typeof item.scanned_count === 'number' && (
                      <span className="ml-2 text-gray-600">📊 {item.scanned_count || 0}/{item.required_scans || Math.floor(parseFloat(item.required_quantity) || 0)} escaneadas</span>
                    )}
                    {Math.floor(parseFloat(item.required_quantity) || 0) >= 3 && (
                      <span className="ml-2 text-gray-600">✍️ Se habilita al llegar a 3</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Resumen */}
      {verifiedCount === totalCount && totalCount > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <Icons.CheckCircle className="w-6 h-6 text-green-600 mr-3" />
            <div>
              <h4 className="font-medium text-green-900">¡Empaque Verificado!</h4>
              <p className="text-sm text-green-700 mt-1">
                Todos los items han sido verificados con {validationMode === 'barcode' ? 'código de barras' : 'validación manual'}.
                Puedes proceder a finalizar el empaque.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente: Captura y subida de evidencia fotográfica de empaque
const PackagingEvidenceCapture = ({ orderId, onEvidenceChange = () => { } }) => {
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [photos, setPhotos] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // dataURL[]
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('Evidencia de empaque');
  const [uploadedCount, setUploadedCount] = useState(0);
  // Galería de evidencias ya subidas
  const [uploadedPhotos, setUploadedPhotos] = useState([]); // [{id, url, ...}]
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Capacidades del entorno para cámara
  const isSecure = typeof window !== 'undefined' && window.isSecureContext;
  const hasAnyCameraAPI = typeof navigator !== 'undefined' && (
    (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') ||
    navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia
  );

  const startCamera = async () => {
    try {
      // Detener cualquier cámara previa
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()); } catch { }
        streamRef.current = null;
      }

      // Requisito de seguridad del navegador
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        toast.error('La cámara requiere HTTPS o localhost. Usa "Subir desde archivos"');
        console.warn('getUserMedia bloqueado: contexto inseguro (no HTTPS)');
        return;
      }

      const hasModernAPI = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

      let stream;
      if (hasModernAPI) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
      } else {
        // Fallback a APIs heredadas
        const legacy = typeof navigator !== 'undefined' && (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
        if (!legacy) {
          toast.error('Este navegador no soporta acceso directo a la cámara. Usa "Subir desde archivos"');
          console.warn('mediaDevices/getUserMedia no disponible y sin API heredada');
          return;
        }
        stream = await new Promise((resolve, reject) => legacy.call(navigator, { video: true, audio: false }, resolve, reject));
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOn(true);
      toast.success('Cámara activada');
    } catch (err) {
      console.error('No se pudo acceder a la cámara:', err);
      let msg = 'No se pudo acceder a la cámara. Usa "Subir desde archivos"';
      if (err && err.name === 'NotAllowedError') msg = 'Permiso denegado para usar la cámara.';
      if (err && err.name === 'NotFoundError') msg = 'No se encontró una cámara disponible.';
      toast.error(msg);
    }
  };

  const stopCamera = () => {
    try {
      streamRef.current?.getTracks()?.forEach(t => t.stop());
    } catch { }
    setIsCameraOn(false);
  };

  const capturePhoto = async () => {
    try {
      const video = videoRef.current;
      if (!video) return;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('No se pudo crear imagen desde el canvas');
      const fileName = `pack-${Date.now()}.jpg`;
      let file;
      try {
        file = new File([blob], fileName, { type: 'image/jpeg' });
      } catch {
        // Fallback para navegadores sin File constructor
        blob.name = fileName;
        blob.type = 'image/jpeg';
        file = blob;
      }
      const url = URL.createObjectURL(blob);
      setPhotos(prev => [...prev, file]);
      setPreviews(prev => [...prev, url]);
      // Subida inmediata
      try { await uploadFiles([file]); } catch { }
      // No liberamos el url para poder mostrarlo; se libera al limpiar
    } catch (e) {
      console.error('Error capturando foto:', e);
      toast.error('No se pudo capturar la foto');
    }
  };

  const onFileInput = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length !== files.length) {
      toast('Algunos archivos no son imágenes y se ignoraron');
    }
    setPhotos(prev => [...prev, ...imgs]);
    setPreviews(prev => [...prev, ...imgs.map(f => URL.createObjectURL(f))]);
    // Subida inmediata de archivos seleccionados
    try { await uploadFiles(imgs); } catch { }
  };

  const removeAt = (idx) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((u, i) => i !== idx));
  };

  const clearAll = () => {
    previews.forEach(u => URL.revokeObjectURL(u));
    setPhotos([]); setPreviews([]);
  };

  const uploadFiles = async (filesToUpload) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setUploading(true);
    try {
      const resp = await packagingEvidenceService.upload(orderId, filesToUpload, description);
      const saved = (resp && resp.data && resp.data.files) || resp?.files || [];
      setUploadedPhotos(prev => {
        const next = [...saved, ...prev]; // recientes primero
        setUploadedCount(next.length);
        try { onEvidenceChange(next.length); } catch { }
        return next;
      });
      toast.success(resp?.message || 'Evidencia registrada');
      clearAll();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo subir la evidencia');
    } finally {
      setUploading(false);
    }
  };

  const uploadAll = async () => {
    if (photos.length === 0) {
      toast.error('Agrega al menos una foto');
      return;
    }
    setUploading(true);
    try {
      const resp = await packagingEvidenceService.upload(orderId, photos, description);
      toast.success(resp?.message || 'Evidencia registrada');
      clearAll();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo subir la evidencia');
    } finally {
      setUploading(false);
    }
  };

  React.useEffect(() => () => stopCamera(), []);

  // Cargar galería de fotos ya subidas (inicial) y cuando cambie el pedido
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setGalleryLoading(true);
      try {
        const resp = await packagingEvidenceService.list(orderId);
        const files = (resp && resp.data && resp.data.files) || resp?.files || [];
        if (!mounted) return;
        setUploadedPhotos(files);
        setUploadedCount(files.length);
        try { onEvidenceChange(files.length); } catch { }
      } catch (e) {
        console.warn('No se pudo cargar la galería de evidencia:', e?.message || e);
        if (!mounted) return;
        setUploadedPhotos([]);
        setUploadedCount(0);
        try { onEvidenceChange(0); } catch { }
      } finally {
        if (mounted) setGalleryLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [orderId]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Icons.Camera className="w-5 h-5 mr-2" /> Evidencia fotográfica de empaque
        </h3>
        <div className="flex items-center space-x-2">
          {!isCameraOn ? (
            <>
              <button
                onClick={startCamera}
                className="btn btn-secondary btn-sm"
                disabled={!isSecure || !hasAnyCameraAPI}
                title={!isSecure ? 'Requiere HTTPS o localhost' : (!hasAnyCameraAPI ? 'Este navegador no soporta acceso a cámara' : '')}
              >
                <Icons.Video className="w-4 h-4 mr-1" /> Activar cámara
              </button>
              {(!isSecure || !hasAnyCameraAPI) && (
                <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border">
                  {!isSecure ? 'HTTPS requerido' : 'Sin soporte de cámara'}
                </span>
              )}
            </>
          ) : (
            <button onClick={stopCamera} className="btn btn-secondary btn-sm">
              <Icons.Square className="w-4 h-4 mr-1" /> Detener
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="relative bg-black rounded overflow-hidden aspect-video">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            {isCameraOn && (
              <button onClick={capturePhoto} className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-gray-800 px-3 py-2 rounded shadow flex items-center">
                <Icons.Camera className="w-4 h-4 mr-1" /> Capturar
              </button>
            )}
          </div>
          <div className="mt-3 text-sm text-gray-600">
            O sube desde archivos:
            <input type="file" accept="image/*" multiple onChange={onFileInput} className="block mt-1" />
            {(!isSecure || !hasAnyCameraAPI) && (
              <div className="mt-2 text-xs text-gray-500">
                Consejo: puedes tomar fotos con el botón de archivos si la cámara del navegador no está disponible.
              </div>
            )}
          </div>
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />

          {/* Galería: Fotos ya subidas (persistidas) */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="block text-sm font-medium text-gray-700">Fotos subidas ({uploadedPhotos.length})</span>
              {galleryLoading && <span className="text-xs text-gray-500">Cargando…</span>}
            </div>
            {uploadedPhotos.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-2 max-h-56 overflow-auto pr-1">
                {uploadedPhotos.map((f, idx) => (
                  <div key={f.id || f.url || idx} className="relative border rounded overflow-hidden">
                    <img
                      src={f.url || f.photo_path || ''}
                      alt={`evidencia-subida-${idx}`}
                      className="w-full h-20 object-cover cursor-pointer"
                      onClick={() => { try { window.open(f.url || f.photo_path, '_blank'); } catch { } }}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-500">Aún no hay fotos para este pedido.</div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 max-h-56 overflow-auto pr-1">
            {previews.map((src, idx) => (
              <div key={idx} className="relative group border rounded overflow-hidden">
                <img src={src} alt={`evidencia-${idx}`} className="w-full h-20 object-cover" />
                <button onClick={() => removeAt(idx)} className="absolute top-1 right-1 bg-white/90 rounded p-1 text-red-600 opacity-0 group-hover:opacity-100">
                  <Icons.X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">{uploadedCount} foto(s) subidas</span>
            <button onClick={uploadAll} disabled className="btn btn-primary btn-sm opacity-60 cursor-not-allowed" title="Subida automática activada">
              Subida automática activa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackagingPage;
