const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shippingController');
const { verifyToken, verifyRole } = require('../middleware/auth');

// Middleware de autenticación para todas las rutas
router.use(verifyToken);

/**
 * @route GET /api/shipping/companies/active
 * @desc Obtener transportadoras activas
 * @access Logistica, Admin
 */
router.get('/companies/active', verifyRole(['admin', 'logistica']), shippingController.getActiveShippingCompanies);

/**
 * @route GET /api/shipping/companies
 * @desc Obtener todas las transportadoras (admin)
 * @access Admin
 */
router.get('/companies', verifyRole(['admin']), shippingController.getAllShippingCompanies);

/**
 * @route POST /api/shipping/validate-guide
 * @desc Validar formato de número de guía
 * @access Logistica, Admin
 */
router.post('/validate-guide', verifyRole(['admin', 'logistica']), shippingController.validateGuideFormat);

/**
 * @route POST /api/shipping/upload-image
 * @desc Subir imagen de guía
 * @access Logistica, Admin
 */
router.post('/upload-image', verifyRole(['admin', 'logistica']), shippingController.uploadGuideImage);

/**
 * @route GET /api/shipping/sender-config
 * @desc Obtener configuración del remitente
 * @access Logistica, Admin
 */
router.get('/sender-config', verifyRole(['admin', 'logistica']), shippingController.getSenderConfiguration);

/**
 * @route POST /api/shipping/guides
 * @desc Crear guía de envío manual
 * @access Logistica, Admin
 */
router.post('/guides', verifyRole(['admin', 'logistica']), shippingController.createShippingGuide);

/**
 * @route GET /api/shipping/guides
 * @desc Obtener guías de envío con filtros
 * @access Logistica, Admin
 */
router.get('/guides', verifyRole(['admin', 'logistica']), shippingController.getShippingGuides);

/**
 * @route GET /api/shipping/guides/:id
 * @desc Obtener guía por ID
 * @access Logistica, Admin
 */
router.get('/guides/:id', verifyRole(['admin', 'logistica']), shippingController.getShippingGuideById);

/**
 * @route PUT /api/shipping/guides/:id/status
 * @desc Actualizar estado de guía
 * @access Logistica, Admin
 */
router.put('/guides/:id/status', verifyRole(['admin', 'logistica']), shippingController.updateGuideStatus);

/**
 * @route GET /api/shipping/orders/:orderId/guides
 * @desc Obtener guías por pedido
 * @access Logistica, Admin
 */
router.get('/orders/:orderId/guides', verifyRole(['admin', 'logistica']), shippingController.getGuidesByOrder);

/**
 * @route GET /api/shipping/stats
 * @desc Obtener estadísticas de envíos
 * @access Admin
 */
router.get('/stats', verifyRole(['admin']), shippingController.getShippingStats);

/**
 * @route PUT /api/shipping/companies/:id/status
 * @desc Activar/desactivar transportadora
 * @access Admin
 */
router.put('/companies/:id/status', verifyRole(['admin']), shippingController.toggleShippingCompanyStatus);

/**
 * @route PUT /api/shipping/companies/:id/tracking-url
 * @desc Actualizar URL de tracking
 * @access Admin
 */
router.put('/companies/:id/tracking-url', verifyRole(['admin']), shippingController.updateTrackingUrl);

module.exports = router;
