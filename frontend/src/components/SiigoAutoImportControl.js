import React, { useState, useEffect } from 'react';
import api from '../services/api';

const SiigoAutoImportControl = () => {
  const [status, setStatus] = useState({
    isRunning: false,
    knownInvoicesCount: 0,
    queueLength: 0,
    lastCheck: null
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatus();
    
    // Verificar estado cada 30 segundos
    const interval = setInterval(() => {
      if (!loading) {
        loadStatus();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loading]);

  const loadStatus = async () => {
    try {
      const response = await api.get('/siigo-auto-import/status');
      if (response.data.success) {
        setStatus(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando estado:', error);
    }
  };

  const toggleAutoImport = async () => {
    setLoading(true);
    
    try {
      const endpoint = status.isRunning ? '/siigo-auto-import/stop' : '/siigo-auto-import/start';
      const response = await api.post(endpoint);
      
      if (response.data.success) {
        setStatus(response.data.data);
        
        // Mostrar notificación
        const message = status.isRunning 
          ? 'Importación automática detenida' 
          : 'Importación automática iniciada';
        
        console.log(message);
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          🤖 Importación Automática SIIGO
        </h3>
        
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${status.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium">
            {status.isRunning ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{status.knownInvoicesCount}</div>
          <div className="text-sm text-blue-800">Facturas conocidas</div>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{status.queueLength}</div>
          <div className="text-sm text-yellow-800">En cola de importación</div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm font-bold text-gray-600">
            {status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : 'N/A'}
          </div>
          <div className="text-sm text-gray-800">Última verificación</div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-semibold text-gray-700 mb-2">¿Cómo funciona?</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✅ Monitorea SIIGO cada 2 minutos buscando nuevas facturas</li>
          <li>✅ Importa automáticamente las facturas nuevas como pedidos</li>
          <li>✅ Envía notificaciones cuando detecta y procesa facturas</li>
          <li>✅ Reintentos automáticos en caso de errores</li>
        </ul>
      </div>

      <button
        onClick={toggleAutoImport}
        disabled={loading}
        className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
          status.isRunning
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? (
          'Procesando...'
        ) : status.isRunning ? (
          '🛑 Detener Importación Automática'
        ) : (
          '🚀 Iniciar Importación Automática'
        )}
      </button>
      
      {status.isRunning && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm text-green-800">
              Sistema activo - Monitoreando nuevas facturas cada 2 minutos
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiigoAutoImportControl;
