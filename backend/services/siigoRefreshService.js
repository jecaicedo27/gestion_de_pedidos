const siigoService = require('./siigoService');
const { query } = require('../config/database');

class SiigoRefreshService {
  constructor() {
    this.refreshIntervals = new Map();
    this.lastRefreshTimes = new Map();
    this.isEnabled = process.env.SIIGO_ENABLED === 'true';
    
    console.log('🔄 Servicio de refresco SIIGO inicializado');
  }

  /**
   * Obtener saldos con cache inteligente y refresco automático
   */
  async getCustomerBalanceWithRefresh(customerNit, forceRefresh = false) {
    try {
      console.log(`💰 [REFRESH] Consultando saldo para ${customerNit} (force: ${forceRefresh})`);
      
      if (!this.isEnabled) {
        return {
          total_balance: 0,
          pending_invoices: [],
          total_invoices: 0,
          source: 'disabled',
          last_updated: new Date()
        };
      }

      const cacheKey = `balance_${customerNit}`;
      const lastRefresh = this.lastRefreshTimes.get(cacheKey);
      const now = new Date();
      
      // Refresco automático cada 2 minutos o si es forzado
      const shouldRefresh = forceRefresh || 
        !lastRefresh || 
        (now - lastRefresh) > (2 * 60 * 1000); // 2 minutos

      let balanceData;
      
      if (shouldRefresh) {
        console.log(`🔄 [REFRESH] Obteniendo datos frescos de SIIGO...`);
        
        // Buscar cliente
        const customer = await siigoService.findCustomerByNit(customerNit);
        
        if (customer) {
          // Obtener saldos actualizados
          balanceData = await siigoService.getCustomerAccountsReceivable(customer.id);
          
          // Guardar en cache con timestamp
          await this.saveToCache(cacheKey, balanceData);
          this.lastRefreshTimes.set(cacheKey, now);
          
          console.log(`✅ [REFRESH] Datos actualizados: $${balanceData.total_balance?.toLocaleString()}`);
        } else {
          balanceData = {
            total_balance: 0,
            pending_invoices: [],
            total_invoices: 0,
            source: 'customer_not_found'
          };
        }
      } else {
        console.log(`📋 [CACHE] Usando datos en cache para ${customerNit}`);
        balanceData = await this.getFromCache(cacheKey);
      }

      return {
        ...balanceData,
        last_updated: lastRefresh || now,
        cache_age_seconds: lastRefresh ? Math.round((now - lastRefresh) / 1000) : 0,
        next_refresh_in: lastRefresh ? Math.max(0, 120 - Math.round((now - lastRefresh) / 1000)) : 0
      };

    } catch (error) {
      console.error(`❌ [REFRESH] Error consultando saldo:`, error.message);
      
      // Intentar obtener del cache en caso de error
      const cachedData = await this.getFromCache(`balance_${customerNit}`);
      if (cachedData) {
        return {
          ...cachedData,
          source: 'cache_fallback',
          error: error.message
        };
      }
      
      return {
        total_balance: 0,
        pending_invoices: [],
        total_invoices: 0,
        source: 'error',
        error: error.message
      };
    }
  }

  /**
   * Forzar refresco para todos los clientes activos
   */
  async refreshAllActiveCustomers() {
    try {
      console.log('🔄 [REFRESH] Iniciando refresco masivo...');
      
      // Obtener clientes con crédito activo
      const activeCustomers = await query(`
        SELECT DISTINCT customer_name 
        FROM customer_credit 
        WHERE status = 'active' 
        AND credit_limit > 0
        LIMIT 10
      `);

      const results = [];
      
      for (const customer of activeCustomers) {
        try {
          // Extraer NIT del nombre si está disponible
          const nitMatch = customer.customer_name.match(/(\d{6,12}-?\d?)/);
          if (nitMatch) {
            const nit = nitMatch[1].replace('-', '');
            const result = await this.getCustomerBalanceWithRefresh(nit, true);
            results.push({
              customer: customer.customer_name,
              nit: nit,
              balance: result.total_balance,
              status: 'updated'
            });
          }
        } catch (error) {
          results.push({
            customer: customer.customer_name,
            status: 'error',
            error: error.message
          });
        }
      }

      console.log(`✅ [REFRESH] Refresco masivo completado: ${results.length} clientes`);
      return results;

    } catch (error) {
      console.error('❌ [REFRESH] Error en refresco masivo:', error.message);
      throw error;
    }
  }

