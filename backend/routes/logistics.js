const express = require('express');
const router = express.Router();

const logisticsController = require('../controllers/logisticsController');
const simplePdfController = require('../controllers/simplePdfController');
const messengerController = require('../controllers/messengerController');
const { verifyToken } = require('../middleware/auth');

// Rutas sin autenticación para testing
router.post('/generate-guide-test', logisticsController.generateGuide);
router.post('/generate-guide-html', simplePdfController.generateSimpleGuide);
router.get('/ready-for-delivery-test', logisticsController.getReadyForDeliveryOrders);

// Rutas públicas para transportadoras (sin autenticación)
router.get('/carriers', logisticsController.getCarriers);

// Middleware de autenticación para el resto de rutas
router.use(verifyToken);

// Rutas para gestión de logística
router.get('/orders', logisticsController.getLogisticsOrders);
router.get('/stats', logisticsController.getLogisticsStats);

// Rutas para actualizar pedidos
router.put('/orders/:id/delivery-method', logisticsController.updateDeliveryMethod);
router.put('/orders/:id/ready', logisticsController.markOrderReady);

// Rutas para generar guías
router.get('/orders/:id/shipping-guide', logisticsController.generateShippingGuide);

// Nuevas rutas para el modal de logística
router.post('/process-order', logisticsController.processOrder);

// Ruta normal con autenticación
router.post('/generate-guide', logisticsController.generateGuide);

// Rutas para pedidos listos para entrega
router.get('/ready-for-delivery', logisticsController.getReadyForDeliveryOrders);
router.post('/assign-messenger', logisticsController.assignMessenger);

// Nuevas rutas para acciones de entrega
router.post('/mark-delivered-carrier', logisticsController.markDeliveredToCarrier);
router.post('/mark-ready-pickup', logisticsController.markReadyForPickup);
router.post('/mark-in-delivery', logisticsController.markInDelivery);

// Recibir pago en bodega (con foto) para Recoge en Bodega
router.post(
  '/receive-pickup-payment',
  messengerController.upload.single('photo'),
  logisticsController.receivePickupPayment
);

module.exports = router;
