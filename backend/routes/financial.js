
const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financialController');
const { authenticateToken } = require('../middleware/auth');

// Middleware para asegurar que solo roles autorizados vean esto (Admin, Cartera?)
// Por ahora abierto a usuarios autenticados, pero idealmente restringido
router.use(authenticateToken);

// Rutas
router.get('/equity-history', financialController.getEquityHistory);
router.get('/siigo-income', financialController.getSiigoIncome);
router.post('/snapshot', financialController.saveDailySnapshot);

module.exports = router;
