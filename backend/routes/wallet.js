const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener información de crédito de un cliente
router.get('/customer-credit/:customerName', 
  verifyRole(['cartera', 'admin']), 
  walletController.getCustomerCredit
);

// Validar pago y enviar a logística
router.post('/validate-payment', 
  verifyRole(['cartera', 'admin']), 
  walletController.validatePayment
);

// Obtener historial de validaciones de un pedido
router.get('/validation-history/:orderId', 
  verifyRole(['cartera', 'admin']), 
  walletController.getValidationHistory
);

// Obtener lista de clientes con crédito
router.get('/credit-customers', 
  verifyRole(['cartera', 'admin']), 
  walletController.getCreditCustomers
);

// Crear o actualizar cliente con crédito
router.post('/credit-customers', 
  verifyRole(['cartera', 'admin']), 
  walletController.upsertCreditCustomer
);

// Obtener pedidos pendientes de validación en cartera
router.get('/orders', 
  verifyRole(['cartera', 'admin']), 
  walletController.getWalletOrders
);

// Obtener estadísticas de cartera
router.get('/stats', 
  verifyRole(['cartera', 'admin']), 
  walletController.getWalletStats
);

// Nueva ruta: Forzar refresco de saldos SIIGO para un cliente
router.post('/refresh-balance/:customerNit', 
  verifyRole(['cartera', 'admin']), 
  async (req, res) => {
    try {
      const { customerNit } = req.params;
      const siigoRefreshService = require('../services/siigoRefreshService');
      
      console.log(`🔄 [ROUTE] Forzando refresco de saldos para NIT: ${customerNit}`);
      
      const siigoData = await siigoRefreshService.getCustomerBalanceWithRefresh(customerNit, true);
      
      res.json({
        success: true,
        data: siigoData,
        message: 'Saldos refrescados exitosamente desde SIIGO'
      });
      
    } catch (error) {
      console.error('❌ Error en refresco forzado SIIGO:', error);
      res.status(500).json({
        success: false,
        message: 'Error refrescando saldos SIIGO',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Nueva ruta: Refresco masivo de todos los clientes activos
router.post('/refresh-all', 
  verifyRole(['admin']), 
  async (req, res) => {
    try {
      const siigoRefreshService = require('../services/siigoRefreshService');
      
      console.log('🔄 [ROUTE] Iniciando refresco masivo de clientes');
      
      const results = await siigoRefreshService.refreshAllActiveCustomers();
      
      res.json({
        success: true,
        data: results,
        message: `Refresco masivo completado: ${results.length} clientes procesados`
      });
      
    } catch (error) {
      console.error('❌ Error en refresco masivo:', error);
      res.status(500).json({
        success: false,
        message: 'Error en refresco masivo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Nueva ruta: Detectar nuevas facturas en SIIGO
router.get('/detect-new-invoices', 
  verifyRole(['cartera', 'admin']), 
  async (req, res) => {
    try {
      const { since } = req.query;
      const siigoRefreshService = require('../services/siigoRefreshService');
      
      console.log('🔍 [ROUTE] Detectando nuevas facturas en SIIGO');
      
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 10 * 60 * 1000);
      const newInvoices = await siigoRefreshService.detectNewInvoices(sinceDate);
      
      res.json({
        success: true,
        data: newInvoices,
        message: `${newInvoices.length} nuevas facturas encontradas`
      });
      
    } catch (error) {
      console.error('❌ Error detectando nuevas facturas:', error);
      res.status(500).json({
        success: false,
        message: 'Error detectando nuevas facturas',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;
