const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Generar token JWT
const generateToken = (userId, username, role) => {
  return jwt.sign(
    { userId, username, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Login de usuario
const login = async (req, res) => {
  try {
    const { username, password } = req.validatedData;

    // Buscar usuario por username
    const users = await query(
      'SELECT id, username, email, password, role, full_name, active FROM users WHERE username = ?',
      [username]
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const user = users[0];

    // Verificar si el usuario está activo
    if (!user.active) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo. Contacta al administrador'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken(user.id, user.username, user.role);

    // Actualizar último login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Respuesta exitosa (sin incluir password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: userWithoutPassword,
        token
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener perfil del usuario actual (incluye roles/permisos si existen tablas avanzadas)
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const users = await query(
      'SELECT id, username, email, role, full_name, phone, created_at, last_login FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = users[0];

    // Intentar cargar roles/permissions avanzados
    let roles = [];
    let permissions = [];
    try {
      const rolesCheck = await query("SHOW TABLES LIKE 'roles'");
      if (rolesCheck.length > 0) {
        roles = await query(
          `SELECT r.id as role_id, r.name as role_name, r.display_name as role_display_name, r.color, r.icon
           FROM user_roles ur
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = ? AND ur.is_active = 1 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
           ORDER BY ur.assigned_at ASC`,
          [userId]
        );
        permissions = await query(
          `SELECT DISTINCT p.name as permission_name, p.display_name as permission_display_name, p.module, p.action, p.resource
           FROM user_roles ur
           JOIN role_permissions rp ON ur.role_id = rp.role_id
           JOIN permissions p ON rp.permission_id = p.id
           WHERE ur.user_id = ? AND ur.is_active = 1 AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`,
          [userId]
        );
      }
    } catch (e) {
      // Ignorar si no existen
    }

    res.json({
      success: true,
      data: {
        ...user,
        roles,
        permissions
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Cambiar contraseña
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validar datos de entrada
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Obtener contraseña actual del usuario
    const users = await query(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Encriptar nueva contraseña
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar contraseña
    await query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedNewPassword, userId]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Verificar token (para validar sesión)
const verifyToken = async (req, res) => {
  try {
    // Si llegamos aquí, el token es válido (verificado por middleware)
    res.json({
      success: true,
      message: 'Token válido',
      user: req.user
    });
  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Verificar token directamente (sin middleware, para debugging)
const verifyTokenDirect = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token vacío'
      });
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuario en base de datos
    const users = await query(
      'SELECT id, username, email, role, full_name, active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = users[0];

    if (!user.active) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }

    res.json({
      success: true,
      message: 'Token válido (directo)',
      user: user
    });

  } catch (error) {
    console.error('Error verificando token directo:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  login,
  getProfile,
  changePassword,
  verifyToken,
  verifyTokenDirect
};
