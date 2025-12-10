import axios from 'axios';
import toast from 'react-hot-toast';

// Configuración base de axios
/**
 * Base URL de la API:
 * - En producción detrás de Nginx, usamos ruta relativa '/api' para evitar llamadas a localhost.
 * - Si existe REACT_APP_API_URL en tiempo de build, tendrá prioridad.
 */
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // Aumentado a 30 segundos para consultas SIIGO
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;

    if (response) {
      const { status, data } = response;

      // Token expirado o inválido
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // Mostrar mensaje de error si existe
      if (data?.message) {
        toast.error(data.message);
      } else {
        toast.error('Error en la solicitud');
      }
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Tiempo de espera agotado');
    } else if (error.message === 'Network Error') {
      toast.error('Error de conexión. Verifica tu conexión a internet.');
    } else {
      toast.error('Error inesperado');
    }

    return Promise.reject(error);
  }
);

// Servicios de autenticación
export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  changePassword: async (passwordData) => {
    const response = await api.post('/auth/change-password', passwordData);
    return response.data;
  },

  verifyToken: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
};

// Servicios de usuarios
export const userService = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  resetPassword: async (id, passwordData) => {
    const response = await api.post(`/users/${id}/reset-password`, passwordData);
    return response.data;
  },
};

// Servicios de pedidos
export const orderService = {
  getOrders: async (params = {}) => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  getTags: async () => {
    const response = await api.get('/orders/tags');
    return response.data;
  },

  getOrder: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  getOrderById: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  reloadFromSiigo: async (id) => {
    const response = await api.post(`/orders/${id}/reload-from-siigo`);
    return response.data;
  },

  createOrder: async (orderData) => {
    const response = await api.post('/orders', orderData);
    return response.data;
  },

  updateOrder: async (id, orderData) => {
    const response = await api.put(`/orders/${id}`, orderData);
    return response.data;
  },

  deleteOrder: async (id) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
  },

  deleteSiigoOrder: async (id) => {
    const response = await api.delete(`/orders/${id}/siigo`);
    return response.data;
  },

  deleteAllOrders: async (confirmCode = 'RESET_ALL_ORDERS') => {
    // Usamos POST para evitar proxies que bloquean DELETE con body
    const response = await api.post('/orders/reset-all', { confirm: confirmCode });
    return response.data;
  },

  assignOrder: async (id, assignmentData) => {
    const response = await api.post(`/orders/${id}/assign`, assignmentData);
    return response.data;
  },

  // Marcar pedido como "gestión especial"
  markSpecial: async (id, payload) => {
    const response = await api.post(`/orders/${id}/mark-special`, payload);
    return response.data;
  },

  // Cancelación por cliente (solo Admin/Facturación)
  cancelByCustomer: async (id, { reason } = {}) => {
    const response = await api.post(`/orders/${id}/cancel-by-customer`, { reason: reason || null });
    return response.data;
  },

  // Enterado de cancelación (Logística)
  logisticsAckCancel: async (id) => {
    const response = await api.post(`/orders/${id}/logistics-ack-cancel`);
    return response.data;
  },

  getOrderStats: async (params = {}) => {
    const response = await api.get('/orders/stats', { params });
    return response.data;
  },

  getDashboardStats: async () => {
    const response = await api.get('/orders/dashboard-stats');
    return response.data;
  },
};

