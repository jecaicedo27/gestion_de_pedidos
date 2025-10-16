const express = require('express');
const PackagingController = require('../controllers/packagingController');
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

// Verificar un item del checklist
router.put('/verify-item/:itemId', PackagingController.verifyItem);

// Verificar todos los items de un pedido de una vez
router.put('/verify-all/:orderId', PackagingController.verifyAllItems);

// Verificar item por código de barras
router.post('/verify-barcode/:orderId', PackagingController.verifyItemByBarcode);

// Finalizar empaque con control de calidad
router.post('/complete/:orderId', PackagingController.completePackaging);

// Obtener plantillas de empaque
router.get('/templates', PackagingController.getPackagingTemplates);

// Estadísticas de empaque
router.get('/stats', PackagingController.getPackagingStats);

// Obtener pedidos listos para entrega
router.get('/ready-for-delivery', PackagingController.getPedidosListosParaEntrega);

module.exports = router;
