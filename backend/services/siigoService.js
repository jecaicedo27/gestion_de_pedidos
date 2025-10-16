
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
    this.rateLimitDelay = 1000; // 1 segundo entre requests
    this.maxRetries = 3;
    this.customersCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
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

  // Retry con backoff exponencial
  async makeRequestWithRetry(requestFn, maxRetries = this.maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.waitForRateLimit();
        return await requestFn();
      } catch (error) {
        console.log(`❌ Intento ${attempt}/${maxRetries} falló:`, error.message);
        
        // Si es error 429, esperar más tiempo
        if (error.response?.status === 429) {
          const delay = Math.pow(2, attempt) * 2000; // Backoff exponencial
          console.log(`🚦 Rate limit detectado, esperando ${delay}ms...`);
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

      // Usar date_start según documentación oficial SIIGO (formato yyyymmdd)
      if (params.start_date) {
        // Convertir de YYYY-MM-DD a YYYYMMDD
        const dateStartFormatted = this.formatDateForSiigo(params.start_date);
        defaultParams.date_start = dateStartFormatted;
        console.log(`📅 Usando date_start (formato SIIGO): ${dateStartFormatted}`);
      }

      return await this.makeRequestWithRetry(async () => {
        console.log(`📋 Obteniendo facturas (página ${defaultParams.page}, page_size: ${defaultParams.page_size})...`);
        if (defaultParams.date_start) {
          console.log(`📅 Filtrando desde fecha: ${defaultParams.date_start}`);
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
        const formatted = `${dateString.slice(0,4)}-${dateString.slice(4,6)}-${dateString.slice(6,8)}`;
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

  async getCustomer(customerId) {
    try {
      // Verificar caché primero
      const cacheKey = customerId;
      const cached = this.customersCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
        console.log(`✅ Cliente obtenido desde caché: ${customerId}`);
        return cached.data;
      }

      const headers = await this.getHeaders();
      
      const customerData = await this.makeRequestWithRetry(async () => {
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
        data: customerData,
        timestamp: Date.now()
      });
      
      console.log(`✅ Cliente cacheado: ${customerId}`);
      return customerData;

    } catch (error) {
      console.error(`❌ Error obteniendo cliente ${customerId}:`, error.message);
      throw error;
    }
  }

  async processInvoiceToOrder(invoice, paymentMethod = 'transferencia', deliveryMethod = 'domicilio') {
    try {
      console.log(`🔄 Procesando factura ${invoice.name || invoice.id} a pedido...`);
      
      // Obtener detalles completos de la factura
      const fullInvoice = await this.getInvoiceDetails(invoice.id);
      console.log(`📋 Detalles completos obtenidos:`, safeJSONStringify(fullInvoice, null, 2));
      
      // Obtener información del cliente
      let customerInfo = {};
      const customerId = fullInvoice.customer?.id || invoice.customer?.id;
      
      if (customerId) {
        try {
          customerInfo = await this.getCustomer(customerId);
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
          
          if (calculatedTotal > 0) return calculatedTotal;
        }
        
        return 0;
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
        console.log('🔍 fullInvoice.observations:', fullInvoice.observations);
        console.log('🔍 fullInvoice.notes:', fullInvoice.notes);
        console.log('🔍 fullInvoice.comments:', fullInvoice.comments);
        console.log('🔍 invoice.observations:', invoice.observations);
        console.log('🔍 invoice.notes:', invoice.notes);
        
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
          
          console.log('🔍 Analizando texto:', text.substring(0, 100) + '...');
          
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
      const shippingPaymentMethod = extractShippingPaymentMethod(invoice, fullInvoice);
      
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
      // Preferimos 'date' (fecha del comprobante) y si no, caemos a 'created'
      const siigoInvoiceCreatedAt = fullInvoice.date ? new Date(fullInvoice.date) : (fullInvoice.created ? new Date(fullInvoice.created) : null);
      
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
        status: 'pendiente_por_facturacion',
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
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
          total_amount, status, delivery_method, payment_method, 
          shipping_payment_method, siigo_public_url, siigo_observations, siigo_invoice_created_at, 
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            await query(`
              INSERT INTO order_items (
                order_id, name, quantity, price, description, created_at
              ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
              orderId,
              sanitizeText(item.description || item.name || 'Producto SIIGO'),
              parseFloat(item.quantity || 1),
              parseFloat(item.price || item.unit_price || 0),
              sanitizeText(item.code || item.description || item.name || null)
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
              code: item.code
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

        console.log(`✅ ${response.data.results?.length || 0} clientes obtenidos`);
        console.log(`📊 Total disponible: ${response.data.pagination?.total_results || 'N/A'}`);
        
        return response.data.results || [];
      });

    } catch (error) {
      console.error('❌ Error obteniendo clientes de SIIGO:', error.message);
      if (error.response) {
        console.error('Respuesta del error:', error.response.data);
      }
      throw error;
    }
  }

  // Método para obtener todos los clientes (todas las páginas)
  async getAllCustomers(maxPages = 20) {
    try {
      console.log(`👥 Obteniendo TODOS los clientes de SIIGO (máximo ${maxPages} páginas)...`);
      
      let allCustomers = [];
      let page = 1;
      let hasMorePages = true;
      
      while (hasMorePages && page <= maxPages) {
        try {
          const customers = await this.getCustomers(page, 50);
          
          if (!customers || customers.length === 0) {
            console.log(`⏹️ No se encontraron más clientes en la página ${page}`);
            hasMorePages = false;
            break;
          }
          
          allCustomers = allCustomers.concat(customers);
          console.log(`📊 Total acumulado: ${allCustomers.length} clientes`);
          
          // Si obtuvimos menos del pageSize, probablemente no hay más páginas
          if (customers.length < 50) {
            hasMorePages = false;
          } else {
            page++;
            // Pausa entre páginas para evitar rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.error(`❌ Error obteniendo página ${page}:`, error.message);
          if (error.message.includes('429') || error.message.includes('rate')) {
            console.log('⏳ Rate limit alcanzado, esperando 5 segundos...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Reintentar la misma página
            continue;
          } else {
            // Otros errores, detener la paginación
            hasMorePages = false;
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
      
      for (const invoiceId of invoiceIds) {
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
          
          // Pequeña pausa entre facturas
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ Error importando factura ${invoiceId}:`, error.message);
          results.push({
            invoiceId,
            success: false,
            message: error.message
          });
        }
      }
      
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
