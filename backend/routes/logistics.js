const express = require('express');
const router = express.Router();

const logisticsController = require('../controllers/logisticsController');
const simplePdfController = require('../controllers/simplePdfController');
const messengerController = require('../controllers/messengerController');
const { verifyToken } = require('../middleware/auth');

// Middleware opcional: solo procesa multer si el Content-Type es multipart/form-data
const optionalPhotoUpload = (req, res, next) => {
  try {
    const ct = String(req.headers['content-type'] || '');
    if (ct.toLowerCase().startsWith('multipart/form-data')) {
      return messengerController.upload.single('photo')(req, res, next);
    }
    return next();
  } catch (e) {
    return next(e);
  }
};

// Rutas sin autenticación para testing
router.post('/generate-guide-test', logisticsController.generateGuide);
router.get('/generate-guide-html', simplePdfController.generateSimpleGuide);
router.post('/generate-guide-html', simplePdfController.generateSimpleGuide);
router.get('/ready-for-delivery-test', logisticsController.getReadyForDeliveryOrders);

// Rutas públicas para transportadoras (sin autenticación)
router.get('/carriers', logisticsController.getCarriers);

// Middleware de autenticación para el resto de rutas
router.use(verifyToken);

// Rutas para gestión de logística
router.get('/orders', logisticsController.getLogisticsOrders);
router.get('/stats', logisticsController.getLogisticsStats);

/* Rutas para actualizar pedidos */
router.put('/orders/:id/delivery-method', logisticsController.updateDeliveryMethod);
router.put('/orders/:id/ready', logisticsController.markOrderReady);
router.post('/orders/:id/change-carrier', logisticsController.changeOrderCarrier);

// Rutas para generar guías
router.get('/orders/:id/shipping-guide', logisticsController.generateShippingGuide);

// Nuevas rutas para el modal de logística
router.post('/process-order', logisticsController.processOrder);

// Ruta normal con autenticación
router.post('/generate-guide', logisticsController.generateGuide);

/* Rutas para pedidos listos para entrega y planillas */
router.get('/ready-for-delivery', logisticsController.getReadyForDeliveryOrders);
router.get('/carrier-manifest', logisticsController.generateCarrierManifest);
router.get('/local-manifest', logisticsController.generateLocalManifest);
router.post('/assign-messenger', logisticsController.assignMessenger);
router.post('/return-to-packaging', logisticsController.returnToPackaging);

// Nuevas rutas para acciones de entrega
router.post('/mark-delivered-carrier', logisticsController.markDeliveredToCarrier);
router.post('/mark-ready-pickup', logisticsController.markReadyForPickup);
router.post('/mark-in-delivery', logisticsController.markInDelivery);
router.post('/mark-pickup-delivered', logisticsController.markPickupDelivered);

// Recibir pago en bodega (con foto) para Recoge en Bodega
router.post(
  '/receive-pickup-payment',
  optionalPhotoUpload,
  logisticsController.receivePickupPayment
);

// Subir evidencia de pago (Cartera)
router.post(
  '/orders/:id/upload-evidence',
  optionalPhotoUpload,
  logisticsController.uploadPaymentEvidence
);

// Conductores externos
router.get('/external-drivers', logisticsController.getExternalDrivers);
router.post('/external-drivers', logisticsController.createExternalDriver);

module.exports = router;
