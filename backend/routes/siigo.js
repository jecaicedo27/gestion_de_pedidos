const express = require('express');
const router = express.Router();
const siigoController = require('../controllers/siigoController');
const { verifyToken, verifyRole } = require('../middleware/auth');

// ============================================================================
// RUTAS BÁSICAS (SIN AUTENTICACIÓN PARA PRUEBAS)
// ============================================================================

/**
 * GET /api/siigo/connection/status
 * Verificar estado de conexión con SIIGO API
 */
router.get('/connection/status', siigoController.getConnectionStatus);

/**
 * GET /api/siigo/invoices
 * Obtener lista de facturas de SIIGO con filtros
 */
router.get('/invoices', siigoController.getInvoices);

/**
 * GET /api/siigo/invoices/:id
 * Obtener detalles de una factura específica de SIIGO
 */
router.get('/invoices/:id', siigoController.getInvoiceDetails);

/**
 * POST /api/siigo/import
 * Importar facturas seleccionadas
 */
router.post('/import', siigoController.importInvoices);

/**
 * GET /api/siigo/automation/status
 * Verificar estado del servicio automático
 */
router.get('/automation/status', siigoController.getAutomationStatus);

// ============================================================================
// RUTAS DE PRUEBA Y DESARROLLO
// ============================================================================

/**
 * POST /api/siigo/test/webhook
 * Ruta de prueba para simular webhook (solo en desarrollo)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test/webhook', (req, res) => {
    console.log('🧪 Webhook de prueba recibido:', req.body);
    
    // Simular estructura de webhook de SIIGO
    const testWebhook = {
      event: 'invoice.created',
      data: {
        id: req.body.invoice_id || 'test-invoice-123',
        ...req.body
      }
    };
    
    // Procesar como webhook real
    req.body = testWebhook;
    siigoController.handleInvoiceWebhook(req, res);
  });
  
  /**
   * GET /api/siigo/test/auth
   * Probar autenticación con SIIGO (solo en desarrollo)
   */
  router.get('/test/auth', async (req, res) => {
    try {
      const siigoService = require('../services/siigoService');
      const token = await siigoService.ensureValidToken();
      
      res.json({
        success: true,
        message: 'Autenticación exitosa',
        data: {
          token_length: token.length,
          expires_at: new Date(siigoService.tokenExpiry).toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en autenticación',
        error: error.message
      });
    }
  });
}

// ============================================================================
// MANEJO DE ERRORES
// ============================================================================

// Middleware de manejo de errores específico para rutas SIIGO
router.use((error, req, res, next) => {
  console.error('❌ Error en rutas SIIGO:', error);
  
  // Error de autenticación SIIGO
  if (error.message.includes('SIIGO API') || error.message.includes('autenticar')) {
    return res.status(503).json({
      success: false,
      message: 'Servicio SIIGO no disponible',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error de conexión'
    });
  }
  
  // Error de validación
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      error: error.message
    });
  }
  
  // Error genérico
  res.status(500).json({
    success: false,
    message: 'Error interno en integración SIIGO',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
  });
});

module.exports = router;
