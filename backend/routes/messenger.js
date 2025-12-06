const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const messengerController = require('../controllers/messengerController');
const { validate, schemas } = require('../middleware/validation');

// Middleware para verificar que el usuario sea mensajero
const requireMessengerRole = (req, res, next) => {
  if (req.user.role !== 'mensajero') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo mensajeros pueden acceder a esta funcionalidad.'
    });
  }
  next();
};

// GET /api/messenger/orders - Obtener pedidos asignados
router.get('/orders', auth.authenticateToken, messengerController.getAssignedOrders);

// POST /api/messenger/orders/:orderId/accept - Aceptar pedido
router.post('/orders/:orderId/accept', auth.authenticateToken, requireMessengerRole, messengerController.acceptOrder);

// POST /api/messenger/orders/:orderId/reject - Rechazar pedido
router.post('/orders/:orderId/reject', auth.authenticateToken, requireMessengerRole, messengerController.rejectOrder);

// POST /api/messenger/orders/:orderId/start-delivery - Iniciar entrega
router.post('/orders/:orderId/start-delivery', auth.authenticateToken, requireMessengerRole, messengerController.startDelivery);

// POST /api/messenger/orders/:orderId/complete - Completar entrega
router.post('/orders/:orderId/complete', auth.authenticateToken, requireMessengerRole, messengerController.completeDelivery);

// POST /api/messenger/orders/:orderId/mark-failed - Marcar entrega como fallida
router.post('/orders/:orderId/mark-failed', auth.authenticateToken, requireMessengerRole, messengerController.markDeliveryFailed);

// POST /api/messenger/orders/:orderId/pending-evidence - Marcar pendiente de comprobante
router.post('/orders/:orderId/pending-evidence', auth.authenticateToken, requireMessengerRole, messengerController.markPendingEvidence);

// POST /api/messenger/orders/:orderId/upload-evidence - Subir evidencia fotográfica
router.post(
  '/orders/:orderId/upload-evidence',
  auth.authenticateToken,
  requireMessengerRole,
  // Wrap multer to return 400 with readable message instead of generic 500
  (req, res, next) => {
    messengerController.upload.single('photo')(req, res, function (err) {
      if (err) {
        // Common cases: file too large, invalid mimetype (e.g., video), etc.
        const message = err.message || 'Error al subir la imagen';
        return res.status(400).json({
          success: false,
          message
        });
      }
      next();
    });
  },
  messengerController.uploadEvidence
);

// GET /api/messenger/daily-summary - Obtener resumen diario
router.get('/daily-summary', auth.authenticateToken, requireMessengerRole, messengerController.getDailySummary);

// GET /api/messenger/cash-summary - Resumen de dinero recibido (rango fechas opcional)
router.get('/cash-summary', auth.authenticateToken, requireMessengerRole, messengerController.getCashSummary);

// GET /api/messenger/deliveries - Historial de entregas (paginado)
router.get('/deliveries', auth.authenticateToken, requireMessengerRole, messengerController.getDeliveryHistory);

/* Nuevos endpoints de caja */

// POST /api/messenger/orders/:orderId/declare-cash - Declarar entrega de dinero por pedido (mensajero)
router.post(
  '/orders/:orderId/declare-cash',
  auth.authenticateToken,
  requireMessengerRole,
  messengerController.declareCashForOrder
);

/* Nuevos endpoints de caja */

/**
 * Recibo HTML por factura (imprimible) para firma - accesible a cartera/admin/logística
 */
router.get(
  '/orders/:orderId/cash-receipt',
  auth.authenticateToken,
  auth.verifyRole(['admin', 'logistica', 'cartera']),
  messengerController.getCashReceiptHtml
);

// POST /api/messenger/orders/:orderId/accept-cash - Aceptar recepción de dinero (admin/logística/cartera)
router.post(
  '/orders/:orderId/accept-cash',
  auth.authenticateToken,
  auth.verifyRole(['admin', 'logistica', 'cartera']),
  messengerController.acceptCashForOrder
);

// POST /api/messenger/cash-deliveries - Declaración agregada diaria de efectivo del mensajero
router.post(
  '/cash-deliveries',
  auth.authenticateToken,
  requireMessengerRole,
  validate(schemas.createCashDelivery),
  messengerController.createCashDelivery
);

// GET /api/messenger/cash-deliveries - Listar entregas agregadas de efectivo por rango
router.get(
  '/cash-deliveries',
  auth.authenticateToken,
  requireMessengerRole,
  messengerController.getCashDeliveries
);

// GET /api/messenger/stats - Estadísticas del mensajero
router.get('/stats', auth.authenticateToken, requireMessengerRole, messengerController.getStats);

// POST /api/messenger/adhoc-payments - Registrar pago adhoc
router.post(
  '/adhoc-payments',
  auth.authenticateToken,
  requireMessengerRole,
  (req, res, next) => {
    messengerController.upload.single('evidence')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ success: false, message: err.message || 'Error al subir imagen' });
      }
      next();
    });
  },
  messengerController.registerAdhocPayment
);

module.exports = router;
