
const axios = require('axios');
const { query } = require('../config/database');
const configService = require('./configService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Función para obtener ID del usuario del sistema
async function getSystemUserId() {
  try {
    const result = await query(`
      SELECT id FROM users 
      WHERE role IN ('admin', 'sistema') 
      ORDER BY 
        CASE WHEN username = 'sistema' THEN 1 ELSE 2 END, 
        id 
      LIMIT 1
    `);
    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.warn('Error obteniendo usuario del sistema:', error.message);
    return null;
  }
}


// Función para sanitizar texto y evitar errores de Unicode
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text;

  try {
    // Remover caracteres de control y high surrogates problemáticos
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de control
      .replace(/[\uD800-\uDFFF]/g, '') // Remover surrogates sin pareja
      .replace(/[^\u0000-\uFFFF]/g, '') // Remover caracteres fuera del BMP
      .trim();
  } catch (error) {
    console.warn('Error sanitizando texto:', error.message);
    return String(text || '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ''); // Solo ASCII extendido como fallback
  }
}

// Función para sanitizar objetos completos recursivamente
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[sanitizeText(key)] = sanitizeObject(value);
  }

  return sanitized;
}

// Función JSON.stringify segura
function safeJSONStringify(obj, replacer = null, space = null) {
  try {
    const sanitized = sanitizeObject(obj);
    return JSON.stringify(sanitized, replacer, space);
  } catch (error) {
    console.warn('Error en JSON.stringify, usando fallback:', error.message);
    // Fallback: convertir a string simple
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return String(obj);
    }
  }
}

class SiigoService {
  constructor() {
    this.baseURL = null;
    this.username = null;
    this.accessKey = null;
    this.token = null;
    this.tokenExpiry = null;
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.rateLimitDelay = 300; // 300ms entre requests (~3 req/sec)
    this.maxRetries = 3;
    this.customersCache = new Map();
    this.inFlightCustomers = new Map(); // Deduplicación de peticiones en curso por cliente
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
    // Concurrency limiter for outbound SIIGO API requests
    this.maxConcurrent = parseInt(process.env.SIIGO_MAX_CONCURRENCY || '3', 10);
    this.currentConcurrent = 0;
    this.waitQueue = [];
  }

  normalizeBaseUrl(url) {
    if (!url || typeof url !== 'string') return null;
    let u = url.trim();
    // quitar slashes finales y /v1 al final para evitar /v1/v1
    u = u.replace(/\/+$/g, '');
    u = u.replace(/\/v1$/i, '');
    return u;
  }

  // Rate limiting helper
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: esperando ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  // Simple concurrency limiter to avoid parallel bursts to SIIGO
  async acquireSlot() {
    if (this.currentConcurrent < this.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }
    await new Promise(resolve => this.waitQueue.push(resolve));
    this.currentConcurrent++;
  }

  releaseSlot() {
    this.currentConcurrent = Math.max(0, this.currentConcurrent - 1);
    const next = this.waitQueue.shift();
    if (next) next();
  }

