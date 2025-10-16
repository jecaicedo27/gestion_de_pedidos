import React, { useState } from 'react';
import { Search, Database, Info, AlertCircle, CheckCircle, Loader, Eye, DollarSign, FileText, Calendar, Building } from 'lucide-react';
import api from '../services/api';

const SiigoConsultaPage = () => {
  const [nit, setNit] = useState('');
  const [loading, setLoading] = useState(false);
  const [estadoSiigo, setEstadoSiigo] = useState(null);
  const [clienteData, setClienteData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('basico');

  // Verificar estado de conexión SIIGO al montar el componente
  React.useEffect(() => {
    // Verificar estado solo una vez al cargar la página
    verificarEstadoSiigo();
  }, []);

  const verificarEstadoSiigo = async () => {
    try {
      const response = await api.get('/siigo-consulta/estado');
      setEstadoSiigo(response.data.data);
    } catch (error) {
      console.error('Error verificando estado SIIGO:', error);
      if (error.response?.status === 429) {
        setEstadoSiigo({ 
          connected: false, 
          error: 'SIIGO API temporalmente limitada (demasiadas peticiones). Intenta en unos minutos.' 
        });
      } else {
        setEstadoSiigo({ connected: false, error: 'Error de conexión' });
      }
    }
  };

  const consultarCliente = async (e) => {
    e.preventDefault();
    
    if (!nit.trim()) {
      setError('Por favor ingresa un NIT válido');
      return;
    }

    setLoading(true);
    setError('');
    setClienteData(null);

    try {
      const response = await api.get(`/siigo-consulta/cliente/${nit.trim()}`);
      
      if (response.data.success) {
        setClienteData(response.data.data);
        setActiveTab('basico');
      } else {
        setError(response.data.message || 'Error consultando cliente');
      }
    } catch (error) {
      console.error('Error consultando cliente:', error);
      if (error.response?.status === 404) {
        setError(`No se encontró cliente con NIT: ${nit}`);
      } else if (error.response?.status === 403) {
        setError('No tienes permisos para realizar esta consulta');
      } else {
        setError('Error interno del servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No disponible';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const tabs = [
    { id: 'basico', label: 'Información Básica', icon: Building },
    { id: 'detallado', label: 'Datos Completos', icon: Info },
    { id: 'financiero', label: 'Estado Financiero', icon: DollarSign },
    { id: 'facturas', label: 'Facturas Recientes', icon: FileText },
    { id: 'estadisticas', label: 'Estadísticas', icon: Database }
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Database className="mr-2" />
              Consulta SIIGO Avanzada
            </h1>
            <p className="text-gray-600">Consulta información completa de clientes desde SIIGO</p>
          </div>
          
          {/* Estado de conexión SIIGO */}
          <div className="flex items-center space-x-2">
            {estadoSiigo ? (
              estadoSiigo.connected ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-5 h-5 mr-1" />
                  <span className="text-sm">SIIGO Conectado</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="w-5 h-5 mr-1" />
                  <span className="text-sm">SIIGO Desconectado</span>
                </div>
              )
            ) : (
              <div className="flex items-center text-gray-500">
                <Loader className="w-5 h-5 mr-1 animate-spin" />
                <span className="text-sm">Verificando...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Formulario de búsqueda */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={consultarCliente} className="space-y-4">
          <div>
            <label htmlFor="nit" className="block text-sm font-medium text-gray-700 mb-2">
              NIT del Cliente
            </label>
            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  id="nit"
                  value={nit}
                  onChange={(e) => setNit(e.target.value)}
                  placeholder="Ejemplo: 59856269"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !estadoSiigo?.connected}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Consultar
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center p-4 text-red-700 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Resultados */}
      {clienteData && (
        <div className="space-y-6">
          {/* Tabs de navegación */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
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

            {/* Contenido de tabs */}
            <div className="p-6">
              {activeTab === 'basico' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">ID SIIGO</label>
                      <p className="text-lg font-mono">{clienteData.cliente_basico.id}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">Nombre Comercial</label>
                      <p className="text-lg">{clienteData.cliente_basico.nombre_comercial || 'No especificado'}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">Identificación</label>
                      <p className="text-lg">{clienteData.cliente_basico.identificacion}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">Tipo de Cliente</label>
                      <p className="text-lg">{clienteData.cliente_basico.tipo_cliente}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">Fecha de Creación</label>
                      <p className="text-lg">{formatDate(clienteData.cliente_basico.creado)}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">Última Actualización</label>
                      <p className="text-lg">{formatDate(clienteData.cliente_basico.actualizado)}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'detallado' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Completos del Cliente</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                      {JSON.stringify(clienteData.cliente_detallado, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'financiero' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado Financiero</h3>
                  
                  {/* Métricas principales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                      <div className="flex items-center">
                        <DollarSign className="w-8 h-8 text-green-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-600">Total Vendido</p>
                          <p className="text-2xl font-bold text-green-700">
                            {formatCurrency(clienteData.cuentas_por_cobrar.total_sold || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="w-8 h-8 text-blue-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-blue-600">Total Pagado</p>
                          <p className="text-2xl font-bold text-blue-700">
                            {formatCurrency(clienteData.cuentas_por_cobrar.total_paid || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                      <div className="flex items-center">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-red-600">Faltante por Pagar</p>
                          <p className="text-2xl font-bold text-red-700">
                            {formatCurrency(clienteData.cuentas_por_cobrar.remaining_to_pay || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                      <div className="flex items-center">
                        <DollarSign className="w-8 h-8 text-purple-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-purple-600">Total Descuentos</p>
                          <p className="text-2xl font-bold text-purple-700">
                            {formatCurrency(clienteData.cuentas_por_cobrar.total_discounts || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Métricas adicionales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-8 h-8 text-orange-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-orange-600">Facturas Pendientes</p>
                          <p className="text-2xl font-bold text-orange-700">
                            {clienteData.resumen_financiero.facturas_pendientes}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
                      <div className="flex items-center">
                        <DollarSign className="w-8 h-8 text-indigo-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-indigo-600">% Pagado</p>
                          <p className="text-2xl font-bold text-indigo-700">
                            {(clienteData.cuentas_por_cobrar.payment_percentage || 0).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg">
                      <div className="flex items-center">
                        <DollarSign className="w-8 h-8 text-teal-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-teal-600">% Descuentos</p>
                          <p className="text-2xl font-bold text-teal-700">
                            {(clienteData.cuentas_por_cobrar.discount_percentage || 0).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalle de cuentas por cobrar */}
                  {clienteData.cuentas_por_cobrar.pending_invoices?.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Facturas con Saldo Pendiente</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Factura
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pagado
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Saldo
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {clienteData.cuentas_por_cobrar.pending_invoices.slice(0, 10).map((factura, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {factura.invoice_number}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatCurrency(factura.total)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatCurrency(factura.paid)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                                  {formatCurrency(factura.balance)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(factura.created_date)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'facturas' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Facturas Recientes</h3>
                  {clienteData.facturas_recientes?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Número
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Fecha
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Estado
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Pagos
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Vencimiento
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {clienteData.facturas_recientes.map((factura, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {factura.numero}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(factura.fecha)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency(factura.total)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {factura.estado || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {factura.pagos}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(factura.vencimiento)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No hay facturas recientes disponibles
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'estadisticas' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">Total Facturas Consultadas</label>
                      <p className="text-2xl font-bold text-blue-600">
                        {clienteData.estadisticas.total_facturas_consultadas}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600">Promedio por Factura</label>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(clienteData.estadisticas.promedio_factura)}
                      </p>
                    </div>
                    {clienteData.estadisticas.rango_fechas && (
                      <>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <label className="block text-sm font-medium text-gray-600">Primera Factura</label>
                          <p className="text-lg">{formatDate(clienteData.estadisticas.rango_fechas.primera_factura)}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <label className="block text-sm font-medium text-gray-600">Última Factura</label>
                          <p className="text-lg">{formatDate(clienteData.estadisticas.rango_fechas.ultima_factura)}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Metadatos */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-md font-medium text-blue-900 mb-3">Metadatos de Consulta</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-700">Consulta realizada:</span>
                        <br />
                        {formatDate(clienteData.metadatos.consulta_realizada)}
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Usuario:</span>
                        <br />
                        {clienteData.metadatos.usuario_consulta}
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">NIT consultado:</span>
                        <br />
                        {clienteData.metadatos.nit_consultado}
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Fuente:</span>
                        <br />
                        {clienteData.metadatos.fuente_datos}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiigoConsultaPage;
