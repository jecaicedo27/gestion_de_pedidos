import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ShippingGuideModal from '../components/ShippingGuideModal';

const ShippingGuidesPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState([]);
  const [orders, setOrders] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    shipping_company_id: '',
    current_status: '',
    guide_number: '',
    page: 1,
    limit: 20
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [showGuideImage, setShowGuideImage] = useState(false);

  const loadGuides = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await api.get(`/shipping/guides?${queryParams}`);
      setGuides(response.data.data.guides);
      setPagination(response.data.data.pagination);
    } catch (error) {
      console.error('Error cargando guías:', error);
    }
  }, [filters]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Cargar transportadoras
      const companiesResponse = await api.get('/shipping/companies/active');
      setCompanies(companiesResponse.data.data);
      
      // Cargar pedidos para envío nacional/internacional
      const ordersResponse = await api.get('/orders?delivery_method=envio_nacional,envio_internacional');
      setOrders(ordersResponse.data.data || []);
      
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'logistica') {
      loadInitialData();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'logistica') {
      loadGuides();
    }
  }, [filters, user, loadGuides]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset page when filtering
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const handleCreateGuide = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const handleGuideCreated = (newGuide) => {
    loadGuides();
    loadInitialData(); // Reload orders to update their status
  };

  const handleUpdateStatus = async (guideId, newStatus) => {
    try {
      const response = await api.put(`/shipping/guides/${guideId}/status`, {
        status: newStatus
      });

      if (response.data.success) {
        alert('Estado actualizado exitosamente');
        loadGuides();
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
      alert(error.response?.data?.message || 'Error actualizando estado');
    }
  };

  const handleViewGuide = (guide) => {
    setSelectedGuide(guide);
    setShowGuideImage(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      generada: 'bg-blue-100 text-blue-800',
      en_transito: 'bg-yellow-100 text-yellow-800',
      entregada: 'bg-green-100 text-green-800',
      devuelta: 'bg-red-100 text-red-800'
    };

    const labels = {
      generada: 'Generada',
      en_transito: 'En Tránsito',
      entregada: 'Entregada',
      devuelta: 'Devuelta'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentTypeBadge = (type) => {
    const badges = {
      contraentrega: 'bg-orange-100 text-orange-800',
      contado: 'bg-green-100 text-green-800'
    };

    const labels = {
      contraentrega: 'Contraentrega',
      contado: 'Contado'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[type] || 'bg-gray-100 text-gray-800'}`}>
        {labels[type] || type}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (user?.role !== 'admin' && user?.role !== 'logistica') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600">Solo los administradores y personal de logística pueden acceder a esta página.</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Guías de Envío</h1>
          <p className="mt-2 text-gray-600">
            Administra las guías de envío para transportadoras nacionales e internacionales
          </p>
        </div>

        {/* Pedidos Pendientes de Guía */}
        {Array.isArray(orders) && orders.filter(order => !order.assigned_guide_id && (order.delivery_method === 'envio_nacional' || order.delivery_method === 'envio_internacional')).length > 0 && (
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pedidos Pendientes de Guía</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders
                  .filter(order => !order.assigned_guide_id && (order.delivery_method === 'envio_nacional' || order.delivery_method === 'envio_internacional'))
                  .map(order => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">#{order.order_number}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.delivery_method === 'envio_nacional' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {order.delivery_method === 'envio_nacional' ? 'Nacional' : 'Internacional'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{order.customer_name}</p>
                      <p className="text-sm text-gray-600 mb-1">{order.customer_phone}</p>
                      <p className="text-sm font-medium text-gray-900 mb-3">
                        ${parseFloat(order.total_amount).toLocaleString('es-CO')}
                      </p>
                      <button
                        onClick={() => handleCreateGuide(order)}
                        className="w-full bg-primary-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Generar Guía
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transportadora
                </label>
                <select
                  value={filters.shipping_company_id}
                  onChange={(e) => handleFilterChange('shipping_company_id', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Todas las transportadoras</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={filters.current_status}
                  onChange={(e) => handleFilterChange('current_status', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Todos los estados</option>
                  <option value="generada">Generada</option>
                  <option value="en_transito">En Tránsito</option>
                  <option value="entregada">Entregada</option>
                  <option value="devuelta">Devuelta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Guía
                </label>
                <input
                  type="text"
                  value={filters.guide_number}
                  onChange={(e) => handleFilterChange('guide_number', e.target.value)}
                  placeholder="Buscar por número de guía"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({
                    shipping_company_id: '',
                    current_status: '',
                    guide_number: '',
                    page: 1,
                    limit: 20
                  })}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Guías */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Guías de Envío</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guía
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transportadora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pago
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {guides.map((guide) => (
                  <tr key={guide.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {guide.guide_number}
                        </div>
                        {guide.tracking_url && (
                          <a
                            href={guide.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-900"
                          >
                            Ver seguimiento
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        #{guide.order_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{guide.company_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {guide.customer_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {guide.customer_phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(guide.current_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPaymentTypeBadge(guide.payment_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ${parseFloat(guide.declared_value).toLocaleString('es-CO')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {guide.package_weight}kg
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(guide.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewGuide(guide)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Ver Guía
                        </button>
                        
                        {guide.current_status !== 'entregada' && (
                          <div className="relative inline-block text-left">
                            <select
                              value={guide.current_status}
                              onChange={(e) => handleUpdateStatus(guide.id, e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="generada">Generada</option>
                              <option value="en_transito">En Tránsito</option>
                              <option value="entregada">Entregada</option>
                              <option value="devuelta">Devuelta</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {guides.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay guías de envío</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza creando una guía para un pedido de envío nacional o internacional.
                </p>
              </div>
            )}
          </div>

          {/* Paginación */}
          {pagination.total_pages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page <= 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page >= pagination.total_pages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando{' '}
                    <span className="font-medium">
                      {((pagination.current_page - 1) * pagination.per_page) + 1}
                    </span>{' '}
                    a{' '}
                    <span className="font-medium">
                      {Math.min(pagination.current_page * pagination.per_page, pagination.total_records)}
                    </span>{' '}
                    de{' '}
                    <span className="font-medium">{pagination.total_records}</span>{' '}
                    resultados
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(pagination.current_page - 1)}
                      disabled={pagination.current_page <= 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Anterior</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pagination.current_page
                            ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => handlePageChange(pagination.current_page + 1)}
                      disabled={pagination.current_page >= pagination.total_pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Siguiente</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para crear guía */}
      <ShippingGuideModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        order={selectedOrder}
        onSuccess={handleGuideCreated}
      />

      {/* Modal para ver imagen de guía */}
      {showGuideImage && selectedGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Guía #{selectedGuide.guide_number}
                </h2>
                <button
                  onClick={() => setShowGuideImage(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Información de la Guía</h3>
                  <div className="space-y-2">
                    <p><strong>Transportadora:</strong> {selectedGuide.company_name}</p>
                    <p><strong>Número de Guía:</strong> {selectedGuide.guide_number}</p>
                    <p><strong>Estado:</strong> {getStatusBadge(selectedGuide.current_status)}</p>
                    <p><strong>Tipo de Pago:</strong> {getPaymentTypeBadge(selectedGuide.payment_type)}</p>
                    <p><strong>Peso:</strong> {selectedGuide.package_weight}kg</p>
                    <p><strong>Valor Declarado:</strong> ${parseFloat(selectedGuide.declared_value).toLocaleString('es-CO')}</p>
                    {selectedGuide.tracking_url && (
                      <p>
                        <strong>Seguimiento:</strong>{' '}
                        <a
                          href={selectedGuide.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Ver en línea
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Información del Pedido</h3>
                  <div className="space-y-2">
                    <p><strong>Pedido:</strong> #{selectedGuide.order_number}</p>
                    <p><strong>Cliente:</strong> {selectedGuide.customer_name}</p>
                    <p><strong>Teléfono:</strong> {selectedGuide.customer_phone}</p>
                    <p><strong>Fecha de Creación:</strong> {formatDate(selectedGuide.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Imagen de la Guía</h3>
                <div className="border border-gray-200 rounded-lg p-4">
                  <img
                    src={`http://localhost:3001${selectedGuide.guide_image_url}`}
                    alt={`Guía ${selectedGuide.guide_number}`}
                    className="max-w-full h-auto mx-auto rounded-lg"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <div className="text-center text-gray-500 py-8" style={{ display: 'none' }}>
                    No se pudo cargar la imagen de la guía
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowGuideImage(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingGuidesPage;
