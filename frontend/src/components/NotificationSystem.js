import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api, { logisticsService } from '../services/api';
import { io } from 'socket.io-client';
import audioFeedback from '../utils/audioUtils';

const NotificationSystem = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevReadyCountRef = useRef(null);
  // Guardar estado para evitar solapes de polling de SIIGO (previene timeouts y requests concurrentes)
  const invoicePollInFlightRef = useRef(false);

  // Permisos por tipo de alerta
  const canReceiveSiigo = user && (user.role === 'admin' || user.role === 'facturacion');
  const canReceiveStatusAlerts = !!user && ['admin', 'facturador', 'cartera', 'logistica', 'mensajero', 'empacador', 'empaque'].includes(user.role);
  const canReceiveAny = !!user && (canReceiveSiigo || canReceiveStatusAlerts);

  useEffect(() => {
    if (!canReceiveSiigo) return;

    // Cargar notificaciones iniciales
    loadNotifications();

    // Configurar polling para nuevas notificaciones cada 2 minutos (menos frecuente para evitar 429)
    const interval = setInterval(() => {
      checkForNewInvoices();
    }, 120000); // 2 minutos en lugar de 30 segundos

    return () => clearInterval(interval);
  }, [canReceiveSiigo]);

  const loadNotifications = async () => {
    try {
      const stored = localStorage.getItem('siigo_notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
        setUnreadCount(parsed.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  };

  const checkForNewInvoices = async () => {
    if (invoicePollInFlightRef.current) {
      return;
    }
    invoicePollInFlightRef.current = true;
    try {
      // Obtener facturas desde HOY 00:00 (filtrado en backend)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startDateStr = startOfToday.toISOString().split('T')[0];

      const response = await api.get('/siigo/invoices', {
        params: {
          page: 1,
          page_size: 5, // Solo las más recientes
          start_date: startDateStr
        },
        timeout: 120000
      });

      if (response.data.success && response.data.data.results) {
        const newInvoices = response.data.data.results;

        // Limitar a facturas de HOY por si el backend devuelve adicionales
        const todaysInvoices = newInvoices.filter((invoice) => {
          const d = invoice?.date || invoice?.created_at || invoice?.document_date;
          if (!d) return false;
          const invDate = new Date(d);
          return invDate >= startOfToday;
        });

        // Reset diario: si el último chequeo fue de otro día, limpiar deduplicación local
        const lastCheckISO = localStorage.getItem('last_invoice_check');
        if (lastCheckISO && new Date(lastCheckISO) < startOfToday) {
          localStorage.removeItem('processed_invoices');
        }

        // Obtener IDs de facturas ya procesadas
        const processedInvoices = JSON.parse(localStorage.getItem('processed_invoices') || '[]');
        const currentTime = new Date().toISOString();

        // Filtrar facturas que no hemos procesado antes
        const newInvoicesFiltered = todaysInvoices.filter(invoice =>
          !processedInvoices.includes(invoice.id)
        );

        if (newInvoicesFiltered.length > 0) {
          console.log(`🔔 ${newInvoicesFiltered.length} nueva(s) factura(s) detectada(s)`);

          // Crear notificaciones para las nuevas facturas
          const newNotifications = newInvoicesFiltered.map(invoice => ({
            id: `invoice_${invoice.id}`,
            type: 'new_invoice',
            title: 'Nueva Factura SIIGO',
            message: `Factura ${invoice.number || invoice.id.slice(-8)} por $${(invoice.total || 0).toLocaleString()}`,
            timestamp: new Date().toISOString(),
            read: false,
            data: invoice
          }));

          // Agregar a las notificaciones existentes
          setNotifications(prev => {
            const updated = [...newNotifications, ...prev].slice(0, 20); // Máximo 20 notificaciones
            localStorage.setItem('siigo_notifications', JSON.stringify(updated));
            return updated;
          });

          setUnreadCount(prev => prev + newNotifications.length);

          // Reproducir sonido de notificación
          if (audioFeedback?.isEnabled()) {
            audioFeedback.playStatusAlert();
          } else {
            // Fallback simple beep si el sistema avanzado no está disponible
            playNotificationSound();
          }

          // Mostrar notificación del navegador si está permitido
          if (Notification.permission === 'granted') {
            new Notification('Nueva Factura SIIGO', {
              body: `${newInvoicesFiltered.length} nueva(s) factura(s) disponible(s) para importar`,
              icon: '/favicon.ico'
            });
          }

          // Actualizar lista de facturas procesadas
          const updatedProcessedInvoices = [
            ...processedInvoices,
            ...newInvoicesFiltered.map(inv => inv.id)
          ].slice(-50); // Mantener solo las últimas 50

          localStorage.setItem('processed_invoices', JSON.stringify(updatedProcessedInvoices));
        }

        localStorage.setItem('last_invoice_check', currentTime);
      }
    } catch (error) {
      const status = error?.response?.status;
      const code = error?.response?.data?.error;
      if (status === 503 || code === 'SIIGO_AUTH_ERROR') {
        // Silenciar cuando SIIGO está deshabilitado o mal configurado para evitar spam
        console.warn('SIIGO no disponible o no configurado; omitiendo chequeo temporalmente');
        return;
      }
      console.error('Error verificando nuevas facturas:', error);
    } finally {
      invoicePollInFlightRef.current = false;
    }
  };

  // WebSocket para alertas de cambio de estado de pedidos (tiempo real)
  const socketRef = useRef(null);
  const statusToastTsRef = useRef(0);
  // Deduplicación de eventos de estado recientes (orderId:to_status -> timestamp)
  const recentStatusRef = useRef(new Map());

  useEffect(() => {
    if (!canReceiveStatusAlerts) return;

    const apiBase = process.env.REACT_APP_API_URL;
    const socketBase = (apiBase && /^https?:\/\//.test(apiBase)) ? apiBase : window.location.origin;

    // Evitar múltiples conexiones
    if (!socketRef.current) {
      const socket = io(socketBase, { path: '/socket.io', transports: ['websocket', 'polling'], withCredentials: true });
      socketRef.current = socket;

      socket.on('connect', () => {
        try {
          socket.emit('join-orders-updates');
        } catch (_) { }
      });

      const shouldNotifyForStatus = (toStatus) => {
        const map = {
          revision_cartera: ['cartera', 'facturador', 'admin'],
          en_logistica: ['logistica', 'admin'],
          pendiente_empaque: ['logistica', 'admin'],
          en_preparacion: ['logistica', 'admin'],
          en_empaque: ['empacador', 'empaque', 'admin', 'logistica'],
          listo_para_entrega: ['logistica', 'admin'],
          en_reparto: ['mensajero', 'admin'],
          enviado: ['mensajero', 'admin'],
          entregado_transportadora: ['logistica', 'admin']
        };
        const targets = map[toStatus] || ['admin']; // por defecto solo admin
        return targets.includes(user?.role);
      };

      const handleStatusChanged = (payload) => {
        try {
          // Evitar duplicados con Empaque: si estás en /packaging y el estado es 'en_empaque' o 'pendiente_empaque', no notificar aquí.
          const __toLow = String(payload?.to_status || '').toLowerCase();
          if ((__toLow === 'en_empaque' || __toLow === 'pendiente_empaque') && typeof window !== 'undefined' && window.location.pathname.includes('/packaging')) {
            return;
          }
          // Throttle global simple para evitar ráfagas de toasts en menos de 3s.
          const __now = Date.now();
          if (__now - statusToastTsRef.current < 3000) {
            return;
          }
          statusToastTsRef.current = __now;

          const { orderId, order_number, from_status, to_status, timestamp } = {
            orderId: payload?.orderId,
            order_number: payload?.order_number,
            from_status: payload?.from_status,
            to_status: payload?.to_status,
            timestamp: payload?.timestamp || new Date().toISOString()
          };

          if (!orderId || !to_status) return;

          // Deduplicación: si ya notificamos este (orderId -> to_status) en los últimos 10s, omitir
          try {
            const key = `${orderId}:${__toLow}`;
            const nowTs = Date.now();
            const lastTs = recentStatusRef.current.get(key);
            if (lastTs && (nowTs - lastTs) < 10000) {
              return;
            }
            recentStatusRef.current.set(key, nowTs);
          } catch (_) { }

          // Filtrar por rol según estado destino
          if (!shouldNotifyForStatus(to_status)) return;

          // Crear notificación local
          const notif = {
            id: `status_${orderId}_${Date.now()}`,
            type: 'status_change',
            title: 'Cambio de Estado de Pedido',
            message: `Pedido ${order_number || orderId}: ${from_status || '—'} → ${to_status}`,
            timestamp,
            read: false,
            data: payload
          };

          setNotifications(prev => {
            const updated = [notif, ...prev].slice(0, 20);
            localStorage.setItem('siigo_notifications', JSON.stringify(updated));
            return updated;
          });
          setUnreadCount(prev => prev + 1);

          // Sonido fuerte e identificativo (timbre de alerta de nuevo pedido/estado, no de error)
          if (audioFeedback?.isEnabled()) {
            // patrón de alerta claro y agradable
            audioFeedback.playStatusAlert();
          }

          // Notificación nativa del navegador (si está permitido)
          if (Notification.permission === 'granted') {
            new Notification('Cambio de Estado de Pedido', {
              body: `Pedido ${order_number || orderId}: ${from_status || '—'} → ${to_status}`,
              icon: '/favicon.ico'
            });
          }
        } catch (e) {
          console.warn('Error manejando order-status-changed:', e);
        }
      };

      socket.on('order-status-changed', handleStatusChanged);

      socket.on('connect_error', (err) => {
        console.error('Socket connection error (status alerts):', err?.message || err);
      });

      return () => {
        try {
          socket.off('order-status-changed');
          socket.disconnect();
        } catch (e) { }
        socketRef.current = null;
      };
    }
  }, [canReceiveStatusAlerts, user?.role]);

  // Polling global para ADMIN/LOGÍSTICA: detectar nuevos "listos para entregar"
  useEffect(() => {
    const role = String(user?.role || '');
    const enabled = role === 'admin' || role === 'logistica';
    if (!enabled) return;

    let disposed = false;

    const checkReadyForDelivery = async () => {
      try {
        const resp = await logisticsService.getReadyForDelivery({ _ts: Date.now() });
        const grouped = resp?.data?.groupedOrders || resp?.groupedOrders || {};
        const currentCount = Object.values(grouped).reduce((acc, list) => acc + ((list || []).length), 0);

        const prev = prevReadyCountRef.current;
        prevReadyCountRef.current = currentCount;

        // La primera vez solo inicializamos sin notificar
        if (prev == null) return;

        if (currentCount > prev) {
          const diff = currentCount - prev;

          // Notificación visual y sonora
          toast.success(`${diff} pedido(s) NUEVOS listos para entregar`);
          if (audioFeedback?.isEnabled()) {
            try { audioFeedback.playStatusAlert(); } catch (_) { }
          }

          // Registrar en bandeja de notificaciones
          const notif = {
            id: `ready_${Date.now()}`,
            type: 'status_change',
            title: 'Nuevos Pedidos Listos',
            message: `${diff} pedido(s) nuevos listos para entregar`,
            timestamp: new Date().toISOString(),
            read: false,
            data: { delta: diff, total: currentCount }
          };
          setNotifications(prevList => {
            const updated = [notif, ...prevList].slice(0, 20);
            localStorage.setItem('siigo_notifications', JSON.stringify(updated));
            return updated;
          });
          setUnreadCount(prevU => prevU + 1);
        }
      } catch (e) {
        // Silenciar errores intermitentes
      }
    };

    // Chequeo inicial (inicializa contador sin alertar)
    checkReadyForDelivery();

    const interval = setInterval(() => {
      if (!disposed) checkReadyForDelivery();
    }, 15000); // 15s

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [user?.role]);

  const playNotificationSound = () => {
    try {
      // Crear un sonido de notificación usando Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Crear un oscilador para generar el sonido
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Conectar oscilador -> ganancia -> salida
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configurar el sonido (tono agradable de notificación)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frecuencia inicial
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1); // Bajar tono
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2); // Subir tono

      // Configurar volumen con fade out
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      // Reproducir sonido
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      console.log('🔊 Sonido de notificación reproducido');
    } catch (error) {
      console.error('Error reproduciendo sonido de notificación:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    if (canReceiveAny) {
      requestNotificationPermission();
    }
  }, [canReceiveAny]);

  // Función para probar notificaciones (temporal)
  const testNotification = () => {
    const testNotif = {
      id: `test_${Date.now()}`,
      type: 'new_invoice',
      title: 'Prueba de Notificación',
      message: 'Esta es una notificación de prueba para verificar el funcionamiento',
      timestamp: new Date().toISOString(),
      read: false,
      data: {}
    };

    setNotifications(prev => {
      const updated = [testNotif, ...prev].slice(0, 20);
      localStorage.setItem('siigo_notifications', JSON.stringify(updated));
      return updated;
    });

    setUnreadCount(prev => prev + 1);
    if (audioFeedback?.isEnabled()) {
      audioFeedback.playStatusAlert();
    } else {
      // Fallback simple beep si el sistema avanzado no está disponible
      playNotificationSound();
    }

    if (Notification.permission === 'granted') {
      new Notification('Prueba de Notificación', {
        body: 'Sistema de notificaciones funcionando correctamente',
        icon: '/favicon.ico'
      });
    }

    console.log('🔔 Notificación de prueba creada');
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem('siigo_notifications', JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('siigo_notifications', JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(0);
  };

  const removeNotification = (notificationId) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      localStorage.setItem('siigo_notifications', JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(prev => {
      const notification = notifications.find(n => n.id === notificationId);
      return notification && !notification.read ? prev - 1 : prev;
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_invoice':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'status_change':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  if (!canReceiveAny) {
    return null;
  }

  return (
    <div className="relative">
      {/* Botón de notificaciones */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel de notificaciones */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''
                    }`}
                >
                  <div className="flex items-start space-x-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {formatTime(notification.timestamp)}
                          </span>
                          <button
                            onClick={() => removeNotification(notification.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          Marcar como leída
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500 mb-2">
              Actualizándose automáticamente cada 2 minutos
            </p>
            {/* Botón de prueba temporal */}
            <button
              onClick={testNotification}
              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
            >
              🔔 Probar Notificación
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSystem;
