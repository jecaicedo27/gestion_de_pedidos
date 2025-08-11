const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const messengerController = require('../controllers/messengerController');

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
router.get('/orders', auth, requireMessengerRole, messengerController.getAssignedOrders);

// POST /api/messenger/orders/:orderId/accept - Aceptar pedido
router.post('/orders/:orderId/accept', auth, requireMessengerRole, messengerController.acceptOrder);

// POST /api/messenger/orders/:orderId/reject - Rechazar pedido
router.post('/orders/:orderId/reject', auth, requireMessengerRole, messengerController.rejectOrder);

// POST /api/messenger/orders/:orderId/start-delivery - Iniciar entrega
router.post('/orders/:orderId/start-delivery', auth, requireMessengerRole, messengerController.startDelivery);

// POST /api/messenger/orders/:orderId/complete - Completar entrega
router.post('/orders/:orderId/complete', auth, requireMessengerRole, messengerController.completeDelivery);

// POST /api/messenger/orders/:orderId/mark-failed - Marcar entrega como fallida
router.post('/orders/:orderId/mark-failed', auth, requireMessengerRole, messengerController.markDeliveryFailed);

// POST /api/messenger/orders/:orderId/upload-evidence - Subir evidencia fotográfica
router.post('/orders/:orderId/upload-evidence', 
  auth, 
  requireMessengerRole,
  messengerController.upload.single('photo'), 
  messengerController.uploadEvidence
);

// GET /api/messenger/daily-summary - Obtener resumen diario
router.get('/daily-summary', auth, requireMessengerRole, messengerController.getDailySummary);

module.exports = router;
