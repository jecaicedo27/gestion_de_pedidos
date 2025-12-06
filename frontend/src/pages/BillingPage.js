import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Plus,
  Download,
  Send,
  Package
} from 'lucide-react';
import api from '../services/api';
import SiigoImportModal from '../components/SiigoImportModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { io } from 'socket.io-client';

const BillingPage = () => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' o 'siigo'
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const socketRef = useRef(null);
  
  // Estados para crear pedido
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_city: '',
    customer_department: '',
    delivery_method: '',
    payment_method: '',
    delivery_date: '',
    notes: '',
    total_amount: ''
  });

  // Filtros para facturas SIIGO
  const [filters, setFilters] = useState({
    page: 1,
    page_size: 10,
    created_start: '',
    created_end: '',
    search: ''
  });

  // Socket.IO: actualizaciones en tiempo real para facturas SIIGO y pedidos pendientes
  useEffect(() => {
    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const socketBase = (typeof apiBase === 'string' && !apiBase.startsWith('http'))
      ? window.location.origin
      : apiBase;

    const socket = io(socketBase, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      try {
        socket.emit('join-siigo-updates');
      } catch {}
    });

    const refreshInvoices = () => {
      if (activeTab === 'siigo') {
        loadInvoices();
      }
    };

    socket.on('new-invoice', refreshInvoices);
    socket.on('invoices-updated', refreshInvoices);
    socket.on('invoice-updated', refreshInvoices);

    socket.on('order-created', () => {
      if (activeTab === 'create') {
        loadPendingOrders();
      }
    });

    socket.on('reconnect', () => {
      try { socket.emit('join-siigo-updates'); } catch {}
      setTimeout(() => {
        if (activeTab === 'siigo') loadInvoices();
        if (activeTab === 'create') loadPendingOrders();
      }, 500);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket error (BillingPage):', err?.message || err);
    });

    return () => {
      socket.off('new-invoice', refreshInvoices);
      socket.off('invoices-updated', refreshInvoices);
      socket.off('invoice-updated', refreshInvoices);
      socket.off('order-created');
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'siigo') {
      loadInvoices();
      checkConnection();
    } else {
      loadPendingOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/siigo/invoices', { params: filters });
      
      if (response.data.success) {
        setInvoices(response.data.data.results || []);
      }
    } catch (error) {
      console.error('Error cargando facturas:', error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/orders', { 
        params: { 
          status: 'pendiente_por_facturacion',
          // Orden explícito en backend por número (sufijo) ASC
          sortBy: 'order_number_numeric',
          sortOrder: 'ASC',
          // Traer suficientes registros (el backend ya ordena)
          limit: 1000,
          view: 'facturacion'
        }
      });
      
      if (response.data.success) {
        const list = response.data.data.orders || [];
        // Orden de respaldo SOLO en esta vista (Facturación):
        // - ASC por sufijo numérico de order_number (más antiguos primero)
        // - Desempate por fecha de factura/creación ASC
        const toNumber = (s) => {
          if (!s) return Number.MAX_SAFE_INTEGER;
          const m = String(s).match(/(\d+)(?!.*\d)/);
          return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
        };
        list.sort((a, b) => {
          const na = toNumber(a.order_number);
          const nb = toNumber(b.order_number);
          if (na !== nb) return na - nb;
          const da = new Date(a.siigo_invoice_created_at || a.created_at);
          const db = new Date(b.siigo_invoice_created_at || b.created_at);
          return da - db;
        });
        setOrders(list);
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    try {
      const response = await api.get('/siigo/connection/status');
      setConnectionStatus(response.data.data);
    } catch (error) {
      console.error('Error verificando conexión:', error);
      setConnectionStatus({ connected: false, error: error.message });
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await api.post('/orders', newOrder);
      
      if (response.data.success) {
        alert('Pedido creado exitosamente');
        // Limpiar formulario
        setNewOrder({
          customer_name: '',
          customer_phone: '',
          customer_email: '',
          customer_address: '',
          customer_city: '',
          customer_department: '',
          delivery_method: '',
          payment_method: '',
          delivery_date: '',
          notes: '',
          total_amount: ''
        });
        // Recargar pedidos pendientes
        loadPendingOrders();
      }
    } catch (error) {
      console.error('Error creando pedido:', error);
      alert('Error al crear el pedido: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSendToWallet = async (orderId, orderNumber) => {
    try {
      const response = await api.put(`/orders/${orderId}`, {
        status: 'confirmado'
      });
      
      if (response.data.success) {
        alert(`Pedido ${orderNumber} enviado a cartera exitosamente`);
        // Recargar la lista
        if (activeTab === 'create') {
          loadPendingOrders();
        } else {
          loadInvoices();
        }
      }
    } catch (error) {
      console.error('Error enviando a cartera:', error);
      alert('Error al enviar a cartera: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleImportInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowImportModal(true);
  };

  const handleImportSuccess = (result) => {
    alert(`Pedido creado exitosamente: ${result.order_number}`);
    setInvoices(prevInvoices => 
      prevInvoices.filter(invoice => invoice.id !== selectedInvoice?.id)
    );
    setShowImportModal(false);
    setSelectedInvoice(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pendiente': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendiente' },
      'pendiente_por_facturacion': { color: 'bg-yellow-100 text-yellow-800', icon: FileText, label: 'Pendiente por Facturación' },
      'confirmado': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, label: 'En Cartera' },
      'active': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Activa' }
    };

    const config = statusConfig[status] || statusConfig['pendiente'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
          <p className="text-gray-600">Crea pedidos manualmente o importa desde SIIGO</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'create'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Crear Pedidos
          </button>
          <button
            onClick={() => setActiveTab('siigo')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'siigo'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Importar SIIGO
          </button>
        </nav>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario de creación */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Crear Nuevo Pedido</h2>
            
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.customer_name}
                    onChange={(e) => setNewOrder({...newOrder, customer_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newOrder.customer_phone}
                    onChange={(e) => setNewOrder({...newOrder, customer_phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newOrder.customer_email}
                  onChange={(e) => setNewOrder({...newOrder, customer_email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección *
                </label>
                <input
                  type="text"
                  required
                  value={newOrder.customer_address}
                  onChange={(e) => setNewOrder({...newOrder, customer_address: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.customer_city}
                    onChange={(e) => setNewOrder({...newOrder, customer_city: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.customer_department}
                    onChange={(e) => setNewOrder({...newOrder, customer_department: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Entrega *
                  </label>
                  <select
                    required
                    value={newOrder.delivery_method}
                    onChange={(e) => setNewOrder({...newOrder, delivery_method: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="domicilio_ciudad">Domicilio en Ciudad</option>
                    <option value="recogida_tienda">Recogida en Tienda</option>
                    <option value="envio_nacional">Envío Nacional</option>
                    <option value="envio_internacional">Envío Internacional</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pago *
                  </label>
                  <select
                    required
                    value={newOrder.payment_method}
                    onChange={(e) => setNewOrder({...newOrder, payment_method: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="tarjeta_credito">Tarjeta de Crédito</option>
                    <option value="pago_electronico">Pago Electrónico</option>
                    <option value="publicidad">Publicidad (sin validación)</option>
                    <option value="reposicion">Reposición (sin validación)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Entrega *
                  </label>
                  <input
                    type="date"
                    required
                    value={newOrder.delivery_date}
                    onChange={(e) => setNewOrder({...newOrder, delivery_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Total *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={newOrder.total_amount}
                    onChange={(e) => setNewOrder({...newOrder, total_amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  rows="3"
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Notas adicionales del pedido..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Crear Pedido
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Lista de pedidos pendientes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Pedidos Pendientes</h2>
              <button
                onClick={loadPendingOrders}
                disabled={loading}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {orders.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay pedidos pendientes</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h3 className="text-sm font-medium text-gray-900">
                              Pedido #{order.order_number}
                            </h3>
                            <div className="ml-2">
                              {getStatusBadge(order.status)}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {order.customer_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(order.total_amount)} • {formatDate(order.created_at)}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => handleSendToWallet(order.id, order.order_number)}
                          className="flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Enviar a Cartera
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Tab de SIIGO */
        <div className="space-y-6">
          {/* Estado de conexión y filtros */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {connectionStatus && (
                  <div className={`flex items-center px-3 py-2 rounded-md text-sm ${
                    connectionStatus.connected 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    {connectionStatus.connected ? 'SIIGO Conectado' : 'SIIGO Desconectado'}
                  </div>
                )}
              </div>
              
              <button
                onClick={loadInvoices}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
                    placeholder="Número de factura, cliente..."
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  name="created_start"
                  value={filters.created_start}
                  onChange={(e) => setFilters({...filters, created_start: e.target.value, page: 1})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  name="created_end"
                  value={filters.created_end}
                  onChange={(e) => setFilters({...filters, created_end: e.target.value, page: 1})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Lista de Facturas SIIGO */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {!connectionStatus?.connected ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay conexión con SIIGO
                </h3>
                <p className="text-gray-600 mb-4">
                  Verifica la configuración de SIIGO para poder importar facturas.
                </p>
                <button
                  onClick={checkConnection}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Verificar Conexión
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay facturas disponibles
                </h3>
                <p className="text-gray-600">
                  No se encontraron facturas con los filtros aplicados.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Factura
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => {
                      const customer = invoice.customer || {};
                      let customerName = 'Cliente sin nombre';
                      
                      if (customer.person?.first_name) {
                        customerName = `${customer.person.first_name} ${customer.person.last_name || ''}`.trim();
                      } else if (customer.company?.name) {
                        customerName = customer.company.name;
                      } else if (customer.name) {
                        customerName = customer.name;
                      }

                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <FileText className="w-5 h-5 text-blue-500 mr-3" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {invoice.number || invoice.name || `Factura ${invoice.id.slice(-8)}`}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {invoice.id.slice(-12)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customerName}</div>
                            <div className="text-sm text-gray-500">
                              {customer.mail || customer.email || 'Sin email'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(invoice.date || invoice.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(invoice.total)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleImportInvoice(invoice)}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Importar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Importación */}
      <SiigoImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        invoice={selectedInvoice}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default BillingPage;
