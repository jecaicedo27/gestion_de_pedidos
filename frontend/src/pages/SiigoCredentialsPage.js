import React, { useState, useEffect } from 'react';
import { 
  Save, 
  TestTube, 
  Shield, 
  ShieldOff, 
  Trash2, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  Database,
  Key,
  Globe
} from 'lucide-react';
import api from '../services/api';

const SiigoCredentialsPage = () => {
  const [credentials, setCredentials] = useState({
    siigo_username: '',
    siigo_access_key: '',
    siigo_base_url: 'https://api.siigo.com/v1',
    webhook_secret: '',
    is_enabled: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await api.get('/siigo-credentials');
      
      if (response.data.success) {
        setCredentials(response.data.data);
        setConfigured(response.data.data.configured);
        setLastUpdated(response.data.data.updated_at);
      }
    } catch (error) {
      console.error('Error cargando credenciales:', error);
      setMessage({
        type: 'error',
        text: 'Error cargando credenciales de SIIGO'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    if (!credentials.siigo_username || !credentials.siigo_access_key) {
      setMessage({
        type: 'error',
        text: 'El usuario y Access Key son campos obligatorios'
      });
      return;
    }

    try {
      setSaving(true);
      const response = await api.post('/siigo-credentials', credentials);
      
      if (response.data.success) {
        setMessage({
          type: 'success',
          text: 'Credenciales de SIIGO guardadas exitosamente'
        });
        setConfigured(true);
        await loadCredentials();
      }
    } catch (error) {
      console.error('Error guardando credenciales:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error guardando credenciales'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!credentials.siigo_username || !credentials.siigo_access_key) {
      setMessage({
        type: 'error',
        text: 'Debe proporcionar usuario y Access Key para probar la conexión'
      });
      return;
    }

    try {
      setTesting(true);
      setConnectionStatus(null);
      
      const response = await api.post('/siigo-credentials/test', {
        siigo_username: credentials.siigo_username,
        siigo_access_key: credentials.siigo_access_key,
        siigo_base_url: credentials.siigo_base_url
      });
      
      if (response.data.success) {
        setConnectionStatus({
          type: 'success',
          message: response.data.message,
          details: response.data.data
        });
        setMessage({
          type: 'success',
          text: 'Conexión con SIIGO exitosa'
        });
      }
    } catch (error) {
      console.error('Error probando conexión:', error);
      setConnectionStatus({
        type: 'error',
        message: error.response?.data?.message || 'Error en la conexión',
        details: error.response?.data?.error
      });
      setMessage({
        type: 'error',
        text: 'Error probando conexión con SIIGO'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleEnabled = async () => {
    try {
      const newEnabledState = !credentials.is_enabled;
      
      const response = await api.patch('/siigo-credentials/toggle', {
        is_enabled: newEnabledState
      });
      
      if (response.data.success) {
        setCredentials(prev => ({
          ...prev,
          is_enabled: newEnabledState
        }));
        setMessage({
          type: 'success',
          text: `Credenciales ${newEnabledState ? 'habilitadas' : 'deshabilitadas'} exitosamente`
        });
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error cambiando estado de credenciales'
      });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Está seguro de que desea eliminar las credenciales de SIIGO? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await api.delete('/siigo-credentials');
      
      if (response.data.success) {
        setCredentials({
          siigo_username: '',
          siigo_access_key: '',
          siigo_base_url: 'https://api.siigo.com/v1',
          webhook_secret: '',
          is_enabled: true
        });
        setConfigured(false);
        setConnectionStatus(null);
        setMessage({
          type: 'success',
          text: 'Credenciales eliminadas exitosamente'
        });
      }
    } catch (error) {
      console.error('Error eliminando credenciales:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error eliminando credenciales'
      });
    }
  };

  const getStatusBadge = () => {
    if (!configured) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-4 h-4 mr-1" />
          Sin configurar
        </span>
      );
    }

    if (!credentials.is_enabled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-4 h-4 mr-1" />
          Deshabilitado
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-4 h-4 mr-1" />
        Habilitado
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando credenciales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Database className="w-8 h-8 mr-3 text-blue-600" />
                Credenciales SIIGO
              </h1>
              <p className="text-gray-600 mt-2">
                Gestiona las credenciales de conexión con la API de SIIGO
              </p>
            </div>
            {getStatusBadge()}
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

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Usuario SIIGO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Key className="w-4 h-4 inline-block mr-1" />
                  Usuario SIIGO
                </label>
                <input
                  type="text"
                  name="siigo_username"
                  value={credentials.siigo_username}
                  onChange={handleInputChange}
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
                    type={showPassword ? "text" : "password"}
                    name="siigo_access_key"
                    value={credentials.siigo_access_key}
                    onChange={handleInputChange}
                    placeholder="Ingrese su Access Key de SIIGO"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
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
                  name="siigo_base_url"
                  value={credentials.siigo_base_url}
                  onChange={handleInputChange}
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
                    type={showWebhookSecret ? "text" : "password"}
                    name="webhook_secret"
                    value={credentials.webhook_secret}
                    onChange={handleInputChange}
                    placeholder="Secret para validar webhooks"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showWebhookSecret ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Estado habilitado */}
            <div className="mt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_enabled"
                  checked={credentials.is_enabled}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Habilitar credenciales SIIGO
                </span>
              </label>
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="mt-4 text-sm text-gray-500">
                Última actualización: {new Date(lastUpdated).toLocaleString()}
              </div>
            )}
          </div>

          {/* Connection Status */}
          {connectionStatus && (
            <div className="border-t border-gray-200 p-4">
              <div className={`p-4 rounded-lg ${
                connectionStatus.type === 'success' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start">
                  {connectionStatus.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 mr-2 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 mr-2 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      connectionStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {connectionStatus.message}
                    </p>
                    {connectionStatus.details && (
                      <pre className={`mt-2 text-xs ${
                        connectionStatus.type === 'success' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {JSON.stringify(connectionStatus.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
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
                onClick={handleTestConnection}
                disabled={testing || !credentials.siigo_username || !credentials.siigo_access_key}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4 mr-2" />
                )}
                {testing ? 'Probando...' : 'Probar Conexión'}
              </button>

              {configured && (
                <>
                  <button
                    onClick={handleToggleEnabled}
                    className={`inline-flex items-center px-4 py-2 rounded-lg ${
                      credentials.is_enabled
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {credentials.is_enabled ? (
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
                    onClick={handleDelete}
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

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            ℹ️ Información sobre las credenciales SIIGO
          </h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div>
              <strong>Usuario:</strong> Es el email de usuario registrado en SIIGO
            </div>
            <div>
              <strong>Access Key:</strong> Token de acceso proporcionado por SIIGO para la API
            </div>
            <div>
              <strong>URL Base:</strong> Endpoint base de la API de SIIGO (por defecto: https://api.siigo.com/v1)
            </div>
            <div>
              <strong>Webhook Secret:</strong> Secreto opcional para validar webhooks entrantes de SIIGO
            </div>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <strong>⚠️ Nota de seguridad:</strong> Las credenciales se almacenan encriptadas en la base de datos. 
              Solo los administradores pueden gestionar estas credenciales.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiigoCredentialsPage;
