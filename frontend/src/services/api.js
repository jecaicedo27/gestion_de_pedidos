import axios from 'axios';
import toast from 'react-hot-toast';

// Configuración base de axios
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Aumentado a 30 segundos para consultas SIIGO
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
  
  getOrder: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
  
  getOrderById: async (id) => {
    const response = await api.get(`/orders/${id}`);
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
  
  assignOrder: async (id, assignmentData) => {
    const response = await api.post(`/orders/${id}/assign`, assignmentData);
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
  
  canMakeRequest: function(endpoint) {
    const lastTime = this.lastRequests.get(endpoint) || 0;
    const now = Date.now();
    return (now - lastTime) >= this.minInterval;
  },
  
  recordRequest: function(endpoint) {
    this.lastRequests.set(endpoint, Date.now());
  },
  
  waitTime: function(endpoint) {
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

export default api;
