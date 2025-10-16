const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');
const { body } = require('express-validator');

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// GET /api/products - Obtener todos los productos
router.get('/', productController.getAllProducts);

// POST /api/products/load-from-siigo - Cargar productos desde SIIGO
router.post('/load-from-siigo', productController.loadProductsFromSiigo);

// GET /api/products/stats - Obtener estadísticas de productos
router.get('/stats', productController.getProductStats);

// GET /api/products/categories - Obtener todas las categorías (dinámicas desde SIIGO)
router.get('/categories', productController.getCategories);

// POST /api/products/sync-categories - Sincronizar categorías desde SIIGO
router.post('/sync-categories', productController.syncCategories);

// GET /api/products/categories/sync-stats - Estadísticas de sincronización de categorías
router.get('/categories/sync-stats', productController.getCategorySyncStats);

// GET /api/products/barcode/:barcode - Buscar producto por código de barras
router.get('/barcode/:barcode', productController.findByBarcode);

// POST /api/products/verify-barcode - Verificar código de barras para empaque
router.post('/verify-barcode', [
    body('barcode').notEmpty().withMessage('Código de barras es requerido'),
    body('order_id').isInt({ min: 1 }).withMessage('ID de pedido válido es requerido')
], productController.verifyBarcodeForPackaging);

// POST /api/products/sync-inventory - Sincronizar inventario real desde SIIGO
router.post('/sync-inventory', async (req, res) => {
  try {
    console.log('🔄 Iniciando sincronización de inventario desde API...');
    
    const { syncInventoryFromSiigo } = require('../../sync_inventory_from_siigo');
    const result = await syncInventoryFromSiigo();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Inventario sincronizado exitosamente: ${result.totalUpdated} productos actualizados`,
        data: {
          totalUpdated: result.totalUpdated,
          summary: result.summary
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error sincronizando inventario desde SIIGO',
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Error en sync-inventory endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

module.exports = router;
