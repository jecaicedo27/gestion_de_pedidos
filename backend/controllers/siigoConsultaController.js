const siigoService = require('../services/siigoService');

/**
 * Controlador para consultas avanzadas SIIGO - Solo para administradores
 */

// Caché simple para evitar rate limiting
const cache = new Map();
const CACHE_TTL = 30000; // 30 segundos

// Consultar cliente completo por NIT
const consultarClientePorNit = async (req, res) => {
  try {
    const { nit } = req.params;
    
    if (!nit) {
      return res.status(400).json({
        success: false,
        message: 'NIT es requerido'
      });
    }

    console.log(`🔍 [ADMIN] Consultando información completa para NIT: ${nit}`);
    
    // 1. Buscar cliente por NIT
    const cliente = await siigoService.findCustomerByNit(nit);
    
    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: `No se encontró cliente con NIT: ${nit}`,
        data: null
      });
    }

    console.log(`✅ [ADMIN] Cliente encontrado: ${cliente.id}`);

    // 2. Obtener información completa del cliente
    const clienteCompleto = await siigoService.getCustomer(cliente.id);

    // 3. Obtener cuentas por cobrar
    const cuentasPorCobrar = await siigoService.getCustomerAccountsReceivable(cliente.id);

    // 4. Obtener facturas del cliente
    let facturas = [];
    try {
      const facturasResponse = await siigoService.api.get(`/v1/invoices`, {
        params: {
          customer: cliente.id,
          page_size: 50 // Últimas 50 facturas
        }
      });
      facturas = facturasResponse.data.results || [];
      console.log(`📄 [ADMIN] ${facturas.length} facturas obtenidas`);
    } catch (error) {
      console.warn(`⚠️ [ADMIN] Error obteniendo facturas: ${error.message}`);
    }

    // 5. Estructurar respuesta completa
    const respuestaCompleta = {
      // Información básica del cliente
      cliente_basico: {
        id: cliente.id,
        nombre_comercial: cliente.commercial_name,
        identificacion: cliente.identification,
        tipo_cliente: cliente.type?.name || 'No especificado',
        creado: cliente.created,
        actualizado: cliente.updated
      },

      // Información detallada
      cliente_detallado: clienteCompleto,

      // Resumen financiero con nuevas métricas
      resumen_financiero: {
        saldo_total: cuentasPorCobrar.total_balance || 0,
        facturas_pendientes: cuentasPorCobrar.total_invoices || 0,
        facturas_con_saldo: cuentasPorCobrar.pending_invoices?.length || 0,
        // Nuevas métricas agregadas
        total_vendido: cuentasPorCobrar.total_sold || 0,
        total_pagado: cuentasPorCobrar.total_paid || 0,
        faltante_por_pagar: cuentasPorCobrar.remaining_to_pay || 0,
        total_descuentos: cuentasPorCobrar.total_discounts || 0,
        porcentaje_pagado: cuentasPorCobrar.payment_percentage || 0,
        porcentaje_descuentos: cuentasPorCobrar.discount_percentage || 0
      },

      // Cuentas por cobrar detalladas (incluye todos los nuevos campos)
      cuentas_por_cobrar: cuentasPorCobrar,

      // Facturas recientes
      facturas_recientes: facturas.slice(0, 10).map(factura => ({
        id: factura.id,
        numero: factura.name || factura.number,
        fecha: factura.created,
        total: factura.total,
        estado: factura.status,
        vencimiento: factura.due_date,
        pagos: factura.payments?.length || 0
      })),

      // Estadísticas
      estadisticas: {
        total_facturas_consultadas: facturas.length,
        rango_fechas: facturas.length > 0 ? {
          primera_factura: facturas[facturas.length - 1]?.created,
          ultima_factura: facturas[0]?.created
        } : null,
        promedio_factura: facturas.length > 0 ? 
          facturas.reduce((sum, f) => sum + (f.total || 0), 0) / facturas.length : 0
      },

      // Metadatos de consulta
      metadatos: {
        consulta_realizada: new Date().toISOString(),
        nit_consultado: nit,
        usuario_consulta: req.user.full_name,
        fuente_datos: 'SIIGO API'
      }
    };

    console.log(`✅ [ADMIN] Consulta completa exitosa para ${cliente.commercial_name || cliente.identification}`);

    res.json({
      success: true,
      message: 'Información completa del cliente obtenida exitosamente',
      data: respuestaCompleta
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error en consulta completa:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener estado de conexión SIIGO con caché
const estadoConexionSiigo = async (req, res) => {
  try {
    const cacheKey = 'siigo_connection_status';
    
    // Verificar caché para evitar múltiples llamadas a SIIGO
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('✅ Estado SIIGO obtenido desde caché');
        return res.json({
          success: true,
          data: cached.data
        });
      }
    }
    
    const estado = await siigoService.checkConnection();
    
    // Guardar en caché
    cache.set(cacheKey, {
      data: estado,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      data: estado
    });
  } catch (error) {
    console.error('❌ Error verificando conexión SIIGO:', error.message);
    
    // Si es error 429, proporcionar mensaje específico
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'SIIGO API temporalmente limitada (demasiadas peticiones). Intenta en unos minutos.',
        error: 'Rate limit exceeded'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error verificando conexión SIIGO',
      error: error.message
    });
  }
};

// Buscar clientes por término
const buscarClientes = async (req, res) => {
  try {
    const { termino } = req.query;
    
    if (!termino || termino.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'El término de búsqueda debe tener al menos 3 caracteres'
      });
    }

    console.log(`🔍 [ADMIN] Buscando clientes con término: ${termino}`);

    // Buscar clientes en SIIGO
    const response = await siigoService.api.get(`/v1/customers`, {
      params: {
        name: termino,
        page_size: 20
      }
    });

    const clientes = response.data.results || [];

    const clientesFormateados = clientes.map(cliente => ({
      id: cliente.id,
      nombre: cliente.commercial_name || cliente.name,
      identificacion: cliente.identification,
      tipo: cliente.type?.name,
      email: cliente.mail,
      telefono: cliente.phones?.[0]?.number,
      ciudad: cliente.address?.city?.city_name
    }));

    console.log(`✅ [ADMIN] ${clientesFormateados.length} clientes encontrados`);

    res.json({
      success: true,
      data: clientesFormateados,
      total: clientesFormateados.length
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error buscando clientes:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  consultarClientePorNit,
  estadoConexionSiigo,
  buscarClientes
};
