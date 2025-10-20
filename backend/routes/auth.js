const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const authController = require('../controllers/authController');

// POST /api/auth/login - Iniciar sesión
router.post('/login', 
  validate(schemas.login),
  authController.login
);

// GET /api/auth/profile - Obtener perfil del usuario actual
router.get('/profile', 
  verifyToken,
  authController.getProfile
);

// POST /api/auth/change-password - Cambiar contraseña
router.post('/change-password', 
  verifyToken,
  authController.changePassword
);

// GET /api/auth/verify - Verificar token
router.get('/verify', 
  verifyToken,
  authController.verifyToken
);

// GET /api/auth/verify-direct - Verificar token directo (sin middleware, para debugging)
router.get('/verify-direct', 
  authController.verifyTokenDirect
);

module.exports = router;
