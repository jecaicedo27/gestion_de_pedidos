const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, verifyRoles } = require('../middleware/auth');
const { validate, validateParams, schemas, paramSchemas } = require('../middleware/validation');
const orderController = require('../controllers/orderController');

// Configuración de Multer para guías de transporte
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/guides';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'guide-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

// GET /api/orders - Obtener todos los pedidos con filtros
router.get('/',
  verifyToken,
  verifyRoles.allRoles,
  orderController.getOrders
);

// GET /api/orders/stats - Obtener estadísticas de pedidos
router.get('/stats',
  verifyToken,
  verifyRoles.allRoles,
  orderController.getOrderStats
);

// GET /api/orders/dashboard-stats - Obtener estadísticas avanzadas del dashboard
router.get('/dashboard-stats',
  verifyToken,
  verifyRoles.allRoles,
  orderController.getDashboardStats
);

// GET /api/orders/tags - Obtener todas las etiquetas únicas
router.get('/tags',
  verifyToken,
  verifyRoles.allRoles,
  orderController.getTags
);

// GET /api/orders/pending-guides - Obtener pedidos pendientes de guía (Logística y Admin)
router.get('/pending-guides',
  verifyToken,
  verifyRoles.logistica,
  orderController.getPendingTransportGuides
);

// GET /api/orders/:id - Obtener pedido por ID
router.get('/:id',
  verifyToken,
  verifyRoles.allRoles,
  validateParams(paramSchemas.id),
  orderController.getOrderById
);

// POST /api/orders/:id/reload-from-siigo - Recargar datos del pedido desde SIIGO
router.post('/:id/reload-from-siigo',
  verifyToken,
  verifyRoles.allRoles,
  validateParams(paramSchemas.id),
  orderController.reloadFromSiigo
);

// POST /api/orders/:id/sync - Sincronización inteligente desde SIIGO (preserva verificaciones)
router.post('/:id/sync',
  verifyToken,
  verifyRoles.allRoles, // Permitir a empaque/logística sincronizar
  validateParams(paramSchemas.id),
  orderController.syncOrderFromSiigo
);

// GET /api/orders/:id/timeline - Línea de tiempo del pedido
router.get('/:id/timeline',
  verifyToken,
  verifyRoles.allRoles,
  validateParams(paramSchemas.id),
  orderController.getOrderTimeline
);

// POST /api/orders - Crear nuevo pedido
router.post('/',
  verifyToken,
  verifyRoles.facturador,
  validate(schemas.createOrder),
  orderController.createOrder
);

// PUT /api/orders/:id - Actualizar pedido
router.put('/:id',
  verifyToken,
  verifyRoles.allRoles,
  validateParams(paramSchemas.id),
  validate(schemas.updateOrder),
  orderController.updateOrder
);

// DELETE /api/orders/:id - Eliminar pedido (admin y facturador)
router.delete('/:id',
  verifyToken,
  verifyRoles.adminOrFacturador,
  validateParams(paramSchemas.id),
  orderController.deleteOrder
);

// DELETE /api/orders/:id/siigo - Eliminar pedido SIIGO para permitir reimportación (admin)
router.delete('/:id/siigo',
  verifyToken,
  verifyRoles.admin,
  validateParams(paramSchemas.id),
  orderController.deleteSiigoOrder
);

// DELETE /api/orders (bulk) - Eliminar TODOS los pedidos (solo admin, requiere confirm)
router.delete('/',
  verifyToken,
  verifyRoles.admin,
  orderController.deleteAllOrders
);

// POST /api/orders/reset-all - Alternativa segura para entornos donde DELETE /orders pueda colisionar
router.post('/reset-all',
  verifyToken,
  verifyRoles.admin,
  orderController.deleteAllOrders
);

// POST /api/orders/:id/assign - Asignar pedido a mensajero
router.post('/:id/assign',
  verifyToken,
  verifyRoles.logistica,
  validateParams(paramSchemas.id),
  orderController.assignOrder
);

/**
 * Marcar pedido como "gestión especial" (Facturación/Admin)
 * Body: { reason: string }
 */
router.post('/:id/mark-special',
  verifyToken,
  verifyRoles.adminOrFacturador,
  validateParams(paramSchemas.id),
  orderController.markSpecialManaged
);

/**
 * Cancelación por cliente (Admin/Facturación)
 */
router.post('/:id/cancel-by-customer',
  verifyToken,
  verifyRoles.adminOrFacturador,
  validateParams(paramSchemas.id),
  orderController.cancelByCustomer
);

/**
 * Enterado de cancelación (Logística)
 */
router.post('/:id/logistics-ack-cancel',
  verifyToken,
  verifyRoles.logistica,
  validateParams(paramSchemas.id),
  orderController.logisticsAckCancel
);

// POST /api/orders/:id/transport-guide - Subir guía de transporte
router.post('/:id/transport-guide',
  verifyToken,
  verifyRoles.logistica,
  validateParams(paramSchemas.id),
  upload.array('guides', 10),
  orderController.uploadTransportGuide
);

module.exports = router;
