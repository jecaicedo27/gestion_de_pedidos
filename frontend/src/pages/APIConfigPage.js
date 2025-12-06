import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Settings, 
  Save, 
  TestTube, 
  AlertCircle, 
  CheckCircle, 
  Loader,
  Eye,
  EyeOff,
  Database,
  Key,
  Globe,
  Shield,
  ShieldOff,
  Trash2,
  XCircle,
  Smartphone,
  RefreshCw,
  Play,
  Pause,
  Clock
} from 'lucide-react';
import api from '../services/api';

const APIConfigPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('siigo');
  
  // Polling states with localStorage persistence  
  const [pollingActive, setPollingActive] = useState(() => {
    const savedPollingActive = localStorage.getItem('apiconfig_polling_active');
    return savedPollingActive === 'true';
  });
  const [pollingInterval, setPollingInterval] = useState(() => {
    const savedInterval = localStorage.getItem('apiconfig_polling_interval');
    return savedInterval ? parseInt(savedInterval) : 30;
  });
  const [lastPollingUpdate, setLastPollingUpdate] = useState(() => {
    const savedUpdate = localStorage.getItem('apiconfig_last_polling_update');
    return savedUpdate ? new Date(savedUpdate) : null;
  });
  const pollingIntervalRef = useRef(null);
  
  const [config, setConfig] = useState({
    siigo: {
      configured: false,
      enabled: false,
      siigo_username: '',
      siigo_base_url: 'https://api.siigo.com',
      webhook_secret: '',
      updated_at: null,
      status: 'not_configured'
    },
    wapify: {
      configured: false,
      enabled: false,
      api_key: '',
      api_url: 'https://api.wapify.com/v1',
      status: 'not_configured'
    }
  });

  const [formData, setFormData] = useState({
    siigo: {
      siigo_username: '',
      siigo_access_key: '',
      siigo_base_url: 'https://api.siigo.com',
      webhook_secret: '',
      is_enabled: true
    },
    wapify: {
      api_key: '',
      base_url: 'https://api.wapify.com/v1',
      enabled: true
    }
  });

  const [showCredentials, setShowCredentials] = useState({
    siigo_access_key: false,
    wapify_api_key: false,
    webhook_secret: false
  });

  const [testResults, setTestResults] = useState({
    siigo: null,
    wapify: null
  });

  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAPIConfig();
    }
  }, [user]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Start/stop polling effect
  useEffect(() => {
    if (pollingActive && user?.role === 'admin') {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => stopPolling();
  }, [pollingActive, pollingInterval, user]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    if (type === 'success') {
      toast.success(text);
    } else {
      toast.error(text);
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const loadAPIConfig = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get('/api-config');
      
      if (response.data.success) {
        const data = response.data.data;
        setConfig(data);
        
        // Actualizar formData con los datos cargados (el backend ya envía asteriscos)
        setFormData(prev => ({
          ...prev,
          siigo: {
            siigo_username: data.siigo.siigo_username || '',
            siigo_access_key: data.siigo.siigo_access_key || '', // Backend ya envía asteriscos si existe
            siigo_base_url: data.siigo.siigo_base_url || 'https://api.siigo.com',
            webhook_secret: data.siigo.webhook_secret || '', // Backend ya envía asteriscos si existe
            is_enabled: data.siigo.enabled || false
          }
        }));
        
        if (silent) {
          const now = new Date();
          setLastPollingUpdate(now);
          localStorage.setItem('apiconfig_last_polling_update', now.toISOString());
        }
      } else {
        if (!silent) showMessage('error', 'Error cargando configuración de APIs');
      }
    } catch (error) {
      console.error('Error loading API config:', error);
      if (!silent) showMessage('error', 'Error conectando con el servidor');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSiigoSave = async () => {
    if (!formData.siigo.siigo_username || !formData.siigo.siigo_access_key) {
      showMessage('error', 'El usuario y Access Key son campos obligatorios');
      return;
    }

    try {
      setSaving(true);
      const response = await api.put('/api-config/siigo', formData.siigo);
      
      if (response.data.success) {
        showMessage('success', 'Credenciales de SIIGO guardadas exitosamente');
        await loadAPIConfig();
      }
    } catch (error) {
      console.error('Error saving SIIGO config:', error);
      showMessage('error', error.response?.data?.message || 'Error guardando credenciales');
    } finally {
      setSaving(false);
    }
  };

  const handleSiigoTest = async () => {
    if (!formData.siigo.siigo_username || !formData.siigo.siigo_access_key) {
      showMessage('error', 'Debe proporcionar usuario y Access Key para probar la conexión');
      return;
    }

    try {
      setTesting(true);
      setTestResults(prev => ({ ...prev, siigo: null }));
      
      const params = new URLSearchParams();
      params.append('siigo_username', formData.siigo.siigo_username);
      params.append('siigo_access_key', formData.siigo.siigo_access_key);
      params.append('siigo_base_url', formData.siigo.siigo_base_url);
      const response = await api.post('/api-config/siigo/test', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      if (response.data.success) {
        setTestResults(prev => ({
          ...prev,
          siigo: {
            type: 'success',
            message: response.data.message,
            details: response.data.data
          }
        }));
        showMessage('success', 'Conexión con SIIGO exitosa');
      }
    } catch (error) {
      console.error('Error testing SIIGO connection:', error);
      setTestResults(prev => ({
        ...prev,
        siigo: {
          type: 'error',
          message: error.response?.data?.message || 'Error en la conexión',
          details: error.response?.data?.error
        }
      }));
      showMessage('error', 'Error probando conexión con SIIGO');
    } finally {
      setTesting(false);
    }
  };

  const handleSiigoToggle = async () => {
    try {
      const newEnabledState = !config.siigo.enabled;
      
      const response = await api.patch('/api-config/siigo/toggle', {
        is_enabled: newEnabledState
      });
      
      if (response.data.success) {
        setConfig(prev => ({
          ...prev,
          siigo: { ...prev.siigo, enabled: newEnabledState }
        }));
        showMessage('success', `Credenciales ${newEnabledState ? 'habilitadas' : 'deshabilitadas'} exitosamente`);
      }
    } catch (error) {
      console.error('Error toggling SIIGO:', error);
      showMessage('error', error.response?.data?.message || 'Error cambiando estado de credenciales');
    }
  };

  const handleSiigoDelete = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar las credenciales de SIIGO? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await api.delete('/api-config/siigo');
      
      if (response.data.success) {
        setFormData(prev => ({
          ...prev,
          siigo: {
            siigo_username: '',
            siigo_access_key: '',
            siigo_base_url: 'https://api.siigo.com',
            webhook_secret: '',
            is_enabled: true
          }
        }));
        setTestResults(prev => ({ ...prev, siigo: null }));
        showMessage('success', 'Credenciales eliminadas exitosamente');
        await loadAPIConfig();
      }
    } catch (error) {
      console.error('Error deleting SIIGO credentials:', error);
      showMessage('error', error.response?.data?.message || 'Error eliminando credenciales');
    }
  };

  // Polling functions
  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(() => {
      loadAPIConfig(true); // Silent reload
    }, pollingInterval * 1000);
    
    console.log(`🔄 Polling iniciado cada ${pollingInterval} segundos`);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('⏹️ Polling detenido');
    }
  };

  const togglePolling = () => {
    const newPollingState = !pollingActive;
    setPollingActive(newPollingState);
    localStorage.setItem('apiconfig_polling_active', newPollingState.toString());
    
    if (newPollingState) {
      console.log('🔄 Polling activado por el usuario');
    } else {
      console.log('⏹️ Polling desactivado por el usuario');
    }
  };

  const handlePollingIntervalChange = (newInterval) => {
    setPollingInterval(newInterval);
    localStorage.setItem('apiconfig_polling_interval', newInterval.toString());
    
    if (pollingActive) {
      // Restart polling with new interval
      stopPolling();
      setTimeout(() => {
        if (pollingActive) {
          startPolling();
        }
      }, 100);
    }
  };

  const handleManualRefresh = async () => {
    await loadAPIConfig(true);
    showMessage('success', 'Configuración actualizada');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      configured: { 
        class: 'bg-green-100 text-green-800', 
        text: 'Configurado',
        icon: CheckCircle 
      },
      disabled: { 
        class: 'bg-yellow-100 text-yellow-800', 
        text: 'Deshabilitado',
        icon: AlertCircle 
      },
      error: { 
        class: 'bg-red-100 text-red-800', 
        text: 'Error',
        icon: XCircle 
      },
      not_configured: { 
        class: 'bg-gray-100 text-gray-800', 
        text: 'Sin configurar',
        icon: AlertCircle 
      }
    };

    const configStatus = statusConfig[status] || statusConfig.not_configured;
    const Icon = configStatus.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${configStatus.class}`}>
        <Icon className="w-3 h-3 mr-1" />
        {configStatus.text}
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
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Settings className="w-8 h-8 mr-3 text-blue-600" />
                Configuración de APIs
              </h1>
              <p className="mt-2 text-gray-600">
                Gestiona las integraciones con APIs externas como SIIGO y Wapify
              </p>
            </div>
            
            {/* Polling Controls */}
            <div className="bg-white rounded-lg shadow p-4 min-w-0">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Auto Refresh:</span>
                  
                  <button
                    onClick={togglePolling}
                    className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ${
                      pollingActive
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pollingActive ? (
                      <>
                        <Pause className="w-3 h-3 mr-1" />
                        ON
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        OFF
                      </>
                    )}
                  </button>
                </div>

                {pollingActive && (
                  <div className="flex items-center space-x-2">
                    <select
                      value={pollingInterval}
                      onChange={(e) => handlePollingIntervalChange(parseInt(e.target.value))}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={15}>15s</option>
                      <option value={30}>30s</option>
                      <option value={60}>1m</option>
                      <option value={120}>2m</option>
                      <option value={300}>5m</option>
                    </select>
                    
                    {lastPollingUpdate && (
                      <span className="text-xs text-gray-500">
                        {lastPollingUpdate.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={handleManualRefresh}
                  className="inline-flex items-center px-2.5 py-1.5 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-xs font-medium"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 mr-2" />
              )}
              {message.text}
            </div>
          </div>
        )}

        {/* API Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Database className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">SIIGO</h3>
                  <p className="text-sm text-gray-500">Sistema de facturación</p>
                </div>
              </div>
              {getStatusBadge(config.siigo.status)}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Estado:</span>
                <span className={`font-medium ${config.siigo.enabled ? 'text-green-600' : 'text-gray-600'}`}>
                  {config.siigo.enabled ? 'Habilitado' : 'Deshabilitado'}
                </span>
              </div>
              {config.siigo.updated_at && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-500">Última actualización:</span>
                  <span className="text-gray-600">
                    {new Date(config.siigo.updated_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Smartphone className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Wapify</h3>
                  <p className="text-sm text-gray-500">Mensajería WhatsApp</p>
                </div>
              </div>
              {getStatusBadge(config.wapify.status)}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Estado:</span>
                <span className={`font-medium ${config.wapify.enabled ? 'text-green-600' : 'text-gray-600'}`}>
                  {config.wapify.enabled ? 'Habilitado' : 'Deshabilitado'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'siigo', label: 'SIIGO', icon: Database },
              { id: 'wapify', label: 'Wapify', icon: Smartphone }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg">
          {/* SIIGO Configuration */}
          {activeTab === 'siigo' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Configuración SIIGO</h2>
                {getStatusBadge(config.siigo.status)}
              </div>

              {/* Test Results */}
              {testResults.siigo && (
                <div className={`mb-6 p-4 rounded-lg ${
                  testResults.siigo.type === 'success' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start">
                    {testResults.siigo.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 mr-2 text-red-600 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        testResults.siigo.type === 'success' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResults.siigo.message}
                      </p>
                      {testResults.siigo.details && (
                        <pre className={`mt-2 text-xs ${
                          testResults.siigo.type === 'success' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {JSON.stringify(testResults.siigo.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {/* Usuario SIIGO */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Key className="w-4 h-4 inline-block mr-1" />
                      Usuario SIIGO
                    </label>
                    <input
                      type="text"
                      value={formData.siigo.siigo_username}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        siigo: { ...prev.siigo, siigo_username: e.target.value }
                      }))}
                      placeholder="usuario@empresa.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Access Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Shield className="w-4 h-4 inline-block mr-1" />
                      Access Key
                    </label>
                    <div className="relative">
                      <input
                        type={showCredentials.siigo_access_key ? "text" : "password"}
                        value={formData.siigo.siigo_access_key}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          siigo: { ...prev.siigo, siigo_access_key: e.target.value }
                        }))}
                        placeholder="Ingrese su Access Key de SIIGO"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredentials(prev => ({
                          ...prev,
                          siigo_access_key: !prev.siigo_access_key
                        }))}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showCredentials.siigo_access_key ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* URL Base */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Globe className="w-4 h-4 inline-block mr-1" />
                      URL Base API
                    </label>
                    <input
                      type="text"
                      value={formData.siigo.siigo_base_url}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        siigo: { ...prev.siigo, siigo_base_url: e.target.value }
                      }))}
                      placeholder="https://api.siigo.com/v1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Webhook Secret */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Key className="w-4 h-4 inline-block mr-1" />
                      Webhook Secret (opcional)
                    </label>
                    <div className="relative">
                      <input
                        type={showCredentials.webhook_secret ? "text" : "password"}
                        value={formData.siigo.webhook_secret}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          siigo: { ...prev.siigo, webhook_secret: e.target.value }
                        }))}
                        placeholder="Secret para validar webhooks"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredentials(prev => ({
                          ...prev,
                          webhook_secret: !prev.webhook_secret
                        }))}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showCredentials.webhook_secret ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Estado habilitado */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.siigo.is_enabled}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          siigo: { ...prev.siigo, is_enabled: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Habilitar credenciales SIIGO
                      </span>
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Información</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Estado actual:</span>
                      <span className="ml-2">{getStatusBadge(config.siigo.status)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Funcionalidades:</span>
                      <ul className="mt-1 ml-4 list-disc text-gray-600">
                        <li>Importación automática de facturas</li>
                        <li>Sincronización de clientes</li>
                        <li>Webhook de notificaciones</li>
                        <li>Consulta de balances</li>
                      </ul>
                    </div>
                    <div className="pt-4">
                      <span className="font-medium text-gray-700">Documentación:</span>
                      <a 
                        href="https://api.siigo.com/docs" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-600 hover:text-blue-500"
                      >
                        Ver documentación de SIIGO API
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSiigoSave}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {saving ? 'Guardando...' : 'Guardar Credenciales'}
                  </button>

                  <button
                    onClick={handleSiigoTest}
                    disabled={testing || !formData.siigo.siigo_username || !formData.siigo.siigo_access_key}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testing ? (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4 mr-2" />
                    )}
                    {testing ? 'Probando...' : 'Probar Conexión'}
                  </button>

                  {config.siigo.configured && (
                    <>
                      <button
                        onClick={handleSiigoToggle}
                        className={`inline-flex items-center px-4 py-2 rounded-lg ${
                          config.siigo.enabled
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {config.siigo.enabled ? (
                          <>
                            <ShieldOff className="w-4 h-4 mr-2" />
                            Deshabilitar
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Habilitar
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleSiigoDelete}
                        className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Wapify Configuration */}
          {activeTab === 'wapify' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Configuración Wapify</h2>
                {getStatusBadge(config.wapify.status)}
              </div>
              
              <div className="text-center py-12">
                <Smartphone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Próximamente</h3>
                <p className="text-gray-600">
                  La configuración de Wapify estará disponible en una próxima versión.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default APIConfigPage;
