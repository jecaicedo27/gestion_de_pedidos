import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import authService from '../services/authService';
import SendMessageModal from '../components/SendMessageModal';

const CustomersPage = () => {
  // Estados principales
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [fullSyncLoading, setFullSyncLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Estados de diálogos
  const [updateDialog, setUpdateDialog] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadCustomerStats();
    loadCustomers();
  }, [page, rowsPerPage, searchTerm]);

  // Función para cargar estadísticas
  const loadCustomerStats = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch('/api/customers/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // Función para cargar clientes
  const loadCustomers = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();

      const queryParams = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm
      });

      const response = await fetch(`/api/customers?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.data.customers);
        setTotalCount(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
      toast.error('Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  // Función para actualizar todos los clientes desde SIIGO
  const handleUpdateAllCustomers = async () => {
    try {
      setUpdateLoading(true);
      setUpdateDialog(false);

      const token = authService.getToken();
      const response = await fetch('/api/customers/update-all-from-siigo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setUpdateResult(data);
        toast.success(
          `Actualización completada: ${data.data.updatedCount} pedidos actualizados`
        );

        // Recargar datos
        await loadCustomerStats();
        await loadCustomers();
      } else {
        toast.error(data.message || 'Error en la actualización');
        setUpdateResult({
          success: false,
          message: data.message || 'Error desconocido',
          data: { updatedCount: 0, errorCount: 1 }
        });
      }
    } catch (error) {
      console.error('Error actualizando clientes:', error);
      toast.error('Error conectando con el servidor');
      setUpdateResult({
        success: false,
        message: 'Error de conexión',
        data: { updatedCount: 0, errorCount: 1 }
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  // Sincronización completa desde SIIGO (trae TODAS las páginas)
  const handleFullSyncCustomers = async () => {
    try {
      setFullSyncLoading(true);
      const token = authService.getToken();
      const maxPages = 300; // ajustar si se requiere
      const response = await fetch(`/api/customers/full-sync?max_pages=${maxPages}&async=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setUpdateResult(data);
        toast.success(`Sincronización completa: procesados ${data.data.processed}, nuevos ${data.data.created}`);
        await loadCustomerStats();
        await loadCustomers();
      } else {
        toast.error(data.message || 'Error en sincronización completa');
      }
    } catch (e) {
      console.error('Error en full sync:', e);
      toast.error('Error conectando con el servidor');
    } finally {
      setFullSyncLoading(false);
    }
  };

  // Funciones de paginación
  const handleChangePage = (newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (newRowsPerPage) => {
    setRowsPerPage(parseInt(newRowsPerPage, 10));
    setPage(0);
  };

  // Función para obtener el color del indicador según el porcentaje
  const getCompletionColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600 bg-green-100';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Formatear números
  const formatNumber = (number) => {
    return new Intl.NumberFormat('es-CO').format(number || 0);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Clientes</h1>
          <p className="text-gray-600">Administración y sincronización de clientes desde SIIGO</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              loadCustomerStats();
              loadCustomers();
            }}
            disabled={loading || updateLoading}
            className="btn btn-secondary flex items-center"
          >
            <Icons.RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Vista
          </button>
          <button
            onClick={handleFullSyncCustomers}
            disabled={loading || fullSyncLoading}
            className="btn btn-primary flex items-center"
          >
            {fullSyncLoading ? (
              <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Icons.RefreshCcw className="w-4 h-4 mr-2" />
            )}
            {fullSyncLoading ? 'Extrayendo clientes...' : 'Actualizar desde SIIGO'}
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="card-content p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Clientes con Nombre Comercial</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatNumber(stats.customersWithCommercialName)}
                  </p>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getCompletionColor(stats.completionPercentage)}`}>
                    {stats.completionPercentage}%
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Icons.CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sin Nombre Comercial</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatNumber(stats.customersWithoutCommercialName)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Icons.AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Clientes (BD)</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatNumber(stats.customersInTable)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Icons.Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultado de actualización */}
      {updateResult && (
        <div className={`card mb-6 border-l-4 ${updateResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <div className="card-content p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-medium ${updateResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {updateResult.success ? '✅ Actualización Completada' : '❌ Error en Actualización'}
                </h3>
                <p className={`text-sm mt-1 ${updateResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {updateResult.message}
                </p>
                {updateResult.data && (
                  <div className="mt-2 text-sm">
                    <p>• Pedidos actualizados: <strong>{updateResult.data.updatedCount || 0}</strong></p>
                    {updateResult.data.errorCount > 0 && (
                      <p className="text-red-600">• Errores: <strong>{updateResult.data.errorCount}</strong></p>
                    )}
                    {updateResult.data.processedCustomers && (
                      <p>• Clientes procesados: <strong>{updateResult.data.processedCustomers}</strong></p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setUpdateResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de progreso de actualización */}
      {updateLoading && (
        <div className="card mb-6">
          <div className="card-content p-4">
            <h3 className="font-medium text-gray-900 mb-2">Actualizando clientes desde SIIGO...</h3>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <p className="text-sm text-gray-600">Este proceso puede tomar varios minutos. Se están sincronizando los datos faltantes.</p>
          </div>
        </div>
      )}

      {/* Tabla de clientes */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Lista de Clientes ({formatNumber(totalCount)})</h2>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card-content p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Comercial</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identificación</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciudad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Creación</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedidos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Compras</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="12" className="px-6 py-8 text-center">
                      <div className="flex items-center justify-center">
                        <Icons.Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-500">Cargando clientes...</span>
                      </div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center">
                        <Icons.Users className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-gray-500">No se encontraron clientes</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {customer.document_type === 'NIT' ? (
                            <Icons.Building className="w-5 h-5 text-blue-500 mr-2" />
                          ) : (
                            <Icons.User className="w-5 h-5 text-gray-400 mr-2" />
                          )}
                          <span className="text-sm font-medium text-gray-900">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.commercial_name ? (
                          <span className="text-sm text-gray-900">{customer.commercial_name}</span>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Sin nombre comercial</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.identification}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {customer.document_type || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.city || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.department || customer.state || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.created_at ? new Date(customer.created_at).toLocaleDateString('es-CO') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(customer.orders_count || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(customer.lifetime_total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customer.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                          {customer.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setMessageModalOpen(true);
                          }}
                          className="text-green-600 hover:text-green-900"
                          title="Enviar WhatsApp"
                        >
                          <Icons.MessageSquare className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalCount > 0 && (
            <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex items-center">
                <select
                  value={rowsPerPage}
                  onChange={(e) => handleChangeRowsPerPage(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10 por página</option>
                  <option value={25}>25 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">
                  {`${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, totalCount)} de ${totalCount}`}
                </span>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleChangePage(page - 1)}
                    disabled={page === 0}
                    className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icons.ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleChangePage(page + 1)}
                    disabled={(page + 1) * rowsPerPage >= totalCount}
                    className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icons.ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diálogo de confirmación para actualización */}
      {updateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Icons.RefreshCcw className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Actualizar Clientes desde SIIGO</h3>
              </div>

              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  Esta acción actualizará todos los clientes que tienen datos incompletos
                  (como nombres comerciales faltantes) desde SIIGO.
                </p>

                {stats && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      • <strong>{formatNumber(stats.ordersWithoutCommercialName)}</strong> pedidos sin nombre comercial
                    </p>
                    <p className="text-sm text-blue-800">
                      • <strong>{formatNumber(stats.uniqueSiigoCustomers)}</strong> clientes únicos a procesar
                    </p>
                    <p className="text-sm text-blue-800 mt-2">
                      <strong>Nota:</strong> Este proceso puede tomar varios minutos dependiendo
                      de la cantidad de clientes a actualizar.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setUpdateDialog(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateAllCustomers}
                  className="btn btn-primary flex items-center"
                >
                  <Icons.RefreshCcw className="w-4 h-4 mr-2" />
                  Actualizar Ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SendMessageModal
        isOpen={messageModalOpen}
        onClose={() => {
          setMessageModalOpen(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />
    </div>
  );
};

export default CustomersPage;
