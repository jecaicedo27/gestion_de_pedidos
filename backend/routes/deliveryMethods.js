const express = require('express');
const router = express.Router();
const deliveryMethodsController = require('../controllers/deliveryMethodsController');
const { verifyToken } = require('../middleware/auth');

// Middleware de autenticación para todas las rutas
router.use(verifyToken);

// Obtener todos los métodos de envío (solo admin)
router.get('/', async (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores pueden acceder a esta función.'
    });
  }
  
  await deliveryMethodsController.getAllMethods(req, res);
});

// Obtener métodos de envío activos (todos los roles autenticados)
router.get('/active', deliveryMethodsController.getActiveMethods);

// Crear nuevo método de envío (solo admin)
router.post('/', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores pueden crear métodos de envío.'
    });
  }
  
  await deliveryMethodsController.createMethod(req, res);
});

// Actualizar método de envío (solo admin)
router.put('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores pueden actualizar métodos de envío.'
    });
  }
  
  await deliveryMethodsController.updateMethod(req, res);
});

// Eliminar método de envío (solo admin)
router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores pueden eliminar métodos de envío.'
    });
  }
  
  await deliveryMethodsController.deleteMethod(req, res);
});

// Cambiar estado de método de envío (solo admin)
router.patch('/:id/toggle-status', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores pueden cambiar el estado de métodos de envío.'
    });
  }
  
  await deliveryMethodsController.toggleStatus(req, res);
});

// Actualizar orden de métodos (solo admin)
router.patch('/order', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores pueden reordenar métodos de envío.'
    });
  }
  
  await deliveryMethodsController.updateOrder(req, res);
});

module.exports = router;