  // Retry con backoff exponencial
  async makeRequestWithRetry(requestFn, maxRetries = this.maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.acquireSlot();
        await this.waitForRateLimit();
        const result = await requestFn();
        this.releaseSlot();
        return result;
      } catch (error) {
        this.releaseSlot();
        console.log(`❌ Intento ${attempt}/${maxRetries} falló:`, error.message);

        // Si es error 429, esperar más tiempo (usar Retry-After si está disponible) y adaptar el ritmo base
        if (error.response?.status === 429) {
          let delay = Math.pow(2, attempt) * 2000; // Backoff exponencial por defecto
          const retryAfter = error.response?.headers?.['retry-after'];
          if (retryAfter) {
            const asNumber = Number(retryAfter);
            if (!Number.isNaN(asNumber) && asNumber > 0) {
              delay = Math.max(delay, asNumber * 1000);
            } else {
              // Si es un HTTP-date, usar un mínimo seguro
              delay = Math.max(delay, 5000);
            }
          }
          console.log(`🚦 Rate limit detectado, esperando ${delay}ms...`);
          // Adaptar el ritmo base para reducir futuros 429 (límite superior de 5s)
          this.rateLimitDelay = Math.min(Math.max(this.rateLimitDelay, Math.floor(delay / 2)), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Si es error de auth, renovar token
        if (error.response?.status === 401) {
          console.log('🔐 Token expirado, renovando...');
          this.token = null;
          this.tokenExpiry = null;
          await this.authenticate();
          continue;
        }

        // Si es el último intento, lanzar error
        if (attempt === maxRetries) {
          throw error;
        }

        // Esperar antes del siguiente intento
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async loadConfig() {
    try {
      // Prioridad 1: credenciales por empresa desde siigo_credentials
      const rows = await query(`
        SELECT siigo_username, siigo_access_key, siigo_base_url
        FROM siigo_credentials
        WHERE company_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `, [1]);

      if (rows && rows.length > 0) {
        const row = rows[0];

        // username plano
        this.username = row.siigo_username || this.username;

        // access_key puede estar cifrado (JSON) o en texto plano
        let accessPlain = row.siigo_access_key;
        try {
          const parsed = JSON.parse(accessPlain);
          if (parsed && parsed.encrypted && parsed.iv && parsed.authTag) {
            accessPlain = configService.decrypt(parsed);
          }
        } catch (_e) {
          // no JSON -> ya es texto plano
        }
        this.accessKey = accessPlain || this.accessKey;

        // baseURL normalizada (sin /v1)
        const normalized = this.normalizeBaseUrl(row.siigo_base_url || '');
        if (normalized) this.baseURL = normalized;
      }

      // Prioridad 2: system_config a través de configService (compatibilidad)
      if (!this.username || !this.accessKey) {
        const creds = await configService.getSiigoCredentials();
        this.username = this.username || creds?.username || null;
        this.accessKey = this.accessKey || creds?.accessKey || null;
      }

      // Prioridad 3: baseURL desde system_config o env (sin /v1)
      if (!this.baseURL) {
        const cfgBase = await configService.getConfig('siigo_base_url', process.env.SIIGO_API_BASE_URL || 'https://api.siigo.com');
        this.baseURL = this.normalizeBaseUrl(cfgBase || 'https://api.siigo.com');
      }
    } catch (e) {
      console.warn('⚠️  Error cargando configuración SIIGO:', e.message);
      // Fallback mínimo
      if (!this.baseURL) this.baseURL = 'https://api.siigo.com';
    }
  }

  async authenticate() {
    try {
      if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.token;
      }

      await this.loadConfig();
      console.log('🔐 Autenticando con SIIGO API...');

      if (!this.username || !this.accessKey) {
        throw new Error('Credenciales SIIGO no configuradas');
      }

      console.log(`🔗 URL: ${this.baseURL}/auth`);
      console.log(`👤 Usuario: ${this.username}`);

      const response = await axios.post(`${this.baseURL}/auth`, {
        username: this.username,
        access_key: this.accessKey
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      this.token = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      console.log('✅ Autenticación exitosa');
      return this.token;

    } catch (error) {
      console.error('❌ Error en autenticación SIIGO:', error.message);
      if (error.response) {
        console.error('Respuesta:', error.response.data);
      }
      throw new Error('No se pudo autenticar con SIIGO API');
    }
  }

  getBaseUrl() {
    return this.baseURL;
  }

  async getHeaders() {
    const token = await this.authenticate();
    const partnerId = process.env.SIIGO_API_PARTNER_ID || process.env.SIIGO_PARTNER_ID || 'siigo';
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Partner-Id': partnerId
    };
  }

  async getInvoices(params = {}) {
    try {
      const headers = await this.getHeaders();

      const defaultParams = {
        page_size: params.page_size || 100, // Aumentado el límite
        page: params.page || 1
      };

      // Soporte de filtros por fecha: preferir created_start (fecha de creación),
      // si no está, usar date_start (fecha del comprobante)
      if (params.created_start) {
        const createdStart = this.formatDateForSiigo(params.created_start);
        defaultParams.created_start = createdStart;
        console.log(`📅 Usando created_start (SIIGO): ${createdStart}`);
      } else if (params.start_date) {
        const dateStartFormatted = this.formatDateForSiigo(params.start_date);
        defaultParams.date_start = dateStartFormatted;
        console.log(`📅 Usando date_start (SIIGO): ${dateStartFormatted}`);
      }

      return await this.makeRequestWithRetry(async () => {
        console.log(`📋 Obteniendo facturas (página ${defaultParams.page}, page_size: ${defaultParams.page_size})...`);
        if (defaultParams.created_start) {
          console.log(`📅 Filtrando por created_start: ${defaultParams.created_start}`);
        } else if (defaultParams.date_start) {
          console.log(`📅 Filtrando por date_start: ${defaultParams.date_start}`);
        }

        const response = await axios.get(`${this.baseURL}/v1/invoices`, {
          headers,
          params: defaultParams,
          timeout: 45000 // Timeout aumentado
        });

        console.log(`✅ ${response.data.results?.length || 0} facturas obtenidas desde ${defaultParams.date_start || 'inicio'}`);
        console.log(`📊 Total disponible en SIIGO: ${response.data.pagination?.total_results || 'N/A'}`);
        return response.data;
      });

    } catch (error) {
      console.error('❌ Error obteniendo facturas:', error.message);
      throw error;
    }
  }

  // Función para convertir fecha a formato SIIGO (yyyy-MM-dd)
  formatDateForSiigo(dateString) {
    try {
      // Si ya está en formato yyyy-MM-dd, devolverlo tal como está
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        console.log(`📅 Fecha ya en formato SIIGO: ${dateString}`);
        return dateString;
      }

      // Si está en formato yyyymmdd (sin guiones), convertir a yyyy-MM-dd
      if (/^\d{8}$/.test(dateString)) {
        const formatted = `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
        console.log(`📅 Fecha convertida de ${dateString} a formato SIIGO: ${formatted}`);
        return formatted;
      }

      // Si es un objeto Date, convertir a yyyy-MM-dd
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formatted = `${year}-${month}-${day}`;
        console.log(`📅 Fecha convertida de Date a formato SIIGO: ${formatted}`);
        return formatted;
      }

      console.warn(`⚠️ Formato de fecha no reconocido: ${dateString}`);
      return dateString;
    } catch (error) {
      console.error(`❌ Error formateando fecha para SIIGO: ${error.message}`);
      return dateString;
    }
  }

  async getInvoiceDetails(invoiceId) {
    try {
      const headers = await this.getHeaders();

      return await this.makeRequestWithRetry(async () => {
        console.log(`📄 Obteniendo detalles de factura: ${invoiceId}`);

        const response = await axios.get(`${this.baseURL}/v1/invoices/${invoiceId}`, {
          headers,
          timeout: 30000
        });

        console.log(`✅ Detalles obtenidos para factura ${invoiceId}`);
        return response.data;
      });

    } catch (error) {
      console.error(`❌ Error obteniendo detalles de factura ${invoiceId}:`, error.message);
      throw error;
    }
  }

  async getCustomer(customerId, skipCache = false) {
    try {
      // Verificar caché primero
      const cacheKey = customerId;
      const cached = this.customersCache.get(cacheKey);

      if (!skipCache && cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        console.log(`✅ Cliente obtenido desde caché: ${customerId}`);
        return cached.data;
      }

      // Deduplicación de peticiones concurrentes
      const inflight = this.inFlightCustomers.get(cacheKey);
      if (inflight) {
        console.log(`⏳ Esperando petición en curso para cliente ${customerId}`);
        return await inflight;
      }

      const fetchPromise = (async () => {
        const headers = await this.getHeaders();
        const data = await this.makeRequestWithRetry(async () => {
          console.log(`👤 Obteniendo cliente SIIGO: ${customerId}`);

          const response = await axios.get(`${this.baseURL}/v1/customers/${customerId}`, {
            headers,
            timeout: 20000
          });

          console.log(`✅ Cliente obtenido: ${customerId}`);
          return response.data;
        });

        // Guardar en caché
        this.customersCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });

        console.log(`✅ Cliente cacheado: ${customerId}`);
        return data;
      })();

      this.inFlightCustomers.set(cacheKey, fetchPromise);

      try {
        const result = await fetchPromise;
        return result;
      } finally {
        this.inFlightCustomers.delete(cacheKey);
      }

    } catch (error) {
      console.error(`❌ Error obteniendo cliente ${customerId}:`, error.message);
      throw error;
    }
  }

  // Crear cliente en SIIGO
  async createCustomer(payload = {}) {
    try {
      const headers = await this.getHeaders();
      const body = sanitizeObject(payload);
      // Normalizar id_type a códigos DIAN/SIIGO (protección adicional)
      try {
        const mapIdType = (v) => {
          const s = String(v || '').trim().toUpperCase();
          switch (s) {
            case '31':
            case 'NIT': return '31'; // NIT
            case '13':
            case 'CC': return '13'; // Cédula de ciudadanía
            case '22':
            case 'CE': return '22'; // Cédula de extranjería
            case '12':
            case 'TI': return '12'; // Tarjeta de identidad
            case '41':
            case 'PA':
            case 'PASAPORTE': return '41'; // Pasaporte
            default: return s || '13';
          }
        };
        if (body && body.id_type !== undefined) {
          body.id_type = mapIdType(body.id_type);
        }
      } catch (e) {
        console.warn('⚠️ Normalización id_type falló:', e.message);
      }

      // Construir campo 'name' requerido por SIIGO
      if (body.person_type === 'Person') {
        if (!body.name && (body.first_name || body.last_name)) {
          body.name = [body.first_name || '', body.last_name || ''];
        }
        // Limpiar campos individuales que no son parte del payload directo si ya se usaron
        delete body.first_name;
        delete body.last_name;
      } else if (body.person_type === 'Company') {
        if (!body.name && body.company_name) {
          body.name = [body.company_name];
        }
        delete body.company_name;
      }

      return await this.makeRequestWithRetry(async () => {
        console.log('👤 Creando cliente en SIIGO...');
        console.log('🧾 SIIGO payload core:', safeJSONStringify({ person_type: body?.person_type, id_type: body?.id_type, city: body?.address?.city }, null, 2));
        const response = await axios.post(`${this.baseURL}/v1/customers`, body, {
          headers,
          timeout: 30000
        });
        console.log('✅ Cliente creado en SIIGO:', safeJSONStringify({ id: response.data?.id, identification: response.data?.identification }, null, 2));
        // Invalida cache ligera si aplica
        try {
          if (response?.data?.id) {
            this.customersCache.set(response.data.id, { data: response.data, timestamp: Date.now() });
          }
        } catch { }
        return response.data;
      });
    } catch (error) {
      console.error('❌ Error creando cliente en SIIGO:', error.message);
      if (error.response) console.error('Respuesta SIIGO:', safeJSONStringify(error.response.data, null, 2));
      throw error;
    }
  }

  async processInvoiceToOrder(invoice, paymentMethod = 'transferencia', deliveryMethod = 'domicilio') {
    try {
      console.log(`🔄 Procesando factura ${invoice.name || invoice.id} a pedido...`);

      // Obtener detalles completos de la factura (evitar doble consulta si ya viene completo)
      let fullInvoice = (invoice && Array.isArray(invoice.items) && invoice.items.length > 0)
        ? invoice
        : await this.getInvoiceDetails(invoice.id);
      if (fullInvoice === invoice) {
        console.log('📋 Usando detalles completos provistos (sin nueva consulta a SIIGO)');
      } else {
        console.log(`📋 Detalles completos obtenidos:`, safeJSONStringify(fullInvoice, null, 2));
      }

      // Validación de items > 0 con reintentos para evitar pedidos vacíos
      {
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts && (!fullInvoice.items || fullInvoice.items.length === 0)) {
          attempts++;
          console.warn(`⚠️ Factura ${invoice.id} sin items (intento ${attempts}/${maxAttempts}). Reintentando obtener detalles...`);
          await new Promise(r => setTimeout(r, Math.min(3000, attempts * 1500)));
          try {
            fullInvoice = await this.getInvoiceDetails(invoice.id);
            console.log(`🔄 Reintento ${attempts}: items ahora = ${Array.isArray(fullInvoice.items) ? fullInvoice.items.length : 0}`);
          } catch (e) {
            console.warn(`Reintento ${attempts} falló: ${e.message}`);
          }
        }
        if (!fullInvoice.items || fullInvoice.items.length === 0) {
          console.error(`❌ Factura ${invoice.id} aún sin items tras ${maxAttempts} intentos. Abortando creación de pedido.`);
          try {
            await query(`
              INSERT INTO siigo_sync_log (
                siigo_invoice_id, sync_status, error_message, processed_at
              ) VALUES (?, ?, ?, NOW())
            `, [invoice.id, 'pending_no_items', 'Factura sin items; importación abortada']);
          } catch (logError) {
            console.error('Error logging pending_no_items:', logError.message);
          }
          return {
            success: false,
            itemsCount: 0,
            message: 'Factura sin items; importación no aplicada. Reintente luego.'
          };
        }
      }

      // Obtener información del cliente
      let customerInfo = {};
      const customerId = fullInvoice.customer?.id || invoice.customer?.id;

      if (customerId) {
        try {
          customerInfo = await this.getCustomer(customerId, true);
          console.log(`👤 Info del cliente obtenida:`, safeJSONStringify(customerInfo, null, 2));
        } catch (error) {
          console.warn(`⚠️ No se pudo obtener info del cliente ${customerId}:`, error.message);
        }
      }

      // Extraer nombre comercial específicamente
      const extractCommercialName = (customer, customerInfo) => {
        // Prioridad 1: Commercial name del customerInfo detallado (IGNORAR "No aplica")
        if (customerInfo.commercial_name && customerInfo.commercial_name !== 'No aplica' && customerInfo.commercial_name.trim() !== '') {
          return customerInfo.commercial_name.trim();
        }

        // Prioridad 2: Commercial name del customer básico (IGNORAR "No aplica")
        if (customer?.commercial_name && customer.commercial_name !== 'No aplica' && customer.commercial_name.trim() !== '') {
          return customer.commercial_name.trim();
        }

        // Prioridad 3: Para empresas, usar el nombre de la empresa
        if (customerInfo.person_type === 'Company') {
          // Si es array de nombres (empresas), usar el primer elemento
          if (customerInfo.name && Array.isArray(customerInfo.name) && customerInfo.name.length > 0) {
            return customerInfo.name[0].trim();
          }

          // Company name
          if (customerInfo.company?.name) {
            return customerInfo.company.name.trim();
          }
        }

        // Para personas naturales, retornar null ya que no tienen nombre comercial
        return null;
      };

      // Extraer nombre del cliente (para customer_name) con múltiples fallbacks
      const extractCustomerName = (customer, customerInfo) => {
        // Prioridad 1: Nombre comercial del customerInfo detallado (IGNORAR "No aplica")
        if (customerInfo.commercial_name && customerInfo.commercial_name !== 'No aplica') {
          return customerInfo.commercial_name;
        }

        // Prioridad 2: Persona física - construir nombre completo
        if (customerInfo.name && Array.isArray(customerInfo.name) && customerInfo.name.length >= 2) {
          return customerInfo.name.join(' ').trim();
        }

        // Prioridad 3: first_name + last_name si existe person
        if (customerInfo.person?.first_name) {
          return `${customerInfo.person.first_name} ${customerInfo.person.last_name || ''}`.trim();
        }

        // Prioridad 4: Empresa - company name
        if (customerInfo.company?.name) return customerInfo.company.name;

        // Prioridad 5: Nombre del customer básico (IGNORAR "No aplica")
        if (customer?.commercial_name && customer.commercial_name !== 'No aplica') {
          return customer.commercial_name;
        }
        if (customer?.name) return customer.name;

        // Prioridad 6: Identification name
        if (customerInfo.identification?.name) return customerInfo.identification.name;
        if (customer?.identification?.name) return customer.identification.name;

        // Fallback final
        return 'Cliente SIIGO';
      };

      // Extraer teléfono del cliente
      const extractCustomerPhone = (customer, customerInfo) => {
        return customerInfo.phones?.[0]?.number ||
          customer?.phones?.[0]?.number ||
          customerInfo.person?.phones?.[0]?.number ||
          customerInfo.company?.phones?.[0]?.number ||
          'Sin teléfono';
      };

      // Extraer dirección del cliente
      const extractCustomerAddress = (customer, customerInfo) => {
        return customerInfo.address?.address ||
          customer?.address?.address ||
          customerInfo.person?.address?.address ||
          customerInfo.company?.address?.address ||
          'Sin dirección';
      };

      // Calcular total desde la factura
      const calculateTotal = (invoice, fullInvoice) => {
        // Prioridad 1: Total de la factura completa
        if (fullInvoice.total && !isNaN(parseFloat(fullInvoice.total))) {
          return parseFloat(fullInvoice.total);
        }

        // Prioridad 2: Total amount de la factura completa
        if (fullInvoice.total_amount && !isNaN(parseFloat(fullInvoice.total_amount))) {
          return parseFloat(fullInvoice.total_amount);
        }

        // Prioridad 3: Total de la factura básica
        if (invoice.total && !isNaN(parseFloat(invoice.total))) {
          return parseFloat(invoice.total);
        }

        // Prioridad 4: Total amount de la factura básica
        if (invoice.total_amount && !isNaN(parseFloat(invoice.total_amount))) {
          return parseFloat(invoice.total_amount);
        }

        // Prioridad 5: Calcular desde items si existen
        if (fullInvoice.items && Array.isArray(fullInvoice.items)) {
          const calculatedTotal = fullInvoice.items.reduce((sum, item) => {
            const quantity = parseFloat(item.quantity || 1);
            const price = parseFloat(item.unit_price || item.price || 0);
            return sum + (quantity * price);
          }, 0);

          if (calculatedTotal > 0) {
            console.warn(`⚠️ calculateTotal: Fallback a cálculo por items para factura ${invoice.id || 'desconocida'}. Total calculado: ${calculatedTotal}. Esto suele indicar que 'total' y 'total_amount' faltaban en la respuesta de SIIGO.`);
            return calculatedTotal;
          }
        }

        return 0;
      };

      // Calcular valor neto (Total a Pagar)
      const calculateNetValue = (invoice, fullInvoice) => {
        // Prioridad 1: Balance (saldo pendiente) de la factura completa
        if (fullInvoice.balance !== undefined && !isNaN(parseFloat(fullInvoice.balance))) {
          return parseFloat(fullInvoice.balance);
        }

        // Prioridad 2: Balance de la factura básica
        if (invoice.balance !== undefined && !isNaN(parseFloat(invoice.balance))) {
          return parseFloat(invoice.balance);
        }

        // Prioridad 3: Si no hay balance, asumir que es igual al total (si no hay pagos registrados)
        // Pero para ser seguros, retornamos null para que se use el total_amount si no hay net_value explícito
        return null;
      };

      // Extraer TODOS los datos adicionales del cliente - CORREGIDO
      const extractCustomerIdentification = (customer, customerInfo) => {
        console.log('🔍 extractCustomerIdentification - customerInfo.identification:', customerInfo.identification);
        console.log('🔍 extractCustomerIdentification - customer?.identification:', customer?.identification);

        // Buscar en customerInfo primero (detallado) - ES UN STRING
        if (customerInfo.identification && typeof customerInfo.identification === 'string') {
          console.log('✅ Returning customerInfo.identification:', customerInfo.identification);
          return customerInfo.identification;
        }

        // Buscar en customer básico (de la factura)
        if (customer?.identification && typeof customer.identification === 'string') {
          console.log('✅ Returning customer.identification:', customer.identification);
          return customer.identification;
        }

        console.log('❌ No identification found, returning null');
        return null;
      };

      const extractCustomerIdType = (customer, customerInfo) => {
        console.log('🔍 extractCustomerIdType - customerInfo.id_type:', customerInfo.id_type);

        // Buscar tipo de ID en customerInfo
        if (customerInfo.id_type?.name) {
          console.log('✅ Returning id_type.name:', customerInfo.id_type.name);
          return customerInfo.id_type.name;
        }
        if (customerInfo.id_type?.code) {
          console.log('✅ Returning id_type.code:', customerInfo.id_type.code);
          return customerInfo.id_type.code;
        }

        console.log('❌ No id_type found, returning null');
        return null;
      };

      const extractCustomerEmail = (customer, customerInfo) => {
        console.log('🔍 extractCustomerEmail - customerInfo.contacts:', customerInfo.contacts);
        console.log('🔍 extractCustomerEmail - customerInfo.email:', customerInfo.email);

        // Buscar en contacts (primera prioridad)
        if (customerInfo.contacts && Array.isArray(customerInfo.contacts) && customerInfo.contacts.length > 0) {
          const primaryContact = customerInfo.contacts[0];
          console.log('🔍 primaryContact:', primaryContact);
          if (primaryContact && primaryContact.email) {
            console.log('✅ Returning contact email:', primaryContact.email);
            return primaryContact.email;
          }
        }

        // Buscar en nivel superior
        if (customerInfo.email) {
          console.log('✅ Returning customerInfo.email:', customerInfo.email);
          return customerInfo.email;
        }

        console.log('❌ No email found, returning null');
        return null;
      };

      const extractCustomerDepartment = (customer, customerInfo) => {
        console.log('🔍 extractCustomerDepartment - customerInfo.address?.city:', customerInfo.address?.city);

        // Extraer departamento de address.city.state_name
        if (customerInfo.address?.city?.state_name) {
          console.log('✅ Returning state_name:', customerInfo.address.city.state_name);
          return customerInfo.address.city.state_name;
        }

        console.log('❌ No state_name found, returning null');
        return null;
      };

      const extractCustomerCity = (customer, customerInfo) => {
        console.log('🔍 extractCustomerCity - customerInfo.address?.city:', customerInfo.address?.city);
        console.log('🔍 extractCustomerCity - customerInfo.address?.city?.city_name:', customerInfo.address?.city?.city_name);

        // CORREGIDO: Extraer solo el string de la ciudad
        if (customerInfo.address?.city?.city_name) {
          console.log('✅ Returning city_name string:', customerInfo.address.city.city_name);
          return customerInfo.address.city.city_name;
        }

        // Fallback a string simple
        if (typeof customerInfo.address?.city === 'string') {
          console.log('✅ Returning city string:', customerInfo.address.city);
          return customerInfo.address.city;
        }

        console.log('❌ No valid city found, returning null');
        return null;
      };

      const extractCustomerCountry = (customer, customerInfo) => {
        console.log('🔍 extractCustomerCountry - customerInfo.address?.city?.country_name:', customerInfo.address?.city?.country_name);

        // Extraer país de address.city.country_name
        if (customerInfo.address?.city?.country_name) {
          console.log('✅ Returning country_name:', customerInfo.address.city.country_name);
          return customerInfo.address.city.country_name;
        }

        console.log('✅ Returning default: Colombia');
        return 'Colombia';
      };

      const extractCustomerPersonType = (customer, customerInfo) => {
        // Usar person_type directamente
        return customerInfo.person_type || null;
      };

      // Preparar datos del pedido con extracción COMPLETA
      const customerName = extractCustomerName(fullInvoice.customer || invoice.customer, customerInfo);
      const customerPhone = extractCustomerPhone(fullInvoice.customer || invoice.customer, customerInfo);
      const customerAddress = extractCustomerAddress(fullInvoice.customer || invoice.customer, customerInfo);
      const totalAmount = calculateTotal(invoice, fullInvoice);
      const netValue = calculateNetValue(invoice, fullInvoice);

      // EXTRAER TODOS LOS CAMPOS ADICIONALES - INCLUYENDO COMMERCIAL_NAME
      const commercialName = extractCommercialName(fullInvoice.customer || invoice.customer, customerInfo);
      const customerIdentification = extractCustomerIdentification(fullInvoice.customer || invoice.customer, customerInfo);
      const customerIdType = extractCustomerIdType(fullInvoice.customer || invoice.customer, customerInfo);
      const customerEmail = extractCustomerEmail(fullInvoice.customer || invoice.customer, customerInfo);
      const customerDepartment = extractCustomerDepartment(fullInvoice.customer || invoice.customer, customerInfo);
      const customerCity = extractCustomerCity(fullInvoice.customer || invoice.customer, customerInfo);
      const customerCountry = extractCustomerCountry(fullInvoice.customer || invoice.customer, customerInfo);
      const customerPersonType = extractCustomerPersonType(fullInvoice.customer || invoice.customer, customerInfo);
      const siigoCustomerId = customerInfo.id || (fullInvoice.customer || invoice.customer)?.id || null;

      console.log(`🏢 Commercial name extraído: ${commercialName || 'NULL'}`);

      // EXTRAER URL PÚBLICA DE SIIGO (CAMPO CRÍTICO PARA BOTÓN DE DESCARGA)
      const siigoPublicUrl = fullInvoice.public_url || invoice.public_url || null;
      console.log(`🔗 URL pública extraída de SIIGO: ${siigoPublicUrl}`);

      // EXTRAER OBSERVACIONES/NOTAS DE SIIGO
      const extractSiigoObservations = (invoice, fullInvoice) => {
        console.log('🔍 Extrayendo observaciones de SIIGO...');
        let observations = [];

        // Recopilar todas las observaciones/notas disponibles
        if (fullInvoice.observations) {
          observations.push(`OBSERVACIONES: ${fullInvoice.observations}`);
        }
        if (fullInvoice.notes) {
          observations.push(`NOTAS: ${fullInvoice.notes}`);
        }
        if (fullInvoice.comments) {
          observations.push(`COMENTARIOS: ${fullInvoice.comments}`);
        }

        // Fallback a datos básicos de la factura
        if (observations.length === 0 && invoice.observations) {
          observations.push(`OBSERVACIONES: ${invoice.observations}`);
        }
        if (observations.length === 0 && invoice.notes) {
          observations.push(`NOTAS: ${invoice.notes}`);
        }

        const result = observations.join('\n\n');
        console.log(`📝 Observaciones extraídas: ${result || 'Sin observaciones'}`);
        return result || null;
      };

      // EXTRAER MÉTODO DE PAGO DE ENVÍO desde observaciones SIIGO
      const extractShippingPaymentMethod = (invoice, fullInvoice) => {
        console.log('💰 Extrayendo método de pago de envío desde SIIGO...');

        // Buscar en todas las fuentes de texto disponibles
        const textSources = [
          fullInvoice.observations,
          fullInvoice.notes,
          fullInvoice.comments,
          invoice.observations,
          invoice.notes
        ].filter(Boolean);

        for (const text of textSources) {
          if (!text) continue;

          // Normalizar texto
          const normalizedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\s+/g, ' ');

          const lines = normalizedText.split('\n');

          for (const line of lines) {
            const trimmedLine = line.trim();

            // Buscar específicamente "FORMA DE PAGO DE ENVIO:" en cualquier parte de la línea
            if (trimmedLine.match(/FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:/i)) {
              const paymentMethodMatch = trimmedLine.replace(/.*FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:\s*/i, '').trim();
              if (paymentMethodMatch) {
                console.log(`✅ Método de pago de envío encontrado: ${paymentMethodMatch}`);
                // Normalizar valores comunes
                const normalized = paymentMethodMatch.toLowerCase();
                if (normalized.includes('contado')) return 'contado';
                if (normalized.includes('contraentrega') || normalized.includes('contra entrega')) return 'contraentrega';
                return paymentMethodMatch; // Devolver valor original si no coincide con patrones conocidos
              }
            }
          }
        }

        console.log('❌ No se encontró método de pago de envío en observaciones SIIGO');
        return null;
      };

      const siigoObservations = extractSiigoObservations(invoice, fullInvoice);
      // Normalizar y sanear método de pago de envío para que no exceda la columna (varchar(50))
      const __rawShippingMethod = extractShippingPaymentMethod(invoice, fullInvoice);
      let shippingPaymentMethod = null;
      if (__rawShippingMethod) {
        const raw = String(__rawShippingMethod).trim();
        const low = raw.toLowerCase();
        if (low.includes('contado')) {
          shippingPaymentMethod = 'contado';
        } else if (low.includes('contraentrega') || low.includes('contra entrega')) {
          shippingPaymentMethod = 'contraentrega';
        } else {
          // Mantener valor crudo pero capado a 50 caracteres para no romper la BD
          shippingPaymentMethod = raw.slice(0, 50);
        }
      }

      // Sanitizar datos del cliente antes de procesarlos
      const sanitizedCustomerName = sanitizeText(customerName);
      const sanitizedCommercialName = sanitizeText(commercialName);
      const sanitizedCustomerPhone = sanitizeText(customerPhone);
      const sanitizedCustomerAddress = sanitizeText(customerAddress);
      const sanitizedCustomerIdentification = sanitizeText(customerIdentification);
      const sanitizedCustomerIdType = sanitizeText(customerIdType);
      const sanitizedCustomerEmail = sanitizeText(customerEmail);
      const sanitizedCustomerDepartment = sanitizeText(customerDepartment);
      const sanitizedCustomerCity = sanitizeText(typeof customerCity === 'object' ? JSON.stringify(customerCity) : customerCity);
      const sanitizedCustomerCountry = sanitizeText(customerCountry);
      const sanitizedSiigoObservations = sanitizeText(siigoObservations);

      console.log('🧹 Datos sanitizados - Cliente:', sanitizedCustomerName);

      // Fecha de la factura (fecha y hora del comprobante en SIIGO)
      // Normalizar a string 'YYYY-MM-DD' para evitar desfaces por zona horaria (ej. 13 -> 12)
      const normalizeToYMD = (value) => {
        try {
          if (!value) return null;
          if (typeof value === 'string') {
            // Si ya viene como YYYY-MM-DD, devolver tal cual (fecha sin tz)
            if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
            // Si viene ISO u otro formato, parsear y tomar parte UTC
            const d = new Date(value);
            if (!isNaN(d)) {
              const y = d.getUTCFullYear();
              const m = String(d.getUTCMonth() + 1).padStart(2, '0');
              const day = String(d.getUTCDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
            }
            return null;
          }
          if (value instanceof Date && !isNaN(value)) {
            const y = value.getUTCFullYear();
            const m = String(value.getUTCMonth() + 1).padStart(2, '0');
            const day = String(value.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          }
          return null;
        } catch (_) {
          return null;
        }
      };
      // Preferimos 'date' (fecha del comprobante) y si no, caemos a 'created'
      const siigoInvoiceCreatedAt = normalizeToYMD(fullInvoice.date) || normalizeToYMD(fullInvoice.created);

      // Normalizar payment_method a ENUM permitido en orders.payment_method para evitar "Data truncated"
      let normalizedPaymentMethod = String(paymentMethod || '').toLowerCase().trim();
      try {
        const cols = await query("SHOW COLUMNS FROM orders LIKE 'payment_method'");
        const type = cols?.[0]?.Type || '';
        const m = /^enum\((.+)\)$/i.exec(type);
        const allowed = m
          ? m[1].split(',').map(s => s.trim().replace(/^'/, '').replace(/'$/, ''))
          : ['efectivo', 'transferencia', 'tarjeta_credito', 'pago_electronico'];

        // Mapeos conocidos
        const normalizeCredit = (v) => (v === 'credito' || v === 'crédito') ? 'cliente_credito' : v;
        normalizedPaymentMethod = normalizeCredit(normalizedPaymentMethod);

        if (!allowed.includes(normalizedPaymentMethod)) {
          if (normalizedPaymentMethod === 'contraentrega' && allowed.includes('contraentrega')) {
            // mantener
          } else if (normalizedPaymentMethod.includes('credito') && allowed.includes('cliente_credito')) {
            normalizedPaymentMethod = 'cliente_credito';
          } else if (allowed.includes('transferencia')) {
            normalizedPaymentMethod = 'transferencia';
          } else if (allowed.length > 0) {
            normalizedPaymentMethod = allowed[0];
          } else {
            normalizedPaymentMethod = 'efectivo';
          }
        }
      } catch (_) {
        // Fallback conservador
        normalizedPaymentMethod = ['efectivo', 'transferencia', 'tarjeta_credito', 'pago_electronico'].includes(normalizedPaymentMethod)
          ? normalizedPaymentMethod
          : 'efectivo';
      }

      const orderData = {
        order_number: fullInvoice.name || invoice.name || `SIIGO-${invoice.id}`,
        invoice_code: fullInvoice.name || invoice.name || `SIIGO-${invoice.id}`,
        siigo_invoice_id: invoice.id,
        customer_name: sanitizedCustomerName,
        customer_phone: sanitizedCustomerPhone,
        customer_address: sanitizedCustomerAddress,
        customer_identification: sanitizedCustomerIdentification,
        customer_id_type: sanitizedCustomerIdType,
        siigo_customer_id: siigoCustomerId,
        customer_person_type: customerPersonType,
        customer_email: sanitizedCustomerEmail,
        customer_department: sanitizedCustomerDepartment,
        customer_country: sanitizedCustomerCountry,
        customer_city: sanitizedCustomerCity,
        total_amount: totalAmount,
        net_value: netValue, // Nuevo campo
        status: 'pendiente_por_facturacion',
        delivery_method: deliveryMethod,
        payment_method: normalizedPaymentMethod,
        created_by: await getSystemUserId(),
        created_at: new Date()
      };

      console.log(`💾 Datos COMPLETOS del pedido preparados:`, orderData);

      console.log(`💾 Insertando pedido con TODOS los campos: ${orderData.order_number}`);

      // Insertar pedido con TODOS los campos disponibles incluyendo commercial_name, siigo_public_url, siigo_observations y shipping_payment_method
      const insertResult = await query(`
        INSERT INTO orders (
          order_number, invoice_code, siigo_invoice_id, customer_name, commercial_name,
          customer_phone, customer_address, customer_identification,
          customer_id_type, siigo_customer_id, customer_person_type,
          customer_email, customer_department, customer_country, customer_city,
          total_amount, net_value, status, delivery_method, payment_method, 
          shipping_payment_method, siigo_public_url, siigo_observations, siigo_invoice_created_at, 
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderData.order_number,
        orderData.invoice_code,
        orderData.siigo_invoice_id,
        orderData.customer_name,
        sanitizedCommercialName, // NUEVO CAMPO: commercial_name extraído correctamente
        orderData.customer_phone,
        orderData.customer_address,
        orderData.customer_identification,
        orderData.customer_id_type,
        orderData.siigo_customer_id,
        orderData.customer_person_type,
        orderData.customer_email,
        orderData.customer_department,
        orderData.customer_country,
        typeof orderData.customer_city === 'object' ? safeJSONStringify(orderData.customer_city) : orderData.customer_city,
        orderData.total_amount,
        orderData.net_value,
        orderData.status,
        orderData.delivery_method,
        orderData.payment_method,
        shippingPaymentMethod, // CAMPO AUTOMÁTICO DESDE SIIGO
        siigoPublicUrl,
        sanitizedSiigoObservations,
        siigoInvoiceCreatedAt,
        orderData.created_by,
        orderData.created_at
      ]);

      const orderId = insertResult.insertId;
      console.log(`✅ Pedido creado con ID: ${orderId}`);

      // Procesar items de la factura
      let itemsInserted = 0;
      if (fullInvoice.items && fullInvoice.items.length > 0) {
        console.log(`📦 Procesando ${fullInvoice.items.length} items...`);

        for (const item of fullInvoice.items) {
          try {
            console.log(`🔍 Insertando item: ${item.description || item.name || 'Producto SIIGO'}`);
            // Determinar la línea de la factura conservando el orden de SIIGO
            const invoiceLine = Array.isArray(fullInvoice.items) ? (fullInvoice.items.indexOf(item) + 1) : null;
            const productCode = item.code || (item.product?.code) || null;

            await query(`
              INSERT INTO order_items (
                order_id, name, product_code, quantity, price, description, invoice_line, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
              orderId,
              sanitizeText(item.description || item.name || 'Producto SIIGO'),
              sanitizeText(productCode || null),
              parseFloat(item.quantity || 1),
              parseFloat(item.price || item.unit_price || 0),
              sanitizeText(item.description || item.name || null),
              invoiceLine || null
            ]);
            itemsInserted++;
            console.log(`✅ Item insertado exitosamente: ${item.description || item.name}`);
          } catch (itemError) {
            console.error(`❌ Error insertando item "${item.description || item.name}":`, itemError.message);
            console.error(`📊 Datos del item:`, JSON.stringify({
              orderId,
              name: item.description || item.name,
              quantity: item.quantity,
              price: item.price || item.unit_price,
              code: item.code,
              invoice_line: Array.isArray(fullInvoice.items) ? (fullInvoice.items.indexOf(item) + 1) : null
            }, null, 2));
          }
        }

        console.log(`✅ ${itemsInserted} items insertados de ${fullInvoice.items.length} intentados`);
      } else {
        console.log(`⚠️ Factura sin items detallados`);
      }

      // Log de sincronización
      await query(`
        INSERT INTO siigo_sync_log (
          siigo_invoice_id, sync_status, order_id, processed_at
        ) VALUES (?, ?, ?, NOW())
      `, [invoice.id, 'success', orderId]);

      console.log(`🎉 Factura ${invoice.name} procesada exitosamente como pedido ${orderId}`);

      return {
        success: true,
        orderId: orderId,
        itemsCount: itemsInserted,
        message: `Pedido ${orderData.order_number} creado con ${itemsInserted} items`
      };

    } catch (error) {
      console.error(`❌ Error procesando factura ${invoice.name}:`, error.message);

      // Log de error
      try {
        await query(`
          INSERT INTO siigo_sync_log (
            siigo_invoice_id, sync_status, error_message, processed_at
          ) VALUES (?, ?, ?, NOW())
        `, [invoice.id, 'error', error.message]);
      } catch (logError) {
        console.error('Error logging sync error:', logError.message);
      }

      throw error;
    }
  }

  // Función para extraer items de una factura de SIIGO
  extractOrderItems(invoiceData) {
    try {
      if (!invoiceData || !invoiceData.items || !Array.isArray(invoiceData.items)) {
        console.log('⚠️ Factura sin items detallados');
        return [];
      }

      console.log(`📦 Extrayendo ${invoiceData.items.length} items de la factura...`);

      return invoiceData.items.map(item => ({
        name: item.description || item.name || 'Producto SIIGO',
        quantity: parseFloat(item.quantity || 1),
        price: parseFloat(item.price || item.unit_price || 0),
        description: item.description || item.name || null,
        product_code: item.code || null
      }));

    } catch (error) {
      console.error('❌ Error extrayendo items de SIIGO:', error.message);
      return [];
    }
  }

  // Función para construir notas del pedido desde SIIGO
  buildOrderNotes(invoiceData, customerInfo = {}) {
    try {
      let notes = [];

      // Agregar observaciones de SIIGO
      if (invoiceData.observations) {
        notes.push(`OBSERVACIONES SIIGO: ${invoiceData.observations}`);
      }

      // Agregar notas de SIIGO
      if (invoiceData.notes) {
        notes.push(`NOTAS SIIGO: ${invoiceData.notes}`);
      }

      // Agregar información adicional del cliente si está disponible
      if (customerInfo.identification) {
        notes.push(`IDENTIFICACIÓN: ${customerInfo.identification}`);
      }

      if (customerInfo.id_type?.name) {
        notes.push(`TIPO ID: ${customerInfo.id_type.name}`);
      }

      const result = notes.join('\n\n');
      console.log(`📝 Notas del pedido construidas: ${result || 'Sin notas'}`);

      return result || null;

    } catch (error) {
      console.error('❌ Error construyendo notas del pedido:', error.message);
      return null;
    }
  }

  // Método para obtener todos los productos desde SIIGO
  async getAllProducts(page = 1, pageSize = 100) {
    try {
      console.log(`📦 Obteniendo productos de SIIGO (página ${page}, tamaño: ${pageSize})...`);

      const headers = await this.getHeaders();

      return await this.makeRequestWithRetry(async () => {
        const response = await axios.get(`${this.baseURL}/v1/products`, {
          headers,
          params: {
            page: page,
            page_size: pageSize
          },
          timeout: 30000
        });

        console.log(`✅ ${response.data.results?.length || 0} productos obtenidos`);
        console.log(`📊 Total disponible: ${response.data.pagination?.total_results || 'N/A'}`);

        // Si hay más páginas, obtenerlas todas recursivamente
        const products = response.data.results || [];

        if (response.data.pagination && response.data.pagination.total_pages > page) {
          console.log(`📄 Obteniendo página ${page + 1} de ${response.data.pagination.total_pages}...`);
          const nextPageProducts = await this.getAllProducts(page + 1, pageSize);
          return products.concat(nextPageProducts);
        }

        return products;
      });

    } catch (error) {
      console.error('❌ Error obteniendo productos de SIIGO:', error.message);
      if (error.response) {
        console.error('Respuesta del error:', error.response.data);
      }
      throw error;
    }
  }

  // Método para obtener detalles completos de un producto
  async getProductDetails(productId) {
    try {
      console.log(`📦 Obteniendo detalles del producto: ${productId}`);

      const headers = await this.getHeaders();

      return await this.makeRequestWithRetry(async () => {
        const response = await axios.get(`${this.baseURL}/v1/products/${productId}`, {
          headers,
          timeout: 20000
        });

        console.log(`✅ Detalles obtenidos para producto ${productId}`);
        return response.data;
      });

    } catch (error) {
      console.error(`❌ Error obteniendo detalles del producto ${productId}:`, error.message);
      throw error;
    }
  }

  // Método para obtener múltiples clientes con paginación
  async getCustomers(page = 1, pageSize = 50) {
    try {
      console.log(`👥 Obteniendo clientes de SIIGO (página ${page}, tamaño: ${pageSize})...`);

      const headers = await this.getHeaders();

      return await this.makeRequestWithRetry(async () => {
        const response = await axios.get(`${this.baseURL}/v1/customers`, {
          headers,
          params: {
            page: page,
            page_size: pageSize
          },
          timeout: 30000
        });

        const results = response.data.results || [];
        const totalPages = response.data.pagination?.total_pages || null;
        console.log(`✅ ${results.length} clientes obtenidos`);
        console.log(`📊 Total disponible: ${response.data.pagination?.total_results || 'N/A'} | total_pages: ${totalPages || 'N/A'}`);

        return { results, totalPages };
      });

    } catch (error) {
      console.error('❌ Error obteniendo clientes de SIIGO:', error.message);
      if (error.response) {
        console.error('Respuesta del error:', error.response.data);
      }
      throw error;
    }
  }

  async getCustomerByIdentification(identification) {
    try {
      const headers = await this.getHeaders();
      // SIIGO permite filtrar por identificación
      const response = await axios.get(`${this.baseURL}/v1/customers`, {
        headers,
        params: { identification, page_size: 1 },
        timeout: 20000
      });
      return response.data.results?.[0] || null;
    } catch (error) {
      console.error(`❌ Error buscando cliente por identificación ${identification}:`, error.message);
      return null;
    }
  }

  // Método para obtener todos los clientes (todas las páginas)
  async getAllCustomers(maxPages = 20) {
    try {
      console.log(`👥 Obteniendo TODOS los clientes de SIIGO (máximo ${maxPages} páginas)...`);

      let allCustomers = [];
      let page = 1;
      let emptyPagesInARow = 0;
      const pageSize = 50;

      while (page <= maxPages) {
        try {
          const { results, totalPages } = await this.getCustomers(page, pageSize);

          if (!results || results.length === 0) {
            emptyPagesInARow++;
            console.log(`⏳ Página ${page} sin resultados (vacía). Intentos vacíos consecutivos: ${emptyPagesInARow}`);
            // Si tenemos varias páginas vacías seguidas, consideramos fin; de lo contrario, seguir a la siguiente
            if (emptyPagesInARow >= 3) {
              console.log(`⏹️ Demasiadas páginas vacías consecutivas, deteniendo en página ${page}`);
              break;
            }
            page++;
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          emptyPagesInARow = 0;

          allCustomers = allCustomers.concat(results);
          console.log(`📊 Total acumulado: ${allCustomers.length} clientes`);

          // Si conocemos totalPages y ya alcanzamos el final, salir
          if (totalPages && page >= totalPages) {
            console.log('✅ Alcanzada la última página informada por SIIGO');
            break;
          }

          // Continuar a la siguiente página
          page++;
          // Pausa entre páginas para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`❌ Error obteniendo página ${page}:`, error.message);
          if (error.message.includes('429') || error.message.includes('rate')) {
            const delay = Math.min(15000, this.rateLimitDelay * 5);
            console.log(`⏳ Rate limit alcanzado, esperando ${delay}ms antes de reintentar la MISMA página...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Reintentar misma página
          } else {
            // Otros errores: avanzar a la siguiente página para no detener el proceso completo
            console.log('⚠️ Error no bloqueante, avanzando a la siguiente página...');
            page++;
          }
        }
      }

      console.log(`✅ Obtenidos ${allCustomers.length} clientes en total de SIIGO`);
      return allCustomers;

    } catch (error) {
      console.error('❌ Error obteniendo todos los clientes de SIIGO:', error.message);
      throw error;
    }
  }

  // Método para importar facturas específicas
  async importInvoices(invoiceIds, paymentMethod = 'transferencia', deliveryMethod = 'domicilio') {
    try {
      console.log(`📥 Importando ${invoiceIds.length} facturas...`);

      const results = [];
      const concurrency = parseInt(process.env.SIIGO_IMPORT_CONCURRENCY || '2', 10);
      let currentIndex = 0;

      async function worker() {
        while (true) {
          const idx = currentIndex++;
          if (idx >= invoiceIds.length) break;
          const invoiceId = invoiceIds[idx];
          try {
            // Obtener detalles de la factura
            const invoice = await this.getInvoiceDetails(invoiceId);

            // Verificar si ya existe
            const existing = await query(
              'SELECT id FROM orders WHERE siigo_invoice_id = ?',
              [invoiceId]
            );

            if (existing.length > 0) {
              console.log(`⚠️ Factura ${invoice.name} ya existe como pedido ${existing[0].id}`);
              results.push({
                invoiceId,
                success: false,
                message: 'Factura ya importada',
                orderId: existing[0].id
              });
              continue;
            }

            // Procesar factura
            const result = await this.processInvoiceToOrder(invoice, paymentMethod, deliveryMethod);
            results.push({
              invoiceId,
              ...result
            });
          } catch (error) {
            console.error(`❌ Error importando factura ${invoiceId}:`, error.message);
            results.push({
              invoiceId,
              success: false,
              message: error.message
            });
          }
        }
      }

      const workers = Array(Math.min(concurrency, invoiceIds.length)).fill(0).map(() => worker.call(this));
      await Promise.all(workers);

      console.log(`📊 Importación completada: ${results.filter(r => r.success).length}/${results.length} exitosas`);

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      };

    } catch (error) {
      console.error('❌ Error en importación masiva:', error.message);
      throw error;
    }
  }
}

module.exports = new SiigoService();
