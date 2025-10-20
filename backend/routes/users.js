const express = require('express');
const router = express.Router();
const { verifyToken, verifyRoles } = require('../middleware/auth');
const { validate, validateParams, schemas, paramSchemas } = require('../middleware/validation');
const userController = require('../controllers/userController');

// GET /api/users - Obtener todos los usuarios (admin, facturador, y logistica para mensajeros)
router.get('/', 
  verifyToken,
  verifyRoles.allRoles, // Permitir todos los roles autenticados, el controller filtrará por permisos
  userController.getUsers
);

// GET /api/users/:id - Obtener usuario por ID (admin y facturador)
router.get('/:id', 
  verifyToken,
  verifyRoles.adminOrFacturador,
  validateParams(paramSchemas.id),
  userController.getUserById
);

// POST /api/users - Crear nuevo usuario (admin y facturador)
router.post('/', 
  verifyToken,
  verifyRoles.adminOrFacturador,
  validate(schemas.createUser),
  userController.createUser
);

// PUT /api/users/:id - Actualizar usuario (admin y facturador)
router.put('/:id', 
  (req, res, next) => {
    console.log('🚀 [USERS ROUTE] PUT /:id - Iniciando request');
    console.log('📋 Body recibido:', req.body);
    console.log('📋 Params recibidos:', req.params);
    console.log('📋 Headers:', req.headers.authorization ? 'Token presente' : 'Sin token');
    next();
  },
  verifyToken,
  (req, res, next) => {
    console.log('✅ [USERS ROUTE] Token verificado exitosamente');
    console.log('👤 Usuario autenticado:', req.user);
    next();
  },
  verifyRoles.adminOrFacturador,
  (req, res, next) => {
    console.log('✅ [USERS ROUTE] Roles verificados exitosamente');
    next();
  },
  validateParams(paramSchemas.id),
  (req, res, next) => {
    console.log('✅ [USERS ROUTE] Parámetros validados exitosamente');
    console.log('📋 req.validatedParams:', req.validatedParams);
    next();
  },
  validate(schemas.updateUser),
  (req, res, next) => {
    console.log('✅ [USERS ROUTE] Datos validados exitosamente');
    console.log('📋 req.validatedData:', req.validatedData);
    console.log('🎯 [USERS ROUTE] Pasando al controlador updateUser...');
    next();
  },
  userController.updateUser
);

// DELETE /api/users/:id - Eliminar usuario (admin y facturador)
router.delete('/:id', 
  verifyToken,
  verifyRoles.adminOrFacturador,
  validateParams(paramSchemas.id),
  userController.deleteUser
);

// POST /api/users/:id/reset-password - Resetear contraseña de usuario (admin y facturador)
router.post('/:id/reset-password', 
  verifyToken,
  verifyRoles.adminOrFacturador,
  validateParams(paramSchemas.id),
  userController.resetPassword
);

// POST /api/users/:id/change-password - Cambiar contraseña personalizada (admin y facturador)
router.post('/:id/change-password', 
  verifyToken,
  verifyRoles.adminOrFacturador,
  validateParams(paramSchemas.id),
  validate(schemas.changePassword),
  userController.changePassword
);

module.exports = router;
