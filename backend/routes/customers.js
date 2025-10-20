const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const auth = require('../middleware/auth');

// Middleware de autenticación para todas las rutas
router.use(auth.authenticateToken);

// Rutas específicas para actualización desde SIIGO
router.post('/update-all-from-siigo', customerController.updateAllCustomers);
router.post('/update-single/:siigoCustomerId', customerController.updateSingleCustomer);

// Obtener estadísticas de clientes
router.get('/stats', customerController.getCustomerStats);

// CRUD básico para clientes
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomer);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
