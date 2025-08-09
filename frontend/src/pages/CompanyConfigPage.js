import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { companyConfigService } from '../services/api';

const CompanyConfigPage = () => {
  const [config, setConfig] = useState({
    company_name: '',
    nit: '',
    email: '',
    address: '',
    whatsapp: '',
    city: '',
    department: '',
    postal_code: '',
    website: '',
    logo_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCompanyConfig();
  }, []);

  const loadCompanyConfig = async () => {
    try {
      const response = await companyConfigService.getConfig();
      // Normalizar valores para evitar null en inputs
      const normalizedConfig = {
        company_name: response.data?.company_name || '',
        nit: response.data?.nit || '',
        email: response.data?.email || '',
        address: response.data?.address || '',
        whatsapp: response.data?.whatsapp || '',
        city: response.data?.city || '',
        department: response.data?.department || '',
        postal_code: response.data?.postal_code || '',
        website: response.data?.website || '',
        logo_url: response.data?.logo_url || ''
      };
      setConfig(normalizedConfig);
    } catch (error) {
      console.error('Error cargando configuración:', error);
      toast.error('Error al cargar configuración de empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await companyConfigService.updateConfig(config);
      setConfig(response.data || config);
      toast.success('Configuración de empresa actualizada exitosamente');
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast.error(error.response?.data?.message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Configuración de Empresa
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Configura los datos de tu empresa que se usarán en guías de envío y documentos
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre de la Empresa */}
              <div className="md:col-span-2">
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  value={config.company_name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Mi Empresa S.A.S"
                />
              </div>

              {/* NIT */}
              <div>
                <label htmlFor="nit" className="block text-sm font-medium text-gray-700">
                  NIT *
                </label>
                <input
                  type="text"
                  id="nit"
                  name="nit"
                  value={config.nit}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 900123456-7"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={config.email}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: info@miempresa.com"
                />
              </div>

              {/* Dirección */}
              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Dirección desde donde se despacha *
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={config.address}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Carrera 45 # 26-85, Piso 3, Oficina 302"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
                  WhatsApp *
                </label>
                <input
                  type="text"
                  id="whatsapp"
                  name="whatsapp"
                  value={config.whatsapp}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: +57 300 123 4567"
                />
              </div>

              {/* Ciudad */}
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                  Ciudad
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={config.city}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Bogotá"
                />
              </div>

              {/* Departamento */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Departamento
                </label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={config.department}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Cundinamarca"
                />
              </div>

              {/* Código Postal */}
              <div>
                <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700">
                  Código Postal
                </label>
                <input
                  type="text"
                  id="postal_code"
                  name="postal_code"
                  value={config.postal_code}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: 110111"
                />
              </div>

              {/* Sitio Web */}
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                  Sitio Web
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={config.website}
                  onChange={handleChange}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: https://www.miempresa.com"
                />
              </div>
            </div>

            {/* Información importante */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Importante:</strong> Estos datos se utilizarán automáticamente en:
                  </p>
                  <ul className="mt-2 text-sm text-blue-600 list-disc list-inside">
                    <li>Guías de envío y documentos de despacho</li>
                    <li>Facturas y documentos comerciales</li>
                    <li>Comunicaciones con clientes</li>
                    <li>Reportes del sistema</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={loadCompanyConfig}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Recargar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  'Guardar Configuración'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompanyConfigPage;
