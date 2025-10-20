const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const carteraController = require('../controllers/carteraController');

// Todas las rutas requieren autenticación y rol de cartera o admin
// Debug: listado rápido de rutas (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  console.log('📦 Cartera router cargado');
  router.get('/_debug', (req, res) => {
    res.json({
      ok: true,
      routes: [
        '/pending',
        '/handovers',
        '/handovers/:id',
        '/handovers/:id/close',
        '/handovers/:id/receipt',
        '/cash-register/:id/accept',
        '/cash-register/:id/receipt',
        '/handovers/bodega/:date',
        '/handovers/bodega/:date/receipt',
      ],
    });
  });
}

// GET /api/cartera/pending - Órdenes entregadas con cobro pendientes de aceptación por cartera
router.get(
  '/pending',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getPendingCashOrders
);

// GET /api/cartera/handovers - Listado de actas/cierres de caja por mensajero
router.get(
  '/handovers',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getHandovers
);

// GET /api/cartera/handovers/:id - Detalle de un acta/cierre con sus ítems
router.get(
  '/handovers/:id',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getHandoverDetails
);

// POST /api/cartera/handovers/:id/close - Cerrar acta (marca completed o discrepancy)
router.post(
  '/handovers/:id/close',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.closeHandover
);

// GET /api/cartera/handovers/:id/receipt - Recibo HTML imprimible del acta
router.get(
  '/handovers/:id/receipt',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getHandoverReceipt
);

/**
 * POST /api/cartera/cash-register/:id/accept - Aceptar registro de caja de bodega
 */
router.post(
  '/cash-register/:id/accept',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.acceptCashRegister
);

/**
 * GET /api/cartera/cash-register/:id/receipt - Recibo imprimible del registro de bodega
 */
router.get(
  '/cash-register/:id/receipt',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getCashRegisterReceipt
);

/**
 * GET /api/cartera/handovers/bodega/:date - Detalle por día de bodega (YYYY-MM-DD)
 */
router.get(
  '/handovers/bodega/:date',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getBodegaHandoverDetails
);

/**
 * GET /api/cartera/handovers/bodega/:date/receipt - Recibo imprimible del consolidado de bodega
 */
router.get(
  '/handovers/bodega/:date/receipt',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getBodegaHandoverReceipt
);

module.exports = router;
