const express = require('express');
const router = express.Router();
const { authenticateToken, verifyToken } = require('../middleware/auth');
const { siigoLimiter, generalLimiter } = require('../middleware/rateLimiter');
const QuotationController = require('../controllers/quotationController');

// Middleware de autenticación para todas las rutas - usar verifyToken para compatibilidad
router.use(verifyToken);

// Rutas de clientes
router.get('/customers/search', QuotationController.searchCustomers);
router.post('/customers/sync', siigoLimiter, QuotationController.syncCustomers);
router.get('/customers/stats', QuotationController.getCustomerStats);

// Rutas de cotizaciones
router.get('/stats', QuotationController.getStats);
router.get('/', QuotationController.getQuotations);
router.post('/', QuotationController.createQuotation);
router.get('/:quotationId', QuotationController.getQuotation);

// Procesamiento con ChatGPT
router.post('/process-natural-order', generalLimiter, QuotationController.processNaturalLanguageOrder);
router.post('/process-image-order', generalLimiter, QuotationController.processImageOrder);
router.post('/:quotationId/process', generalLimiter, QuotationController.processWithChatGPT);

// Crear factura desde cotización
router.post('/create-invoice', generalLimiter, QuotationController.createInvoice);

// Crear cotización directamente en SIIGO
router.post('/create-quotation-siigo', generalLimiter, QuotationController.createSiigoQuotation);

// Crear factura directa desde inventario
router.post('/create-invoice-direct', generalLimiter, QuotationController.createDirectInvoice);

// Crear factura directamente en SIIGO con ChatGPT
router.post('/create-siigo-invoice-with-chatgpt', generalLimiter, QuotationController.createSiigoInvoiceWithChatGPT);

// Gestión de items
router.put('/:quotationId/items/:itemId', QuotationController.updateQuotationItem);

// Generación en SIIGO
router.post('/:quotationId/generate-siigo', siigoLimiter, QuotationController.generateSiigoQuotation);

// Estadísticas de ChatGPT
router.get('/admin/chatgpt-stats', QuotationController.getChatGPTStats);

// Sincronización
router.post('/sync', siigoLimiter, QuotationController.syncQuotations);

module.exports = router;
