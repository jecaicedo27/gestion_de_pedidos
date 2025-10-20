const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Importar todas las funciones del controlador
const {
  getSiigoCredentials,
  updateSiigoCredentials,
  testSiigoConnection,
  toggleSiigoCredentials,
  deleteSiigoCredentials
} = require('../controllers/siigoCredentialsController');

// Middleware para verificar que el usuario sea administrador
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren permisos de administrador.'
    });
  }
};

// Rutas con autenticación correcta
router.get('/', auth.authenticateToken, requireAdmin, getSiigoCredentials);
router.post('/', auth.authenticateToken, requireAdmin, updateSiigoCredentials);
router.put('/', auth.authenticateToken, requireAdmin, updateSiigoCredentials);
router.post('/test', auth.authenticateToken, requireAdmin, testSiigoConnection);
router.patch('/toggle', auth.authenticateToken, requireAdmin, toggleSiigoCredentials);
router.delete('/', auth.authenticateToken, requireAdmin, deleteSiigoCredentials);

module.exports = router;
