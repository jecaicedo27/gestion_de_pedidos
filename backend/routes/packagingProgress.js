const express = require('express');
const { verifyToken, verifyRole } = require('../middleware/auth');
const PackagingController = require('../controllers/packagingController');

const router = express.Router();

// Solo lectura de progreso de empaque para Admin, Facturación y Logística
router.use(verifyToken);

// Listado de pedidos en empaque (sin filtros)
// Usa el query existente en PackagingController.getPendingOrders
router.get('/list', verifyRole(['admin', 'facturador', 'logistica', 'cartera']), PackagingController.getPendingOrders);

/* Snapshot de empaque por pedido (solo lectura) */
router.get('/:orderId/snapshot', verifyRole(['admin', 'facturador', 'logistica', 'cartera']), PackagingController.getPackagingSnapshot);

/* Checklist de empaque por pedido (solo lectura) */
router.get('/:orderId/checklist', verifyRole(['admin', 'facturador', 'logistica', 'cartera']), PackagingController.getPackagingChecklist);

module.exports = router;
