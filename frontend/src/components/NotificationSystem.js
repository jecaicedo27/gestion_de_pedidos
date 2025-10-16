import React, { useState, useEffect } from 'react';
import { Bell, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NotificationSystem = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Solo mostrar notificaciones para admin y facturación
  const canReceiveNotifications = user && (user.role === 'admin' || user.role === 'facturacion');

  useEffect(() => {
    if (!canReceiveNotifications) return;

    // Cargar notificaciones iniciales
    loadNotifications();

    // Configurar polling para nuevas notificaciones cada 2 minutos (menos frecuente para evitar 429)
    const interval = setInterval(() => {
      checkForNewInvoices();
    }, 120000); // 2 minutos en lugar de 30 segundos

    return () => clearInterval(interval);
  }, [canReceiveNotifications]);

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
    try {
      // Obtener facturas desde hoy 12:15 AM
      const response = await api.get('/siigo/invoices', {
        params: {
          page: 1,
          page_size: 5 // Solo las más recientes
        }
      });

      if (response.data.success && response.data.data.results) {
        const newInvoices = response.data.data.results;
        
        // Obtener IDs de facturas ya procesadas
        const processedInvoices = JSON.parse(localStorage.getItem('processed_invoices') || '[]');
        const currentTime = new Date().toISOString();
        
        // Filtrar facturas que no hemos procesado antes
        const newInvoicesFiltered = newInvoices.filter(invoice => 
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
          playNotificationSound();

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
    }
  };

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
    if (canReceiveNotifications) {
      requestNotificationPermission();
    }
  }, [canReceiveNotifications]);

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
    playNotificationSound();

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

  if (!canReceiveNotifications) {
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
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                    !notification.read ? 'bg-blue-50' : ''
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
