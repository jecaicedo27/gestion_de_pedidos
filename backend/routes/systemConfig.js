const express = require('express');
const router = express.Router();
const systemConfigController = require('../controllers/systemConfigController');
const { authenticateToken } = require('../middleware/auth');

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

/**
 * @route GET /api/system-config
 * @desc Obtener toda la configuración del sistema
 * @access Private (Admin)
 */
router.get('/', systemConfigController.getSystemConfig);

/**
 * @route GET /api/system-config/siigo-start-date
 * @desc Obtener configuración específica de fecha de inicio SIIGO
 * @access Private (Admin)
 */
router.get('/siigo-start-date', systemConfigController.getSiigoStartDate);

/**
 * @route PUT /api/system-config
 * @desc Actualizar múltiples configuraciones del sistema
 * @access Private (Admin)
 */
router.put('/', systemConfigController.updateMultipleConfigs);

/**
 * @route PUT /api/system-config/siigo-start-date
 * @desc Actualizar configuración de fecha de inicio SIIGO
 * @access Private (Admin)
 */
router.put('/siigo-start-date', systemConfigController.updateSiigoStartDate);

/**
 * @route PUT /api/system-config/:key
 * @desc Actualizar una configuración específica del sistema
 * @access Private (Admin)
 */
router.put('/:key', systemConfigController.updateSystemConfig);

module.exports = router;
