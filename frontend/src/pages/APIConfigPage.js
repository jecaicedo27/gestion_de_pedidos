import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  Activity,
  BarChart3,
  MessageCircle,
  Wrench,
  Cloud,
  Smartphone
} from 'lucide-react';

const APIConfigPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('siigo');
  const [config, setConfig] = useState({
    siigo: {
      enabled: false,
      username: '',
      access_key: '',
      api_url: '',
      status: 'not_configured'
    },
    wapify: {
      enabled: false,
      api_key: '',
      api_url: '',
      status: 'not_configured'
    }
  });

  const [showCredentials, setShowCredentials] = useState({
    siigo_access_key: false,
    wapify_api_key: false
  });

  const [testResults, setTestResults] = useState({
    siigo: null,
    wapify: null
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAPIConfig();
    }
  }, [user]);

  const loadAPIConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/api-config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data.data);
      } else {
        toast.error('Error cargando configuración de APIs');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error conectando con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSiigoConfigUpdate = async (formData) => {
    try {
      setLoading(true);
      const response = await fetch('/api/api-config/siigo', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Configuración de SIIGO actualizada');
        await loadAPIConfig();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error actualizando SIIGO');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error conectando con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleWapifyConfigUpdate = async (formData) => {
    try {
      setLoading(true);
      const response = await fetch('/api/api-config/wapify', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Configuración de Wapify actualizada');
        await loadAPIConfig();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error actualizando Wapify');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error conectando con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const testAPIConnection = async (apiType) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/api-config/${apiType}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      setTestResults(prev => ({
        ...prev,
        [apiType]: result
      }));

      if (result.success) {
        toast.success(`Conexión exitosa con ${apiType.toUpperCase()}`);
      } else {
        toast.error(`Error conectando con ${apiType.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error probando conexión');
      setTestResults(prev => ({
        ...prev,
        [apiType]: { success: false, message: 'Error de conexión' }
      }));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      configured: { 
        class: 'bg-green-100 text-green-800', 
        text: 'Configurado',
        icon: CheckCircle 
      },
      error: { 
        class: 'bg-red-100 text-red-800', 
        text: 'Error',
        icon: AlertCircle 
      },
      disconnected: { 
        class: 'bg-yellow-100 text-yellow-800', 
        text: 'Desconectado',
        icon: AlertCircle 
      },
      not_configured: { 
        class: 'bg-gray-100 text-gray-800', 
        text: 'Sin configurar',
        icon: Settings 
      }
    };

    const config = statusConfig[status] || statusConfig.not_configured;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.class}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Configuración de APIs</h1>
          <p className="mt-2 text-gray-600">
            Gestiona las integraciones con APIs externas como SIIGO y Wapify
          </p>
        </div>

        {/* API Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Cloud className="h-6 w-6 text-blue-600" />
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
              { id: 'siigo', label: 'SIIGO', icon: Cloud },
              { id: 'wapify', label: 'Wapify', icon: Smartphone }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
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
                <button
                  onClick={() => testAPIConnection('siigo')}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  Probar Conexión
                </button>
              </div>

              {/* Test Results */}
              {testResults.siigo && (
                <div className={`mb-6 p-4 rounded-md ${
                  testResults.siigo.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {testResults.siigo.success ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${
                        testResults.siigo.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResults.siigo.data?.message || testResults.siigo.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Estado
                    </label>
                    <div className="mt-1">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={config.siigo.enabled}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            siigo: { ...prev.siigo, enabled: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-900">Habilitar SIIGO</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Usuario
                    </label>
                    <input
                      type="text"
                      value={config.siigo.username}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        siigo: { ...prev.siigo, username: e.target.value }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="usuario@empresa.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Access Key
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type={showCredentials.siigo_access_key ? 'text' : 'password'}
                        value={config.siigo.access_key}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          siigo: { ...prev.siigo, access_key: e.target.value }
                        }))}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
                        placeholder="••••••••••••••••••••••••••••••••"
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      URL de la API
                    </label>
                    <input
                      type="url"
                      value={config.siigo.api_url}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        siigo: { ...prev.siigo, api_url: e.target.value }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="https://api.siigo.com/v1"
                    />
                  </div>

                  <button
                    onClick={() => handleSiigoConfigUpdate({
                      username: config.siigo.username,
                      access_key: config.siigo.access_key,
                      enabled: config.siigo.enabled
                    })}
                    disabled={loading}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Guardar Configuración
                  </button>
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
                        className="ml-2 text-primary-600 hover:text-primary-500"
                      >
                        Ver documentación de SIIGO API
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wapify Configuration */}
          {activeTab === 'wapify' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Configuración Wapify</h2>
                <button
                  onClick={() => testAPIConnection('wapify')}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  Probar Conexión
                </button>
              </div>

              {/* Test Results */}
              {testResults.wapify && (
                <div className={`mb-6 p-4 rounded-md ${
                  testResults.wapify.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {testResults.wapify.success ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${
                        testResults.wapify.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResults.wapify.data?.message || testResults.wapify.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Estado
                    </label>
                    <div className="mt-1">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={config.wapify.enabled}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            wapify: { ...prev.wapify, enabled: e.target.checked }
                          }))}
                          className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-900">Habilitar Wapify</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      API Key
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type={showCredentials.wapify_api_key ? 'text' : 'password'}
                        value={config.wapify.api_key}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          wapify: { ...prev.wapify, api_key: e.target.value }
                        }))}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm pr-10"
                        placeholder="••••••••••••••••••••••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCredentials(prev => ({
                          ...prev,
                          wapify_api_key: !prev.wapify_api_key
                        }))}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showCredentials.wapify_api_key ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      URL de la API
                    </label>
                    <input
                      type="url"
                      value={config.wapify.api_url}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        wapify: { ...prev.wapify, api_url: e.target.value }
                      }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="https://api.wapify.com/v1"
                    />
                  </div>

                  <button
                    onClick={() => handleWapifyConfigUpdate({
                      api_key: config.wapify.api_key,
                      enabled: config.wapify.enabled
                    })}
                    disabled={loading}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Guardar Configuración
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Información</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Estado actual:</span>
                      <span className="ml-2">{getStatusBadge(config.wapify.status)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Funcionalidades:</span>
                      <ul className="mt-1 ml-4 list-disc text-gray-600">
                        <li>Envío de mensajes WhatsApp</li>
                        <li>Notificaciones automáticas</li>
                        <li>Mensajes de pedidos en ruta</li>
                        <li>Confirmaciones de entrega</li>
                      </ul>
                    </div>
                    <div className="pt-4">
                      <span className="font-medium text-gray-700">Documentación:</span>
                      <a 
                        href="https://wapify.com/docs" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-primary-600 hover:text-primary-500"
                      >
                        Ver documentación de Wapify API
                      </a>
                    </div>
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

export default APIConfigPage;
