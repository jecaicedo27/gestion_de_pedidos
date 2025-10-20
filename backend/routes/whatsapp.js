const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { verifyToken, verifyRole } = require('../middleware/auth');

/**
 * @route POST /api/whatsapp/webhook/status
 * @desc Webhook para actualizar estado de mensajes (desde Wapify)
 * @access Public (con validación de token en el body)
 */
router.post('/webhook/status', (req, res, next) => {
  // Validar token de webhook si es necesario
  const webhookToken = req.headers['x-webhook-token'] || req.body.webhook_token;
  const expectedToken = process.env.WAPIFY_WEBHOOK_TOKEN;
  
  if (expectedToken && webhookToken !== expectedToken) {
    return res.status(401).json({
      success: false,
      message: 'Token de webhook inválido'
    });
  }
  
  next();
}, whatsappController.updateMessageStatus);

// Middleware de autenticación para el resto de rutas
router.use(verifyToken);

/**
 * @route GET /api/whatsapp/connection/status
 * @desc Obtener estado de conexión con Wapify
 * @access Admin
 */
router.get('/connection/status', verifyRole(['admin']), whatsappController.getConnectionStatus);

/**
 * @route GET /api/whatsapp/stats
 * @desc Obtener estadísticas de WhatsApp
 * @access Admin
 */
router.get('/stats', verifyRole(['admin']), whatsappController.getWhatsAppStats);

/**
 * @route GET /api/whatsapp/notifications
 * @desc Obtener logs de notificaciones WhatsApp
 * @access Admin, Facturador
 */
router.get('/notifications', verifyRole(['admin', 'facturador']), whatsappController.getNotificationLogs);

/**
 * @route POST /api/whatsapp/test
 * @desc Enviar mensaje de prueba
 * @access Admin
 */
router.post('/test', verifyRole(['admin']), whatsappController.sendTestMessage);

/**
 * @route POST /api/whatsapp/notifications/:notificationId/retry
 * @desc Reintentar notificación fallida
 * @access Admin
 */
router.post('/notifications/:notificationId/retry', verifyRole(['admin']), whatsappController.retryNotification);

/**
 * @route POST /api/whatsapp/orders/:orderId/notify
 * @desc Enviar notificación manual para un pedido
 * @access Admin, Logistica, Mensajero
 */
router.post('/orders/:orderId/notify', verifyRole(['admin', 'logistica', 'mensajero']), whatsappController.sendOrderNotification);

/**
 * @route GET /api/whatsapp/templates
 * @desc Obtener templates de mensajes
 * @access Admin, Facturador
 */
router.get('/templates', verifyRole(['admin', 'facturador']), whatsappController.getMessageTemplates);

module.exports = router;
