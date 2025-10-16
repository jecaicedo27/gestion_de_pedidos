import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import SiigoAutoImportControl from '../components/SiigoAutoImportControl';

const SiigoConfigPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncStats, setSyncStats] = useState(null);
  const [credentials, setCredentials] = useState({
    enabled: true,
    username: '',
    access_key: '',
    base_url: 'https://api.siigo.com/v1',
    webhook_secret: ''
  });
  const [activeTab, setActiveTab] = useState('status');
  const [notification, setNotification] = useState(null);
  
  // WhatsApp states
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [whatsappStats, setWhatsappStats] = useState(null);
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') {
      loadSiigoData();
    }
  }, [user]);

  const loadSiigoData = async () => {
    try {
      setLoading(true);
      
      // Cargar estado de conexión
      const statusResponse = await api.get('/siigo/connection/status');
      setConnectionStatus(statusResponse.data.data);
      
      // Cargar logs de sincronización
      const logsResponse = await api.get('/siigo/sync/logs?limit=10');
      setSyncLogs(logsResponse.data.data.logs);
      
      // Cargar estadísticas
      const statsResponse = await api.get('/siigo/sync/stats');
      setSyncStats(statsResponse.data.data);
      
    } catch (error) {
      console.error('Error cargando datos SIIGO:', error);
      showNotification('Error cargando configuración SIIGO', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppData = async () => {
    try {
      setLoading(true);
      
      // Cargar estado de conexión WhatsApp
      const statusResponse = await api.get('/whatsapp/connection/status');
      setWhatsappStatus(statusResponse.data.data);
      
      // Cargar estadísticas WhatsApp
      const statsResponse = await api.get('/whatsapp/stats');
      setWhatsappStats(statsResponse.data.data);
      
      // Cargar logs de notificaciones
      const logsResponse = await api.get('/whatsapp/notifications?limit=10');
      setWhatsappLogs(logsResponse.data.data.logs);
      
    } catch (error) {
      console.error('Error cargando datos WhatsApp:', error);
      showNotification('Error cargando configuración WhatsApp', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone) {
      showNotification('Por favor ingresa un número de teléfono', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/whatsapp/test', {
        phone_number: testPhone,
        message: testMessage || undefined
      });
      
      if (response.data.success) {
        showNotification('Mensaje de prueba enviado exitosamente', 'success');
        setTestPhone('');
        setTestMessage('');
        await loadWhatsAppData();
      } else {
        showNotification('Error enviando mensaje: ' + response.data.message, 'error');
      }
    } catch (error) {
      showNotification('Error enviando mensaje: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryWhatsApp = async (notificationId) => {
    try {
      const response = await api.post(`/whatsapp/notifications/${notificationId}/retry`);
      
      if (response.data.success) {
        showNotification('Notificación reenviada exitosamente', 'success');
        await loadWhatsAppData();
      } else {
        showNotification('Error reenviando notificación', 'error');
      }
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleTestConnection = async () => {
    try {
      setLoading(true);
      const response = await api.get('/siigo/test/auth');
      
      if (response.data.success) {
        showNotification('Conexión exitosa con SIIGO API', 'success');
        await loadSiigoData();
      } else {
        showNotification('Error en la conexión: ' + response.data.error, 'error');
      }
    } catch (error) {
      showNotification('Error probando conexión: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async (logId) => {
    try {
      const response = await api.post(`/siigo/sync/retry/${logId}`);
      
      if (response.data.success) {
        showNotification('Sincronización reintentada exitosamente', 'success');
        await loadSiigoData();
      } else {
        showNotification('Error reintentando sincronización', 'error');
      }
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-CO');
  };

  const getStatusBadge = (status) => {
    const badges = {
      success: 'badge-success',
      error: 'badge-danger',
      pending: 'badge-warning'
    };
    
    const labels = {
      success: 'Exitoso',
      error: 'Error',
      pending: 'Pendiente'
    };
    
    return (
      <span className={`badge ${badges[status] || 'badge-secondary'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getSyncTypeBadge = (type) => {
    const badges = {
      webhook: 'badge-primary',
      manual: 'badge-secondary'
    };
    
    const labels = {
      webhook: 'Webhook',
      manual: 'Manual'
    };
    
    return (
      <span className={`badge ${badges[type] || 'badge-secondary'}`}>
        {labels[type] || type}
      </span>
    );
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600">Solo los administradores pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configuración SIIGO</h1>
          <p className="mt-2 text-gray-600">
            Gestiona la integración con SIIGO API y monitorea las sincronizaciones
          </p>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-md ${
            notification.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'status', label: 'Estado de Conexión' },
              { id: 'auto-import', label: 'Importación Automática' },
              { id: 'logs', label: 'Logs de Sincronización' },
              { id: 'stats', label: 'Estadísticas' },
              { id: 'whatsapp', label: 'WhatsApp' },
              { id: 'config', label: 'Configuración' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg">
          {/* Estado de Conexión */}
          {activeTab === 'status' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Estado de Conexión SIIGO</h2>
                <button
                  onClick={handleTestConnection}
                  className="btn btn-primary btn-sm"
                  disabled={loading}
                >
                  Probar Conexión
                </button>
              </div>

              {connectionStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title text-lg">Estado de Conexión</h3>
                    </div>
                    <div className="card-content">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <span className={`font-medium ${
                          connectionStatus.connected ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {connectionStatus.connected ? 'Conectado' : 'Desconectado'}
                        </span>
                      </div>
                      
                      {connectionStatus.connected && connectionStatus.user && (
                        <div className="mt-4 space-y-2">
                          <p><strong>Usuario:</strong> {connectionStatus.user.name || 'N/A'}</p>
                          <p><strong>Email:</strong> {connectionStatus.user.email || 'N/A'}</p>
                          <p><strong>Token expira:</strong> {formatDate(connectionStatus.token_expires)}</p>
                        </div>
                      )}
                      
                      {!connectionStatus.connected && connectionStatus.error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-red-800 text-sm">{connectionStatus.error}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title text-lg">Configuración Actual</h3>
                    </div>
                    <div className="card-content">
                      <div className="space-y-2">
                        <p><strong>URL Base:</strong> https://api.siigo.com/v1</p>
                        <p><strong>Usuario:</strong> COMERCIAL@PERLAS-EXPLOSIVAS.COM</p>
                        <p><strong>Webhook:</strong> /api/siigo/webhook/invoice-created</p>
                        <p><strong>Estado:</strong> 
                          <span className="ml-2 badge badge-success">Habilitado</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logs de Sincronización */}
          {activeTab === 'logs' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Logs de Sincronización</h2>
                <button
                  onClick={loadSiigoData}
                  className="btn btn-secondary btn-sm"
                >
                  Actualizar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-head">Factura SIIGO</th>
                      <th className="table-head">Tipo</th>
                      <th className="table-head">Estado</th>
                      <th className="table-head">Pedido</th>
                      <th className="table-head">Cliente</th>
                      <th className="table-head">Fecha</th>
                      <th className="table-head">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {syncLogs.map((log) => (
                      <tr key={log.id} className="table-row">
                        <td className="table-cell font-mono text-sm">
                          {log.siigo_invoice_id}
                        </td>
                        <td className="table-cell">
                          {getSyncTypeBadge(log.sync_type)}
                        </td>
                        <td className="table-cell">
                          {getStatusBadge(log.sync_status)}
                        </td>
                        <td className="table-cell">
                          {log.order_number ? (
                            <span className="text-primary-600 font-medium">
                              {log.order_number}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="table-cell">
                          {log.customer_name || '-'}
                        </td>
                        <td className="table-cell text-sm text-gray-500">
                          {formatDate(log.processed_at)}
                        </td>
                        <td className="table-cell">
                          {log.sync_status === 'error' && (
                            <button
                              onClick={() => handleRetrySync(log.id)}
                              className="btn btn-sm btn-outline text-xs"
                            >
                              Reintentar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {syncLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay logs de sincronización disponibles
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Importación Automática */}
          {activeTab === 'auto-import' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Control de Importación Automática</h2>
              </div>

              <SiigoAutoImportControl />
            </div>
          )}

          {/* Estadísticas */}
          {activeTab === 'stats' && syncStats && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Estadísticas de Sincronización</h2>

              {/* Estadísticas Generales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="card">
                  <div className="card-content">
                    <div className="text-2xl font-bold text-primary-600">
                      {syncStats.general.total_syncs}
                    </div>
                    <div className="text-sm text-gray-600">Total Sincronizaciones</div>
                  </div>
                </div>
                
                <div className="card">
                  <div className="card-content">
                    <div className="text-2xl font-bold text-green-600">
                      {syncStats.general.successful_syncs}
                    </div>
                    <div className="text-sm text-gray-600">Exitosas</div>
                  </div>
                </div>
                
                <div className="card">
                  <div className="card-content">
                    <div className="text-2xl font-bold text-red-600">
                      {syncStats.general.failed_syncs}
                    </div>
                    <div className="text-sm text-gray-600">Fallidas</div>
                  </div>
                </div>
                
                <div className="card">
                  <div className="card-content">
                    <div className="text-2xl font-bold text-blue-600">
                      {syncStats.general.webhook_syncs}
                    </div>
                    <div className="text-sm text-gray-600">Por Webhook</div>
                  </div>
                </div>
              </div>

              {/* Estadísticas Diarias */}
              {syncStats.daily.length > 0 && (
                <div className="card mb-6">
                  <div className="card-header">
                    <h3 className="card-title">Últimos 7 Días</h3>
                  </div>
                  <div className="card-content">
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead className="table-header">
                          <tr>
                            <th className="table-head">Fecha</th>
                            <th className="table-head">Total</th>
                            <th className="table-head">Exitosas</th>
                            <th className="table-head">Fallidas</th>
                            <th className="table-head">Tasa de Éxito</th>
                          </tr>
                        </thead>
                        <tbody className="table-body">
                          {syncStats.daily.map((day) => (
                            <tr key={day.date} className="table-row">
                              <td className="table-cell">
                                {new Date(day.date).toLocaleDateString('es-CO')}
                              </td>
                              <td className="table-cell">{day.total}</td>
                              <td className="table-cell text-green-600">{day.successful}</td>
                              <td className="table-cell text-red-600">{day.failed}</td>
                              <td className="table-cell">
                                <span className={`badge ${
                                  (day.successful / day.total) > 0.9 ? 'badge-success' : 
                                  (day.successful / day.total) > 0.7 ? 'badge-warning' : 'badge-danger'
                                }`}>
                                  {Math.round((day.successful / day.total) * 100)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Errores Recientes */}
              {syncStats.recent_errors.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Errores Recientes</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-3">
                      {syncStats.recent_errors.map((error, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-red-800">
                                Factura: {error.siigo_invoice_id}
                              </p>
                              <p className="text-sm text-red-600 mt-1">
                                {error.error_message}
                              </p>
                            </div>
                            <span className="text-xs text-red-500">
                              {formatDate(error.processed_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp */}
          {activeTab === 'whatsapp' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Configuración WhatsApp</h2>
                <button
                  onClick={loadWhatsAppData}
                  className="btn btn-secondary btn-sm"
                >
                  Actualizar
                </button>
              </div>

              {/* Estado de Conexión WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title text-lg">Estado de Wapify</h3>
                  </div>
                  <div className="card-content">
                    {whatsappStatus ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <div className={`w-3 h-3 rounded-full ${
                            whatsappStatus.connected ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className={`font-medium ${
                            whatsappStatus.connected ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {whatsappStatus.connected ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>
                        
                        {whatsappStatus.connected && whatsappStatus.profile && (
                          <div className="space-y-2">
                            <p><strong>Número de negocio:</strong> {whatsappStatus.business_number}</p>
                            <p><strong>Perfil:</strong> {whatsappStatus.profile.name || 'N/A'}</p>
                          </div>
                        )}
                        
                        {!whatsappStatus.connected && whatsappStatus.error && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-red-800 text-sm">{whatsappStatus.error}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={loadWhatsAppData}
                        className="btn btn-primary btn-sm"
                      >
                        Verificar Estado
                      </button>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title text-lg">Mensaje de Prueba</h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Número de teléfono
                        </label>
                        <input
                          type="text"
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          placeholder="+573001234567"
                          className="input"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Mensaje personalizado (opcional)
                        </label>
                        <textarea
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          placeholder="Mensaje personalizado..."
                          rows={3}
                          className="input"
                        />
                      </div>
                      
                      <button
                        onClick={handleTestWhatsApp}
                        className="btn btn-primary btn-sm w-full"
                        disabled={loading || !testPhone}
                      >
                        Enviar Prueba
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estadísticas WhatsApp */}
              {whatsappStats && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de Mensajes</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="card">
                      <div className="card-content">
                        <div className="text-2xl font-bold text-primary-600">
                          {whatsappStats.general.total_messages || 0}
                        </div>
                        <div className="text-sm text-gray-600">Total Mensajes</div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-content">
                        <div className="text-2xl font-bold text-green-600">
                          {whatsappStats.general.sent_messages || 0}
                        </div>
                        <div className="text-sm text-gray-600">Enviados</div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-content">
                        <div className="text-2xl font-bold text-blue-600">
                          {whatsappStats.general.delivered_messages || 0}
                        </div>
                        <div className="text-sm text-gray-600">Entregados</div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-content">
                        <div className="text-2xl font-bold text-red-600">
                          {whatsappStats.general.failed_messages || 0}
                        </div>
                        <div className="text-sm text-gray-600">Fallidos</div>
                      </div>
                    </div>
                  </div>

                  {/* Estadísticas por tipo */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="card">
                      <div className="card-content">
                        <div className="text-xl font-bold text-orange-600">
                          {whatsappStats.general.pedido_en_ruta || 0}
                        </div>
                        <div className="text-sm text-gray-600">Pedido en Ruta</div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-content">
                        <div className="text-xl font-bold text-purple-600">
                          {whatsappStats.general.guia_envio || 0}
                        </div>
                        <div className="text-sm text-gray-600">Guía de Envío</div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-content">
                        <div className="text-xl font-bold text-green-600">
                          {whatsappStats.general.pedido_entregado || 0}
                        </div>
                        <div className="text-sm text-gray-600">Pedido Entregado</div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-content">
                        <div className="text-xl font-bold text-gray-600">
                          {whatsappStats.general.test_messages || 0}
                        </div>
                        <div className="text-sm text-gray-600">Mensajes de Prueba</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Logs de Notificaciones WhatsApp */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Logs de Notificaciones WhatsApp</h3>
                </div>
                <div className="card-content">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead className="table-header">
                        <tr>
                          <th className="table-head">Teléfono</th>
                          <th className="table-head">Tipo</th>
                          <th className="table-head">Estado</th>
                          <th className="table-head">Pedido</th>
                          <th className="table-head">Fecha</th>
                          <th className="table-head">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {whatsappLogs.map((log) => (
                          <tr key={log.id} className="table-row">
                            <td className="table-cell font-mono text-sm">
                              {log.phone_number}
                            </td>
                            <td className="table-cell">
                              <span className={`badge ${
                                log.message_type === 'pedido_en_ruta' ? 'badge-warning' :
                                log.message_type === 'guia_envio' ? 'badge-info' :
                                log.message_type === 'pedido_entregado' ? 'badge-success' :
                                'badge-secondary'
                              }`}>
                                {log.message_type === 'pedido_en_ruta' ? 'En Ruta' :
                                 log.message_type === 'guia_envio' ? 'Guía Envío' :
                                 log.message_type === 'pedido_entregado' ? 'Entregado' :
                                 'Prueba'}
                              </span>
                            </td>
                            <td className="table-cell">
                              {getStatusBadge(log.status)}
                            </td>
                            <td className="table-cell">
                              {log.order_number ? (
                                <span className="text-primary-600 font-medium">
                                  {log.order_number}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="table-cell text-sm text-gray-500">
                              {formatDate(log.created_at)}
                            </td>
                            <td className="table-cell">
                              {log.status === 'fallido' && (
                                <button
                                  onClick={() => handleRetryWhatsApp(log.id)}
                                  className="btn btn-sm btn-outline text-xs"
                                >
                                  Reintentar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {whatsappLogs.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No hay logs de WhatsApp disponibles
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Configuración */}
          {activeTab === 'config' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Configuración de Credenciales</h2>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Configuración Avanzada
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Las credenciales se configuran a través de variables de entorno por seguridad. 
                      Contacta al administrador del sistema para cambiar estas configuraciones.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado de SIIGO
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="badge badge-success">Habilitado</span>
                    <span className="text-sm text-gray-500">
                      (Configurado en SIIGO_ENABLED=true)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Base de SIIGO API
                  </label>
                  <input
                    type="text"
                    value="https://api.siigo.com/v1"
                    disabled
                    className="input bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usuario SIIGO
                  </label>
                  <input
                    type="text"
                    value="COMERCIAL@PERLAS-EXPLOSIVAS.COM"
                    disabled
                    className="input bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Key
                  </label>
                  <input
                    type="password"
                    value="••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
                    disabled
                    className="input bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook Secret
                  </label>
                  <input
                    type="password"
                    value="••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
                    disabled
                    className="input bg-gray-50"
                  />
                </div>

                <div className="pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Información del Webhook</h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>URL del Webhook:</strong>
                    </p>
                    <code className="block bg-white p-2 rounded border text-sm">
                      https://tu-dominio.com/api/siigo/webhook/invoice-created
                    </code>
                    <p className="text-sm text-gray-600 mt-2">
                      Configura esta URL en SIIGO para recibir notificaciones automáticas de facturas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SiigoConfigPage;
