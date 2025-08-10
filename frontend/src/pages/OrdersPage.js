import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService, userService, walletService } from '../services/api';
import DeliveryRegistrationModal from '../components/DeliveryRegistrationModal';
import OrderReviewModal from '../components/OrderReviewModal';
import WalletValidationModal from '../components/WalletValidationModal';
import LogisticsModal from '../components/LogisticsModal';
import DeleteSiigoOrderModal from '../components/DeleteSiigoOrderModal';
import IsolatedSearchInput from '../components/IsolatedSearchInput';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { io } from 'socket.io-client';


// CustomDropdown para reemplazar selector nativo de estado
const CustomDropdown = ({ value, onChange, options, placeholder, className }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between ${className}`}
        style={{ zIndex: 1 }}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icons.ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

const OrdersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const socketRef = useRef(null);
  const searchInputRef = useRef(null);
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [messengers, setMessengers] = useState([]);
  const [readyForDelivery, setReadyForDelivery] = useState({
    groupedOrders: {},
    stats: {},
    loading: false
  });
  
  // Estados para filtros - estado simplificado sin separación de búsqueda
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

  // Cargar pedidos - memoizado para evitar re-creaciones innecesarias
  const loadOrders = useCallback(async (filtersToUse = filters) => {
    try {
      setLoading(true);
      
      // Determinar si estamos en la vista de cartera o todos los pedidos
      const view = searchParams.get('view');
      const isWalletView = view === 'cartera' || filtersToUse.status === 'revision_cartera';
      const isAllOrdersView = view === 'todos';
      
      // Preparar filtros - si es vista "todos", eliminar filtro de estado
      let finalFilters = { ...filtersToUse };
      if (isAllOrdersView) {
        finalFilters = { ...filtersToUse, status: '' };
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
      
      // Auto-focus removido para evitar interferencias
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      toast.error('Error cargando pedidos');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Cargar mensajeros (para asignación)
  const loadMessengers = async () => {
    if (['admin', 'logistica'].includes(user?.role)) {
      try {
        const response = await userService.getUsers({ role: 'mensajero', active: true });
        // La respuesta viene en response.data.data.users debido a la estructura del backend
        setMessengers(response.data.data?.users || response.data.users || []);
      } catch (error) {
        console.error('Error cargando mensajeros:', error);
      }
    }
  };

  // Cargar pedidos listos para entrega
  const loadReadyForDelivery = async () => {
    if (!['admin', 'logistica'].includes(user?.role)) return;
    
    try {
      console.log('🚚 Iniciando loadReadyForDelivery...');
      setReadyForDelivery(prev => ({ ...prev, loading: true }));
      
      const response = await fetch('/api/logistics/ready-for-delivery', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Error cargando pedidos listos: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Datos recibidos:', data);
      
      // Asegurar que los datos existen y tienen la estructura correcta
      const groupedOrders = data?.data?.groupedOrders || {};
      const stats = data?.data?.stats || {};
      
      console.log('📦 Grupos:', Object.keys(groupedOrders));
      console.log('📈 Stats:', stats);
      
      setReadyForDelivery({
        groupedOrders,
        stats,
        loading: false
      });
      
      console.log('✅ loadReadyForDelivery completado');
      
    } catch (error) {
      console.error('❌ Error cargando pedidos listos para entrega:', error);
      setReadyForDelivery(prev => ({ 
        ...prev, 
        loading: false,
        groupedOrders: {},
        stats: {}
      }));
    }
  };

  // Asignar mensajero a pedido
  const handleAssignMessengerToOrder = async (orderId, messengerId) => {
    try {
      const response = await fetch('/api/logistics/assign-messenger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ orderId, messengerId })
      });

      if (!response.ok) {
        throw new Error('Error asignando mensajero');
      }

      const result = await response.json();
      toast.success(result.message);
      
      // Recargar datos
      loadReadyForDelivery();
      loadOrders();
      
    } catch (error) {
      console.error('Error asignando mensajero:', error);
      toast.error('Error asignando mensajero');
    }
  };

  // Marcar pedido como entregado a transportadora
  const handleMarkAsDeliveredToCarrier = async (orderId, carrierName) => {
    try {
      const response = await fetch('/api/logistics/mark-delivered-carrier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          orderId, 
          status: 'entregado_transportadora',
          delivery_notes: `Entregado a ${carrierName} el ${new Date().toLocaleString()}`
        })
      });

      if (!response.ok) {
        throw new Error('Error marcando como entregado');
      }

      const result = await response.json();
      toast.success(`Pedido entregado a ${carrierName}`);
      
      // Recargar datos
      loadReadyForDelivery();
      loadOrders();
      
    } catch (error) {
      console.error('Error marcando como entregado:', error);
      toast.error('Error marcando como entregado');
    }
  };

  // Marcar pedido listo para recoger
  const handleMarkReadyForPickup = async (orderId) => {
    try {
      const response = await fetch('/api/logistics/mark-ready-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          orderId, 
          status: 'listo_para_recoger',
          delivery_notes: `Listo para recoger en bodega - ${new Date().toLocaleString()}`
        })
      });

      if (!response.ok) {
        throw new Error('Error marcando como listo');
      }

      const result = await response.json();
      toast.success('Pedido marcado como listo para recoger');
      
      // Recargar datos
      loadReadyForDelivery();
      loadOrders();
      
    } catch (error) {
      console.error('Error marcando como listo:', error);
      toast.error('Error marcando como listo');
    }
  };

  // Marcar pedido como en reparto
  const handleMarkInDelivery = async (orderId, messengerId) => {
    try {
      const response = await fetch('/api/logistics/mark-in-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          orderId, 
          messengerId,
          status: 'en_reparto',
          delivery_notes: `En reparto con mensajero - ${new Date().toLocaleString()}`
        })
      });

      if (!response.ok) {
        throw new Error('Error marcando en reparto');
      }

      const result = await response.json();
      toast.success('Pedido enviado a reparto');
      
      // Recargar datos
      loadReadyForDelivery();
      loadOrders();
      
    } catch (error) {
      console.error('Error marcando en reparto:', error);
      toast.error('Error marcando en reparto');
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

  // Cargar datos cuando cambien los filtros
  useEffect(() => {
    loadOrders(filters);
  }, [filters, loadOrders]);

  // Cargar mensajeros solo una vez
  useEffect(() => {
    loadMessengers();
  }, []);

  // Cargar pedidos listos para entrega cuando estamos en vista de logística
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'logistica' && ['admin', 'logistica'].includes(user?.role)) {
      loadReadyForDelivery();
    }
  }, [searchParams.get('view'), user?.role]);

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

  // Manejar cambios en filtros - memoizado para evitar re-creaciones
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : value // Reset page when other filters change
    }));
  }, []);

  // Manejar búsqueda independiente
  const handleSearch = useCallback((searchValue) => {
    setFilters(prev => ({
      ...prev,
      search: searchValue,
      page: 1 // Reset page when search changes
    }));
  }, []);

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
              <IsolatedSearchInput
                ref={searchInputRef}
                onSearch={handleSearch}
                initialValue={filters.search}
                placeholder="Cliente, teléfono, código..."
              />
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <CustomDropdown
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                options={[
  { value: '', label: 'Todos los estados' },
  { value: 'pendiente_por_facturacion', label: 'Pendiente por Facturación' },
  { value: 'revision_cartera', label: 'Revisión por Cartera' },
  { value: 'en_logistica', label: 'En Logística' },
  { value: 'en_empaque', label: 'En Empaque' },
  { value: 'en_preparacion', label: 'En Preparación' },
  { value: 'empacado', label: 'Empacado' },
  { value: 'en_reparto', label: 'En Reparto' },
  { value: 'entregado_transportadora', label: 'Entregado a Transportadora' },
  { value: 'entregado_cliente', label: 'Entregado a Cliente' },
  { value: 'cancelado', label: 'Cancelado' }
]}
                placeholder="Todos los estados"
              />
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

      {/* Sección de Pedidos Listos para Entrega - Solo en vista de logística */}
      {searchParams.get('view') === 'logistica' && ['admin', 'logistica'].includes(user?.role) && (
        <div className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <div className="w-1 h-8 bg-red-500 rounded mr-3"></div>
                🚚 Pedidos Listos para Entrega
              </h2>
              <p className="text-gray-600 mt-1">
                Organiza y asigna los pedidos empacados por tipo de entrega
              </p>
            </div>
            
            {!readyForDelivery.loading && readyForDelivery.stats.total > 0 && (
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{readyForDelivery.stats.total}</div>
                  <div className="text-sm text-gray-500">Total Listos</div>
                </div>
                <button
                  onClick={loadReadyForDelivery}
                  className="btn btn-secondary btn-sm"
                  title="Actualizar"
                >
                  <Icons.RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {readyForDelivery.loading ? (
            <div className="card">
              <div className="card-content">
                <div className="animate-pulse">
                  <div className="h-32 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ) : readyForDelivery.stats.total === 0 ? (
            <div className="card">
              <div className="card-content">
                <div className="text-center py-12">
                  <Icons.CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">¡Excelente! No hay pedidos pendientes para entrega</p>
                  <p className="text-gray-400">Todos los pedidos han sido procesados</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              
              {/* Recoge en Bodega */}
              {readyForDelivery.stats.recoge_bodega > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.Home className="w-5 h-5 mr-2 text-green-600" />
                      Recoge en Bodega
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        {readyForDelivery.stats.recoge_bodega}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.recoge_bodega?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-green-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleMarkReadyForPickup(order.id)}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                              title="Marcar como listo para recoger"
                            >
                              ✅ Listo
                            </button>
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Interrapidísimo */}
              {readyForDelivery.stats.interrapidisimo > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.Truck className="w-5 h-5 mr-2 text-orange-600" />
                      Interrapidísimo
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                        {readyForDelivery.stats.interrapidisimo}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.interrapidisimo?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-orange-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleMarkAsDeliveredToCarrier(order.id, 'Interrapidísimo')}
                              className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded"
                              title="Entregar a Interrapidísimo"
                            >
                              🚛 Entregar
                            </button>
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Transprensa */}
              {readyForDelivery.stats.transprensa > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.Package className="w-5 h-5 mr-2 text-purple-600" />
                      Transprensa
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                        {readyForDelivery.stats.transprensa}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.transprensa?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-purple-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleMarkAsDeliveredToCarrier(order.id, 'Transprensa')}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded"
                              title="Entregar a Transprensa"
                            >
                              🚛 Entregar
                            </button>
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Envía */}
              {readyForDelivery.stats.envia > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.Send className="w-5 h-5 mr-2 text-blue-600" />
                      Envía
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {readyForDelivery.stats.envia}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.envia?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-blue-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <button
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Ver detalles"
                          >
                            <Icons.Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Camión Externo */}
              {readyForDelivery.stats.camion_externo > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.Truck className="w-5 h-5 mr-2 text-indigo-600" />
                      Camión Externo
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                        {readyForDelivery.stats.camion_externo}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.camion_externo?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-indigo-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <button
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Ver detalles"
                          >
                            <Icons.Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mensajero Julián */}
              {readyForDelivery.stats.mensajero_julian > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.User className="w-5 h-5 mr-2 text-emerald-600" />
                      Mensajero Julián
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">
                        {readyForDelivery.stats.mensajero_julian}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.mensajero_julian?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-emerald-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {messengers.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignMessengerToOrder(order.id, parseInt(e.target.value));
                                  }
                                }}
                                className="text-xs px-2 py-1 border border-gray-300 rounded"
                                defaultValue=""
                              >
                                <option value="">Reasignar</option>
                                {messengers.map((messenger) => (
                                  <option key={messenger.id} value={messenger.id}>
                                    {messenger.username || `Usuario ${messenger.id}`}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mensajero Juan */}
              {readyForDelivery.stats.mensajero_juan > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.UserCheck className="w-5 h-5 mr-2 text-teal-600" />
                      Mensajero Juan
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">
                        {readyForDelivery.stats.mensajero_juan}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.mensajero_juan?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-teal-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {messengers.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignMessengerToOrder(order.id, parseInt(e.target.value));
                                  }
                                }}
                                className="text-xs px-2 py-1 border border-gray-300 rounded"
                                defaultValue=""
                              >
                                <option value="">Reasignar</option>
                                {messengers.map((messenger) => (
                                  <option key={messenger.id} value={messenger.id}>
                                    {messenger.full_name || messenger.name || messenger.username || `Usuario ${messenger.id}`}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mensajería Local */}
              {readyForDelivery.stats.mensajeria_local > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.MessageSquare className="w-5 h-5 mr-2 text-purple-600" />
                      Mensajería Local
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                        {readyForDelivery.stats.mensajeria_local}
                      </span>
                    </h3>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.mensajeria_local?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-purple-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {messengers.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignMessengerToOrder(order.id, parseInt(e.target.value));
                                  }
                                }}
                                className="text-xs px-2 py-1 border border-gray-300 rounded"
                                defaultValue=""
                              >
                                <option value="">Asignar mensajero</option>
                                {messengers.map((messenger) => (
                                  <option key={messenger.id} value={messenger.id}>
                                    {messenger.full_name || messenger.name || messenger.username || `Usuario ${messenger.id}`}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Otros (Sin Asignar) */}
              {readyForDelivery.stats.otros > 0 && (
                <div className="card border-2 border-yellow-200">
                  <div className="card-header bg-yellow-50">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icons.AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
                      Sin Asignar
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        {readyForDelivery.stats.otros}
                      </span>
                    </h3>
                    <p className="text-xs text-yellow-700 mt-1">Requieren atención</p>
                  </div>
                  <div className="card-content">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {readyForDelivery.groupedOrders.otros?.map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{order.order_number}</div>
                            <div className="text-xs text-gray-600">{order.customer_name}</div>
                            <div className="text-xs text-yellow-600">${order.total_amount?.toLocaleString('es-CO')}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {messengers.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAssignMessengerToOrder(order.id, parseInt(e.target.value));
                                  }
                                }}
                                className="text-xs px-2 py-1 border border-yellow-300 rounded bg-white"
                                defaultValue=""
                              >
                                <option value="">Asignar mensajero</option>
                                {messengers.map((messenger) => (
                                  <option key={messenger.id} value={messenger.id}>
                                    {messenger.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => navigate(`/orders/${order.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

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
