import React, { useState, useEffect } from 'react';
import { Calendar, Save, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const SiigoStartDateConfigPage = () => {
  const [startDate, setStartDate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [quotationsStartDate, setQuotationsStartDate] = useState('');
  const [quotationsEnabled, setQuotationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await api.get('/system-config');

      if (response.data.success) {
        // Asegurar que configs es un array
        const configs = Array.isArray(response.data.data)
          ? response.data.data
          : response.data.configs || [];

        const startDateConfig = configs.find(c => c.config_key === 'siigo_start_date');
        const enabledConfig = configs.find(c => c.config_key === 'siigo_start_date_enabled');
        const quotStartDateConfig = configs.find(c => c.config_key === 'siigo_quotations_start_date');
        const quotEnabledConfig = configs.find(c => c.config_key === 'siigo_quotations_start_date_enabled');

        if (startDateConfig) {
          setStartDate(startDateConfig.config_value);
        } else {
          setStartDate('2025-01-01');
        }

        if (enabledConfig) {
          setEnabled(enabledConfig.config_value === 'true');
        } else {
          setEnabled(true);
        }

        if (quotStartDateConfig) {
          setQuotationsStartDate(quotStartDateConfig.config_value);
        } else {
          setQuotationsStartDate('2025-01-01');
        }

        if (quotEnabledConfig) {
          setQuotationsEnabled(quotEnabledConfig.config_value === 'true');
        } else {
          setQuotationsEnabled(true);
        }

      } else {
        // Si la respuesta no es exitosa, usar valores por defecto
        setStartDate('2025-01-01');
        setEnabled(true);
        setQuotationsStartDate('2025-01-01');
        setQuotationsEnabled(true);
        toast.error('No se pudo cargar la configuración, usando valores por defecto');
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);

      // Si es error 404, usar valores por defecto
      if (error.response?.status === 404) {
        setStartDate('2025-01-01');
        setEnabled(true);
        setQuotationsStartDate('2025-01-01');
        setQuotationsEnabled(true);
        toast.error('El endpoint de configuración no está disponible. Usando valores por defecto.');
      } else {
        toast.error('Error cargando configuración');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if ((!startDate && enabled) || (!quotationsStartDate && quotationsEnabled)) {
      toast.error('Por favor selecciona una fecha de inicio para las configuraciones habilitadas');
      return;
    }

    try {
      setSaving(true);

      const response = await api.put('/system-config', {
        configs: [
          {
            config_key: 'siigo_start_date',
            config_value: startDate
          },
          {
            config_key: 'siigo_start_date_enabled',
            config_value: enabled.toString()
          },
          {
            config_key: 'siigo_quotations_start_date',
            config_value: quotationsStartDate
          },
          {
            config_key: 'siigo_quotations_start_date_enabled',
            config_value: quotationsEnabled.toString()
          }
        ]
      });

      if (response.data.success) {
        toast.success('Configuración guardada exitosamente');
      } else {
        toast.error('Error guardando configuración: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast.error('Error guardando configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-blue-600" />
          Configuración de Fecha de Inicio SIIGO
        </h1>
        <p className="text-gray-600">
          Configure desde qué fecha el sistema debe importar facturas y cotizaciones de SIIGO
        </p>
      </div>

      {/* Tarjeta Facturas */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Fecha de Inicio de Importación de Facturas
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
              Habilitar fecha de inicio personalizada
            </label>
          </div>

          {enabled && (
            <div className="space-y-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de inicio (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Solo se mostrarán facturas SIIGO creadas desde esta fecha en adelante
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tarjeta Cotizaciones */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            Fecha de Inicio de Importación de Cotizaciones
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="quotationsEnabled"
              checked={quotationsEnabled}
              onChange={(e) => setQuotationsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="quotationsEnabled" className="text-sm font-medium text-gray-700">
              Habilitar fecha de inicio personalizada
            </label>
          </div>

          {quotationsEnabled && (
            <div className="space-y-4">
              <div>
                <label htmlFor="quotationsStartDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de inicio (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  id="quotationsStartDate"
                  value={quotationsStartDate}
                  onChange={(e) => setQuotationsStartDate(e.target.value)}
                  className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Solo se mostrarán cotizaciones SIIGO creadas desde esta fecha en adelante
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botón de guardar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={saveConfiguration}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              ¿Cómo funciona esta configuración?
            </h3>
            <div className="text-sm text-blue-700 mt-1 space-y-1">
              <p>• Cuando está <strong>habilitada</strong>: El sistema solo mostrará documentos SIIGO desde la fecha configurada.</p>
              <p>• Cuando está <strong>deshabilitada</strong>: El sistema mostrará todos los documentos disponibles del último día.</p>
              <p>• Esta configuración afecta la importación automática y manual.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiigoStartDateConfigPage;
