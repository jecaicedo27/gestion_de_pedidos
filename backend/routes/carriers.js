const express = require('express');
const router = express.Router();
const carrierController = require('../controllers/carrierController');
const { authenticateToken } = require('../middleware/auth');

// Rutas públicas (para dropdowns en formularios)
router.get('/active', carrierController.getActive);

// Rutas protegidas (requieren autenticación)
router.use(authenticateToken);

// CRUD de transportadoras
router.get('/', carrierController.getAll);
router.get('/:id', carrierController.getById);
router.post('/', carrierController.create);
router.put('/:id', carrierController.update);
router.delete('/:id', carrierController.delete);
router.patch('/:id/toggle', carrierController.toggleActive);

module.exports = router;
