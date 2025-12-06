const express = require('express');
const PackagingController = require('../controllers/packagingController');
const MessengerController = require('../controllers/messengerController');
const { verifyToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación y permisos de empaque
router.use(verifyToken);
router.use(requirePermission('packaging'));

// Obtener pedidos pendientes de empaque
router.get('/pending-orders', PackagingController.getPendingOrders);

// Iniciar proceso de empaque para un pedido
router.post('/start/:orderId', PackagingController.startPackaging);

// Obtener checklist de empaque para un pedido
router.get('/checklist/:orderId', PackagingController.getPackagingChecklist);

/**
 * Verificar un item del checklist (completo o manual)
 */
router.put('/verify-item/:itemId', PackagingController.verifyItem);

/**
 * Guardar progreso parcial (escaneadas/contadas) sin completar verificación
 * Body: { scanned_count: number, required_scans?: number }
 */
router.put('/partial/:itemId', PackagingController.savePartialProgress);

// Verificar todos los items de un pedido de una vez
router.put('/verify-all/:orderId', PackagingController.verifyAllItems);

// Verificar item por código de barras
router.post('/verify-barcode/:orderId', PackagingController.verifyItemByBarcode);

 // Finalizar empaque con control de calidad
router.post('/complete/:orderId', PackagingController.completePackaging);

 // Galería global de evidencias (agrupada por pedido, con filtros)
 router.get('/evidence-gallery', PackagingController.listEvidenceGallery);

 // Listar evidencias de empaque para mostrar galería
 router.get('/evidence/:orderId', PackagingController.listPackagingEvidence);

 // Subir evidencia fotográfica de empaque (múltiples fotos)
 // Campo: photos[] (multipart/form-data)
 // Nota: aumentar maxCount para evitar "Unexpected field" cuando se suben más de 10 fotos
 router.post('/evidence/:orderId', MessengerController.upload.array('photos', 100), PackagingController.uploadPackagingEvidence);

// Obtener plantillas de empaque
router.get('/templates', PackagingController.getPackagingTemplates);

// Estadísticas de empaque
router.get('/stats', PackagingController.getPackagingStats);

// Obtener pedidos listos para entrega
router.get('/ready-for-delivery', PackagingController.getPedidosListosParaEntrega);

// Lock de empaque
router.post('/lock/:orderId', PackagingController.acquirePackagingLock);
router.post('/heartbeat/:orderId', PackagingController.heartbeatPackagingLock);
router.post('/pause/:orderId', PackagingController.pausePackagingLock);
router.post('/block/:orderId', PackagingController.blockPackagingLock);
router.post('/unlock/:orderId', PackagingController.unlockPackagingAdmin);
router.get('/lock-status/:orderId', PackagingController.getPackagingLockStatus);

module.exports = router;