  /**
   * Detectar nuevas facturas en SIIGO
   */
  async detectNewInvoices(since = null) {
    try {
      console.log('🔍 [DETECT] Detectando nuevas facturas...');
      
      if (!since) {
        // Por defecto, buscar facturas de los últimos 10 minutos
        since = new Date(Date.now() - 10 * 60 * 1000);
      }

      const invoices = await siigoService.getInvoices({
        created_start: since.toISOString().split('T')[0],
        page_size: 50
      });

      const newInvoices = [];
      
      if (invoices && invoices.results) {
        for (const invoice of invoices.results) {
          const createdDate = new Date(invoice.created || invoice.date);
          
          if (createdDate >= since) {
            newInvoices.push({
              id: invoice.id,
              number: invoice.name || invoice.number,
              customer: invoice.customer?.commercial_name || invoice.customer?.name,
              customer_nit: invoice.customer?.identification,
              total: invoice.total,
              created: createdDate,
              status: invoice.status
            });
          }
        }
      }

      console.log(`🔍 [DETECT] ${newInvoices.length} facturas nuevas encontradas`);
      return newInvoices;

    } catch (error) {
      console.error('❌ [DETECT] Error detectando nuevas facturas:', error.message);
      return [];
    }
  }

  /**
   * Configurar refresco automático para un cliente
   */
  startAutoRefresh(customerNit, intervalMinutes = 3) {
    const intervalId = setInterval(async () => {
      try {
        console.log(`⏰ [AUTO] Refresco automático para ${customerNit}`);
        await this.getCustomerBalanceWithRefresh(customerNit, true);
      } catch (error) {
        console.error(`❌ [AUTO] Error en refresco automático:`, error.message);
      }
    }, intervalMinutes * 60 * 1000);

    this.refreshIntervals.set(customerNit, intervalId);
    console.log(`⏰ [AUTO] Refresco automático iniciado para ${customerNit} cada ${intervalMinutes} minutos`);
  }

  /**
   * Detener refresco automático para un cliente
   */
  stopAutoRefresh(customerNit) {
    const intervalId = this.refreshIntervals.get(customerNit);
    if (intervalId) {
      clearInterval(intervalId);
      this.refreshIntervals.delete(customerNit);
      console.log(`⏹️ [AUTO] Refresco automático detenido para ${customerNit}`);
    }
  }

  /**
   * Guardar en cache de base de datos
   */
  async saveToCache(key, data) {
    try {
      await query(`
        INSERT INTO siigo_cache (cache_key, cache_data, created_at, updated_at)
        VALUES (?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE 
          cache_data = VALUES(cache_data), 
          updated_at = NOW()
      `, [key, JSON.stringify(data)]);
    } catch (error) {
      console.warn('⚠️ Error guardando cache:', error.message);
    }
  }

  /**
   * Obtener del cache
   */
  async getFromCache(key) {
    try {
      const result = await query(`
        SELECT cache_data, updated_at 
        FROM siigo_cache 
        WHERE cache_key = ? 
        AND updated_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        LIMIT 1
      `, [key]);

      if (result.length > 0) {
        return JSON.parse(result[0].cache_data);
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Error obteniendo cache:', error.message);
      return null;
    }
  }

  /**
   * Crear tabla de cache si no existe
   */
  async initializeCache() {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS siigo_cache (
          id INT AUTO_INCREMENT PRIMARY KEY,
          cache_key VARCHAR(255) UNIQUE,
          cache_data JSON,
          created_at DATETIME,
          updated_at DATETIME,
          INDEX idx_cache_key (cache_key),
          INDEX idx_updated_at (updated_at)
        )
      `);
      console.log('📋 Tabla de cache SIIGO inicializada');
    } catch (error) {
      console.warn('⚠️ Error inicializando cache:', error.message);
    }
  }

  /**
   * Limpiar cache antiguo
   */
  async cleanupCache() {
    try {
      await query(`
        DELETE FROM siigo_cache 
        WHERE updated_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
      `);
      console.log('🧹 Cache antiguo limpiado');
    } catch (error) {
      console.warn('⚠️ Error limpiando cache:', error.message);
    }
  }
}

// Instancia singleton
const siigoRefreshService = new SiigoRefreshService();

// Inicializar cache al cargar
siigoRefreshService.initializeCache();

// Limpiar cache cada hora
setInterval(() => {
  siigoRefreshService.cleanupCache();
}, 60 * 60 * 1000);

module.exports = siigoRefreshService;