// Servicios de configuración
export const configService = {
  getConfig: async () => {
    const response = await api.get('/config');
    return response.data;
  },

  getPublicConfig: async () => {
    const response = await api.get('/config/public');
    return response.data;
  },

  getThemeConfig: async () => {
    const response = await api.get('/config/theme');
    return response.data;
  },

  updateConfig: async (configData) => {
    const response = await api.put('/config', configData);
    return response.data;
  },

  resetConfig: async () => {
    const response = await api.post('/config/reset');
    return response.data;
  },

  uploadLogo: async (formData) => {
    const response = await api.post('/config/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Función helper para manejar errores de forma consistente
export const handleApiError = (error, defaultMessage = 'Error en la operación') => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  return defaultMessage;
};

// Servicios de configuración de empresa
export const companyConfigService = {
  getConfig: async () => {
    const response = await api.get('/company-config');
    return response.data;
  },

  getPublicConfig: async () => {
    const response = await api.get('/company-config/public');
    return response.data;
  },

  getShippingInfo: async () => {
    const response = await api.get('/company-config/shipping-info');
    return response.data;
  },

  updateConfig: async (configData) => {
    const response = await api.put('/company-config', configData);
    return response.data;
  },

  resetConfig: async () => {
    const response = await api.post('/company-config/reset');
    return response.data;
  },

  uploadLogo: async (formData) => {
    const response = await api.post('/company-config/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// Función helper para formatear parámetros de query
export const formatQueryParams = (params) => {
  const filtered = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});

  return filtered;
};

// Servicios de cartera
export const walletService = {
  getWalletOrders: async (params = {}) => {
    const response = await api.get('/wallet/orders', { params });
    return response.data;
  },

  validatePayment: async (formData) => {
    const response = await api.post('/wallet/validate-payment', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getCustomerCredit: async (customerName) => {
    const response = await api.get(`/wallet/customer-credit/${customerName}`);
    return response.data;
  },

  getValidationHistory: async (orderId) => {
    const response = await api.get(`/wallet/validation-history/${orderId}`);
    return response.data;
  },

  getCreditCustomers: async (params = {}) => {
    const response = await api.get('/wallet/credit-customers', { params });
    return response.data;
  },

  upsertCreditCustomer: async (customerData) => {
    const response = await api.post('/wallet/credit-customers', customerData);
    return response.data;
  },

  getWalletStats: async () => {
    const response = await api.get('/wallet/stats');
    return response.data;
  },
};

// Rate limiting helper
const rateLimitManager = {
  lastRequests: new Map(),
  minInterval: 3000, // 3 seconds between requests

  canMakeRequest: function (endpoint) {
    const lastTime = this.lastRequests.get(endpoint) || 0;
    const now = Date.now();
    return (now - lastTime) >= this.minInterval;
  },

  recordRequest: function (endpoint) {
    this.lastRequests.set(endpoint, Date.now());
  },

  waitTime: function (endpoint) {
    const lastTime = this.lastRequests.get(endpoint) || 0;
    const now = Date.now();
    const elapsed = now - lastTime;
    return Math.max(0, this.minInterval - elapsed);
  }
};

// Retry helper with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on certain errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }

      // If it's a 429 error or network error, wait and retry
      if (error.response?.status === 429 || error.code === 'ECONNABORTED' || error.message === 'Network Error') {
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`🔄 Intento ${attempt} falló, reintentando en ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For other errors, don't retry
      throw error;
    }
  }
};

// Rate limited API wrapper
const rateLimitedRequest = async (endpoint, requestFn) => {
  // Check if we can make the request
  if (!rateLimitManager.canMakeRequest(endpoint)) {
    const waitTime = rateLimitManager.waitTime(endpoint);
    console.log(`⏳ Rate limit activo para ${endpoint}, esperando ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Record the request
  rateLimitManager.recordRequest(endpoint);

  // Make the request with retry logic
  return await retryWithBackoff(requestFn);
};

// Servicio de evidencia de empaque
export const packagingEvidenceService = {
  list: async (orderId) => {
    const response = await api.get(`/packaging/evidence/${orderId}`);
    return response.data;
  },
  upload: async (orderId, files = [], description) => {
    const form = new FormData();
    if (description) form.append('description', description);
    for (const f of files) form.append('photos', f);
    const response = await api.post(`/packaging/evidence/${orderId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  gallery: async (params = {}) => {
    const response = await api.get('/packaging/evidence-gallery', {
      params: formatQueryParams(params || {})
    });
    return response.data;
  }
};

// Servicios de SIIGO con rate limiting
export const siigoService = {
  getInvoices: async (params = {}) => {
    return await rateLimitedRequest('siigo/invoices', async () => {
      const response = await api.get('/siigo/invoices', { params });
      return response.data;
    });
  },

  importInvoice: async (invoiceId, importData) => {
    return await rateLimitedRequest(`siigo/import/${invoiceId}`, async () => {
      const response = await api.post(`/siigo/import/${invoiceId}`, importData);
      return response.data;
    });
  },

  importInvoices: async (invoiceData) => {
    return await rateLimitedRequest('siigo/import', async () => {
      const response = await api.post('/siigo/import', invoiceData);
      return response.data;
    });
  },

  getConnectionStatus: async () => {
    return await rateLimitedRequest('siigo/connection/status', async () => {
      const response = await api.get('/siigo/connection/status');
      return response.data;
    });
  },

  refreshInvoices: async () => {
    return await rateLimitedRequest('siigo/refresh', async () => {
      const response = await api.post('/siigo/refresh');
      return response.data;
    });
  },

  getSiigoHealth: async () => {
    return await rateLimitedRequest('siigo/health', async () => {
      const response = await api.get('/siigo/health');
      return response.data;
    });
  },

  getSiigoStatus: async () => {
    return await rateLimitedRequest('siigo/status', async () => {
      const response = await api.get('/siigo/status');
      return response.data;
    });
  },
  getImportSummary: async () => {
    return await rateLimitedRequest('siigo/summary', async () => {
      const response = await api.get('/siigo/summary');
      return response.data;
    });
  },
  // Crear cliente en SIIGO desde el frontend
  createCustomer: async (payload) => {
    return await rateLimitedRequest('siigo/create-customer', async () => {
      const response = await api.post('/siigo/customers', payload);
      return response.data;
    });
  },
  // Buscar ciudades con códigos SIIGO (state_code/city_code)
  searchCities: async (q = '') => {
    return await rateLimitedRequest('siigo/cities', async () => {
      const response = await api.get('/siigo/cities', { params: { search: q } });
      return response.data;
    });
  }
};

// Servicios de clientes
export const customerService = {
  getCustomers: async (params = {}) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  getCustomerById: async (id) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  createCustomer: async (customerData) => {
    const response = await api.post('/customers', customerData);
    return response.data;
  },

  updateCustomer: async (id, customerData) => {
    const response = await api.put(`/customers/${id}`, customerData);
    return response.data;
  },

  deleteCustomer: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  searchCustomers: async (searchTerm) => {
    const response = await api.get('/customers/search', {
      params: { search: searchTerm }
    });
    return response.data;
  },

  syncFromSiigo: async () => {
    const response = await api.post('/customers/sync-from-siigo');
    return response.data;
  },

  updateFromSiigo: async (id) => {
    const response = await api.post(`/customers/${id}/update-from-siigo`);
    return response.data;
  }
};

// Servicios de cotizaciones
export const quotationService = {
  getQuotations: async (params = {}) => {
    const response = await api.get('/quotations', { params });
    return response.data;
  },

  getQuotationById: async (id) => {
    const response = await api.get(`/quotations/${id}`);
    return response.data;
  },

  createQuotation: async (quotationData) => {
    const response = await api.post('/quotations', quotationData);
    return response.data;
  },

  updateQuotation: async (id, quotationData) => {
    const response = await api.put(`/quotations/${id}`, quotationData);
    return response.data;
  },

  deleteQuotation: async (id) => {
    const response = await api.delete(`/quotations/${id}`);
    return response.data;
  },

  processWithChatGPT: async (quotationData) => {
    const response = await api.post('/quotations/process-with-chatgpt', quotationData);
    return response.data;
  },

  createSiigoInvoiceWithChatGPT: async (quotationData) => {
    const response = await api.post('/quotations/create-siigo-invoice-with-chatgpt', quotationData, {
      timeout: 120000 // 2 minutos para ChatGPT + SIIGO
    });
    return response.data;
  },

  searchCustomers: async (searchTerm) => {
    const response = await api.get('/quotations/customers/search', {
      params: { q: searchTerm }
    });
    return response.data;
  }
};

// Servicios de analíticas
export const analyticsService = {
  getAdvancedDashboard: async () => {
    const response = await api.get('/analytics/advanced-dashboard');
    // El backend retorna { success, data: {...} }; exponemos directamente el objeto data esperado por el Dashboard.
    return (response && response.data && typeof response.data === 'object' && response.data.data !== undefined)
      ? response.data.data
      : response.data;
  },

  getDailyShipments: async (params = {}) => {
    const response = await api.get('/analytics/daily-shipments', { params });
    return response.data;
  },

  getTopShippingCities: async (params = {}) => {
    const response = await api.get('/analytics/top-shipping-cities', { params });
    return response.data;
  },

  getTopCustomers: async (params = {}) => {
    const response = await api.get('/analytics/top-customers', { params });
    return response.data;
  },

  getCustomerRepeatPurchases: async (params = {}) => {
    const response = await api.get('/analytics/customer-repeat-purchases', { params });
    return response.data;
  },

  getNewCustomersDaily: async (params = {}) => {
    const response = await api.get('/analytics/new-customers-daily', { params });
    return response.data;
  },

  getLostCustomers: async (params = {}) => {
    const response = await api.get('/analytics/lost-customers', { params });
    return response.data;
  },

  getSalesTrends: async (params = {}) => {
    const response = await api.get('/analytics/sales-trends', { params });
    return response.data;
  },

  getProductPerformance: async (params = {}) => {
    const response = await api.get('/analytics/product-performance', { params });
    return response.data;
  },

  getPerformanceMetrics: async (params = {}) => {
    const response = await api.get('/analytics/performance-metrics', { params });
    return response.data;
  },
};

/**
 * Analytics Postventa (Fase 4)
 */
export const postventaAnalyticsService = {
  npsSummary: async (params = {}) => {
    const response = await api.get('/analytics/postventa/nps/summary', { params });
    return response.data;
  },
  npsComments: async (params = {}) => {
    const response = await api.get('/analytics/postventa/nps/comments', { params });
    return response.data;
  },
  responseRate: async (params = {}) => {
    const response = await api.get('/analytics/postventa/response-rate', { params });
    return response.data;
  },
  churnRisk: async () => {
    const response = await api.get('/analytics/postventa/churn-risk');
    return response.data;
  },
  loyalty: async () => {
    const response = await api.get('/analytics/postventa/loyalty');
    return response.data;
  },
  referrals: async () => {
    const response = await api.get('/analytics/postventa/referrals');
    return response.data;
  }
};

// Función helper para descargar archivos
export const downloadFile = async (url, filename) => {
  try {
    const response = await api.get(url, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    toast.error('Error al descargar el archivo');
    throw error;
  }

};


export const messengerService = {
  // Listado de pedidos asignados/descubiertos para el mensajero (opcional)
  getOrders: async (params = {}) => {
    const response = await api.get('/messenger/orders', { params });
    return response.data;
  },

  // Resumen diario
  getDailySummary: async (params = {}) => {
    const response = await api.get('/messenger/daily-summary', { params });
    return response.data;
  },

  // Resumen de caja
  getCashSummary: async (params = {}) => {
    const response = await api.get('/messenger/cash-summary', { params });
    return response.data;
  },

  // Historial de entregas
  getDeliveries: async (params = {}) => {
    const response = await api.get('/messenger/deliveries', { params });
    return response.data;
  },

  // Aceptar pedido
  acceptOrder: async (orderId) => {
    const response = await api.post(`/messenger/orders/${orderId}/accept`);
    return response.data;
  },

  // Rechazar pedido
  rejectOrder: async (orderId, reason) => {
    const response = await api.post(`/messenger/orders/${orderId}/reject`, { reason });
    return response.data;
  },

  // Iniciar entrega
  startDelivery: async (orderId) => {
    const response = await api.post(`/messenger/orders/${orderId}/start-delivery`);
    return response.data;
  },

  // Completar entrega
  completeDelivery: async (orderId, payload) => {
    // payload esperado por backend:
    // { paymentCollected, deliveryFeeCollected, paymentMethod, deliveryFeePaymentMethod, deliveryNotes, latitude, longitude }
    const response = await api.post(`/messenger/orders/${orderId}/complete`, payload);
    return response.data;
  },

  // Marcar entrega fallida
  markFailed: async (orderId, reason) => {
    const response = await api.post(`/messenger/orders/${orderId}/mark-failed`, { reason });
    return response.data;
  },

  // Subir evidencia (foto) - campo 'photo'
  uploadEvidence: async (orderId, formData) => {
    const response = await api.post(`/messenger/orders/${orderId}/upload-evidence`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  // Declaración agregada diaria de efectivo del mensajero
  createCashDelivery: async (data) => {
    // data: { amount: number, deliveredTo: number, referenceNumber?: string, notes?: string }
    const response = await api.post('/messenger/cash-deliveries', data);
    return response.data;
  },
  // Listar entregas agregadas de efectivo por rango
  getCashDeliveries: async (params = {}) => {
    // params: { from?: ISOString, to?: ISOString }
    const response = await api.get('/messenger/cash-deliveries', { params });
    return response.data;
  },
  registerAdhocPayment: async (data) => {
    const response = await api.post('/messenger/adhoc-payments', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  // Estadísticas del mensajero
  getStats: async (params = {}) => {
    const response = await api.get('/messenger/stats', { params });
    return response.data;
  },
  // Aceptar recepción de dinero de una factura (para cartera/admin/logística)
  acceptCashForOrder: async (orderId) => {
    const response = await api.post(`/messenger/orders/${orderId}/accept-cash`);
    return response.data;
  },
};

export const treasuryService = {
  // Balance en línea de Cartera
  getCashBalance: async (params = {}) => {
    const response = await api.get('/cartera/cash-balance', { params });
    return response.data;
  },
  // Registrar consignación bancaria (evidencia opcional + cruce con facturas)
  // details: [{ order_id, assigned_amount }]
  createDeposit: async ({ amount, bank_name, reference_number, reason_code, reason_text, deposited_at, notes, evidence, details } = {}) => {
    const form = new FormData();
    if (amount != null) form.append('amount', String(amount));
    if (bank_name) form.append('bank_name', bank_name);
    if (reference_number) form.append('reference_number', reference_number);
    if (reason_code) form.append('reason_code', reason_code);
    if (reason_text) form.append('reason_text', reason_text);
    if (deposited_at) form.append('deposited_at', typeof deposited_at === 'string' ? deposited_at : new Date(deposited_at).toISOString());
    if (notes) form.append('notes', notes);
    if (evidence) form.append('evidence', evidence);
    if (Array.isArray(details) && details.length > 0) {
      form.append('details', JSON.stringify(details));
    }
    const response = await api.post('/cartera/deposits', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  // Listar consignaciones registradas
  listDeposits: async (params = {}) => {
    const response = await api.get('/cartera/deposits', { params });
    return response.data;
  },
  getDepositCandidates: async (params = {}) => {
    const response = await api.get('/cartera/deposits/candidates', { params });
    return response.data;
  }
};

// Auditoría solo Admin - Cartera
export const treasuryAdminService = {
  // Cambios de base
  getBaseChanges: async (params = {}) => {
    const response = await api.get('/cartera/audit/base-changes', { params });
    return response.data;
  },
  // Auditoría de consignaciones
  getDepositsAudit: async (params = {}) => {
    const response = await api.get('/cartera/audit/deposits', { params });
    return response.data;
  },
  // Detalle de consignación: facturas relacionadas
  getDepositDetails: async (id) => {
    const response = await api.get(`/cartera/deposits/${encodeURIComponent(id)}/details`);
    return response.data;
  },
  // Marcar/Desmarcar consignación como cerrada en Siigo
  setDepositSiigoClosed: async (id, closed = true) => {
    const response = await api.post(`/cartera/deposits/${encodeURIComponent(id)}/close-siigo`, { closed });
    return response.data;
  },
  // Subir/Actualizar evidencia
  uploadDepositEvidence: async (id, file) => {
    const form = new FormData();
    form.append('evidence', file);
    const response = await api.post(`/cartera/deposits/${encodeURIComponent(id)}/evidence`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export const movementService = {
  // Crear movimiento de Cartera (ingreso extra o retiro) con evidencia opcional
  create: async ({ type, amount, reason_code, reason_text, order_id, order_number, notes, evidence } = {}) => {
    const form = new FormData();
    if (type) form.append('type', String(type));
    if (amount != null) form.append('amount', String(amount));
    if (reason_code) form.append('reason_code', reason_code);
    if (reason_text) form.append('reason_text', reason_text);
    if (order_id != null) form.append('order_id', String(order_id));
    if (order_number) form.append('order_number', order_number);
    if (notes) form.append('notes', notes);
    if (evidence) form.append('evidence', evidence);
    const response = await api.post('/cartera/movements', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },
  // Listar movimientos (filtros: type, status, from, to, order_number)
  list: async (params = {}) => {
    const response = await api.get('/cartera/movements', { params });
    return response.data;
  },
  // Aprobar retiro pendiente (solo admin)
  approve: async (id) => {
    const response = await api.post(`/cartera/movements/${id}/approve`);
    return response.data;
  }
};

export const carteraService = {
  // Listar facturas/entregas pendientes de aceptación
  getPendingCashOrders: async (params = {}) => {
    const response = await api.get('/cartera/pending', { params });
    return response.data;
  },

  // Listado de actas/cierres por mensajero
  getHandovers: async (params = {}) => {
    const response = await api.get('/cartera/handovers', { params });
    return response.data;
  },

  // Detalle de un acta/cierre
  getHandoverDetails: async (id) => {
    const response = await api.get(`/cartera/handovers/${id}`);
    return response.data;
  },

  // Cerrar acta (completed/discrepancy)
  closeHandover: async (id) => {
    const response = await api.post(`/cartera/handovers/${id}/close`);
    return response.data;
  },

  // Aceptar registro de bodega (cash_register)
  acceptCashRegister: async (cashRegisterId) => {
    const response = await api.post(`/cartera/cash-register/${cashRegisterId}/accept`);
    return response.data;
  },

  // Detalle de acta de Bodega por día (YYYY-MM-DD)
  getBodegaHandoverDetails: async (date, origin) => {
    const response = await api.get(`/cartera/handovers/bodega/${encodeURIComponent(date)}`, { params: origin ? { origin } : {} });
    return response.data;
  },

  // Devolver pedido a Facturación (Cartera/Admin)
  // orderId: number | string
  // reason: string (obligatorio, mínimo 3 chars)
  // options: { cleanFlags?: boolean }
  returnToBilling: async (orderId, reason, options = {}) => {
    const payload = { reason: String(reason || '').trim(), ...(options || {}) };
    const response = await api.post(`/cartera/orders/${orderId}/return-to-billing`, payload);
    return response.data;
  },

  // Listado de pedidos por cerrar en Siigo (siigo_closed = 0)
  getPendingSiigoClose: async (params = {}) => {
    const response = await api.get('/cartera/pending-siigo-close', { params });
    return response.data;
  },

  // Cerrar en Siigo (marcado interno) - método obligatorio: 'efectivo' | 'transferencia'
  closeOrderInSiigo: async (orderId, { method, note, tags } = {}) => {
    const payload = { method, note: note || null, tags: tags || null };
    const response = await api.post(`/cartera/orders/${orderId}/close-siigo`, payload);
    return response.data;
  },

  // Aceptar pago adhoc (recibos manuales de mensajero)
  acceptAdhocPayment: async (adhocId) => {
    const response = await api.post(`/cartera/adhoc-payments/${adhocId}/accept`);
    return response.data;
  },
};

export const carrierService = {
  getActive: async () => {
    const response = await api.get('/carriers/active');
    return response.data;
  },
  getAll: async () => {
    const response = await api.get('/carriers');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/carriers/${id}`);
    return response.data;
  }
};

export const logisticsService = {
  // Listado listo para entregar (con flags de caja/cartera)
  getReadyForDelivery: async (params = {}) => {
    const response = await api.get('/logistics/ready-for-delivery', { params });
    return response.data;
  },
  // Listar transportadoras activas desde logística
  getCarriers: async () => {
    const response = await api.get('/logistics/carriers');
    // backend ya retorna { success, data }; normalizamos a lista
    return response.data?.data || response.data || [];
  },
  // Recibir pago en bodega (con foto si es transferencia)
  receivePickupPayment: async ({ orderId, payment_method, amount, notes, file }) => {
    const form = new FormData();
    form.append('orderId', String(orderId));
    if (payment_method) form.append('payment_method', payment_method);
    if (amount != null) form.append('amount', String(amount));
    if (notes) form.append('notes', notes);
    if (file) form.append('photo', file);
    const response = await api.post('/logistics/receive-pickup-payment', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  // Entregar en bodega
  markPickupDelivered: async ({ orderId, delivery_notes }) => {
    const response = await api.post('/logistics/mark-pickup-delivered', { orderId, delivery_notes });
    return response.data;
  },
  // Asignar mensajero
  assignMessenger: async ({ orderId, messengerId }) => {
    const response = await api.post('/logistics/assign-messenger', { orderId, messengerId });
    return response.data;
  },
  // Marcar entregado a transportadora
  markDeliveredToCarrier: async ({ orderId, status = 'entregado_transportadora', delivery_notes }) => {
    const response = await api.post('/logistics/mark-delivered-carrier', { orderId, status, delivery_notes });
    return response.data;
  },
  uploadPaymentEvidence: async (orderId, formData) => {
    const response = await api.post(`/logistics/orders/${orderId}/upload-evidence`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  // Generar guía (PDF) - devuelve blob para descarga
  generateGuide: async (payload) => {
    const response = await api.post('/logistics/generate-guide', payload, { responseType: 'blob' });
    return response;
  },
  // Cambiar transportadora de un pedido listo para entrega
  changeCarrier: async ({ orderId, carrierId, reason, override }) => {
    const response = await api.post(`/logistics/orders/${orderId}/change-carrier`, { carrierId, reason, override });
    return response.data;
  },
  // Descargar planilla de transportadora (PDF)
  downloadCarrierManifest: async ({ carrierId, from, to }) => {
    // Aceptar cualquier status para poder inspeccionar el contenido y dar mensajes claros
    const response = await api.get('/logistics/carrier-manifest', {
      params: { carrierId, from, to },
      responseType: 'blob',
      validateStatus: () => true
    });

    const contentType = (response.headers?.['content-type'] || '').toLowerCase();

    // Si no es PDF, probablemente es un error JSON/HTML (401/403/404, etc.). Convertir blob a texto para extraer el mensaje.
    if (!contentType.includes('application/pdf')) {
      try {
        const text = await response.data.text();
        let msg = 'No se pudo descargar la planilla';
        try {
          const json = JSON.parse(text);
          msg = json?.message || msg;
        } catch {
          // No es JSON; usar texto si está disponible
          if (text && text.length < 500) msg = text;
        }
        const err = new Error(msg);
        // Fabricar un objeto de error compatible con el manejo actual (e.response.data.message)
        err.response = { data: { message: msg }, status: response.status, headers: response.headers };
        throw err;
      } catch {
        const err = new Error('No se pudo descargar la planilla');
        err.response = { data: { message: 'No se pudo descargar la planilla' }, status: response.status, headers: response.headers };
        throw err;
      }
    }

    // Contenido válido PDF
    return response;
  },
  // Descargar planilla de Mensajería Local (PDF)
  downloadLocalManifest: async ({ messengerId, from, to } = {}) => {
    // Aceptar cualquier status para poder inspeccionar el contenido y dar mensajes claros
    const response = await api.get('/logistics/local-manifest', {
      params: { messengerId, from, to },
      responseType: 'blob',
      validateStatus: () => true
    });

    const contentType = (response.headers?.['content-type'] || '').toLowerCase();

    if (!contentType.includes('application/pdf')) {
      try {
        const text = await response.data.text();
        let msg = 'No se pudo descargar la planilla';
        try {
          const json = JSON.parse(text);
          msg = json?.message || msg;
        } catch {
          if (text && text.length < 500) msg = text;
        }
        const err = new Error(msg);
        err.response = { data: { message: msg }, status: response.status, headers: response.headers };
        throw err;
      } catch {
        const err = new Error('No se pudo descargar la planilla');
        err.response = { data: { message: 'No se pudo descargar la planilla' }, status: response.status, headers: response.headers };
        throw err;
      }
    }

    return response;
  },
  // Devolver pedido a Empaque (limpia mensajero, transportadora/guía y tracking)
  returnToPackaging: async ({ orderId, reason }) => {
    const response = await api.post('/logistics/return-to-packaging', { orderId, reason });
    return response.data;
  },
  // Obtener conductores externos
  getExternalDrivers: async () => {
    const response = await api.get('/logistics/external-drivers');
    return response.data;
  },
  // Crear conductor externo
  createExternalDriver: async (driverData) => {
    const response = await api.post('/logistics/external-drivers', driverData);
    return response.data;
  }
};

/**
 * System Config service (guardar/cargar configuraciones del sistema)
 */
export const systemConfigService = {
  // Obtener todas las configuraciones
  getAll: async () => {
    const response = await api.get('/system-config');
    // Normalizar respuesta: { success, data: [{config_key, config_value, ...}] }
    return response.data;
  },
  // Actualizar múltiples configuraciones (upsert)
  setConfigs: async (configs = []) => {
    // configs: [{ config_key, config_value }]
    const response = await api.put('/system-config', { configs });
    return response.data;
  },
  // Actualizar una clave específica (la clave debe existir)
  updateKey: async (key, value) => {
    const response = await api.put(`/system-config/${encodeURIComponent(key)}`, { value });
    return response.data;
  },
  // Helper: obtener remitente por defecto (truck_sender) o null
  getSenderDefault: async () => {
    try {
      const resp = await api.get('/system-config');
      const list = resp?.data?.data || resp?.data || [];
      const found = Array.isArray(list) ? list.find(c => c.config_key === 'truck_sender') : null;
      if (!found) return null;
      try {
        return typeof found.config_value === 'string' ? JSON.parse(found.config_value) : found.config_value;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  },
  // Helper: guardar remitente por defecto
  saveSenderDefault: async (senderObj) => {
    const value = JSON.stringify(senderObj || {});
    const response = await api.put('/system-config', { configs: [{ config_key: 'truck_sender', config_value: value }] });
    return response.data;
  }
};

export const packagingProgressService = {
  // Listado de pedidos en empaque (sin filtros)
  getList: async () => {
    const response = await api.get('/packaging-progress/list');
    return response.data;
  },
  // Snapshot de empaque por pedido (solo lectura)
  getSnapshot: async (orderId) => {
    const response = await api.get(`/packaging-progress/${orderId}/snapshot`);
    return response.data;
  },
  // Checklist de empaque por pedido (solo lectura)
  getChecklist: async (orderId) => {
    const response = await api.get(`/packaging-progress/${orderId}/checklist`);
    return response.data;
  }
};

/**
 * Servicios Postventa (Fase 3 - Frontend)
 */
export const postventaService = {
  // Customer 360
  getCustomer360: async (customerId) => {
    const response = await api.get(`/postventa/customers/${encodeURIComponent(customerId)}/360`);
    return response.data;
  },

  // Surveys
  sendSurvey: async ({ orderId, customerId, channel = 'whatsapp', attributes = {} }) => {
    const response = await api.post('/postventa/surveys/send', { orderId, customerId, channel, attributes });
    return response.data;
  },
  webhookResponse: async ({ orderId, nps, csat, ces, comment }) => {
    const response = await api.post('/postventa/surveys/webhook', { orderId, nps, csat, ces, comment });
    return response.data;
  },

  // Consents & Messaging
  setConsent: async ({ customerId, channel, scope = 'transaccional', optIn, source = 'ui' }) => {
    const response = await api.post('/postventa/consents/set', { customerId, channel, scope, optIn, source });
    return response.data;
  },
  sendMessage: async ({ customerId, orderId, channel = 'whatsapp', templateKey = null, content, variables = {}, scope = 'transaccional' }) => {
    const response = await api.post('/postventa/messaging/send', { customerId, orderId, channel, templateKey, content, variables, scope });
    return response.data;
  },

  // RFM
  rfmRecompute: async ({ customerId = null } = {}) => {
    const response = await api.post('/postventa/rfm/recompute', { customerId });
    return response.data;
  },
  getRfmProfile: async (customerId) => {
    const response = await api.get(`/postventa/rfm/profile/${encodeURIComponent(customerId)}`);
    return response.data;
  },

  // Journeys
  journeysActivate: async ({ name = 'post_entrega_v1' } = {}) => {
    const response = await api.post('/postventa/journeys/activate', { name });
    return response.data;
  },
  journeysPause: async ({ name = 'post_entrega_v1' } = {}) => {
    const response = await api.post('/postventa/journeys/pause', { name });
    return response.data;
  },
  journeysTestDelivered: async ({ orderId, customerId = null, orderNumber = null }) => {
    const response = await api.post('/postventa/journeys/test-delivered', { orderId, customerId, orderNumber });
    return response.data;
  },
};

export default api;
