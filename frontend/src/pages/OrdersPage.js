import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService, userService, walletService } from '../services/api';
import DeliveryRegistrationModal from '../components/DeliveryRegistrationModal';
import OrderReviewModal from '../components/OrderReviewModal';
import WalletValidationModal from '../components/WalletValidationModal';
import LogisticsModal from '../components/LogisticsModal';
import DeleteSiigoOrderModal from '../components/DeleteSiigoOrderModal';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { io } from 'socket.io-client';

const OrdersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const socketRef = useRef(null);
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [messengers, setMessengers] = useState([]);
  
  // Estados para filtros - inicializar con los parámetros de URL
  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: 10,
    sortBy: 'created_at',
    sortOrder: 'DESC'
  }));

  // Estados para modales
  const [deliveryModal, setDeliveryModal] = useState({
    isOpen: false,
    order: null
  });

  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    order: null
  });

  const [walletModal, setWalletModal] = useState({
    isOpen: false,
    order: null
  });

  const [logisticsModal, setLogisticsModal] = useState({
    isOpen: false,
    order: null
  });

  const [deleteSiigoModal, setDeleteSiigoModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });

  // Estados para acciones
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkAction, setBulkAction] = useState('');

  // Cargar pedidos
  const loadOrders = async () => {
    try {
      setLoading(true);
      
      // Determinar si estamos en la vista de cartera o todos los pedidos
      const view = searchParams.get('view');
      const isWalletView = view === 'cartera' || filters.status === 'revision_cartera';
      const isAllOrdersView = view === 'todos';
      
      // Preparar filtros - si es vista "todos", eliminar filtro de estado
      let finalFilters = { ...filters };
      if (isAllOrdersView) {
        finalFilters = { ...filters, status: '' };
        console.log('📋 Vista "Todos los Pedidos" - mostrando pedidos sin filtrar por estado');
      }
      
      let response;
      if (isWalletView) {
        // Usar el endpoint específico de cartera que garantiza datos correctos
        console.log('🏦 Usando endpoint de cartera para obtener pedidos');
        response = await walletService.getWalletOrders(finalFilters);
      } else {
        // Usar el endpoint general de pedidos
        response = await orderService.getOrders(finalFilters);
      }
      
      setOrders(response.data.orders);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      toast.error('Error cargando pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar mensajeros (para asignación)
  const loadMessengers = async () => {
    if (['admin', 'logistica'].includes(user?.role)) {
      try {
        const response = await userService.getUsers({ role: 'mensajero', active: true });
        setMessengers(response.data.users || []);
      } catch (error) {
        console.error('Error cargando mensajeros:', error);
      }
    }
  };

  // Configurar WebSocket para notificaciones en tiempo real
  useEffect(() => {
    // Conectar a WebSocket
    socketRef.current = io(process.env.REACT_APP_API_URL || 'http://localhost:3001');
    
    socketRef.current.on('connect', () => {
      console.log('🔌 Conectado a WebSocket en OrdersPage');
      // Suscribirse a actualizaciones de pedidos
      socketRef.current.emit('join-orders-updates');
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('🔌 Desconectado de WebSocket en OrdersPage');
    });
    
    // Escuchar notificaciones de nuevos pedidos creados desde Siigo
    socketRef.current.on('order-created', (data) => {
      console.log('📡 Nuevo pedido creado desde Siigo:', data);
      toast.success(`Nuevo pedido creado: ${data.orderNumber}`);
      // Recargar pedidos automáticamente
      loadOrders();
    });
    
    // Escuchar notificaciones de facturas procesadas
    socketRef.current.on('invoice-processed', (data) => {
      console.log('📡 Factura procesada como pedido:', data);
      toast.success(`Factura procesada como pedido ${data.orderNumber}`);
      // Recargar pedidos automáticamente
      loadOrders();
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    loadOrders();
    loadMessengers();
  }, [filters]);

  // Solo sincronizar filtros desde URL al montar el componente o cambiar la vista
  useEffect(() => {
    const view = searchParams.get('view');
    const urlStatus = searchParams.get('status') || '';
    
    // Solo actualizar si es diferente y evitar loops
    if (urlStatus !== filters.status) {
      console.log('🔄 Sincronizando estado desde URL:', urlStatus);
      setFilters(prev => ({
        ...prev,
        status: urlStatus,
        page: 1
      }));
    }
  }, [searchParams.get('view'), searchParams.get('status')]);

  // Actualizar URL con filtros (sin dependencia de searchParams para evitar loops)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    // Solo actualizar parámetros relacionados con filtros
    if (filters.search) {
      params.set('search', filters.search);
    } else {
      params.delete('search');
    }
    
    if (filters.status) {
      params.set('status', filters.status);
    } else {
      params.delete('status');
    }
    
    if (filters.dateFrom) {
      params.set('dateFrom', filters.dateFrom);
    } else {
      params.delete('dateFrom'); 
    }
    
    if (filters.dateTo) {
      params.set('dateTo', filters.dateTo);
    } else {
      params.delete('dateTo');
    }
    
    if (filters.page > 1) {
      params.set('page', filters.page.toString());
    } else {
      params.delete('page');
    }
    
    // Solo actualizar si realmente cambió
    const newParamsString = params.toString();
    const currentParamsString = searchParams.toString();
    
    if (newParamsString !== currentParamsString) {
      setSearchParams(params, { replace: true });
    }
  }, [filters.search, filters.status, filters.dateFrom, filters.dateTo, filters.page]);

  // Manejar cambios en filtros
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset page when other filters change
    }));
  };

  // Manejar cambio de estado de pedido
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await orderService.updateOrder(orderId, { status: newStatus });
      toast.success('Estado actualizado exitosamente');
      loadOrders();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('Error actualizando estado');
    }
  };

  // Manejar asignación de mensajero
  const handleAssignMessenger = async (orderId, messengerId) => {
    try {
      await orderService.assignOrder(orderId, { messengerId });
      toast.success('Pedido asignado exitosamente');
      loadOrders();
    } catch (error) {
      console.error('Error asignando pedido:', error);
      toast.error('Error asignando pedido');
    }
  };

  // Manejar eliminación de pedido SIIGO con modal
  const handleDeleteSiigoOrderConfirm = async (orderId) => {
    try {
      setDeleteSiigoModal(prev => ({ ...prev, loading: true }));
      
      await orderService.deleteSiigoOrder(orderId);
      toast.success('Pedido eliminado exitosamente. La factura volverá a estar disponible en SIIGO.');
      
      setDeleteSiigoModal({ isOpen: false, order: null, loading: false });
      loadOrders();
    } catch (error) {
      console.error('Error eliminando pedido SIIGO:', error);
      toast.error('Error eliminando pedido SIIGO');
      setDeleteSiigoModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Manejar registro de entrega
  const handleDeliveryRegistration = async (deliveryData) => {
    try {
      // Aquí implementarías la lógica para subir las fotos y registrar la entrega
      await orderService.updateOrder(deliveryData.orderId, {
        status: 'entregado_cliente',
        delivery_notes: deliveryData.notes,
        amount_received: deliveryData.amountReceived
      });
      
      toast.success('Entrega registrada exitosamente');
      loadOrders();
    } catch (error) {
      console.error('Error registrando entrega:', error);
      throw error;
    }
  };

  // Manejar revisión de pedido
  const handleOrderReview = async (reviewData) => {
    try {
      const { orderId, action, ...updateData } = reviewData;
      
      console.log('🔍 HandleOrderReview - Datos recibidos:', { orderId, action, updateData });
      
      // Mapeo directo de acciones a estados
      const statusMapping = {
        'send_to_wallet': 'revision_cartera',
        'send_to_logistics': 'en_logistica'
      };
      
      const newStatus = statusMapping[action];
      
      if (!newStatus) {
        console.error('❌ Acción no reconocida:', action);
        toast.error('Acción no válida: ' + action);
        return;
      }

      console.log('✅ Mapeando acción:', { action, newStatus });
      console.log('📤 Actualizando pedido:', { orderId, newStatus, updateData });

      await orderService.updateOrder(orderId, {
        ...updateData,
        status: newStatus
      });
      
      const successMessage = newStatus === 'revision_cartera' ? 'enviado a cartera' : 'enviado a logística';
      toast.success(`Pedido ${successMessage} exitosamente`);
      loadOrders();
    } catch (error) {
      console.error('Error procesando revisión:', error);
      toast.error('Error actualizando pedido: ' + error.message);
      throw error;
    }
  };

  // Manejar validación de cartera
  const handleWalletValidation = async (validationData) => {
    try {
      console.log('🏦 HandleWalletValidation - Datos recibidos:', validationData);
      
      const response = await fetch('/api/wallet/validate-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: validationData // FormData
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Error en respuesta de validación:', errorData);
        throw new Error('Error validando pago: ' + response.status);
      }

      const responseData = await response.json();
      console.log('✅ Validación exitosa:', responseData);
      
      // Determinar el nuevo estado según el tipo de validación
      const validationType = validationData.get('validationType');
      let successMessage = '';
      
      if (validationType === 'approved') {
        successMessage = 'Pago validado y enviado a logística exitosamente';
      } else if (validationType === 'rejected') {
        successMessage = 'Pedido marcado como no apto para logística';
      } else {
        successMessage = 'Validación procesada exitosamente';
      }
      
      toast.success(successMessage);
      loadOrders();
    } catch (error) {
      console.error('Error validando pago:', error);
      toast.error('Error validando pago: ' + error.message);
      throw error;
    }
  };

  // Manejar procesamiento de logística
  const handleLogisticsProcess = async (processData) => {
    try {
      console.log('🚚 HandleLogisticsProcess - Datos recibidos:', processData);
      
      const response = await fetch('/api/logistics/process-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(processData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Error en respuesta de logística:', errorData);
        throw new Error('Error procesando pedido: ' + response.status);
      }

      const responseData = await response.json();
      console.log('✅ Procesamiento de logística exitoso:', responseData);
      
      toast.success('Pedido procesado y enviado a empaque exitosamente');
      loadOrders();
    } catch (error) {
      console.error('Error procesando pedido:', error);
      toast.error('Error procesando pedido: ' + error.message);
      throw error;
    }
  };

  // Manejar selección múltiple
  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(order => order.id));
    }
  };

  // Manejar acciones en lote
  const handleBulkAction = async () => {
    if (!bulkAction || selectedOrders.length === 0) return;

    try {
      const promises = selectedOrders.map(orderId => {
        switch (bulkAction) {
          case 'confirm':
            return orderService.updateOrder(orderId, { status: 'confirmado' });
          case 'prepare':
            return orderService.updateOrder(orderId, { status: 'en_preparacion' });
          case 'ready':
            return orderService.updateOrder(orderId, { status: 'listo' });
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
      toast.success(`${selectedOrders.length} pedidos actualizados`);
      setSelectedOrders([]);
      setBulkAction('');
      loadOrders();
    } catch (error) {
      console.error('Error en acción en lote:', error);
      toast.error('Error procesando pedidos');
    }
  };

  // Obtener color del estado
  const getStatusColor = (status) => {
    const colors = {
      pendiente_por_facturacion: 'bg-yellow-100 text-yellow-800',
      revision_cartera: 'bg-blue-100 text-blue-800',
      en_logistica: 'bg-purple-100 text-purple-800',
      en_empaque: 'bg-orange-100 text-orange-800',
      empacado: 'bg-cyan-100 text-cyan-800',
      en_reparto: 'bg-indigo-100 text-indigo-800',
      entregado_transportadora: 'bg-green-100 text-green-800',
      entregado_cliente: 'bg-green-100 text-green-800',
      cancelado: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Obtener etiqueta del estado
  const getStatusLabel = (status) => {
    const labels = {
      pendiente_por_facturacion: 'Pendiente por Facturación',
      revision_cartera: 'Revisión por Cartera',
      en_logistica: 'En Logística',
      en_empaque: 'En Empaque',
      empacado: 'Empacado',
      en_reparto: 'En Reparto',
      entregado_transportadora: 'Entregado a Transportadora',
      entregado_cliente: 'Entregado a Cliente',
      cancelado: 'Cancelado'
    };
    return labels[status] || status;
  };

  // Obtener etiqueta del método de envío
  const getDeliveryMethodLabel = (method) => {
    const labels = {
      domicilio_ciudad: 'Domicilio Ciudad',
      domicilio_nacional: 'Domicilio Nacional',
      recogida_tienda: 'Recogida en Tienda',
      envio_nacional: 'Envío Nacional',
      envio_internacional: 'Envío Internacional',
      contraentrega: 'Contraentrega'
    };
    return labels[method] || method || 'No especificado';
  };

  // Obtener color del método de envío
  const getDeliveryMethodColor = (method) => {
    const colors = {
      domicilio_ciudad: 'bg-blue-100 text-blue-800',
      domicilio_nacional: 'bg-purple-100 text-purple-800',
      recogida_tienda: 'bg-green-100 text-green-800',
      envio_nacional: 'bg-orange-100 text-orange-800',
      envio_internacional: 'bg-red-100 text-red-800',
      contraentrega: 'bg-yellow-100 text-yellow-800'
    };
    return colors[method] || 'bg-gray-100 text-gray-800';
  };

  // Verificar permisos para acciones
  const canChangeStatus = (order, newStatus) => {
    const { role } = user;
    const currentStatus = order.status;

    if (role === 'admin') return true;
    
    if (role === 'facturador') {
      return currentStatus === 'pendiente' && newStatus === 'confirmado';
    }
    
    if (role === 'logistica') {
      return ['confirmado', 'en_preparacion', 'listo'].includes(currentStatus);
    }
    
    if (role === 'mensajero') {
      return currentStatus === 'enviado' && newStatus === 'entregado';
    }
    
    return false;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestión de Pedidos
          </h1>
          <p className="text-gray-600 mt-2">
            Administra todos los pedidos del sistema
          </p>
        </div>
        
        {user?.role === 'facturador' && (
          <button
            onClick={() => navigate('/orders/create')}
            className="btn btn-primary"
          >
            <Icons.Plus className="w-4 h-4 mr-2" />
            Nuevo Pedido
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="card-content">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cliente, teléfono, código..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los estados</option>
                <option value="pendiente_por_facturacion">Pendiente por Facturación</option>
                <option value="revision_cartera">Revisión por Cartera</option>
                <option value="en_logistica">En Logística</option>
                <option value="en_empaque">En Empaque</option>
                <option value="empacado">Empacado</option>
                <option value="en_reparto">En Reparto</option>
                <option value="entregado_transportadora">Entregado a Transportadora</option>
                <option value="entregado_cliente">Entregado a Cliente</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Fecha desde */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desde
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hasta
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Acciones en lote - Solo para logística */}
          {selectedOrders.length > 0 && user?.role === 'logistica' && (
            <div className="mt-4 flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                {selectedOrders.length} pedidos seleccionados
              </span>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="px-3 py-1 border border-blue-300 rounded-md text-sm"
              >
                <option value="">Seleccionar acción</option>
                <option value="confirm">Confirmar</option>
                <option value="prepare">Poner en preparación</option>
                <option value="ready">Marcar como listo</option>
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="btn btn-primary btn-sm"
              >
                Aplicar
              </button>
              <button
                onClick={() => setSelectedOrders([])}
                className="btn btn-secondary btn-sm"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="card">
        <div className="card-content p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {user?.role === 'logistica' && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedOrders.length === orders.length && orders.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  {user?.role === 'mensajero' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Método de Envío
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha de Envío
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    {user?.role === 'logistica' && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => handleSelectOrder(order.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {order.order_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.items?.length || 0} items
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 break-words leading-tight">
                          {order.customer_name}
                        </div>
                        <div className="text-sm text-gray-500 whitespace-nowrap">
                          {order.customer_phone}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                        {order.validation_status === 'rejected' && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            ❌ Rechazado por Cartera
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${order.total_amount?.toLocaleString('es-CO')}
                    </td>
                    
                    {/* Método de envío - Solo visible para mensajeros */}
                    {user?.role === 'mensajero' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDeliveryMethodColor(order.delivery_method)}`}>
                          {getDeliveryMethodLabel(order.delivery_method)}
                        </span>
                      </td>
                    )}
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.shipping_date 
                        ? format(new Date(order.shipping_date), 'dd/MM/yyyy', { locale: es })
                        : '-'
                      }
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2 min-w-[200px]">
                        {/* Slot 1: Ver detalles - SIEMPRE presente */}
                        <button
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="text-blue-600 hover:text-blue-900 w-4 h-4 flex items-center justify-center"
                          title="Ver detalles"
                        >
                          <Icons.Eye className="w-4 h-4" />
                        </button>

                        {/* Slot 2: Descargar factura SIIGO */}
                        {order.siigo_public_url ? (
                          <a
                            href={order.siigo_public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 w-4 h-4 flex items-center justify-center"
                            title="Descargar factura SIIGO"
                          >
                            <Icons.FileText className="w-4 h-4" />
                          </a>
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}

                        {/* Slot 3: Acción principal del estado */}
                        {(['admin', 'facturador'].includes(user?.role) && order.status === 'pendiente_por_facturacion') ? (
                          <button
                            onClick={() => setReviewModal({ isOpen: true, order })}
                            className="text-orange-600 hover:text-orange-900 w-4 h-4 flex items-center justify-center"
                            title="Revisar y aprobar pedido"
                          >
                            <Icons.FileSearch className="w-4 h-4" />
                          </button>
                        ) : (['admin', 'cartera'].includes(user?.role) && order.status === 'revision_cartera') ? (
                          <button
                            onClick={() => setWalletModal({ isOpen: true, order })}
                            className="text-green-600 hover:text-green-900 w-4 h-4 flex items-center justify-center"
                            title="Validar pago"
                          >
                            <Icons.CreditCard className="w-4 h-4" />
                          </button>
                        ) : (['admin', 'logistica'].includes(user?.role) && order.status === 'en_logistica') ? (
                          <button
                            onClick={() => setLogisticsModal({ isOpen: true, order })}
                            className="text-purple-600 hover:text-purple-900 w-4 h-4 flex items-center justify-center"
                            title="Procesar envío"
                          >
                            <Icons.Truck className="w-4 h-4" />
                          </button>
                        ) : (['admin', 'logistica'].includes(user?.role) && order.status === 'en_empaque') ? (
                          <button
                            onClick={() => navigate(`/packaging?orderId=${order.id}`)}
                            className="text-green-600 hover:text-green-900 w-4 h-4 flex items-center justify-center"
                            title="Procesar Empaque"
                          >
                            <Icons.Box className="w-4 h-4" />
                          </button>
                        ) : (order.status === 'en_reparto' && user?.role === 'mensajero') ? (
                          <button
                            onClick={() => setDeliveryModal({ isOpen: true, order })}
                            className="text-purple-600 hover:text-purple-900 w-4 h-4 flex items-center justify-center"
                            title="Registrar entrega"
                          >
                            <Icons.Package className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}

                        {/* Slot 4: Acción secundaria */}
                        {(['admin', 'logistica'].includes(user?.role) && order.status === 'en_empaque') ? (
                          <button
                            onClick={() => handleStatusChange(order.id, 'empacado')}
                            className="text-blue-600 hover:text-blue-900 w-4 h-4 flex items-center justify-center"
                            title="Finalizar Empaque"
                          >
                            <Icons.CheckCircle className="w-4 h-4" />
                          </button>
                        ) : (order.status === 'pendiente' && canChangeStatus(order, 'confirmado')) ? (
                          <button
                            onClick={() => handleStatusChange(order.id, 'confirmado')}
                            className="text-green-600 hover:text-green-900 w-4 h-4 flex items-center justify-center"
                            title="Confirmar"
                          >
                            <Icons.Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}

                        {/* Slot 5: Eliminar pedido SIIGO - Solo admin y pedidos de SIIGO */}
                        {(user?.role === 'admin' && order.siigo_invoice_id && !['entregado_cliente', 'entregado_transportadora'].includes(order.status)) ? (
                          <button
                            onClick={() => setDeleteSiigoModal({ isOpen: true, order, loading: false })}
                            className="text-red-600 hover:text-red-900 w-4 h-4 flex items-center justify-center"
                            title="Eliminar pedido SIIGO (vuelve a SIIGO para reimportación)"
                          >
                            <Icons.Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {orders.length === 0 && (
            <div className="text-center py-12">
              <Icons.Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No se encontraron pedidos</p>
              <p className="text-gray-400">Intenta ajustar los filtros de búsqueda</p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {pagination.pages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} resultados
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleFilterChange('page', pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn btn-secondary btn-sm"
              >
                <Icons.ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-sm text-gray-700">
                Página {pagination.page} de {pagination.pages}
              </span>
              
              <button
                onClick={() => handleFilterChange('page', pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="btn btn-secondary btn-sm"
              >
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de registro de entrega */}
      <DeliveryRegistrationModal
        isOpen={deliveryModal.isOpen}
        onClose={() => setDeliveryModal({ isOpen: false, order: null })}
        order={deliveryModal.order}
        onConfirm={handleDeliveryRegistration}
      />

      {/* Modal de revisión de pedido */}
      <OrderReviewModal
        isOpen={reviewModal.isOpen}
        onClose={() => setReviewModal({ isOpen: false, order: null })}
        order={reviewModal.order}
        onConfirm={handleOrderReview}
      />

      {/* Modal de validación de cartera */}
      <WalletValidationModal
        isOpen={walletModal.isOpen}
        onClose={() => setWalletModal({ isOpen: false, order: null })}
        order={walletModal.order}
        onValidate={handleWalletValidation}
      />

      {/* Modal de logística */}
      <LogisticsModal
        isOpen={logisticsModal.isOpen}
        onClose={() => setLogisticsModal({ isOpen: false, order: null })}
        order={logisticsModal.order}
        onProcess={handleLogisticsProcess}
      />

      {/* Modal de eliminación de pedido SIIGO */}
      <DeleteSiigoOrderModal
        isOpen={deleteSiigoModal.isOpen}
        onClose={() => setDeleteSiigoModal({ isOpen: false, order: null, loading: false })}
        order={deleteSiigoModal.order}
        onConfirm={handleDeleteSiigoOrderConfirm}
        loading={deleteSiigoModal.loading}
      />
    </div>
  );
};

export default OrdersPage;
