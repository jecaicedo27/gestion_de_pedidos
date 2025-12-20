const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const inventoryManagementController = require('../controllers/inventoryManagementController');

// Todas las rutas requieren autenticación y roles específicos
// Roles permitidos: admin, facturacion, cartera

// GET /api/inventory-management/view - Vista completa de inventario con configuraciones
router.get(
    '/view',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.getInventoryManagementView
);

// GET /api/inventory-management/products/:id/config - Obtener configuración de un producto
router.get(
    '/products/:id/config',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.getProductConfig
);

// PUT /api/inventory-management/products/:id/config - Actualizar configuración de un producto
router.put(
    '/products/:id/config',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.updateProductConfig
);

// POST /api/inventory-management/analyze - Analizar consumo histórico
router.post(
    '/analyze',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.analyzeConsumption
);

router.get(
    '/kpis',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.getInventoryKPIs
);

// POST /api/inventory-management/calculate-abc - Calcular clasificación ABC
router.post(
    '/calculate-abc',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.calculateABC
);

// GET /api/inventory-management/export-excel - Exportar inventario a Excel
router.get(
    '/export-excel',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.exportInventoryToExcel
);

// POST /api/inventory-management/generate-purchase-order - Generar Orden de Compra
router.post(
    '/generate-purchase-order',
    auth.authenticateToken,
    auth.verifyRole(['admin', 'facturacion', 'cartera']),
    inventoryManagementController.generatePurchaseOrder
);

module.exports = router;
