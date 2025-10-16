const express = require('express');
const router = express.Router();
const { verifyToken, verifyRoles } = require('../middleware/auth');
const { validate, validateParams, schemas, paramSchemas } = require('../middleware/validation');
const orderController = require('../controllers/orderController');

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

// GET /api/orders/:id - Obtener pedido por ID
router.get('/:id', 
  verifyToken,
  verifyRoles.allRoles,
  validateParams(paramSchemas.id),
  orderController.getOrderById
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

// POST /api/orders/:id/assign - Asignar pedido a mensajero
router.post('/:id/assign', 
  verifyToken,
  verifyRoles.logistica,
  validateParams(paramSchemas.id),
  orderController.assignOrder
);

module.exports = router;
