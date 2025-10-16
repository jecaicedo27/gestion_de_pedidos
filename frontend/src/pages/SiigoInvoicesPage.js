import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, RefreshCw, AlertCircle, CheckCircle, Clock, Wifi, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { io } from 'socket.io-client';
import api, { siigoService } from '../services/api';
import SiigoImportModal from '../components/SiigoImportModal';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const SiigoInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10); // Items por página
  const [siigoStartDate, setSiigoStartDate] = useState(null);
  const socketRef = useRef(null);
  
  // Rate limiting state
  const lastRequestTime = useRef(0);
  const lastConnectionCheck = useRef(0);
  const requestQueue = useRef([]);
  const isRequestInProgress = useRef(false);
  const RATE_LIMIT_DELAY = 3000; // 3 segundos entre requests
  const CONNECTION_CHECK_INTERVAL = 60000; // 1 minuto entre verificaciones de conexión

  // Configurar WebSocket para notificaciones en tiempo real
  useEffect(() => {
    // Conectar a WebSocket
    socketRef.current = io(process.env.REACT_APP_API_URL || 'http://localhost:3001');
    
    socketRef.current.on('connect', () => {
      console.log('🔌 Conectado a WebSocket');
      setSocketConnected(true);
      // Suscribirse a actualizaciones de SIIGO
      socketRef.current.emit('join-siigo-updates');
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('🔌 Desconectado de WebSocket');
      setSocketConnected(false);
    });
    
    // Escuchar notificaciones de nuevas facturas
    socketRef.current.on('new-invoice', (data) => {
      console.log('📡 Nueva factura recibida:', data);
      toast.success('Nueva factura disponible en SIIGO');
      // Recargar facturas automáticamente
      loadInvoices();
    });
    
    // Escuchar notificaciones de facturas procesadas
    socketRef.current.on('invoice-processed', (data) => {
      console.log('📡 Factura procesada:', data);
      toast.success(`Factura procesada como pedido ${data.orderNumber}`);
      // Remover la factura de la lista local
      setInvoices(prev => prev.filter(invoice => invoice.id !== data.invoiceId));
    });
    
    // Escuchar notificaciones de facturas actualizadas
    socketRef.current.on('invoices-updated', (data) => {
      console.log('📡 Facturas actualizadas:', data);
      toast(`${data.updatedCount} facturas actualizadas automáticamente`, {
        icon: 'ℹ️',
      });
      // Recargar facturas para mostrar cambios
      loadInvoices();
    });
    
    // Escuchar notificaciones de factura específica actualizada
    socketRef.current.on('invoice-updated', (data) => {
      console.log('📡 Factura específica actualizada:', data);
      toast('Factura actualizada automáticamente', {
        icon: 'ℹ️',
      });
      // Recargar facturas para mostrar cambios
      loadInvoices();
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Cargar facturas solo cuando sea necesario
  useEffect(() => {
    loadInvoices();
  }, []); // Solo cargar al montar el componente

  // Verificar conexión y estado de automatización al montar
  useEffect(() => {
    checkConnection();
    checkAutomationStatus();
    loadSiigoStartDate();
  }, []);

  const loadSiigoStartDate = async () => {
    try {
      const response = await api.get('/system-config/siigo-start-date');
      if (response.data.success && response.data.data) {
        setSiigoStartDate(response.data.data.start_date);
      }
    } catch (error) {
      console.error('Error obteniendo fecha de inicio SIIGO:', error);
    }
  };

  // Polling automático cada 60 segundos - DESACTIVADO TEMPORALMENTE
  // MOTIVO: Exceso de llamadas causando Error 429 (Too Many Requests) en API SIIGO
  /*
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Actualizando facturas automáticamente...');
      loadInvoices();
    }, 60000); // 60 segundos

    return () => clearInterval(interval);
  }, []);
  */

  const loadInvoices = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando facturas SIIGO... (esto puede tomar hasta 2 minutos)');
      
      // Timeout específico para SIIGO (más largo que el global)
      const response = await api.get('/siigo/invoices', {
        timeout: 180000 // 3 minutos específicamente para SIIGO
      });
      
      console.log('📊 Respuesta completa del backend:', response.data);
      
      // Validar que la respuesta existe
      if (!response || !response.data) {
        console.error('❌ Respuesta vacía del servidor');
        setInvoices([]);
        setPagination({});
        return;
      }
      
      // Manejar diferentes estructuras de respuesta con validaciones mejoradas
      if (response.data.success) {
        const responseData = response.data.data || response.data;
        
        // Validar que responseData existe antes de acceder a sus propiedades
        if (!responseData) {
          console.log('⚠️ responseData es null o undefined');
          setInvoices([]);
          setPagination({});
          return;
        }
        
        // Si hay results en la respuesta
        if (responseData.results && Array.isArray(responseData.results)) {
          setInvoices(responseData.results);
          setPagination(responseData.pagination || {});
        }
        // Si la respuesta es directamente un array
        else if (Array.isArray(responseData)) {
          setInvoices(responseData);
          setPagination({});
        }
        // Si las facturas están directamente en data
        else if (responseData.invoices && Array.isArray(responseData.invoices)) {
          setInvoices(responseData.invoices);
          setPagination(responseData.pagination || {});
        }
        // Si hay un array de datos en cualquier nivel
        else if (responseData.data && Array.isArray(responseData.data)) {
          setInvoices(responseData.data);
          setPagination(responseData.pagination || {});
        }
        // Fallback para cualquier estructura
        else {
          console.log('🔍 Estructura de datos no reconocida:', responseData);
          console.log('🔍 Tipo de responseData:', typeof responseData);
          console.log('🔍 Keys disponibles:', responseData ? Object.keys(responseData) : 'N/A');
          setInvoices([]);
          setPagination({});
        }
      } else {
        // Si success es false, pero verificar si hay datos de error útiles
        console.log('⚠️ Success es false, respuesta:', response.data);
        
        // Verificar si hay mensaje de error específico
        if (response.data.message) {
          toast.error(response.data.message, { duration: 5000 });
        } else if (response.data.error) {
          toast.error(response.data.error, { duration: 5000 });
        }
        
        setInvoices([]);
        setPagination({});
      }
    } catch (error) {
      console.error('❌ Error cargando facturas:', error);
      console.error('❌ Error stack:', error.stack);
      
      // Manejo específico de errores SIIGO
      if (error.response?.status === 429) {
        toast.error('Límite de API SIIGO excedido. Espera unos minutos antes de volver a intentar.', {
          duration: 5000,
        });
      } else if (error.response?.status === 500) {
        toast.error('Error del servidor. Verificar credenciales SIIGO en configuración.', {
          duration: 5000,
        });
      } else if (error.response?.status === 401) {
        toast.error('Credenciales SIIGO inválidas. Verificar configuración.', {
          duration: 5000,
        });
      } else if (error.response?.status === 404) {
        toast.error('Endpoint no encontrado. Verificar que el backend esté actualizado.', {
          duration: 5000,
        });
      } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        toast.error('Error de conexión con el servidor. Verificar que el backend esté ejecutándose.', {
          duration: 5000,
        });
      } else {
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Error desconocido';
        toast.error(`Error cargando facturas: ${errorMessage}`, {
          duration: 5000,
        });
      }
      
      setInvoices([]);
      setPagination({});
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    try {
      const response = await siigoService.getConnectionStatus();
      setConnectionStatus(response.success ? response : { connected: false, error: response.message });
    } catch (error) {
      console.error('Error verificando conexión:', error);
      setConnectionStatus({ connected: false, error: error.message });
    }
  };

  const checkAutomationStatus = async () => {
    try {
      const response = await api.get('/siigo/automation/status');
      setAutomationStatus(response.data.success ? response.data.data : null);
    } catch (error) {
      console.error('Error verificando estado de automatización:', error);
      setAutomationStatus(null);
    }
  };


  const handleImportInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowImportModal(true);
  };

  const handleImportSuccess = (result) => {
    console.log('� Response data received:', result);
    console.log('🔍 Campos del objeto:', Object.keys(result || {}));
    
    // Validar campos antes de mostrar para evitar "undefined"
    const orderNumber = result?.order_number || result?.orderNumber || result?.pedido_numero || 'nuevo pedido';
    const orderId = result?.order_id || result?.orderId || result?.id || '';
    
    // Mostrar notificación de éxito con validación
    toast.success(`Pedido creado exitosamente: ${orderNumber}`, {
      duration: 4000,
    });
    
    console.log(`✅ Factura importada: ${orderNumber} (ID: ${orderId})`);
    
    // Remover la factura importada de la lista local
    setInvoices(prevInvoices => 
      prevInvoices.filter(invoice => invoice.id !== selectedInvoice?.id)
    );
    
    // Cerrar el modal
    setShowImportModal(false);
    setSelectedInvoice(null);
    
    // Recargar la lista de facturas para asegurar sincronización
    setTimeout(() => {
      loadInvoices();
    }, 1000);
    
    // Emitir evento para notificar a otras páginas
    if (socketRef.current) {
      socketRef.current.emit('order-created', {
        orderId: orderId,
        orderNumber: orderNumber,
        invoiceId: selectedInvoice?.id
      });
    }
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
      'active': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Activa' },
      'pending': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendiente' },
      'cancelled': { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Cancelada' }
    };

    const config = statusConfig[status] || statusConfig['pending'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  // Funciones de paginación
  const totalItems = invoices.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const startIndex = (currentPage - 1) * perPage;
  const endIndex = startIndex + perPage;
  const currentInvoices = invoices.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <LoadingSpinner />
        <div className="mt-4 text-center">
          <p className="text-lg font-medium text-gray-900">Cargando facturas SIIGO...</p>
          <p className="text-sm text-gray-600 mt-2">
            Este proceso puede tomar hasta 2-3 minutos debido al volumen de datos
          </p>
          <div className="mt-3 text-xs text-gray-500">
            ⏱️ Consultando API de SIIGO...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas SIIGO</h1>
          <p className="text-gray-600">
            {siigoStartDate 
              ? `Importando facturas de SIIGO desde ${formatDate(siigoStartDate)}`
              : 'Importando facturas de SIIGO desde la fecha configurada en fecha inicio SIIGO'
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Estado de conexión SIIGO */}
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
          
          {/* Estado de WebSocket */}
          <div className={`flex items-center px-3 py-2 rounded-md text-sm ${
            socketConnected 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {socketConnected ? (
              <Wifi className="w-4 h-4 mr-2" />
            ) : (
              <WifiOff className="w-4 h-4 mr-2" />
            )}
            {socketConnected ? 'Tiempo Real' : 'Sin Tiempo Real'}
          </div>
          
          {/* Indicador de estado de automatización */}
          <div className={`flex items-center px-3 py-2 rounded-md text-sm ${
            automationStatus?.isRunning
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {automationStatus?.isRunning ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <Clock className="w-4 h-4 mr-2" />
            )}
            {automationStatus?.isRunning 
              ? `Automático cada ${automationStatus.intervalMinutes} min`
              : 'Actualización manual'
            }
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
      </div>


      {/* Lista de Facturas */}
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
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay facturas disponibles
            </h3>
            <p className="text-gray-600">
              No se encontraron facturas disponibles en SIIGO en este momento.
            </p>
          </div>
        ) : (
          <>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentInvoices.map((invoice) => {
                    // Validar que la factura existe y tiene un ID
                    if (!invoice || !invoice.id) {
                      console.warn('⚠️ Factura inválida encontrada:', invoice);
                      return null;
                    }

                    const customer = invoice.customer || invoice.client || {};
                    
                    // Función para extraer nombre del cliente con múltiples fallbacks mejorados
                    const getCustomerName = () => {
                      try {
                        // Opción 1: Persona física - first_name + last_name
                        if (customer.person?.first_name) {
                          return `${customer.person.first_name} ${customer.person.last_name || ''}`.trim();
                        }
                        
                        // Opción 2: Empresa - company name
                        if (customer.company?.name) {
                          return customer.company.name;
                        }
                        
                        // Opción 3: Nombre completo directo
                        if (customer.name && typeof customer.name === 'string') {
                          return customer.name;
                        }
                        
                        // Opción 4: Nombre en identification
                        if (customer.identification?.name) {
                          return customer.identification.name;
                        }
                        
                        // Opción 5: Nombre comercial
                        if (customer.commercial_name) {
                          return customer.commercial_name;
                        }
                        
                        // Opción 6: Buscar en contacts si existe
                        if (customer.contacts && Array.isArray(customer.contacts) && customer.contacts.length > 0) {
                          const contact = customer.contacts[0];
                          if (contact && contact.first_name) {
                            return `${contact.first_name} ${contact.last_name || ''}`.trim();
                          }
                        }
                        
                        // Opción 7: Buscar nombre en cualquier parte del objeto customer
                        if (customer.full_name) {
                          return customer.full_name;
                        }
                        
                        // Opción 8: Buscar en address si tiene nombre
                        if (customer.address?.name) {
                          return customer.address.name;
                        }
                        
                        // Opción 9: Usar email como fallback si existe
                        if (customer.mail || customer.email) {
                          return customer.mail || customer.email;
                        }
                        
                        // Opción 10: Buscar en cualquier campo que contenga "name" de forma segura
                        const findNameInObject = (obj, depth = 0) => {
                          if (depth > 3 || !obj || typeof obj !== 'object') return null;
                          
                          try {
                            for (const [key, value] of Object.entries(obj)) {
                              if (typeof value === 'string' && value.length > 2 && value.length < 100) {
                                if (key.toLowerCase().includes('name') || 
                                    key.toLowerCase().includes('nombre') ||
                                    key.toLowerCase().includes('client')) {
                                  return value;
                                }
                              } else if (typeof value === 'object' && value !== null) {
                                const found = findNameInObject(value, depth + 1);
                                if (found) return found;
                              }
                            }
                          } catch (error) {
                            console.warn('Error buscando nombre en objeto:', error);
                          }
                          return null;
                        };
                        
                        const foundName = findNameInObject(customer);
                        if (foundName) {
                          return foundName;
                        }
                        
                        // Si no se encuentra nada, usar un identificador del invoice
                        if (invoice.number) {
                          return `Cliente de ${invoice.number}`;
                        }
                        
                        return 'Cliente sin nombre';
                      } catch (error) {
                        console.warn('Error extrayendo nombre del cliente:', error);
                        return 'Cliente sin nombre';
                      }
                    };

                    const customerName = getCustomerName();

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
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {invoice.is_imported ? (
                            <span className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Ya Importada
                            </span>
                          ) : (
                            <button
                              onClick={() => handleImportInvoice(invoice)}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Importar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalItems > 0 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando <span className="font-medium">{startIndex + 1}</span> a{' '}
                      <span className="font-medium">{Math.min(endIndex, totalItems)}</span> de{' '}
                      <span className="font-medium">{totalItems}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Anterior</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Siguiente</span>
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>

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

export default SiigoInvoicesPage;
