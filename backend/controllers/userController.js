const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

// Obtener todos los usuarios (admin, facturador, y logistica solo para mensajeros)
const getUsers = async (req, res) => {
  try {
const { page = 1, limit = 10, role, active } = req.query;
const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
const pageNum = Math.max(1, parseInt(page) || 1);
const offsetNum = (pageNum - 1) * limitNum;

    // Verificar permisos según el rol del usuario autenticado
    if (req.user.role === 'logistica') {
      // Los usuarios de logística solo pueden ver mensajeros
      if (!role || role !== 'mensajero') {
        return res.status(403).json({
          success: false,
          message: 'Los usuarios de logística solo pueden consultar mensajeros'
        });
      }
    }

    // Construir query con filtros
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

if (active !== undefined) {
  whereClause += ' AND active = ?';
  const activeVal = (active === 'true' || active === '1' || active === 1);
  params.push(activeVal ? 1 : 0);
}

    // Obtener usuarios con paginación
    const users = await query(
      `SELECT id, username, email, role, full_name, phone, active, created_at, last_login 
       FROM users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offsetNum]
    );

    // Obtener total de usuarios para paginación
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = totalResult[0].total;

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener usuario por ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.validatedParams;

    const users = await query(
      'SELECT id, username, email, role, full_name, phone, active, created_at, last_login FROM users WHERE id = ?',
      [id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear nuevo usuario (solo admin)
const createUser = async (req, res) => {
  try {
    console.log('🔍 CREAR USUARIO - Datos recibidos:', req.validatedData);
    
    const { username, email, password, role, fullName, full_name, phone } = req.validatedData;
    
    // Manejar tanto fullName como full_name, usar username si no se proporciona nombre
    const finalFullName = fullName || full_name || username;
    const finalEmail = (email && email.trim() !== '') ? email.trim() : null;
    const finalPhone = (phone && phone.trim() !== '') ? phone.trim() : null;

    console.log('🔍 Valores procesados:', {
      username,
      finalEmail,
      role,
      finalFullName,
      finalPhone
    });

    // Verificar si el username ya existe  
    let existingUserQuery = 'SELECT id FROM users WHERE username = ?';
    const queryParams = [username];
    
    if (finalEmail) {
      existingUserQuery += ' OR email = ?';
      queryParams.push(finalEmail);
    }
    
    console.log('🔍 Query verificación:', existingUserQuery, queryParams);
    const existingUser = await query(existingUserQuery, queryParams);

    if (existingUser.length > 0) {
      console.log('❌ Usuario existente encontrado');
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario o email ya existe'
      });
    }

    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('✅ Contraseña encriptada');

    // Crear usuario
    const insertParams = [username, finalEmail, hashedPassword, role, finalFullName, finalPhone];
    console.log('🔍 Parámetros INSERT:', insertParams);
    
    const result = await query(
      `INSERT INTO users (username, email, password, role, full_name, phone, active, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, true, NOW())`,
      insertParams
    );

    console.log('✅ Usuario insertado con ID:', result.insertId);

    // Obtener el usuario creado
    const newUser = await query(
      'SELECT id, username, email, role, full_name, phone, active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    console.log('✅ Usuario creado exitosamente:', newUser[0]);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: newUser[0]
    });

  } catch (error) {
    console.error('❌ ERROR DETALLADO creando usuario:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      details: error.message
    });
  }
};

// Actualizar usuario (solo admin)
const updateUser = async (req, res) => {
  try {
    console.log('🔄 UPDATE USER - Iniciando actualización');
    console.log('📋 Parámetros validados:', req.validatedParams);
    console.log('📋 Datos validados:', req.validatedData);
    
    const { id } = req.validatedParams;
    const updateData = req.validatedData;

    // Verificar que el usuario existe
    console.log('🔍 Buscando usuario con ID:', id);
    const existingUser = await query(
      'SELECT id, username, email FROM users WHERE id = ?',
      [id]
    );

    if (!existingUser.length) {
      console.log('❌ Usuario no encontrado con ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    console.log('✅ Usuario existente encontrado:', existingUser[0]);

    // Si se está actualizando el email, verificar que no exista
    if (updateData.email && updateData.email !== existingUser[0].email) {
      console.log('🔍 Verificando email duplicado:', updateData.email);
      const emailExists = await query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [updateData.email, id]
      );

      if (emailExists.length > 0) {
        console.log('❌ Email ya existe:', updateData.email);
        return res.status(400).json({
          success: false,
          message: 'El email ya está en uso por otro usuario'
        });
      }
      console.log('✅ Email disponible');
    }

    // Construir query de actualización dinámicamente
    const updateFields = [];
    const updateValues = [];

    console.log('🔧 Construyendo query dinámico...');
    Object.keys(updateData).forEach(key => {
      console.log(`   Procesando campo: ${key} = ${updateData[key]}`);
      if (updateData[key] !== undefined) {
        const fieldName = key === 'fullName' ? 'full_name' : key;
        updateFields.push(`${fieldName} = ?`);
        updateValues.push(updateData[key]);
        console.log(`   ✅ Agregado: ${fieldName} = ${updateData[key]}`);
      }
    });

    if (updateFields.length === 0) {
      console.log('❌ No hay campos para actualizar');
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const finalQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log('📝 Query final:', finalQuery);
    console.log('📝 Valores finales:', updateValues);

    // Actualizar usuario
    console.log('🚀 Ejecutando query UPDATE...');
    const updateResult = await query(finalQuery, updateValues);
    console.log('✅ Query UPDATE ejecutado. Resultado:', updateResult);

    // Obtener usuario actualizado
    console.log('🔍 Obteniendo usuario actualizado...');
    const updatedUser = await query(
      'SELECT id, username, email, role, full_name, phone, active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    console.log('📋 Usuario actualizado obtenido:', updatedUser[0]);

    console.log('🎉 Actualización completada exitosamente');
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: updatedUser[0]
    });

  } catch (error) {
    console.error('❌ ERROR DETALLADO actualizando usuario:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      details: error.message
    });
  }
};

// Eliminar usuario (solo admin)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.validatedParams;

    // Verificar que el usuario existe
    const existingUser = await query(
      'SELECT id, username FROM users WHERE id = ?',
      [id]
    );

    if (!existingUser.length) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // No permitir eliminar el propio usuario
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
    }

    // Verificar si el usuario tiene pedidos asociados
    const userOrders = await query(
      'SELECT COUNT(*) as count FROM orders WHERE created_by = ?',
      [id]
    );

    if (userOrders[0].count > 0) {
      // En lugar de eliminar, desactivar el usuario
      await query(
        'UPDATE users SET active = false, updated_at = NOW() WHERE id = ?',
        [id]
      );

      res.json({
        success: true,
        message: 'Usuario desactivado exitosamente (tiene pedidos asociados)'
      });
    } else {
      // Eliminar usuario si no tiene pedidos
      await query('DELETE FROM users WHERE id = ?', [id]);

      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
    }

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Resetear contraseña de usuario (solo admin)
const resetPassword = async (req, res) => {
  try {
    const { id } = req.validatedParams;

    console.log('🔐 RESET PASSWORD - ID:', id);

    // Verificar que el usuario existe
    const existingUser = await query(
      'SELECT id, username FROM users WHERE id = ?',
      [id]
    );

    if (!existingUser.length) {
      console.log('❌ Usuario no encontrado con ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('✅ Usuario encontrado:', existingUser[0].username);

    // Generar contraseña temporal automáticamente
    const generateTempPassword = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let tempPassword = '';
      for (let i = 0; i < 8; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return tempPassword;
    };

    const tempPassword = generateTempPassword();
    console.log('🔑 Contraseña temporal generada:', tempPassword);

    // Encriptar nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

    console.log('🔒 Contraseña encriptada generada');

    // Actualizar contraseña
    await query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );

    console.log('✅ Contraseña actualizada en base de datos');

    res.json({
      success: true,
      message: 'Contraseña reseteada exitosamente',
      newPassword: tempPassword
    });

  } catch (error) {
    console.error('❌ Error reseteando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Cambiar contraseña personalizada (solo admin)
const changePassword = async (req, res) => {
  try {
    const { id } = req.validatedParams;
    const { password } = req.validatedData;

    console.log('🔐 CHANGE PASSWORD - ID:', id);

    // Verificar que el usuario existe
    const existingUser = await query(
      'SELECT id, username FROM users WHERE id = ?',
      [id]
    );

    if (!existingUser.length) {
      console.log('❌ Usuario no encontrado con ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('✅ Usuario encontrado:', existingUser[0].username);

    // Encriptar nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    console.log('🔒 Contraseña encriptada generada');

    // Actualizar contraseña
    await query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );

    console.log('✅ Contraseña actualizada en base de datos');

    res.json({
      success: true,
      message: `Contraseña cambiada exitosamente para ${existingUser[0].username}`
    });

  } catch (error) {
    console.error('❌ Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  changePassword
};
