const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logisticsController');
const simplePdfController = require('../controllers/simplePdfController');
const { verifyToken } = require('../middleware/auth');

// Rutas sin autenticación para testing
router.post('/generate-guide-test', logisticsController.generateGuide);
router.post('/generate-guide-html', simplePdfController.generateSimpleGuide);

// Middleware de autenticación para el resto de rutas
router.use(verifyToken);

// Rutas para transportadoras
router.get('/carriers', logisticsController.getCarriers);

// Rutas para gestión de logística
router.get('/orders', logisticsController.getLogisticsOrders);
router.get('/stats', logisticsController.getLogisticsStats);

// Rutas para actualizar pedidos
router.put('/orders/:id/shipping-method', logisticsController.updateShippingMethod);
router.put('/orders/:id/ready', logisticsController.markOrderReady);

// Rutas para generar guías
router.get('/orders/:id/shipping-guide', logisticsController.generateShippingGuide);

// Nuevas rutas para el modal de logística
router.post('/process-order', logisticsController.processOrder);

// Ruta normal con autenticación
router.post('/generate-guide', logisticsController.generateGuide);

module.exports = router;
