const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
    getCustomerCredits,
    getCustomerCreditById,
    createCustomerCredit,
    updateCustomerCredit,
    deleteCustomerCredit,
    findCustomerByNitOrName,
    validateCreditForOrder
} = require('../controllers/customerCreditController');

// Middleware de autenticación para todas las rutas
router.use(verifyToken);

// Rutas para gestión de crédito de clientes (solo admin)
router.get('/', (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Solo administradores pueden gestionar créditos de clientes.'
        });
    }
    next();
}, getCustomerCredits);

router.get('/search', findCustomerByNitOrName);

router.get('/:id', (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Solo administradores pueden ver detalles de crédito.'
        });
    }
    next();
}, getCustomerCreditById);

router.post('/', (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Solo administradores pueden crear clientes de crédito.'
        });
    }
    next();
}, createCustomerCredit);

router.put('/:id', (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Solo administradores pueden actualizar créditos de clientes.'
        });
    }
    next();
}, updateCustomerCredit);

router.delete('/:id', (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Solo administradores pueden eliminar clientes de crédito.'
        });
    }
    next();
}, deleteCustomerCredit);

// Ruta para validar crédito (accesible por cartera y admin)
router.post('/validate', (req, res, next) => {
    if (!['admin', 'cartera'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Solo administradores y cartera pueden validar créditos.'
        });
    }
    next();
}, validateCreditForOrder);

module.exports = router;
