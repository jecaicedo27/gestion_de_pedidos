const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Middleware para verificar que el usuario sea super_admin
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Acceso denegado. Se requieren permisos de Super Administrador.' });
  }
};

// Rutas para gestión de usuarios
router.get('/users', authenticateToken, requireSuperAdmin, adminController.getUsers);
router.post('/users', authenticateToken, requireSuperAdmin, adminController.createUser);
router.put('/users/:id', authenticateToken, requireSuperAdmin, adminController.updateUser);
router.delete('/users/:id', authenticateToken, requireSuperAdmin, adminController.deleteUser);

// Rutas para gestión de roles
router.get('/roles', authenticateToken, requireSuperAdmin, adminController.getRoles);
router.post('/roles', authenticateToken, requireSuperAdmin, adminController.createRole);
router.put('/roles/:id', authenticateToken, requireSuperAdmin, adminController.updateRole);
router.delete('/roles/:id', authenticateToken, requireSuperAdmin, adminController.deleteRole);

// Rutas para gestión de permisos
router.get('/permissions', authenticateToken, requireSuperAdmin, adminController.getPermissions);
router.post('/permissions', authenticateToken, requireSuperAdmin, adminController.createPermission);
router.put('/permissions/:id', authenticateToken, requireSuperAdmin, adminController.updatePermission);
router.delete('/permissions/:id', authenticateToken, requireSuperAdmin, adminController.deletePermission);

// Rutas para relaciones usuario-rol
router.get('/user-roles', authenticateToken, requireSuperAdmin, adminController.getUserRoles);
router.post('/assign-role', authenticateToken, requireSuperAdmin, adminController.assignRoleToUser);
router.post('/remove-role', authenticateToken, requireSuperAdmin, adminController.removeRoleFromUser);

// Rutas para relaciones rol-permiso
router.get('/role-permissions', authenticateToken, requireSuperAdmin, adminController.getRolePermissions);
router.post('/assign-permission', authenticateToken, requireSuperAdmin, adminController.assignPermissionToRole);
router.post('/remove-permission', authenticateToken, requireSuperAdmin, adminController.removePermissionFromRole);

// Rutas para configuración de vistas
router.get('/role-views', authenticateToken, requireSuperAdmin, adminController.getRoleViews);
router.post('/role-views', authenticateToken, requireSuperAdmin, adminController.updateRoleViews);

// Rutas para obtener información completa del usuario
router.get('/user/:id/complete', authenticateToken, requireSuperAdmin, adminController.getUserComplete);
router.get('/role/:id/complete', authenticateToken, requireSuperAdmin, adminController.getRoleComplete);

// Rutas para estadísticas del sistema
router.get('/stats', authenticateToken, requireSuperAdmin, adminController.getSystemStats);

module.exports = router;
