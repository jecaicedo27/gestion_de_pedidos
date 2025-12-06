/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Autocomplete, TextField, Chip } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { orderService, userService, walletService, messengerService, carteraService } from '../services/api';
import DeliveryRegistrationModal from '../components/DeliveryRegistrationModal';
import DeliveryConfirmationModal from '../components/DeliveryConfirmationModal';
import OrderReviewModal from '../components/OrderReviewModal';
import OrderTimelineModal from '../components/OrderTimelineModal';
import WalletValidationModal from '../components/WalletValidationModal';
import LogisticsModal from '../components/LogisticsModal';
import PickupPaymentModal from '../components/PickupPaymentModal';
import DeleteSiigoOrderModal from '../components/DeleteSiigoOrderModal';
import SpecialManagementModal from '../components/SpecialManagementModal';
import ReasonModal from '../components/ReasonModal';
import IsolatedSearchInput from '../components/IsolatedSearchInput';
import ReadyForDeliveryGroupTable from '../components/ReadyForDeliveryGroupTable';
import UploadEvidenceModal from '../components/UploadEvidenceModal';
import PendingTransportGuides from '../components/PendingTransportGuides';
import AdhocPaymentModal from '../components/AdhocPaymentModal';
import api from '../services/api';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import es from 'date-fns/locale/es';
import { io } from 'socket.io-client';
import audioFeedback from '../utils/audioUtils';
import { hasOrderPayment, hasShippingFeePaid, computeCollectionAmounts, isCreditOrder, normalize, getPaymentMethodLabel, getPaymentBadgeClass, getElectronicLabel, getElectronicBadgeClass, resolveElectronicType, getProviderHint, detectProviderFromString } from '../utils/payments';

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
        className={`w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left flex items-center justify-between ${className}`}
        style={{ zIndex: 1 }}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icons.ChevronDown className={`w - 4 h - 4 text - gray - 400 transition - transform ${isOpen ? 'rotate-180' : ''} `} />
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
  const socketConnectedRef = useRef(false);

  // Tab actual para vista de mensajero: 'asignados' (default) o 'ready'
  const messengerTab = searchParams.get('tab') || 'asignados';
  const setMessengerTab = (tab) => {
    const params = new URLSearchParams(searchParams);
    if (tab === 'asignados') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    setSearchParams(params, { replace: true });
  };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [messengers, setMessengers] = useState([]);

  // Estados para filtros - estado simplificado sin separación de búsqueda
  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    paymentMethod: searchParams.get('paymentMethod') || '',
    tags: searchParams.get('tags') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: 10,
    sortBy: 'created_at',
    sortOrder: 'ASC'
  }));

  // Etiquetas disponibles para el filtro
  const [availableTags, setAvailableTags] = useState([]);

  // Función para cargar etiquetas
  const fetchTags = async () => {
    try {
      const tags = await orderService.getTags();
      setAvailableTags(tags);
    } catch (error) {
      console.error('Error al cargar etiquetas:', error);
    }
  };

  // Cargar etiquetas al montar
  useEffect(() => {
    fetchTags();
  }, []);

  const [readyOrders, setReadyOrders] = useState([]);

  // SIIGO: pendientes por cerrar y modal
  const [siigoPending, setSiigoPending] = useState([]);
  const [siigoCloseModal, setSiigoCloseModal] = useState({
    open: false,
    order: null,
    method: 'efectivo', // 'efectivo' | 'transferencia'
    note: '',
    tags: [],
    availableTags: []
  });

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

  const [deliveryConfirmationModal, setDeliveryConfirmationModal] = useState({
    isOpen: false,
    order: null
  });

  const [pickupPaymentModal, setPickupPaymentModal] = useState({
    isOpen: false,
    order: null
  });

  const [timelineModal, setTimelineModal] = useState({
    isOpen: false,
    order: null
  });

  const [specialModal, setSpecialModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });

  // Modal genérico para razones (rechazar / entrega fallida)
  const [reasonModal, setReasonModal] = useState({
    isOpen: false,
    order: null,
    mode: 'reject',
    loading: false
  });
  // Cancelación por cliente (acción rápida en listado)
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });

  const [uploadEvidenceModal, setUploadEvidenceModal] = useState({
    open: false,
    order: null,
    file: null
  });

  const [adhocPaymentModal, setAdhocPaymentModal] = useState({
    isOpen: false
  });

  // Ocultar en tiempo real pedidos ya entregados para evitar reaparición por latencia

  // Ref para pausar recargas mientras haya modales abiertos (evita reset de LogisticsModal)
  const modalOpenRef = useRef(false);
  useEffect(() => {
    modalOpenRef.current =
      logisticsModal.isOpen ||
      deliveryModal.isOpen ||
      reviewModal.isOpen ||
      walletModal.isOpen ||
      pickupPaymentModal.isOpen ||
      deliveryConfirmationModal.isOpen ||
      timelineModal.isOpen ||
      deleteSiigoModal.isOpen;
  }, [
    logisticsModal.isOpen,
    deliveryModal.isOpen,
    reviewModal.isOpen,
    walletModal.isOpen,
    pickupPaymentModal.isOpen,
    deliveryConfirmationModal.isOpen,
    timelineModal.isOpen,
    deleteSiigoModal.isOpen
  ]);

  // Estado para recarga desde SIIGO por pedido

  // Funciones para mensajeros (moved inside component)
  const handleAcceptOrder = async (orderId) => {
    try {
      const response = await fetch(`/api/messenger/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        let errorMessage = 'Error aceptando pedido';
        try {
          const errData = await response.json();
          errorMessage = errData.message || errorMessage;
        } catch (e) {
          const text = await response.text().catch(() => '');
          errorMessage = `Error ${response.status}: ${text.slice(0, 50) || response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      toast.success(result.message || 'Pedido aceptado exitosamente');
      // Actualizar UI optimistamente sin recargar toda la lista
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('orders:update', { detail: { id: orderId, patch: { messenger_status: 'accepted' } } }));
      }
    } catch (error) {
      console.error('Error aceptando pedido:', error);
      toast.error(`DEBUG: ${error.message || 'Error aceptando pedido'}`);
    }
  };

  const handleRejectOrder = (orderId) => {
    try {
      const orderObj = orders.find(o => o.id === orderId) || null;
      setReasonModal({ isOpen: true, order: orderObj || { id: orderId }, mode: 'reject', loading: false });
    } catch (error) {
      console.error('Error abriendo modal de rechazo:', error);
      toast.error('No se pudo abrir el modal de rechazo');
    }
  };

  const handleStartDelivery = async (orderId) => {
    try {
      const response = await fetch(`/api/messenger/orders/${orderId}/start-delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Error iniciando entrega');
      }

      const result = await response.json();
      toast.success(result.message || 'Entrega iniciada exitosamente');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('orders:refresh'));
      }
    } catch (error) {
      console.error('Error iniciando entrega:', error);
      toast.error('Error iniciando entrega');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('orders:refresh'));
      }
    }
  };

  const handleMarkDeliveryFailed = (orderId) => {
    try {
      const orderObj = orders.find(o => o.id === orderId) || null;
      setReasonModal({ isOpen: true, order: orderObj || { id: orderId }, mode: 'failed', loading: false });
    } catch (error) {
      console.error('Error abriendo modal de entrega fallida:', error);
      toast.error('No se pudo abrir el modal');
    }
  };


  // Estados para acciones
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Track orders with payment received during this session and in-flight requests
  const [recentlyPaidOrders, setRecentlyPaidOrders] = useState(new Set());
  const [receivingIds, setReceivingIds] = useState(new Set());
  // Track recargas desde SIIGO por pedido para animar ruedita
  const [reloadingIds, setReloadingIds] = useState(new Set());

  // Helpers to robustly determine processing/paid status (handles string/number id mismatches and raw flags)
  const keyForId = useCallback((id) => String(id), []);
  const isProcessing = useCallback((id) => receivingIds.has(keyForId(id)), [receivingIds, keyForId]);
  const isPaidUi = useCallback((order) => {
    const k = keyForId(order?.id);
    // Consider both local session state and raw flags possibly coming from backend payload
    const rawPaid =
      Boolean(order?.payment_received) ||
      Boolean(order?.payment_collected) ||
      Boolean(order?.paymentCollected) ||
      Boolean(order?.has_payment) ||
      Boolean(order?.has_order_payment) ||
      Boolean(order?.hasOrderPayment);
    return hasOrderPayment(order) || recentlyPaidOrders.has(k) || rawPaid;
  }, [recentlyPaidOrders, keyForId]);

  // Delivered state from backend flags or status
  const isDeliveredUi = useCallback((order) => {
    const s = (order?.status || '').toString();
    return (
      ['entregado_cliente', 'entregado_bodega', 'entregado', 'finalizado', 'completado'].includes(s) ||
      Boolean(order?.delivered_at) ||
      Boolean(order?.is_delivered)
    );
  }, []);

  // Optimistic removal from "Ready for Delivery" groups after state change

  // Cargar pedidos - memoizado para evitar re-creaciones innecesarias
  const loadOrders = useCallback(async (filtersToUse = filters, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      // Determinar si estamos en la vista de cartera o todos los pedidos
      const view = searchParams.get('view');
      const isWalletView = view === 'cartera' || filtersToUse.status === 'revision_cartera';
      const isAllOrdersView = view === 'todos';

      // Si es mensajero o logística/admin con vista de mensajero, usar la vista de mensajero
      if (user?.role === 'mensajero' || ((['logistica', 'admin'].includes(user?.role)) && view === 'mensajero')) {
        console.log('📱 Usuario mensajero/logística/admin - usando vista de mensajero');
        try {
          // Siempre usar el endpoint enriquecido de mensajero para esta vista
          // (incluye flags como is_credit/requires_payment coherentes para UI)
          let endpoint = '/api/messenger/orders';
          if (['logistica', 'admin'].includes(user?.role)) {
            console.log('🏢 Usuario logística/admin - usando endpoint de mensajero para vista de mensajero');
          }

          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (!response.ok) {
            throw new Error('Error cargando pedidos de mensajero');
          }

          const data = await response.json();

          // Si es logística o admin, filtrar solo pedidos con mensajeros asignados
          let ordersToShow = data.data?.orders || data.data || [];
          if (['logistica', 'admin'].includes(user?.role)) {
            ordersToShow = ordersToShow.filter(order =>
              order.assigned_messenger_id &&
              ['listo_para_entrega', 'en_reparto', 'entregado_cliente'].includes(order.status)
            );
            console.log(`🔍 Logística/Admin - Mostrando ${ordersToShow.length} pedidos con mensajeros asignados`);
          }

          setOrders(ordersToShow);
          setPagination({
            page: 1,
            pages: 1,
            total: ordersToShow.length || 0,
            limit: 50
          });

        } catch (error) {
          console.error('Error cargando pedidos de mensajero:', error);
          toast.error('Error cargando pedidos asignados');
        }
      } else {
        // Preparar filtros - si es vista "todos", eliminar filtro de estado
        let finalFilters = { ...filtersToUse };
        if (isAllOrdersView) {
          // Forzar LIFO (último primero) solo en vista "Todos los Pedidos"
          // Enviar explícitamente view='todos' al backend para permitir a Cartera ver todo el histórico
          finalFilters = { ...filtersToUse, view: 'todos', status: '', sortBy: 'created_at', sortOrder: 'DESC', limit: 100 };
          console.log('📋 Vista "Todos los Pedidos" - mostrando pedidos sin filtrar por estado (LIFO) y limit=100');
        }

        let response;
        if (isWalletView) {
          // Usar el endpoint específico de cartera que garantiza datos correctos
          console.log('🏦 Usando endpoint de cartera para obtener pedidos');
          response = await walletService.getWalletOrders(finalFilters);
        } else {
          // Usar el endpoint general de pedidos
          // Nota: si el filtro es "pendiente_empaque" (ficha agrupada), NO enviar status al backend,
          // para evitar que el servidor filtre por un estado inexistente y devuelva vacío.
          // En su lugar pedimos una lista más amplia y filtramos en frontend por:
          // ['pendiente_empaque', 'en_preparacion', 'en_empaque'].
          let apiFilters = { ...finalFilters };
          const pseudoGroup = new Set(['pendiente_empaque', 'pendiente_entrega', 'listo_para_entrega_pendientes', 'entregados']);
          if (pseudoGroup.has((finalFilters.status || ''))) {
            // Para pseudo-estados agrupados, no enviar status al backend; filtramos en frontend
            apiFilters.status = '';
            apiFilters.limit = Math.max(Number(finalFilters.limit || 50), 100);
            apiFilters.sortBy = finalFilters.sortBy || 'created_at';
            apiFilters.sortOrder = finalFilters.sortOrder || 'DESC';
          }
          response = await orderService.getOrders(apiFilters);
        }

        // Normalizar payload de respuesta (wallet suele envolver en data.data)
        const payload = response?.data ?? {};
        let list = payload?.data?.orders ?? payload?.orders ?? payload?.data ?? [];
        if (!Array.isArray(list) && Array.isArray(payload?.data)) {
          list = payload.data;
        }

        // Filtro defensivo en frontend: si se selecciona un estado específico,
        // asegurar que solo se muestren pedidos con ese estado (independiente de la respuesta del backend).
        // Caso especial: "pendiente_empaque" agrupa todo el flujo de empaque.
        if (finalFilters.status) {
          const desired = String(finalFilters.status);
          if (desired === 'pendiente_empaque') {
            const packagingGroup = new Set(['pendiente_empaque', 'en_preparacion', 'en_empaque']);
            list = list.filter(o => packagingGroup.has(String(o?.status || '')));
          } else if (desired === 'pendiente_entrega') {
            list = list.filter(o => {
              const s = String(o?.status || '').toLowerCase();
              const ms = String(o?.messenger_status || '').toLowerCase();
              return s === 'en_reparto' || ms === 'accepted' || ms === 'in_delivery';
            });
          } else if (desired === 'listo_para_entrega_pendientes') {
            list = list.filter(o => {
              const s = String(o?.status || '').toLowerCase();
              const ms = String(o?.messenger_status || '').toLowerCase();
              return s === 'listo_para_entrega' && !(ms === 'accepted' || ms === 'in_delivery');
            });
          } else if (desired === 'entregados') {
            list = list.filter(o => isDeliveredUi(o));
          } else if (desired === 'revision_cartera') {
            // Permitir 'revision_cartera' O pedidos marcados como pendientes de comprobante (aunque estén entregados)
            list = list.filter(o => String(o?.status || '') === desired || o?.is_pending_payment_evidence);
          } else if (desired === 'money_in_transit') {
            // El backend ya filtra, pero si queremos ser defensivos en frontend:
            // (No es fácil filtrar aquí sin datos extra de delivery_tracking/cash_register, 
            //  así que confiamos en el backend y solo pasamos si la lista viene filtrada)
            // Opcional: podríamos marcar un flag en el backend para identificar estos pedidos
          } else {
            list = list.filter(o => String(o?.status || '') === desired);
          }
        }


        setOrders(list);
        const pag = payload?.data?.pagination ?? payload?.pagination ?? {
          page: 1,
          pages: 1,
          total: list.length,
          limit: list.length || 1
        };
        setPagination(pag);
      }

      // Auto-focus removido para evitar interferencias
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      toast.error('Error cargando pedidos');
    } finally {
      setLoading(false);
    }
  }, [searchParams, user?.role]);

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

  // Cargar pedidos listos para entrega (para vista logística)
  const loadReadyOrders = useCallback(async () => {
    // Solo cargar si es logística o admin y NO estamos en la vista específica de "en_logistica" (que ya filtra)
    // O si queremos mostrar el dashboard superior.
    if (['logistica', 'admin'].includes(user?.role)) {
      try {
        // Usamos un filtro específico para traer solo los listos para entrega
        const response = await orderService.getOrders({
          status: 'listo_para_entrega',
          limit: 100, // Traer suficientes para agrupar
          page: 1
        });
        const payload = response?.data ?? {};
        let list = payload?.data?.orders ?? payload?.orders ?? payload?.data ?? [];
        if (!Array.isArray(list) && Array.isArray(payload?.data)) {
          list = payload.data;
        }
        setReadyOrders(list);
      } catch (error) {
        console.error('Error cargando pedidos listos:', error);
      }
    }
  }, [user?.role]);

  // Cargar pedidos listos al inicio y al recargar
  useEffect(() => {
    loadReadyOrders();
  }, [loadReadyOrders]);

  // Group ready orders by courier/messenger
  const groupedReadyOrders = useMemo(() => {
    const groups = {};
    readyOrders.forEach(order => {
      let key = 'Sin Asignar';
      if (order.carrier_name) {
        key = order.carrier_name;
      } else if (order.assigned_messenger_name) {
        key = order.assigned_messenger_name;
      } else if (order.delivery_method === 'recoge_bodega') {
        key = 'Recoge en Bodega';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    return groups;
  }, [readyOrders]);

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
      const msg = String(result?.message || '');
      if (/entregado/i.test(msg)) {
        // Si el backend confirmó entrega en bodega, remover optimistamente de la sección
        toast.success(msg);
      } else {
        toast.success(msg || 'Pedido marcado como listo para recoger');
      }

      // Recargar datos
      loadOrders();

    } catch (error) {
      console.error('Error marcando como listo:', error);
      toast.error('Error marcando como listo');
    }
  };

  // Entregar pedido en bodega (cambia a entregado_bodega)
  const handleMarkPickupDelivered = async (orderId) => {
    try {
      const response = await fetch('/api/logistics/mark-pickup-delivered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          orderId,
          status: 'entregado_bodega',
          delivery_notes: `Entregado en bodega - ${new Date().toLocaleString()}`
        })
      });

      if (!response.ok) {
        const txt = await response.text();
        console.error('Respuesta error entrega bodega:', txt);
        throw new Error('Error entregando en bodega');
      }

      await response.json();
      // Optimistic UI: remover de la sección "Listos para entrega" inmediatamente
      toast.success('Pedido entregado en bodega');
      // Refrescar datos para confirmar estado con backend
      loadOrders();
    } catch (error) {
      console.error('Error entregando en bodega:', error);
      toast.error(error?.message || 'Error entregando en bodega');
    }
  };

  // Abrir modal de recepción de pago en bodega
  const handleReceivePickupPayment = (order) => {
    setPickupPaymentModal({ isOpen: true, order });
  };

  // Confirmación desde el modal: envía FormData al backend
  const confirmPickupPayment = async ({ orderId, method, amount, file }) => {
    const fd = new FormData();
    fd.append('orderId', orderId);
    fd.append('payment_method', method);
    if (amount > 0) fd.append('amount', String(amount));
    if (file) fd.append('photo', file);
    fd.append('notes', 'Recepción en bodega');

    // mark as in-flight to prevent double submissions
    setReceivingIds(prev => {
      const next = new Set(prev);
      next.add(String(orderId));
      return next;
    });

    try {
      await api.post('/logistics/receive-pickup-payment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Mark as paid in this session so button is disabled immediately
      setRecentlyPaidOrders(prev => {
        const next = new Set(prev);
        next.add(String(orderId));
        return next;
      });
      toast.success('Pago recibido');
      // Refresh data from backend
      loadOrders();
    } catch (err) {
      console.error('Error registrando pago en bodega:', err);
      // El interceptor de api ya muestra toast si viene message del backend
      if (!err?.response) {
        toast.error('Error registrando pago en bodega');
      }
      throw err;
    } finally {
      // clear in-flight flag
      setReceivingIds(prev => {
        const next = new Set(prev);
        next.delete(String(orderId));
        return next;
      });
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
      loadOrders();

    } catch (error) {
      console.error('Error marcando en reparto:', error);
      toast.error('Error marcando en reparto');
    }
  };

  // Recargar un pedido desde SIIGO (estado de carga por pedido + animación)
  const handleReloadFromSiigo = async (orderId) => {
    const key = String(orderId);
    setReloadingIds(prev => {
      const s = new Set(prev);
      s.add(key);
      return s;
    });
    try {
      // Usar el nuevo endpoint de sincronización inteligente que preserva verificaciones
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${orderId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (res.ok) {
        toast.success('Sincronización inteligente completada');
        await loadOrders();
      } else {
        throw new Error(data.message || 'Error al sincronizar');
      }
    } catch (error) {
      console.error('Error recargando desde SIIGO:', error);
      toast.error(error.message || 'Error recargando desde SIIGO');
    } finally {
      setReloadingIds(prev => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  };

  // Marcar pedido como "Gestión especial" usando modal (sin prompt nativo)
  const handleMarkSpecial = (orderId) => {
    try {
      const orderObj = orders.find(o => o.id === orderId) || null;
      setSpecialModal({ isOpen: true, order: orderObj || { id: orderId }, loading: false });
    } catch (error) {
      console.error('Error abriendo modal de gestión especial:', error);
      toast.error('No se pudo abrir el modal de gestión especial');
    }
  };

  // Confirmación de gestión especial desde modal bonito
  const handleConfirmSpecial = async ({ orderId, reason }) => {
    setSpecialModal((prev) => ({ ...prev, loading: true }));
    try {
      await orderService.markSpecial(orderId, { reason: String(reason).trim() });
      toast.success('Pedido marcado como gestión especial');
      setSpecialModal({ isOpen: false, order: null, loading: false });
      await loadOrders();
    } catch (error) {
      console.error('Error marcando como gestión especial:', error);
      toast.error('Error marcando como gestión especial');
    } finally {
      setSpecialModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Confirmación de registro de pago adhoc desde modal
  const handleConfirmAdhocPayment = async ({ amount, description, notes, evidence }) => {
    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('description', description);
      if (notes) formData.append('notes', notes);
      if (evidence) formData.append('evidence', evidence);

      await messengerService.registerAdhocPayment(formData);
      toast.success('Recepción de dinero registrada correctamente');
      setAdhocPaymentModal({ isOpen: false });
    } catch (error) {
      console.error('Error registrando recepción de dinero:', error);
      toast.error('Error registrando recepción de dinero');
      throw error;
    }
  };

  // Confirmación genérica para ReasonModal (rechazo / entrega fallida)
  const handleReasonConfirm = async ({ reason }) => {
    const orderId = reasonModal?.order?.id;
    if (!orderId) return;

    setReasonModal(prev => ({ ...prev, loading: true }));
    try {
      const url = reasonModal.mode === 'reject'
        ? `/api/messenger/orders/${orderId}/reject`
        : `/api/messenger/orders/${orderId}/mark-failed`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason: String(reason).trim() })
      });

      if (!response.ok) {
        throw new Error('Error enviando motivo');
      }

      const result = await response.json().catch(() => ({}));
      toast.success(
        result?.message || (reasonModal.mode === 'reject'
          ? 'Pedido rechazado y devuelto a logística'
          : 'Entrega marcada como fallida')
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('orders:refresh'));
      }
    } catch (error) {
      console.error('Error procesando motivo:', error);
      toast.error(reasonModal.mode === 'reject' ? 'Error rechazando pedido' : 'Error marcando entrega como fallida');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('orders:refresh'));
      }
    } finally {
      setReasonModal({ isOpen: false, order: null, mode: 'reject', loading: false });
    }
  };

  // Confirmación de cancelación por cliente (acción rápida)
  const handleConfirmCancelByCustomer = async ({ reason }) => {
    const orderId = cancelModal?.order?.id;
    if (!orderId) return;
    setCancelModal(prev => ({ ...prev, loading: true }));
    try {
      await orderService.cancelByCustomer(orderId, { reason: String(reason || '').trim() });
      toast.success('Pedido cancelado por cliente');
      setCancelModal({ isOpen: false, order: null, loading: false });
      // Refrescar lista
      loadOrders();
      loadReadyOrders?.();
      // Disparar evento global para que otras vistas reaccionen si es necesario
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('orders:refresh'));
      }
    } catch (e) {
      if (!e?.response?.data?.message) {
        toast.error('No se pudo cancelar el pedido');
      }
      setCancelModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Configurar WebSocket para notificaciones en tiempo real
  useEffect(() => {
    // Refresco global que incluye pedidos listos
    const refreshAll = () => {
      if (!modalOpenRef.current) {
        loadOrders();
        loadReadyOrders();
      }
    };

    // Conectar a WebSocket (producción: mismo origen detrás de Nginx; desarrollo: REACT_APP_API_URL si está definida)
    const apiBase = process.env.REACT_APP_API_URL;
    const socketBase = (apiBase && /^https?:\/\//.test(apiBase))
      ? apiBase
      : window.location.origin;
    socketRef.current = io(socketBase, { path: '/socket.io', transports: ['websocket', 'polling'] });

    socketRef.current.on('connect', () => {
      console.log('🔌 Conectado a WebSocket en OrdersPage');
      socketConnectedRef.current = true;
      // Suscribirse a actualizaciones de pedidos
      socketRef.current.emit('join-orders-updates');
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔌 Desconectado de WebSocket en OrdersPage');
      socketConnectedRef.current = false;
    });

    // Refresco seguro: evita recargar si un modal está abierto (no resetear formularios)
    const safeRefresh = () => {
      if (!modalOpenRef.current) {
        loadOrders();
        loadReadyOrders();
      } else {
        // console.debug('⏸️ Refresh bloqueado por modal abierto');
      }
    };

    // Escuchar notificaciones de nuevos pedidos creados desde Siigo
    socketRef.current.on('order-created', (data) => {
      console.log('📡 Nuevo pedido creado desde Siigo:', data);
      toast.success(`Nuevo pedido creado: ${data.orderNumber}`);
      // Recargar pedidos automáticamente
      safeRefresh();
    });

    // Escuchar notificaciones de facturas procesadas
    socketRef.current.on('invoice-processed', (data) => {
      console.log('📡 Factura procesada como pedido:', data);
      toast.success(`Factura procesada como pedido ${data.orderNumber}`);
      // Recargar pedidos automáticamente
      safeRefresh();
    });

    // Helpers para tiempo real sin refrescar lista completa
    const isLogisticsViewActive = () =>
      (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'logistica'));
    const fetchOrderById = async (id) => {
      if (!id) return null;
      try {
        const resp = await fetch(`/api/orders/${id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!resp.ok) return null;
        const json = await resp.json();
        return json?.data || null;
      } catch { return null; }
    };
    const upsertOrderInList = (orderObj) => {
      setOrders((prev) => {
        const without = prev.filter(o => o.id !== orderObj.id);
        const next = [...without, orderObj];
        next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return next;
      });
    };
    const removeOrderFromList = (id) => {
      setOrders((prev) => prev.filter(o => o.id !== id));
    };

    // Escuchar cambios de estado para actualización incremental en Logística
    socketRef.current.on('order-status-changed', (payload) => {
      try {
        const to = String(payload?.to_status || '').toLowerCase();
        const from = String(payload?.from_status || '').toLowerCase();
        const number = payload?.order_number || payload?.orderId || '';
        const id = Number(payload?.orderId || 0) || null;
        const logisticsStatusFilter = (searchParams.get('status') || '').toLowerCase();

        // Vista de logística activa: actualizar incrementalmente SIN recargar toda la lista
        if (isLogisticsViewActive() && !modalOpenRef.current) {
          // Entra a logística -> obtener sólo ese pedido y agregarlo si el filtro lo permite
          if (to === 'en_logistica') {
            toast.success(`🆕 Pedido ${number} enviado a Logística`);
            try { audioFeedback.playStatusAlert(); } catch { }
            if (logisticsStatusFilter === '' || logisticsStatusFilter === 'en_logistica') {
              fetchOrderById(id).then((orderObj) => { if (orderObj) upsertOrderInList(orderObj); });
            }
            return;
          }
          // Sale de logística -> eliminar de la lista si está presente
          if (from === 'en_logistica' || ['en_empaque', 'cancelado'].includes(to)) {
            removeOrderFromList(id);
            return;
          }
        }

        // Fallback: refresco seguro cuando no estamos en vista logística o hay modal abierto
        if (to === 'en_logistica') {
          toast.success(`🆕 Pedido ${number} enviado a Logística`);
          try { audioFeedback.playStatusAlert(); } catch { }
          safeRefresh();
          return;
        }
        if (from === 'en_logistica' || ['en_empaque', 'cancelado'].includes(to)) {
          safeRefresh();
        }
      } catch (e) {
        // no-op
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  // Cargar datos cuando cambien los filtros
  useEffect(() => {
    loadOrders(filters);
  }, [filters, loadOrders]);

  // Refrescar pedidos cuando se dispare evento global 'orders:refresh'
  useEffect(() => {
    const handler = () => {
      // Reconsultar la lista con los filtros actuales, sin mostrar spinner de carga
      loadOrders(filters, false);
      loadReadyOrders();
    };
    window.addEventListener('orders:refresh', handler);
    return () => {
      window.removeEventListener('orders:refresh', handler);
    };
  }, [loadOrders, loadReadyOrders]);

  // Auto-actualización para Logística:
  // Preferir WebSocket (tiempo real). Usar polling SOLO como fallback cuando no haya socket activo.
  // Además, pausar cualquier refresh si hay un modal abierto para no resetear formularios.
  useEffect(() => {
    const isLogisticsView = user?.role === 'logistica' || (searchParams.get('view') === 'logistica');
    if (!isLogisticsView) return;

    const shouldBlock = modalOpenRef.current;
    const socketAlive = socketConnectedRef.current;

    let interval;
    const tick = () => {
      if (!shouldBlock && !socketAlive) {
        loadOrders(undefined, false);
        loadReadyOrders();
      }
    };

    // Fallback con menor frecuencia, solo si NO hay socket
    if (!shouldBlock && !socketAlive) {
      interval = setInterval(tick, 30000); // 30s fallback
    }

    const onFocus = () => {
      if (!modalOpenRef.current && !socketConnectedRef.current) {
        loadOrders(undefined, false);
        loadReadyOrders();
      }
    };
    const onVisibility = () => {
      if (!document.hidden && !modalOpenRef.current && !socketConnectedRef.current) {
        loadOrders(undefined, false);
        loadReadyOrders();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.role,
    loadOrders,
    logisticsModal.isOpen,
    deliveryModal.isOpen,
    reviewModal.isOpen,
    walletModal.isOpen,
    pickupPaymentModal.isOpen,
    deliveryConfirmationModal.isOpen,
    timelineModal.isOpen,
    deleteSiigoModal.isOpen
  ]);

  // Actualizaciones optimistas por evento 'orders:update' (sin recargar toda la lista)
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {};
      const id = detail.id ?? detail.orderId;
      const patch = detail.patch || {};
      if (!id) return;
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    };
    window.addEventListener('orders:update', handler);
    return () => {
      window.removeEventListener('orders:update', handler);
    };
  }, []);

  // Cargar mensajeros solo una vez
  useEffect(() => {
    loadMessengers();
  }, []);

  // Cargar "Pedidos por cerrar en Siigo" cuando estamos en vista Cartera
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'cartera') {
      (async () => {
        try {
          const res = await carteraService.getPendingSiigoClose({});
          setSiigoPending(res?.data || []);
        } catch (e) {
          // silencioso
        }
      })();
    }
  }, [searchParams]);

  // Cargar pedidos listos para entrega cuando estamos en vista de logística
  // Seguridad: ocultar cualquier sección legacy "Pedidos Listos para Entrega" en vista logística (status en_logistica)
  useEffect(() => {
    const view = searchParams.get('view');
    const status = searchParams.get('status');
    if (view === 'logistica' && status === 'en_logistica') {
      const headers = Array.from(document.querySelectorAll('h2, h1'));
      headers.forEach((h) => {
        const text = (h.textContent || '').trim();
        if (/Pedidos\s+Listos\s+para\s+Entrega/i.test(text)) {
          // Ocultar bloque de encabezado
          if (h.parentElement) {
            h.parentElement.style.display = 'none';
          }
          // Ocultar posibles listados/tablas asociados cercanos (grids responsivos)
          const possibleContainer = h.closest('div');
          if (possibleContainer && possibleContainer.parentElement) {
            const grids = possibleContainer.parentElement.querySelectorAll('.grid, .grid-cols-1, .grid-cols-2, .grid-cols-3');
            grids.forEach(el => (el.style.display = 'none'));
          }
        }
      });
    }
  }, [searchParams]);

  // Helper para filtrar IDs ocultos (evita reaparición por latencia en render)

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
  }, [searchParams.get('view'), searchParams.get('status')]); // eslint-disable-line react-hooks/exhaustive-deps

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

    if (filters.paymentMethod) {
      params.set('paymentMethod', filters.paymentMethod);
    } else {
      params.delete('paymentMethod');
    }

    if (filters.tags) {
      params.set('tags', filters.tags);
    } else {
      params.delete('tags');
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

  }, [filters.search, filters.status, filters.paymentMethod, filters.tags, filters.dateFrom, filters.dateTo, filters.page]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Acciones en lote para logística
  const handleBulkAction = async () => {
    try {
      if (!bulkAction || selectedOrders.length === 0) {
        toast.error('Selecciona una acción y al menos un pedido');
        return;
      }

      const mapping = {
        confirm: 'confirmado',
        prepare: 'en_preparacion',
        ready: 'empacado'
      };
      const newStatus = mapping[bulkAction];
      if (!newStatus) {
        toast.error('Acción no válida');
        return;
      }

      await Promise.all(
        selectedOrders.map((orderId) =>
          orderService.updateOrder(orderId, { status: newStatus })
        )
      );

      toast.success(`Acción aplicada a ${selectedOrders.length} pedidos`);
      setSelectedOrders([]);
      setBulkAction('');
      loadOrders();
    } catch (error) {
      console.error('Error aplicando acción en lote:', error);
      toast.error('Error aplicando acción en lote');
    }
  };

  // Eliminar TODOS los pedidos (solo admin)
  const handleDeleteAllOrders = async () => {
    try {
      if (!window.confirm('Esta acción eliminará TODOS los pedidos y registros relacionados. Esta operación no se puede deshacer. ¿Deseas continuar?')) return;
      const code = window.prompt("Para confirmar, escribe EXACTAMENTE: RESET_ALL_ORDERS");
      if (code !== 'RESET_ALL_ORDERS') {
        toast.error('Confirmación inválida');
        return;
      }
      setResetLoading(true);
      await orderService.deleteAllOrders('RESET_ALL_ORDERS');
      toast.success('Se eliminaron todos los pedidos correctamente');
      setSelectedOrders([]);
      // Recargar lista (quedará vacía)
      loadOrders();
    } catch (error) {
      console.error('Error eliminando todos los pedidos:', error);
      toast.error('No se pudieron eliminar todos los pedidos');
    } finally {
      setResetLoading(false);
    }
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

  // Abrir modal de "Cerrar en Siigo" (vista Cartera)
  const handleOpenSiigoClose = async (order) => {
    // Determinar método predeterminado basado en el pedido
    const pm = (order.payment_method || '').toLowerCase();
    let defaultMethod = 'otros';

    if (['efectivo', 'contraentrega'].includes(pm)) {
      defaultMethod = 'efectivo';
    } else if (['mercadopago', 'pago_electronico'].includes(pm)) {
      defaultMethod = 'mercadopago';
    } else if (['transferencia', 'nequi', 'bancolombia', 'daviplata'].includes(pm)) {
      defaultMethod = 'transferencia';
    } else if (['reposicion'].includes(pm)) {
      defaultMethod = 'reposicion';
    } else if (['cliente_credito', 'credito'].includes(pm)) {
      defaultMethod = 'credito';
    } else {
      // Si no coincide con ninguno conocido, intentar mapear directo o dejar 'otros'
      if (['efectivo', 'transferencia', 'credito', 'reposicion', 'mercadopago'].includes(pm)) {
        defaultMethod = pm;
      }
    }

    // Cargar tags disponibles
    let availableTags = [];
    try {
      const res = await api.get('/cartera/tags');
      if (res.data && res.data.success) {
        availableTags = res.data.data;
      }
    } catch (e) {
      console.error('Error cargando tags:', e);
    }

    setSiigoCloseModal({
      open: true,
      order,
      method: defaultMethod,
      note: '',
      tags: Array.isArray(order.tags) ? order.tags.filter(t => t && typeof t === 'string' && t.trim() !== '') : [],
      availableTags
    });
  };

  // Confirmar cierre en Siigo (vista Cartera)
  const handleConfirmSiigoClose = async () => {
    try {
      const { order, method, note, tags } = siigoCloseModal;
      if (!order) return;
      const orderId = order.id || order.order_id || order.orderId;
      if (!orderId) {
        toast.error('Pedido inválido');
        return;
      }
      if (!['efectivo', 'transferencia', 'credito', 'reposicion', 'otros', 'mercadopago', 'pago_electronico', 'contraentrega', 'publicidad'].includes(String(method))) {
        toast.error('Selecciona un método válido');
        return;
      }
      await carteraService.closeOrderInSiigo(orderId, { method, note, tags });
      toast.success('Pedido cerrado en Siigo');
      // Remover de la lista local
      setSiigoPending(prev => prev.filter(o => (o.id || o.order_id) !== orderId));
      setSiigoCloseModal({ open: false, order: null, method: 'efectivo', note: '', tags: [], availableTags: [] });
      // Refrescar pedidos (por si cambia chip de estado)
      setSiigoCloseModal({ open: false, order: null, method: 'efectivo', note: '', tags: [], availableTags: [] });
      // Refrescar pedidos (por si cambia chip de estado)
      loadOrders();
      // Refrescar etiquetas (por si se crearon nuevas)
      fetchTags();
    } catch (e) {
      // interceptor maneja errores; mantener modal abierto para corrección
    }
  };

  // Manejar registro de entrega (flujo de mensajero)
  const handleDeliveryRegistration = async (deliveryData) => {
    try {
      // 1) Subir evidencias fotográficas (opcional pero recomendado)
      if (deliveryData.paymentPhoto) {
        const fd1 = new FormData();
        fd1.append('photo', deliveryData.paymentPhoto);
        fd1.append('description', 'Pago recibido');
        await messengerService.uploadEvidence(deliveryData.orderId, fd1);
      }
      if (deliveryData.deliveryPhoto) {
        const fd2 = new FormData();
        fd2.append('photo', deliveryData.deliveryPhoto);
        fd2.append('description', 'Evidencia de entrega');
        await messengerService.uploadEvidence(deliveryData.orderId, fd2);
      }

      // 2) Completar entrega usando el endpoint específico de mensajeros
      const orderObj = orders.find(o => o.id === deliveryData.orderId);
      const requiresPayment =
        orderObj?.requires_payment === true ||
        orderObj?.requires_payment === 1 ||
        orderObj?.requires_payment === '1';

      const shouldCollectFee =
        Boolean(orderObj?.should_collect_delivery_fee) ||
        ((orderObj?.shipping_payment_method || '').toLowerCase() === 'contraentrega' &&
          !(orderObj?.delivery_fee_exempt === true || orderObj?.delivery_fee_exempt === 1 || orderObj?.delivery_fee_exempt === '1'));

      const payload = {
        paymentCollected: Number(deliveryData.amountReceived || 0),
        deliveryFeeCollected: Number(deliveryData.deliveryFeeCollected || 0),
        ...(requiresPayment
          ? {
            paymentMethod: (deliveryData.productPaymentMethod || orderObj?.payment_method || 'efectivo'),
            transferAmount: Number(deliveryData.transferAmount || 0),
            transferBank: deliveryData.transferBank || null,
            transferReference: deliveryData.transferReference || null,
            transferDate: deliveryData.transferDate || null
          }
          : {}),
        ...(shouldCollectFee
          ? { deliveryFeePaymentMethod: (deliveryData.deliveryFeePaymentMethod || 'efectivo') }
          : {}),
        deliveryNotes: deliveryData.notes || null
        // latitude, longitude: podrían incluirse si dispones de geolocalización
      };
      await messengerService.completeDelivery(deliveryData.orderId, payload);

      toast.success('Entrega registrada exitosamente');
      loadOrders();
    } catch (error) {
      console.error('Error registrando entrega:', error);
      toast.error('Error registrando entrega');
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

  // Helper robusto para formatear fechas de SIIGO/BD
  const formatDateShort = useCallback((value) => {
    if (!value) return null;
    const v = typeof value === 'string' ? value.trim() : value;

    // Si viene en cualquiera de las variantes que comienzan con YYYY-MM-DD
    // (incluyendo ISO con zona horaria como 'YYYY-MM-DDTHH:mm:ss.sssZ'),
    // renderizar directamente la porción de fecha para evitar desfases por TZ
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const ymd = v.slice(0, 10); // 'YYYY-MM-DD'
      const [y, m, d] = ymd.split('-');
      return `${d}/${m}/${y}`;
    }

    let d;
    if (v instanceof Date) {
      d = v;
    } else if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(v)) {
        // Formato MySQL: 'YYYY-MM-DD HH:mm:ss' -> reemplazar espacio por 'T'
        d = new Date(v.replace(' ', 'T'));
      } else {
        // Intento directo (ISO, etc.)
        d = new Date(v);
        if (isNaN(d.getTime()) && v.includes(' ')) {
          d = new Date(v.replace(' ', 'T'));
        }
      }
    } else {
      d = new Date(v);
    }

    if (isNaN(d.getTime())) return null;
    return format(d, 'dd/MM/yyyy', { locale: es });
  }, []);

  // Vista especial: Logística gestionando pedidos en Logística (icons +30%, separación +10%)
  const isLogisticsActionsView =
    user?.role === 'logistica' &&
    (searchParams.get('view') === 'logistica') &&
    (searchParams.get('status') === 'en_logistica');

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
      <div className="mb-4 sm:mb-8 flex items-center justify-between">
        <div>
          <h1 className={`text-xl sm:text-3xl font-bold text-gray-900 ${(user?.role === 'mensajero' || (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'mensajero'))) ? 'hidden sm:block' : ''}`}>
            Gestión de Pedidos
          </h1>
          <p className={`text-gray-600 mt-2 ${(user?.role === 'mensajero' || (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'mensajero'))) ? 'hidden sm:block' : ''}`}>
            Administra todos los pedidos del sistema
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {user?.role === 'admin' && (
            <button
              onClick={handleDeleteAllOrders}
              disabled={resetLoading}
              className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 flex items-center disabled:opacity-60"
              title="Eliminar todos los pedidos"
            >
              <Icons.Trash2 className="w-4 h-4 mr-2" />
              {resetLoading ? 'Eliminando...' : 'Eliminar todos'}
            </button>
          )}
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
      </div>

      {/* Controles de pestañas para Mensajero (se elimina pestaña "Listos para Entregar") */}
      {(user?.role === 'mensajero' || (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'mensajero'))) && (
        <div className="mb-4 hidden sm:flex items-center justify-between">
          <div>
            <div className="inline-flex rounded-md shadow-sm overflow-hidden border border-gray-300">
              <button
                type="button"
                onClick={() => setMessengerTab('asignados')}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white"
              >
                Asignados
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1 hidden sm:block">
              Mostrando todos tus pedidos asignados
            </p>
          </div>
          {user?.role === 'mensajero' && (
            <button
              onClick={() => setAdhocPaymentModal({ isOpen: true })}
              className="btn btn-success flex items-center shadow-lg hover:shadow-xl transition-shadow"
            >
              <Icons.Wallet className="w-5 h-5 mr-2" />
              <span className="font-semibold">Dinero de Clientes a Crédito</span>
            </button>
          )}
        </div>
      )}

      {/* Botón flotante para móvil (solo mensajero) */}
      {user?.role === 'mensajero' && (
        <button
          onClick={() => setAdhocPaymentModal({ isOpen: true })}
          className="sm:hidden fixed bottom-20 right-4 z-40 bg-green-600 hover:bg-green-700 text-white rounded-full p-4 shadow-2xl flex items-center justify-center transition-all active:scale-95"
          style={{ width: '64px', height: '64px' }}
        >
          <Icons.Wallet className="w-7 h-7" />
        </button>
      )}

      {/* Botón superior para móvil (solo mensajero) */}
      {user?.role === 'mensajero' && (
        <div className="sm:hidden mb-2 px-1">
          <button
            onClick={() => setAdhocPaymentModal({ isOpen: true })}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md flex items-center justify-center transition-colors"
          >
            <Icons.Wallet className="w-5 h-5 mr-2" />
            <span>Dinero de Clientes a Crédito</span>
          </button>
        </div>
      )}

      {(user?.role === 'mensajero' || (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'mensajero'))) && (
        <div className="sm:hidden mb-3">
          <IsolatedSearchInput
            onSearch={handleSearch}
            initialValue={filters.search}
            placeholder="Buscar pedido, cliente o teléfono..."
          />
        </div>
      )}
      {/* Filtros */}
      <div className={`card mb-4 ${(user?.role === 'mensajero' || (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'mensajero'))) ? 'hidden sm:block' : ''}`}>
        <div className="card-content p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                  { value: 'pendiente_empaque', label: 'Pendiente Empaque (grupo)' },
                  { value: 'en_empaque', label: 'En Empaque' },
                  { value: 'en_preparacion', label: 'En Preparación' },
                  { value: 'empacado', label: 'Empacado' },
                  { value: 'listo_para_recoger', label: 'Listo para Recoger en Bodega' },
                  { value: 'en_reparto', label: 'En Reparto' },
                  { value: 'pendiente_entrega', label: 'Pendiente Entrega (grupo)' },
                  { value: 'listo_para_entrega_pendientes', label: 'Listos para Entregar (pendientes)' },
                  { value: 'entregados', label: 'Entregados (grupo)' },
                  { value: 'entregado_transportadora', label: 'Entregado a Transportadora' },
                  { value: 'entregado_cliente', label: 'Entregado a Cliente' },
                  { value: 'entregado_bodega', label: 'Entregado en Bodega' },
                  { value: 'gestion_especial', label: 'Gestión Especial' },
                  { value: 'cancelado', label: 'Cancelado' }
                ]}
                placeholder="Todos los estados"
              />
            </div>

            {/* Forma de Pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma de Pago
              </label>
              <CustomDropdown
                value={filters.paymentMethod}
                onChange={(value) => handleFilterChange('paymentMethod', value)}
                options={[
                  { value: '', label: 'Todas las formas de pago' },
                  { value: 'credito', label: 'Crédito' },
                  { value: 'efectivo', label: 'Efectivo' },
                  { value: 'mercadopago', label: 'Mercado Pago' },
                  { value: 'transferencia', label: 'Transferencia' },
                  { value: 'contraentrega', label: 'Contraentrega' }
                ]}
                placeholder="Todas las formas de pago"
              />
            </div>

            {/* Etiquetas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Etiquetas
              </label>
              <CustomDropdown
                value={filters.tags}
                onChange={(value) => handleFilterChange('tags', value)}
                options={[
                  { value: '', label: 'Todas las etiquetas' },
                  ...availableTags.map(tag => ({ value: tag, label: tag }))
                ]}
                placeholder="Todas las etiquetas"
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Sección de Pedidos Listos para Entrega (Agrupados) - Solo Logística/Admin */}
      {false && (
        <div className="mb-8 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Icons.PackageCheck className="w-5 h-5 text-green-600" />
            Pedidos Listos para Entrega ({readyOrders.length})
          </h2>

          {Object.entries(groupedReadyOrders).map(([groupName, groupOrders]) => (
            <div key={groupName} className="card overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-medium text-gray-800 flex items-center gap-2">
                  {groupName === 'Recoge en Bodega' ? <Icons.Store className="w-4 h-4" /> :
                    groupName === 'Sin Asignar' ? <Icons.HelpCircle className="w-4 h-4" /> :
                      <Icons.Truck className="w-4 h-4" />}
                  {groupName}
                  <span className="ml-2 text-xs bg-white border border-gray-300 px-2 py-0.5 rounded-full text-gray-600">
                    {groupOrders.length}
                  </span>
                </h3>
              </div>

              <ReadyForDeliveryGroupTable
                orders={groupOrders}
                columns={[
                  { header: 'Pedido', render: (o) => <span className="font-medium text-blue-600 cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>{o.order_number}</span> },
                  {
                    header: 'Cliente', render: (o) => (
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{o.customer_name || o.client_name}</span>
                        <span className="text-xs text-gray-500">{o.city || o.customer_city}</span>
                      </div>
                    )
                  },
                  {
                    header: 'Pago', render: (o) => {
                      const { productDue } = computeCollectionAmounts(o);
                      const hasPay = hasOrderPayment(o) || isPaidUi(o);
                      if (isCreditOrder(o)) return <span className="badge badge-blue">Crédito</span>;
                      if (productDue <= 0 || hasPay) return <span className="badge badge-green">Pagado/Sin Cobro</span>;
                      return <span className="badge badge-red">Cobrar: ${formatCurrencyCOP(productDue)}</span>;
                    }
                  },
                  {
                    header: 'Envío', render: (o) => (
                      <span className={`badge ${hasShippingFeePaid(o) ? 'badge-blue' : 'badge-orange'}`}>
                        {hasShippingFeePaid(o) ? 'Flete Pagado' : 'Cobrar Flete'}
                      </span>
                    )
                  },
                  { header: 'Fecha', render: (o) => <span className="text-xs text-gray-500">{formatDateShort(o.created_at)}</span> }
                ]}
                getActions={(order) => (
                  <div className="flex justify-end gap-2">
                    {/* Acciones contextuales según el grupo */}
                    {groupName === 'Recoge en Bodega' && (
                      <>
                        <button
                          onClick={() => setSpecialModal({ isOpen: true, order, loading: false })}
                          className="text-red-600 hover:text-red-900 w-4 h-4 flex items-center justify-center"
                          title="Marcar gestión especial (sale del flujo)"
                        >
                          <Icons.Flag className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMarkPickupDelivered(order.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Entregar"
                        >
                          <Icons.CheckCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {(order.delivery_method !== 'recoge_bodega' && !order.assigned_messenger_id && !order.carrier_name) && (
                      <button
                        onClick={() => setLogisticsModal({ isOpen: true, order })}
                        className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                        title="Asignar Logística"
                      >
                        <Icons.Truck className="w-4 h-4" />
                      </button>
                    )}

                    {/* Para mensajeros asignados, permitir marcar en reparto */}
                    {order.assigned_messenger_id && (
                      <button
                        onClick={() => handleMarkInDelivery(order.id, order.assigned_messenger_id)}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Enviar a Reparto"
                      >
                        <Icons.Send className="w-4 h-4" />
                      </button>
                    )}

                    {/* Para transportadoras, permitir marcar entregado a transportadora si aún no lo está */}
                    {order.carrier_name && order.status !== 'entregado_transportadora' && (
                      <button
                        onClick={() => handleMarkAsDeliveredToCarrier(order.id, order.carrier_name)}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Marcar Entregado a Transportadora"
                      >
                        <Icons.CheckSquare className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              />
            </div>
          ))}
        </div>
      )}

      {/* Lista de pedidos */}
      {(user?.role === 'mensajero' || (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'mensajero'))) && (
        <div className="sm:hidden card mb-4">
          <div className="space-y-3">

            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    {/* Col 1: Código, Nombre, Estado, Valor */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-gray-500">Pedido</div>
                      <div className="text-[13px] font-semibold text-gray-900">{order.order_number}</div>
                      {/* Tags display (mobile) */}
                      {(() => {
                        let tags = [];
                        try {
                          if (typeof order.tags === 'string' && order.tags.trim()) {
                            tags = JSON.parse(order.tags);
                          } else if (Array.isArray(order.tags)) {
                            tags = order.tags;
                          }
                        } catch (e) {
                          // Ignore parse errors
                        }
                        if (Array.isArray(tags) && tags.length > 0) {
                          return (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div className="text-[12px] text-gray-600 mt-1 truncate">{order.customer_name || order.client_name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status, order)}`}>
                          {getStatusLabel(order.status, order)}
                        </span>
                        <span className="text-[13px] font-semibold text-gray-900">{formatCurrencyCOP(getOrderAmount(order))}</span>
                      </div>
                    </div>
                    {/* Col 3: Acciones */}
                    <div className="w-12 shrink-0 flex flex-col items-center justify-start gap-3 pt-1">
                      <button type="button" onClick={() => navigate(`/orders/${order.id}`)} title="Ver" className="text-blue-600 p-2 rounded-full active:scale-95">
                        <Icons.Eye className="w-5 h-5" style={{ width: '22px', height: '22px' }} />
                      </button>
                      <button type="button" onClick={() => setTimelineModal({ isOpen: true, order })} title="Línea de tiempo" className="text-gray-700 p-2 rounded-full active:scale-95">
                        <Icons.History className="w-5 h-5" style={{ width: '22px', height: '22px' }} />
                      </button>
                      {user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'assigned' && !['entregado', 'entregado_cliente', 'entregado_transportadora', 'entregado_bodega'].includes(order.status) && (
                        <>
                          <button type="button" onClick={() => handleAcceptOrder(order.id)} title="Aceptar" className="text-green-600 p-2 rounded-full active:scale-95">
                            <Icons.Check className="w-5 h-5" style={{ width: '22px', height: '22px' }} />
                          </button>
                          <button type="button" onClick={() => handleRejectOrder(order.id)} title="Rechazar" className="text-red-600 p-2 rounded-full active:scale-95">
                            <Icons.X className="w-5 h-5" style={{ width: '22px', height: '22px' }} />
                          </button>
                        </>
                      )}
                      {user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'accepted' && (
                        <button type="button" onClick={() => setDeliveryConfirmationModal({ isOpen: true, order })} title="Iniciar entrega" className="text-blue-600 p-2 rounded-full active:scale-95">
                          <Icons.Play className="w-5 h-5" style={{ width: '22px', height: '22px' }} />
                        </button>
                      )}
                      {user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'in_delivery' && (
                        <>
                          <button type="button" onClick={() => setDeliveryModal({ isOpen: true, order })} title="Completar entrega" className="text-purple-600 p-2 rounded-full active:scale-95">
                            <Icons.Package className="w-5 h-5" style={{ width: '22px', height: '22px' }} />
                          </button>
                          <button type="button" onClick={() => handleMarkDeliveryFailed(order.id)} title="Entrega fallida" className="text-orange-600 p-2 rounded-full active:scale-95">
                            <Icons.AlertTriangle className="w-5 h-5" style={{ width: '22px', height: '22px' }} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Motivo de Gestión Especial (móvil) */}
                  {order.status === 'gestion_especial' && getSpecialReason(order) && (
                    <div className="mt-2 text-[12px] text-gray-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                      <Icons.Flag className="w-4 h-4 text-red-500 mt-0.5" />
                      <p className="leading-snug whitespace-pre-line">
                        <span className="font-medium">Motivo: </span>{getSpecialReason(order)}
                      </p>
                    </div>
                  )}
                  {/* Observaciones del pedido */}
                  {getOrderNotes(order) && (
                    <div className="mt-2 text-[12px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-2 flex items-start gap-2">
                      <Icons.MessageSquare className="w-4 h-4 text-gray-500 mt-0.5" />
                      <p className="leading-snug whitespace-pre-line">{getOrderNotes(order)}</p>
                    </div>
                  )}
                  {/* Col 2: Dirección / Ciudad / Ver ubicación */}
                  {/* Col 2: Dirección / Ciudad / Ver ubicación */}
                  <div className="mt-2 text-[12px] text-gray-700 leading-snug truncate">{getOrderAddress(order)}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 flex items-center justify-between">
                    <span className="truncate">{getOrderCity(order)}</span>
                    {getMapsUrl(order) && (
                      <a href={getMapsUrl(order)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 font-medium">
                        <Icons.MapPin className="w-4 h-4" />
                        <span>Ver ubicación</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="p-6 text-center text-gray-500">No hay pedidos asignados</div>
            )}
          </div>
        </div>
      )}



      {/* Vista de tabla (desktop/tablet) */}
      {/* Mantener solo la tabla principal de pedidos */}
      <div className={`card ${(user?.role === 'mensajero' || (['logistica', 'admin'].includes(user?.role) && (searchParams.get('view') === 'mensajero'))) ? 'hidden sm:block' : ''}`}>
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
                        onChange={() => {
                          if (selectedOrders.length === orders.length) {
                            setSelectedOrders([]);
                          } else {
                            setSelectedOrders(orders.map(order => order.id));
                          }
                        }}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Forma de Pago
                  </th>
                  {user?.role === 'mensajero' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Método de Envío
                    </th>
                  )}
                  {searchParams.get('view') === 'logistica' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Método de Pago
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pago Electrónico
                      </th>
                    </>
                  )}
                  {['admin', 'logistica', 'mensajero', 'facturador'].includes(user?.role) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mensajero
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Factura
                  </th>
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
                          onChange={() => {
                            setSelectedOrders(prev =>
                              prev.includes(order.id)
                                ? prev.filter(id => id !== order.id)
                                : [...prev, order.id]
                            );
                          }}
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
                          {(Array.isArray(order.items) ? order.items.length : (order.items_count ?? order.itemsCount ?? 0))} items
                        </div>
                        {/* Tags display */}
                        {(() => {
                          let tags = [];
                          try {
                            if (typeof order.tags === 'string' && order.tags.trim()) {
                              tags = JSON.parse(order.tags);
                            } else if (Array.isArray(order.tags)) {
                              tags = order.tags;
                            }
                          } catch (e) {
                            // Ignore parse errors
                          }
                          if (Array.isArray(tags) && tags.length > 0) {
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 break-words leading-tight">
                          {order.customer_name || order.client_name}
                        </div>
                        <div className="text-sm text-gray-500 whitespace-nowrap">
                          {order.customer_phone || order.client_phone}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${((['recoge_bodega', 'recogida_tienda'].includes(order.delivery_method)) &&
                            (
                              ['entregado_cliente', 'entregado', 'completado', 'finalizado'].includes(order.status) ||
                              order.delivered_at || order.is_delivered
                            )
                          )
                            ? 'bg-green-100 text-green-800'
                            : getStatusColor(order.status)
                            }`}
                        >
                          {((['recoge_bodega', 'recogida_tienda'].includes(order.delivery_method)) &&
                            (
                              ['entregado_cliente', 'entregado', 'completado', 'finalizado'].includes(order.status) ||
                              order.delivered_at || order.is_delivered
                            )
                          )
                            ? 'Entregado en Bodega'
                            : (order.status === 'entregado_transportadora' && order.carrier_name)
                              ? `Entregado a ${order.carrier_name}`
                              : getStatusLabel(order.status)}
                        </span>
                        {(order.is_pending_payment_evidence === true || order.is_pending_payment_evidence === 1 || order.is_pending_payment_evidence === '1') && (
                          <span className="block text-xs font-bold text-red-600 mt-1">
                            Falta subir comprobante
                          </span>
                        )}
                        {/* Motivo visible para Gestión Especial */}
                        {order.status === 'gestion_especial' && getSpecialReason(order) && (
                          <span className="text-xs font-semibold text-red-600 line-clamp-2">
                            Motivo: {getSpecialReason(order)}
                          </span>
                        )}
                        {order.validation_status === 'rejected' && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            ❌ Rechazado por Cartera
                          </span>
                        )}
                        {order.siigo_closed ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Cerrado en Siigo
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          ${getOrderAmount(order).toLocaleString('es-CO')}
                        </span>
                        {/* Indicadores de método de pago */}
                        <div className="flex space-x-1 mt-1">
                          {(() => {
                            // Si es cliente a crédito, siempre mostrar "CRÉDITO" sin importar totalDue (el flete se muestra en el chip de envío)
                            if (isCreditOrder(order)) {
                              return (
                                <span className="px-1 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                                  🧾 CRÉDITO
                                </span>
                              );
                            }
                            // Mostrar coherencia en el flujo: el chip principal de Monto refleja SOLO el producto,
                            // y el estado del flete se muestra en el chip de envío aparte.
                            const { productDue } = computeCollectionAmounts(order);
                            if (productDue === 0) {
                              if (hasOrderPayment(order)) {
                                return (
                                  <span className="px-1 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                    ✅ PAGADO
                                  </span>
                                );
                              }
                              return (
                                <span className="px-1 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                                  ✅ SIN COBRO
                                </span>
                              );
                            }
                            return (
                              <span className="px-1 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                                💰 COBRAR
                              </span>
                            );
                          })()}

                          {hasShippingFeePaid(order) ? (
                            <span className="px-1 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              🚚 PAGADO
                            </span>
                          ) : (
                            <span className="px-1 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                              🚚 +FLETE
                            </span>
                          )}

                          {/* Proveedor de pago electrónico en crudo (sin helpers), oculto si hay columna dedicada en logística */}
                          {(() => {
                            if (searchParams.get('view') === 'logistica') return null;
                            const text = getRawElectronicProvider(order);
                            if (!text) return null;
                            return (
                              <span className="px-1 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800">
                                {text}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getPaymentMethodLabel(order.payment_method)}
                      {order.electronic_payment_type && (
                        <span className="block text-xs text-gray-400">
                          ({order.electronic_payment_type})
                        </span>
                      )}
                    </td>

                    {searchParams.get('view') === 'logistica' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            // Mostrar valor CRUDO + estado computado (COBRAR / SIN COBRO / CRÉDITO) para coherencia con mensajero
                            const requiresPayment =
                              order?.requires_payment === 1 ||
                              order?.requires_payment === true ||
                              order?.requires_payment === '1';
                            const credit = isCreditOrder(order);
                            const raw =
                              getRawPaymentMethod(order) ||
                              (credit ? 'cliente_credito' : (!requiresPayment ? 'sin_cobro' : ''));

                            try {
                              const { productDue } = computeCollectionAmounts(order);
                              return (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {raw ? (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                      {raw}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-500">-</span>
                                  )}
                                  {credit ? (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                      🧾 CRÉDITO
                                    </span>
                                  ) : productDue > 0 ? (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                                      💰 COBRAR
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                                      ✅ SIN COBRO
                                    </span>
                                  )}
                                </div>
                              );
                            } catch {
                              return raw ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                  {raw}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">-</span>
                              );
                            }
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            if (isCreditOrder(order)) return <span className="text-xs text-gray-500">-</span>;
                            // Mostrar valor en crudo desde base de datos, sin funciones ni filtros
                            const text = getRawElectronicProvider(order);

                            return text
                              ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                  {text}
                                </span>
                              )
                              : <span className="text-xs text-gray-500">-</span>;
                          })()}
                        </td>
                      </>
                    )}

                    {/* Método de envío - Solo visible para mensajeros */}
                    {user?.role === 'mensajero' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDeliveryMethodColor(order.delivery_method)}`}>
                          {getDeliveryMethodLabel(order.delivery_method)}
                        </span>
                      </td>
                    )}

                    {/* Columna Mensajero / Transportadora / Bodega */}
                    {['admin', 'logistica', 'mensajero', 'facturador'].includes(user?.role) && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getCourierDisplay(order)}
                        </div>
                        {isMessengerFlow(order) && order.messenger_status && (
                          <div className="text-xs text-gray-500">
                            Estado: {order.messenger_status}
                          </div>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={order.siigo_invoice_created_at || order.created_at || ''}>
                      {formatDateShort(order.siigo_invoice_created_at) ||
                        formatDateShort(order.created_at) ||
                        '-'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.shipping_date
                        ? format(new Date(order.shipping_date), 'dd/MM/yyyy', { locale: es })
                        : '-'
                      }
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className={`flex items-center justify-end min-w-[200px] actions-cell ${isLogisticsActionsView ? 'actions-lgx' : ''}`}>
                        {/* Slot 1: Ver detalles - SIEMPRE presente */}
                        <button
                          type="button"
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

                        {/* Slot 2.5: Ver línea de tiempo */}
                        <button
                          type="button"
                          onClick={() => setTimelineModal({ isOpen: true, order })}
                          className="text-gray-700 hover:text-gray-900 w-4 h-4 flex items-center justify-center"
                          title="Ver línea de tiempo"
                        >
                          <Icons.History className="w-4 h-4" />
                        </button>

                        {/* Acción rápida: Cliente canceló pedido (Admin/Facturación) */}
                        {(['admin', 'facturador'].includes(user?.role) &&
                          ['en_preparacion', 'en_empaque', 'empacado', 'listo', 'listo_para_entrega', 'listo_para_recoger', 'en_logistica', 'en_reparto'].includes(String(order.status || '').toLowerCase())) ? (
                          <button
                            type="button"
                            onClick={() => setCancelModal({ isOpen: true, order, loading: false })}
                            className="text-red-600 hover:text-red-900 w-4 h-4 flex items-center justify-center"
                            title="Cliente canceló pedido"
                          >
                            <Icons.XCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}

                        {/* Slot 3: Acción principal del estado */}
                        {order.status === 'gestion_especial' ? (
                          <span
                            className="text-gray-500 w-4 h-4 flex items-center justify-center"
                            title="Pedido en gestión especial"
                          >
                            <Icons.Flag className="w-4 h-4" />
                          </span>
                        ) : (['admin', 'facturador'].includes(user?.role) && (order.status === 'pendiente_por_facturacion' || order.status === 'pendiente_facturacion')) ? (
                          <>
                            <button
                              onClick={() => setReviewModal({ isOpen: true, order })}
                              className="text-orange-600 hover:text-orange-900 w-4 h-4 flex items-center justify-center"
                              title="Revisar y aprobar pedido"
                            >
                              <Icons.FileSearch className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSpecialModal({ isOpen: true, order, loading: false })}
                              className="text-red-600 hover:text-red-900 w-4 h-4 flex items-center justify-center"
                              title="Marcar gestión especial (sale del flujo)"
                            >
                              <Icons.Flag className="w-4 h-4" />
                            </button>
                          </>
                        ) : (['admin', 'cartera'].includes(user?.role) && order.status === 'revision_cartera') ? (
                          <button
                            onClick={() => setWalletModal({ isOpen: true, order })}
                            className="text-green-600 hover:text-green-900 w-4 h-4 flex items-center justify-center"
                            title="Validar pago"
                          >
                            <Icons.CreditCard className="w-4 h-4" />
                          </button>
                        ) : (['admin', 'cartera', 'logistica'].includes(user?.role) && (order.is_pending_payment_evidence)) ? (
                          <button
                            onClick={() => setUploadEvidenceModal({ open: true, order, file: null })}
                            className="text-blue-600 hover:text-blue-900 w-4 h-4 flex items-center justify-center"
                            title="Subir comprobante (Pendiente)"
                          >
                            <Icons.Upload className="w-4 h-4" />
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
                        ) : (user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'assigned' && !['entregado', 'entregado_cliente', 'entregado_transportadora', 'entregado_bodega'].includes(order.status)) ? (
                          <button
                            type="button"
                            onClick={() => handleAcceptOrder(order.id)}
                            className="text-green-600 hover:text-green-900 w-4 h-4 flex items-center justify-center"
                            title="Aceptar pedido"
                          >
                            <Icons.Check className="w-4 h-4" />
                          </button>
                        ) : (user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'accepted') ? (
                          <button
                            type="button"
                            onClick={() => setDeliveryConfirmationModal({ isOpen: true, order })}
                            className="text-blue-600 hover:text-blue-900 w-4 h-4 flex items-center justify-center"
                            title="Iniciar entrega"
                          >
                            <Icons.Play className="w-4 h-4" />
                          </button>
                        ) : (user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'in_delivery') ? (
                          <button
                            type="button"
                            onClick={() => setDeliveryModal({ isOpen: true, order })}
                            className="text-purple-600 hover:text-purple-900 w-4 h-4 flex items-center justify-center"
                            title="Completar entrega"
                          >
                            <Icons.Package className="w-4 h-4" />
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
                        ) : (user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'assigned') ? (
                          <button
                            type="button"
                            onClick={() => handleRejectOrder(order.id)}
                            className="text-red-600 hover:text-red-900 w-4 h-4 flex items-center justify-center"
                            title="Rechazar pedido"
                          >
                            <Icons.X className="w-4 h-4" />
                          </button>
                        ) : (user?.role === 'mensajero' && order.assigned_messenger_id === user.id && order.messenger_status === 'in_delivery') ? (
                          <button
                            type="button"
                            onClick={() => handleMarkDeliveryFailed(order.id)}
                            className="text-orange-600 hover:text-orange-900 w-4 h-4 flex items-center justify-center"
                            title="Marcar entrega fallida"
                          >
                            <Icons.AlertTriangle className="w-4 h-4" />
                          </button>
                        ) : (order.status === 'pendiente' && canChangeStatus(order, 'confirmado')) ? (
                          <button
                            onClick={() => handleStatusChange(order.id, 'confirmado')}
                            className="text-green-600 hover:text-green-900 w-4 h-4 flex items-center justify-center"
                            title="Confirmar"
                          >
                            <Icons.Check className="w-4 h-4" />
                          </button>
                        ) : (['admin', 'cartera', 'logistica'].includes(user?.role) && ['efectivo', 'contraentrega'].includes(String(order.payment_method || '').toLowerCase()) && !order.is_pending_payment_evidence) ? (
                          <button
                            onClick={() => setUploadEvidenceModal({ open: true, order, file: null })}
                            className="text-gray-400 hover:text-blue-600 w-4 h-4 flex items-center justify-center"
                            title="Subir comprobante (Opcional)"
                          >
                            <Icons.Upload className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}

                        {/* Slot 4.5: Recargar desde SIIGO (visible si hay siigo_invoice_id) */}
                        {(['admin', 'facturador', 'logistica', 'cartera'].includes(user?.role) && order.siigo_invoice_id) ? (
                          <button
                            onClick={() => handleReloadFromSiigo(order.id)}
                            disabled={reloadingIds.has(String(order.id))}
                            className="text-emerald-600 hover:text-emerald-900 w-4 h-4 flex items-center justify-center disabled:opacity-50"
                            title="Recargar desde SIIGO"
                          >
                            <Icons.RefreshCw className={`w-4 h-4 ${reloadingIds.has(String(order.id)) ? 'animate-spin' : ''}`} />
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

      {/* Sección de Guías Pendientes (Logística y Admin) - Solo en vista Logística */}
      {['logistica', 'admin'].includes(user?.role) && searchParams.get('view') === 'logistica' && (
        <PendingTransportGuides
          onGuideUploaded={() => {
            loadOrders(undefined, false);
            // Also refresh ready orders just in case
            loadReadyOrders();
            // Trigger global refresh to update pending guides list itself (redundant but safe)
            window.dispatchEvent(new Event('orders:refresh'));
          }}
        />
      )}

      {/* Pedidos por cerrar en Siigo (solo vista Cartera) */}
      {searchParams.get('view') === 'cartera' && (
        <div className="card mt-6">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Icons.BadgeCheck className="w-5 h-5 mr-2 text-green-600" />
              Pedidos por cerrar en Siigo
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                {siigoPending.length}
              </span>
            </h2>
          </div>
          <div className="card-content p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Pedido</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Estado</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Entrega</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Forma de Pago</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Factura</th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Fecha Factura</th>
                    <th className="px-2 py-1 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {siigoPending.map((row) => (
                    <tr key={row.id || row.order_id} className="hover:bg-gray-50">
                      <td className="px-2 py-1">
                        <div className="text-sm font-medium text-gray-900">{row.order_number}</div>
                      </td>
                      <td className="px-2 py-1">
                        <div className="text-xs sm:text-sm text-gray-900 whitespace-normal break-words">{row.customer_name}</div>
                      </td>
                      <td className="px-2 py-1 hidden lg:table-cell">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2 py-1 hidden lg:table-cell">
                        {(() => {
                          const dm = String(row?.delivery_method || '').toLowerCase();
                          const channel =
                            row?.delivery_channel ||
                            (row?.carrier_name
                              ? row.carrier_name
                              : row?.messenger_name
                                ? `Mensajero: ${row.messenger_name}`
                                : (dm === 'recoge_bodega' || dm === 'recogida_tienda')
                                  ? 'Bodega'
                                  : '-');
                          return (
                            <span className="text-xs sm:text-sm text-gray-900">
                              {channel}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1 hidden lg:table-cell">
                        <div className="text-xs sm:text-sm text-gray-900">
                          {(row.payment_method || '-').toString().toUpperCase()}
                          {String(row.payment_method || '').toUpperCase() === 'PAGO_ELECTRONICO' && row.electronic_payment_type && (
                            <div className="text-xs text-gray-500 font-medium mt-0.5">
                              {row.electronic_payment_type}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1 hidden lg:table-cell">
                        <div className="text-xs sm:text-sm text-gray-900">
                          {row.siigo_invoice_number || '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1 hidden lg:table-cell">
                        <div className="text-xs text-gray-500">
                          {row.siigo_invoice_created_at ? new Date(row.siigo_invoice_created_at).toLocaleDateString('es-CO') : '-'}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => setTimelineModal({ isOpen: true, order: row })}
                          className="mr-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded inline-flex items-center"
                          title="Ver Historial"
                        >
                          <Icons.History className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleOpenSiigoClose(row)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded inline-flex items-center"
                          title="Cerrar en Siigo"
                        >
                          <Icons.CheckCircle className="w-3 h-3" />
                          <span className="ml-1 hidden sm:inline">Cerrar en Siigo</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {siigoPending.length === 0 && (
                    <tr>
                      <td className="px-2 py-6 text-center text-sm text-gray-500" colSpan={8}>
                        No hay pedidos por cerrar en Siigo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cerrar en Siigo */}
      {siigoCloseModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 overflow-y-auto">
          <div className="bg-white rounded shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold">Cerrar en Siigo</h3>
              <button onClick={() => setSiigoCloseModal({ open: false, order: null, method: 'efectivo', note: '', tags: [], availableTags: [] })} className="text-gray-600 hover:text-gray-900">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 grow overflow-y-auto">
              <div className="text-sm text-gray-700">
                Pedido: <span className="font-semibold">{siigoCloseModal.order?.order_number}</span>
              </div>

              {/* Evidencia de pago (si existe y es transferencia/electrónico) */}
              {siigoCloseModal.order?.payment_evidence_path && (
                <div className="border rounded p-2 bg-gray-50">
                  <p className="text-xs font-medium text-gray-700 mb-2">Comprobante de Pago:</p>
                  <div className="relative h-48 w-full bg-gray-200 rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={siigoCloseModal.order.payment_evidence_path.startsWith('http')
                        ? siigoCloseModal.order.payment_evidence_path
                        : `/uploads/${siigoCloseModal.order.payment_evidence_path}`}
                      alt="Comprobante"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300?text=Error+imagen'; }}
                    />
                  </div>
                  <a
                    href={siigoCloseModal.order.payment_evidence_path.startsWith('http')
                      ? siigoCloseModal.order.payment_evidence_path
                      : `/uploads/${siigoCloseModal.order.payment_evidence_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Ver imagen completa
                  </a>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select
                  value={siigoCloseModal.method}
                  onChange={(e) => setSiigoCloseModal(prev => ({ ...prev, method: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="credito">Cliente a Crédito</option>
                  <option value="pago_electronico">Pago Electrónico</option>
                  <option value="contraentrega">Contraentrega (Solo Medellín)</option>
                  <option value="mercadopago">MercadoPago</option>
                  <option value="publicidad">Publicidad (sin validación)</option>
                  <option value="reposicion">Reposición (sin validación)</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              {/* Etiquetas con Autocomplete */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                <Autocomplete
                  multiple
                  freeSolo
                  options={siigoCloseModal.availableTags}
                  value={siigoCloseModal.tags}
                  onChange={(event, newValue) => {
                    setSiigoCloseModal(prev => ({
                      ...prev,
                      tags: newValue
                    }));
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" label={option} {...getTagProps({ index })} size="small" color="primary" />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      placeholder="Seleccionar o crear etiqueta..."
                      size="small"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
                <textarea
                  value={siigoCloseModal.note}
                  onChange={(e) => setSiigoCloseModal(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Observaciones del cierre"
                />
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end space-x-2 shrink-0">
              <button
                onClick={() => setSiigoCloseModal({ open: false, order: null, method: 'efectivo', note: '', tags: [], availableTags: [] })}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSiigoClose}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Confirmar
              </button>
            </div>
          </div>
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

      {/* Modal de recepción de pago en bodega */}
      <PickupPaymentModal
        isOpen={pickupPaymentModal.isOpen}
        order={pickupPaymentModal.order}
        onClose={() => setPickupPaymentModal({ isOpen: false, order: null })}
        onConfirm={confirmPickupPayment}
      />

      {/* Modal de eliminación de pedido SIIGO */}
      <DeleteSiigoOrderModal
        isOpen={deleteSiigoModal.isOpen}
        onClose={() => setDeleteSiigoModal({ isOpen: false, order: null, loading: false })}
        order={deleteSiigoModal.order}
        onConfirm={handleDeleteSiigoOrderConfirm}
        loading={deleteSiigoModal.loading}
      />

      {/* Modal de confirmación de entrega */}
      <DeliveryConfirmationModal
        isOpen={deliveryConfirmationModal.isOpen}
        onClose={() => setDeliveryConfirmationModal({ isOpen: false, order: null })}
        order={deliveryConfirmationModal.order}
        onConfirmStart={handleStartDelivery}
      />

      {/* Modal de línea de tiempo del pedido */}
      <OrderTimelineModal
        isOpen={timelineModal.isOpen}
        onClose={() => setTimelineModal({ isOpen: false, order: null })}
        order={timelineModal.order}
      />

      {/* Modal de Gestión Especial (bonito) */}
      <SpecialManagementModal
        isOpen={specialModal.isOpen}
        onClose={() => !specialModal.loading && setSpecialModal({ isOpen: false, order: null, loading: false })}
        order={specialModal.order}
        loading={specialModal.loading}
        onConfirm={handleConfirmSpecial}
      />

      {/* Modal genérico de motivo (rechazo / entrega fallida) */}
      <ReasonModal
        isOpen={reasonModal.isOpen}
        onClose={() => !reasonModal.loading && setReasonModal({ isOpen: false, order: null, mode: 'reject', loading: false })}
        order={reasonModal.order}
        mode={reasonModal.mode}
        loading={reasonModal.loading}
        onConfirm={handleReasonConfirm}
      />

      {/* Modal de registro de pago adhoc (mensajero) */}
      <AdhocPaymentModal
        isOpen={adhocPaymentModal.isOpen}
        onClose={() => setAdhocPaymentModal({ isOpen: false })}
        onConfirm={handleConfirmAdhocPayment}
      />

      {/* Modal: Cliente canceló pedido (acción rápida en listado) */}
      <ReasonModal
        isOpen={cancelModal.isOpen}
        onClose={() => !cancelModal.loading && setCancelModal({ isOpen: false, order: null, loading: false })}
        order={cancelModal.order}
        mode="reason"
        loading={cancelModal.loading}
        onConfirm={handleConfirmCancelByCustomer}
      />
      {/* Modal Subir Comprobante */}
      <UploadEvidenceModal
        isOpen={uploadEvidenceModal.open}
        onClose={() => setUploadEvidenceModal({ open: false, order: null, file: null })}
        order={uploadEvidenceModal.order}
        onSuccess={() => {
          loadOrders();
          setUploadEvidenceModal({ open: false, order: null, file: null });
        }}
      />
    </div>
  );
};

// Obtener color del estado
function getStatusColor(status, order = null) {
  // Prioridad: Pendiente de comprobante (si se pasa el objeto order)
  if (order && (order.is_pending_payment_evidence === true || order.is_pending_payment_evidence === 1 || order.is_pending_payment_evidence === '1')) {
    return 'bg-orange-100 text-orange-800';
  }

  const colors = {
    pendiente_por_facturacion: 'bg-yellow-100 text-yellow-800',
    revision_cartera: 'bg-blue-100 text-blue-800',
    en_logistica: 'bg-purple-100 text-purple-800',
    en_empaque: 'bg-orange-100 text-orange-800',
    empacado: 'bg-cyan-100 text-cyan-800',
    en_reparto: 'bg-indigo-100 text-indigo-800',
    listo_para_recoger: 'bg-green-100 text-green-800',
    entregado_transportadora: 'bg-green-100 text-green-800',
    entregado_cliente: 'bg-green-100 text-green-800',
    entregado_bodega: 'bg-green-100 text-green-800',
    entregado: 'bg-green-100 text-green-800',
    gestion_especial: 'bg-red-100 text-red-800',
    cancelado: 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// Obtener etiqueta del estado
function getStatusLabel(status, order = null) {
  // Prioridad: Pendiente de comprobante (si se pasa el objeto order)
  if (order && (order.is_pending_payment_evidence === true || order.is_pending_payment_evidence === 1 || order.is_pending_payment_evidence === '1')) {
    return 'Pendiente Comprobante';
  }

  const labels = {
    pendiente_por_facturacion: 'Pendiente por Facturación',
    revision_cartera: 'Revisión por Cartera',
    en_logistica: 'En Logística',
    en_empaque: 'En Empaque',
    empacado: 'Empacado',
    en_reparto: 'En Reparto',
    listo_para_recoger: 'Listo para Recoger en Bodega',
    entregado_transportadora: 'Entregado a Transportadora',
    entregado_cliente: 'Entregado a Cliente',
    entregado_bodega: 'Entregado en Bodega',
    entregado: 'Entregado',
    gestion_especial: 'Gestión Especial',
    cancelado: 'Cancelado'
  };
  return labels[status] || status;
}

// Etiqueta corta para móvil (mensajero)
function getStatusShort(status) {
  const map = {
    listo_para_entrega: 'Listo',
    en_reparto: 'En ruta',
    entregado_cliente: 'Entregado',
    entregado_bodega: 'Entregado',
    entregado_transportadora: 'En transportadora'
  };
  return map[status] || (getStatusLabel(status) || '').split(' ')[0];
}

// Helper para obtener el monto correcto según el endpoint usado
function getOrderAmount(order) {
  // Priorizar net_value si existe (Total a Pagar)
  if (order.net_value !== undefined && order.net_value !== null) {
    return parseFloat(order.net_value);
  }
  // Para mensajeros, el campo se llama 'total'
  // Para otros roles, el campo se llama 'total_amount'
  return parseFloat(order.total ?? order.total_amount ?? 0);
}

// Obtener etiqueta del método de envío
function getDeliveryMethodLabel(method) {
  const labels = {
    domicilio_ciudad: 'Domicilio Ciudad',
    domicilio_nacional: 'Domicilio Nacional',
    recogida_tienda: 'Recogida en Tienda',
    envio_nacional: 'Envío Nacional',
    envio_internacional: 'Envío Internacional',
    contraentrega: 'Contraentrega'
  };
  return labels[method] || method || 'No especificado';
}

// Obtener color del método de envío
function getDeliveryMethodColor(method) {
  const colors = {
    domicilio_ciudad: 'bg-blue-100 text-blue-800',
    domicilio_nacional: 'bg-purple-100 text-purple-800',
    recogida_tienda: 'bg-green-100 text-green-800',
    envio_nacional: 'bg-orange-100 text-orange-800',
    envio_internacional: 'bg-red-100 text-red-800',
    contraentrega: 'bg-yellow-100 text-yellow-800'
  };
  return colors[method] || 'bg-gray-100 text-gray-800';
}

// Formato de moneda para monto a cobrar en móvil
function formatCurrencyCOP(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
}

// Dirección de entrega (mejor esfuerzo)
function getOrderAddress(order) {
  return (
    order?.delivery_address ||
    order?.shipping_address ||
    order?.customer_address ||
    order?.address ||
    order?.direccion ||
    ''
  );
}

// Ciudad del pedido (mejor esfuerzo)
function getOrderCity(order) {
  return (
    order?.city || order?.customer_city || order?.shipping_city || order?.ciudad || ''
  );
}

// Link a Google Maps para la dirección
function getMapsUrl(order) {
  const addr = (getOrderAddress(order) || '').trim();
  const city = (getOrderCity(order) || '').trim();
  const q = [addr, city].filter(Boolean).join(', ');
  if (!q) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// Motivo de Gestión Especial (solo devuelve el motivo, nunca observaciones de SIIGO)
function getSpecialReason(order) {
  const status = String(order?.status || '').toLowerCase();
  if (status !== 'gestion_especial') return '';

  // 1) Campos explícitos de gestión especial (si el backend los enviara)
  const special = __getRawFromPaths(order, [
    'special_management_note',
    'special_reason',
    'special_notes',
    'special_management_reason',
    'special_management.reason',
    'special_management.notes',
    'gestion_especial_motivo',
    'gestion_especial_notas',
    'admin_notes',
    'review_notes'
  ]);
  if (special) {
    const m = /gesti[oó]n especial:\s*(.*)/i.exec(String(special));
    return (m && m[1]) ? m[1].trim() : String(special);
  }

  // 2) Parsear desde 'notes' el segmento "GESTIÓN ESPECIAL: ..." cuando se guarda como texto plano
  const rawNotes = __firstNonEmpty(
    order?.notes,
    order?.observations,
    order?.order_notes,
    order?.general_notes
  );
  if (rawNotes) {
    const m2 = /gesti[oó]n especial:\s*(.*)/i.exec(String(rawNotes));
    if (m2 && m2[1]) {
      return m2[1].trim();
    }
  }
  return '';
}

// Observaciones del pedido (mejor esfuerzo)
function getOrderNotes(order) {
  // Si el pedido está en Gestión Especial, priorizar el motivo específico
  const status = String(order?.status || '').toLowerCase();
  if (status === 'gestion_especial') {
    // 1) Campos explícitos de gestión especial (si el backend los enviara)
    const special = __getRawFromPaths(order, [
      'special_management_note',
      'special_reason',
      'special_notes',
      'special_management_reason',
      'special_management.notes',
      'special_management.reason',
      'gestion_especial_motivo',
      'gestion_especial_notas',
      'admin_notes',
      'review_notes'
    ]);
    if (special) {
      // Si viene con prefijo "GESTIÓN ESPECIAL: ", extraer solo el motivo
      const m = /gesti[oó]n especial:\s*(.*)/i.exec(String(special));
      return (m && m[1]) ? m[1].trim() : special;
    }
    // 2) Parsear desde 'notes' el segmento "GESTIÓN ESPECIAL: ..." cuando se guarda como texto plano
    const rawNotes = __firstNonEmpty(
      order?.notes,
      order?.observations,
      order?.order_notes,
      order?.general_notes
    );
    if (rawNotes) {
      const m2 = /gesti[oó]n especial:\s*(.*)/i.exec(String(rawNotes));
      if (m2 && m2[1]) {
        return m2[1].trim();
      }
    }
  }
  // Fallbacks generales (incluye observaciones SIIGO en último lugar)
  return __getRawFromPaths(order, [
    // Motivos/Notas de Gestión Especial (prioridad alta si existieran)
    'special_management_note',
    'special_reason',
    'special_notes',
    'special_management_reason',
    'special_management.notes',
    'special_management.reason',
    'gestion_especial_motivo',
    'gestion_especial_notas',
    'admin_notes',
    'review_notes',
    // Genéricas
    'notes', 'observations', 'order_notes', 'general_notes', 'logistics_notes', 'shipping_notes',
    'comentarios', 'observaciones', 'customer_notes',
    'metadata.notes', 'meta.notes',
    // SIIGO (por si el backend lo expone como campo plano)
    'siigo_observations',
    'siigo.notes'
  ]);
}

// Helpers para mostrar en columna "Mensajero" una vista más amplia (transportadora/bodega)
function isBodegaDelivered(order) {
  return (
    (['recoge_bodega', 'recogida_tienda'].includes(order?.delivery_method)) &&
    (
      ['entregado_bodega', 'entregado_cliente', 'entregado', 'completado', 'finalizado'].includes(order?.status) ||
      Boolean(order?.delivered_at) || Boolean(order?.is_delivered)
    )
  );
}

function isCarrierFlow(order) {
  const method = String(order?.delivery_method || '').toLowerCase();
  const hasCarrier = Number(order?.carrier_id || 0) > 0 || Boolean(order?.carrier_name);
  return (
    String(order?.status || '').toLowerCase() === 'entregado_transportadora' ||
    hasCarrier ||
    ['envio_nacional', 'envio_internacional'].includes(method)
  );
}

function getCourierDisplay(order) {
  if (isCarrierFlow(order)) {
    return order?.carrier_name || 'Transportadora';
  }
  if (isBodegaDelivered(order)) {
    return 'Bodega';
  }
  return (
    order?.assigned_messenger_name ||
    order?.messenger_name ||
    (order?.assigned_messenger_id ? `Mensajero ID: ${order.assigned_messenger_id}` : '-')
  );
}

function isMessengerFlow(order) {
  return !isCarrierFlow(order) && !isBodegaDelivered(order);
}



/* payment helpers now imported from ../utils/payments */

/* electronic provider label/badge helpers now imported from ../utils/payments */

/* detectProviderFromString now provided by utils/payments if needed */

/* deepScanProvider no longer needed here */

/* resolveElectronicType imported from ../utils/payments */

/* getProviderHint imported from ../utils/payments */

/**
 * Robust raw value helpers for payment method and electronic provider.
 * - Supports nested paths like "payment.payment_method"
 * - Returns first non-empty normalized string
 * - Filters out placeholders like "undefined", "null", "N/A"
      */
function __toText(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    if (typeof val.label === 'string') return val.label.trim();
    // Common "raw" map-like shapes
    if (typeof val.value === 'string') return val.value.trim();
  }
  return '';
}

function __firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = __toText(v);
    const low = s.toLowerCase();
    if (s && low !== 'undefined' && low !== 'null' && low !== 'n/a' && low !== 'na') {
      return s;
    }
  }
  return '';
}

function __getPath(obj, path) {
  try {
    return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
  } catch {
    return undefined;
  }
}

function __getRawFromPaths(obj, paths) {
  for (const p of paths) {
    const v = __getPath(obj, p);
    const s = __firstNonEmpty(v);
    if (s) return s;
  }
  return '';
}

function getRawPaymentMethod(order) {
  const paths = [
    // flat
    'payment_method', 'PaymentMethod', 'paymentMethod',
    'payment_method_raw', 'paymentMethodRaw',
    'payment_term', 'paymentTerm',
    'payment_condition', 'paymentCondition',
    'payment_type', 'paymentType',
    'payment', 'metodo_pago', 'metodoPago', 'METODO_PAGO',
    // nested generic
    'payment.payment_method', 'payment.method', 'payment.details.method',
    'paymentInfo.method', 'payment_info.method', 'payment_info.payment_method',
    // siigo/invoice
    'siigo.payment_method', 'siigo_payment_method',
    'siigoInvoiceData.payment_method', 'invoice_data.payment_method',
    // metadata
    'metadata.payment_method', 'meta.payment_method'
  ];
  return __getRawFromPaths(order, paths);
}

function getRawElectronicProvider(order) {
  const paths = [
    // flat
    'electronic_payment_type', 'electronic_payment_provider', 'payment_provider',
    'electronicPaymentType', 'electronicPaymentProvider', 'paymentProvider',
    // nested generic
    'payment.electronic.provider', 'payment.provider',
    'paymentInfo.provider', 'payment_info.provider',
    // siigo/invoice
    'siigo.electronic_payment_type', 'siigo.electronic_payment_provider', 'siigo_payment_provider',
    'invoice_data.payment_provider',
    // metadata
    'metadata.payment_provider', 'meta.payment_provider'
  ];
  return __getRawFromPaths(order, paths);
}

export default OrdersPage;
