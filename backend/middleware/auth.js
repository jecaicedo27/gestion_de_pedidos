const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware para verificar JWT con compatibilidad hacia atrás
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token de acceso requerido' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario existe y está activo
    // Compatibilidad: userId (nuevo) o id (anterior)
    const userId = decoded.userId || decoded.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido: ID de usuario no encontrado' 
      });
    }
    
    const users = await query(
      'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido o usuario no encontrado' 
      });
    }

    const user = users[0];

    // Verificar si el sistema de roles avanzado existe
    let hasAdvancedRoles = false;
    try {
      const rolesCheck = await query("SHOW TABLES LIKE 'roles'");
      hasAdvancedRoles = rolesCheck.length > 0;
    } catch (error) {
      console.log('Warning: No se pudo verificar sistema de roles avanzado:', error.message);
      hasAdvancedRoles = false;
    }

    if (hasAdvancedRoles) {
      try {
        // Cargar roles del sistema avanzado
        const userRoles = await query(`
          SELECT 
            r.id as role_id,
            r.name as role_name,
            r.display_name as role_display_name,
            r.color,
            r.icon,
            ur.assigned_at,
            ur.expires_at
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = ? AND ur.is_active = 1
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          ORDER BY ur.assigned_at ASC
        `, [user.id]);

        // Cargar permisos del usuario a través de sus roles
        const userPermissions = await query(`
          SELECT DISTINCT
            p.name as permission_name,
            p.display_name as permission_display_name,
            p.module,
            p.action,
            p.resource
          FROM user_roles ur
          JOIN role_permissions rp ON ur.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = ? AND ur.is_active = 1
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        `, [user.id]);

        // Determinar si es super admin
        const isSuperAdmin = userRoles.some(role => role.role_name === 'super_admin') || user.role === 'admin';

        // Enriquecer objeto user
        req.user = {
          ...user,
          roles: userRoles,
          permissions: userPermissions,
          isSuperAdmin,
          // Mantener compatibilidad con sistema anterior
          role: user.role || (userRoles.length > 0 ? userRoles[0].role_name : 'user')
        };
      } catch (rolesError) {
        console.log('Warning: Error cargando roles avanzados, usando sistema básico:', rolesError.message);
        // Fallback al sistema básico
        req.user = {
          ...user,
          roles: [],
          permissions: [],
          isSuperAdmin: user.role === 'admin',
          role: user.role
        };
      }
    } else {
      // Sistema básico - solo roles simples
      req.user = {
        ...user,
        roles: [],
        permissions: [],
        isSuperAdmin: user.role === 'admin',
        role: user.role
      };
    }

    next();
  } catch (error) {
    console.error('Error verificando token:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Token inválido' 
    });
  }
};

// Alias para compatibilidad
const verifyToken = authenticateToken;

// Middleware para verificar roles
const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para realizar esta acción' 
      });
    }

    next();
  };
};

// Middleware para verificar si es admin
const verifyAdmin = verifyRole(['admin']);

// Middleware para verificar permisos específicos
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }

    // Super admin tiene todos los permisos
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Si no hay sistema avanzado, usar roles básicos
    if (!req.user.permissions || req.user.permissions.length === 0) {
      // Fallback a verificación básica por rol
      const rolePermissions = {
        'admin': true,
        'facturador': permission.includes('billing') || permission.includes('orders'),
        'cartera': permission.includes('wallet') || permission.includes('orders'),
        'logistica': permission.includes('logistics') || permission.includes('orders') || permission.includes('packaging'), // ✅ Logística puede acceder a empaque
        'empaque': permission.includes('packaging') || permission.includes('orders'),
        'mensajero': permission.includes('logistics') || permission.includes('orders') // ✅ Mensajeros pueden actualizar pedidos para registrar entregas
      };
      
      if (rolePermissions[req.user.role]) {
        return next();
      }
      
      return res.status(403).json({ 
        success: false, 
        message: `No tienes el permiso requerido: ${permission}` 
      });
    }

    // Verificar si el usuario tiene el permiso específico
    const hasPermission = req.user.permissions.some(p => p.permission_name === permission);

    if (!hasPermission) {
      return res.status(403).json({ 
        success: false, 
        message: `No tienes el permiso requerido: ${permission}` 
      });
    }

    next();
  };
};

// Middleware para verificar si tiene cualquiera de los permisos dados
const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }

    // Super admin tiene todos los permisos
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Verificar si el usuario tiene al menos uno de los permisos
    const hasAnyPermission = permissions.some(permission => 
      req.user.permissions.some(p => p.permission_name === permission)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({ 
        success: false, 
        message: `No tienes ninguno de los permisos requeridos: ${permissions.join(', ')}` 
      });
    }

    next();
  };
};

// Middleware para verificar roles específicos del nuevo sistema
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuario no autenticado' 
      });
    }

    // Super admin puede hacer todo
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Verificar si el usuario tiene el rol específico
    const hasRole = req.user.roles.some(r => r.role_name === role);

    if (!hasRole) {
      return res.status(403).json({ 
        success: false, 
        message: `Se requiere el rol: ${role}` 
      });
    }

    next();
  };
};

// Middleware para verificar múltiples roles (compatibilidad)
const verifyRoles = {
  admin: verifyRole(['admin']),
  facturador: verifyRole(['admin', 'facturador']),
  cartera: verifyRole(['admin', 'cartera']),
  logistica: verifyRole(['admin', 'logistica']),
  mensajero: verifyRole(['admin', 'mensajero']),
  adminOrFacturador: verifyRole(['admin', 'facturador']),
  allRoles: verifyRole(['admin', 'facturador', 'cartera', 'logistica', 'mensajero'])
};

module.exports = {
  // Autenticación básica
  authenticateToken,
  verifyToken,
  
  // Verificación de roles (sistema anterior)
  verifyRole,
  verifyAdmin,
  verifyRoles,
  
  // Nuevo sistema de roles y permisos
  requirePermission,
  requireAnyPermission,
  requireRole
};
