const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const carteraController = require('../controllers/carteraController');
const treasuryController = require('../controllers/treasuryController');
const movementsController = require('../controllers/movementsController');

// Configuración de Multer para evidencias de reposición
const repositionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/reposition-evidences';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'reposition-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadRepositionEvidences = multer({
  storage: repositionStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});


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
        '/orders/:id/return-to-billing',
        '/deposits',
        '/deposits/candidates',
        '/deposits/:id/details',
        '/deposits/:id/close-siigo',
        '/cash-balance',
        '/movements',
        '/movements/:id/approve'
      ],
    });
  });
}

// Tesorería (Cartera): depósitos y balance
router.post(
  '/deposits',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.createDeposit
);

router.get(
  '/deposits',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.listDeposits
);

router.get(
  '/deposits/candidates',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.getDepositCandidates
);

// Detalle de consignación: facturas relacionadas (admin/cartera)
router.get(
  '/deposits/:id/details',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.getDepositDetails
);

// Marcar cierre en Siigo para una consignación
router.post(
  '/deposits/:id/close-siigo',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.closeDepositSiigo
);

// Subir/Actualizar evidencia de consignación
router.post(
  '/deposits/:id/evidence',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.updateDepositEvidence
);

router.get(
  '/cash-balance',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.getCashBalance
);

// Movimientos de Cartera: ingresos extra y retiros
router.post(
  '/movements',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  movementsController.createMovement
);

router.get(
  '/movements',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  movementsController.listMovements
);

// Aprobación de retiros (solo admin)
router.post(
  '/movements/:id/approve',
  auth.authenticateToken,
  auth.verifyRole(['admin']),
  movementsController.approveMovement
);

// Auditoría (admin y cartera)
router.get(
  '/audit/base-changes',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.listBaseChanges
);

router.get(
  '/audit/deposits',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  treasuryController.listDeposits
);

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

/**
 * POST /api/cartera/orders/:id/return-to-billing - Devolver pedido a Facturación
 */
router.post(
  '/orders/:id/return-to-billing',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.returnToBilling
);

// POST /api/cartera/orders/:id/close-siigo - Cerrar en Siigo (marcado interno)
router.post(
  '/orders/:id/close-siigo',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.closeOrderInSiigo
);

// GET /api/cartera/pending-siigo-close - Listado de pedidos sin cerrar en Siigo
router.get(
  '/pending-siigo-close',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getPendingSiigoClose
);

// GET /api/cartera/reposicion-orders - Listado de pedidos de reposición
router.get(
  '/reposicion-orders',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'facturacion', 'admin']),
  carteraController.getReposicionOrders
);

// POST /api/cartera/orders/:id/complete-manufacturer-reposition - Marcar reposición como completada
router.post(
  '/orders/:id/complete-manufacturer-reposition',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'facturacion', 'admin']),
  uploadRepositionEvidences.array('evidences', 10), // Max 10 archivos
  carteraController.completeManufacturerReposition
);

// GET /api/cartera/tags - Listado de tags disponibles
router.get(
  '/tags',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.getTags
);

// POST /api/cartera/adhoc-payments/:id/accept - Aceptar pago adhoc
router.post(
  '/adhoc-payments/:id/accept',
  auth.authenticateToken,
  auth.verifyRole(['cartera', 'admin']),
  carteraController.acceptAdhocPayment
);

module.exports = router;
