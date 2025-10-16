const db = require('../config/database');
const bcrypt = require('bcryptjs');

class AdminController {
  // ===== GESTIÓN DE USUARIOS =====
  
  async getUsers(req, res) {
    try {
      const [users] = await db.execute(`
        SELECT 
          u.id, u.username, u.email, u.role, u.created_at, u.updated_at,
          GROUP_CONCAT(r.display_name) as roles_display
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = 1
        LEFT JOIN roles r ON ur.role_id = r.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `);

      res.json({ success: true, users });
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async createUser(req, res) {
    try {
      const { username, email, password, roles = [] } = req.body;

      // Validar datos requeridos
      if (!username || !email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username, email y password son requeridos' 
        });
      }

      // Verificar si el usuario ya existe
      const [existingUser] = await db.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      );

      if (existingUser.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Usuario o email ya existe' 
        });
      }

      // Hashear password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const [result] = await db.execute(`
        INSERT INTO users (username, email, password, role, created_at) 
        VALUES (?, ?, ?, 'user', NOW())
      `, [username, email, hashedPassword]);

      const userId = result.insertId;

      // Asignar roles si se proporcionaron
      if (roles.length > 0) {
        for (const roleId of roles) {
          await db.execute(`
            INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
            VALUES (?, ?, ?, NOW())
          `, [userId, roleId, req.user.id]);
        }
      }

      res.json({ success: true, message: 'Usuario creado exitosamente', userId });
    } catch (error) {
      console.error('Error creando usuario:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { username, email, password } = req.body;

      let query = 'UPDATE users SET username = ?, email = ?, updated_at = NOW()';
      let params = [username, email];

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += ', password = ?';
        params.push(hashedPassword);
      }

      query += ' WHERE id = ?';
      params.push(id);

      await db.execute(query, params);

      res.json({ success: true, message: 'Usuario actualizado exitosamente' });
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // No permitir eliminar el propio usuario
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ 
          success: false, 
          message: 'No puedes eliminar tu propio usuario' 
        });
      }

      await db.execute('DELETE FROM users WHERE id = ?', [id]);

      res.json({ success: true, message: 'Usuario eliminado exitosamente' });
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ===== GESTIÓN DE ROLES =====

  async getRoles(req, res) {
    try {
      const [roles] = await db.execute(`
        SELECT 
          r.*,
          COUNT(ur.user_id) as user_count,
          COUNT(rp.permission_id) as permission_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = 1
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        WHERE r.is_active = 1
        GROUP BY r.id
        ORDER BY r.created_at ASC
      `);

      res.json({ success: true, roles });
    } catch (error) {
      console.error('Error obteniendo roles:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async createRole(req, res) {
    try {
      const { name, display_name, description, color, icon } = req.body;

      if (!name || !display_name) {
        return res.status(400).json({ 
          success: false, 
          message: 'Name y display_name son requeridos' 
        });
      }

      const [result] = await db.execute(`
        INSERT INTO roles (name, display_name, description, color, icon, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [name, display_name, description, color || '#6B7280', icon || 'user']);

      res.json({ success: true, message: 'Rol creado exitosamente', roleId: result.insertId });
    } catch (error) {
      console.error('Error creando rol:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { display_name, description, color, icon } = req.body;

      await db.execute(`
        UPDATE roles 
        SET display_name = ?, description = ?, color = ?, icon = ?, updated_at = NOW()
        WHERE id = ?
      `, [display_name, description, color, icon, id]);

      res.json({ success: true, message: 'Rol actualizado exitosamente' });
    } catch (error) {
      console.error('Error actualizando rol:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async deleteRole(req, res) {
    try {
      const { id } = req.params;

      // Verificar que no haya usuarios asignados a este rol
      const [users] = await db.execute(
        'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ? AND is_active = 1',
        [id]
      );

      if (users[0].count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se puede eliminar un rol que tiene usuarios asignados' 
        });
      }

      await db.execute('UPDATE roles SET is_active = 0 WHERE id = ?', [id]);

      res.json({ success: true, message: 'Rol eliminado exitosamente' });
    } catch (error) {
      console.error('Error eliminando rol:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ===== GESTIÓN DE PERMISOS =====

  async getPermissions(req, res) {
    try {
      const [permissions] = await db.execute(`
        SELECT 
          p.*,
          COUNT(rp.role_id) as role_count
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id
        GROUP BY p.id
        ORDER BY p.module, p.action
      `);

      res.json({ success: true, permissions });
    } catch (error) {
      console.error('Error obteniendo permisos:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async createPermission(req, res) {
    try {
      const { name, display_name, module, action, resource, description } = req.body;

      if (!name || !display_name || !module || !action) {
        return res.status(400).json({ 
          success: false, 
          message: 'Name, display_name, module y action son requeridos' 
        });
      }

      const [result] = await db.execute(`
        INSERT INTO permissions (name, display_name, module, action, resource, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [name, display_name, module, action, resource, description]);

      res.json({ success: true, message: 'Permiso creado exitosamente', permissionId: result.insertId });
    } catch (error) {
      console.error('Error creando permiso:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async updatePermission(req, res) {
    try {
      const { id } = req.params;
      const { display_name, module, action, resource, description } = req.body;

      await db.execute(`
        UPDATE permissions 
        SET display_name = ?, module = ?, action = ?, resource = ?, description = ?
        WHERE id = ?
      `, [display_name, module, action, resource, description, id]);

      res.json({ success: true, message: 'Permiso actualizado exitosamente' });
    } catch (error) {
      console.error('Error actualizando permiso:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async deletePermission(req, res) {
    try {
      const { id } = req.params;

      // Verificar que no haya roles usando este permiso
      const [roles] = await db.execute(
        'SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = ?',
        [id]
      );

      if (roles[0].count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se puede eliminar un permiso que está asignado a roles' 
        });
      }

      await db.execute('DELETE FROM permissions WHERE id = ?', [id]);

      res.json({ success: true, message: 'Permiso eliminado exitosamente' });
    } catch (error) {
      console.error('Error eliminando permiso:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ===== GESTIÓN DE RELACIONES USUARIO-ROL =====

  async getUserRoles(req, res) {
    try {
      const [userRoles] = await db.execute(`
        SELECT 
          ur.*,
          u.username,
          r.name as role_name,
          r.display_name as role_display_name,
          assigner.username as assigned_by_username
        FROM user_roles ur
        JOIN users u ON ur.user_id = u.id
        JOIN roles r ON ur.role_id = r.id
        LEFT JOIN users assigner ON ur.assigned_by = assigner.id
        WHERE ur.is_active = 1
        ORDER BY ur.assigned_at DESC
      `);

      res.json({ success: true, userRoles });
    } catch (error) {
      console.error('Error obteniendo user_roles:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async assignRoleToUser(req, res) {
    try {
      const { userId, roleId } = req.body;

      if (!userId || !roleId) {
        return res.status(400).json({ 
          success: false, 
          message: 'userId y roleId son requeridos' 
        });
      }

      // Verificar si ya existe la asignación
      const [existing] = await db.execute(
        'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
        [userId, roleId]
      );

      if (existing.length > 0) {
        // Si existe pero está inactiva, activarla
        await db.execute(`
          UPDATE user_roles 
          SET is_active = 1, assigned_by = ?, assigned_at = NOW()
          WHERE user_id = ? AND role_id = ?
        `, [req.user.id, userId, roleId]);
      } else {
        // Crear nueva asignación
        await db.execute(`
          INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
          VALUES (?, ?, ?, NOW())
        `, [userId, roleId, req.user.id]);
      }

      res.json({ success: true, message: 'Rol asignado exitosamente' });
    } catch (error) {
      console.error('Error asignando rol:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async removeRoleFromUser(req, res) {
    try {
      const { userId, roleId } = req.body;

      await db.execute(`
        UPDATE user_roles 
        SET is_active = 0 
        WHERE user_id = ? AND role_id = ?
      `, [userId, roleId]);

      res.json({ success: true, message: 'Rol removido exitosamente' });
    } catch (error) {
      console.error('Error removiendo rol:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ===== GESTIÓN DE RELACIONES ROL-PERMISO =====

  async getRolePermissions(req, res) {
    try {
      const [rolePermissions] = await db.execute(`
        SELECT 
          rp.*,
          r.name as role_name,
          r.display_name as role_display_name,
          p.name as permission_name,
          p.display_name as permission_display_name,
          p.module,
          p.action,
          granter.username as granted_by_username
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        LEFT JOIN users granter ON rp.granted_by = granter.id
        ORDER BY rp.granted_at DESC
      `);

      res.json({ success: true, rolePermissions });
    } catch (error) {
      console.error('Error obteniendo role_permissions:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async assignPermissionToRole(req, res) {
    try {
      const { roleId, permissionId } = req.body;

      if (!roleId || !permissionId) {
        return res.status(400).json({ 
          success: false, 
          message: 'roleId y permissionId son requeridos' 
        });
      }

      // Verificar si ya existe la asignación
      const [existing] = await db.execute(
        'SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?',
        [roleId, permissionId]
      );

      if (existing.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Este permiso ya está asignado al rol' 
        });
      }

      await db.execute(`
        INSERT INTO role_permissions (role_id, permission_id, granted_by, granted_at)
        VALUES (?, ?, ?, NOW())
      `, [roleId, permissionId, req.user.id]);

      res.json({ success: true, message: 'Permiso asignado exitosamente' });
    } catch (error) {
      console.error('Error asignando permiso:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async removePermissionFromRole(req, res) {
    try {
      const { roleId, permissionId } = req.body;

      await db.execute(`
        DELETE FROM role_permissions 
        WHERE role_id = ? AND permission_id = ?
      `, [roleId, permissionId]);

      res.json({ success: true, message: 'Permiso removido exitosamente' });
    } catch (error) {
      console.error('Error removiendo permiso:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ===== GESTIÓN DE VISTAS POR ROL =====

  async getRoleViews(req, res) {
    try {
      const [roleViews] = await db.execute(`
        SELECT 
          rv.*,
          r.name as role_name,
          r.display_name as role_display_name
        FROM role_views rv
        JOIN roles r ON rv.role_id = r.id
        ORDER BY r.name, rv.sort_order
      `);

      res.json({ success: true, roleViews });
    } catch (error) {
      console.error('Error obteniendo role_views:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async updateRoleViews(req, res) {
    try {
      const { roleId, views } = req.body;

      // Eliminar vistas existentes para este rol
      await db.execute('DELETE FROM role_views WHERE role_id = ?', [roleId]);

      // Insertar nuevas vistas
      for (const view of views) {
        await db.execute(`
          INSERT INTO role_views (role_id, view_name, is_visible, sort_order, custom_config)
          VALUES (?, ?, ?, ?, ?)
        `, [roleId, view.view_name, view.is_visible, view.sort_order, JSON.stringify(view.custom_config || {})]);
      }

      res.json({ success: true, message: 'Vistas actualizadas exitosamente' });
    } catch (error) {
      console.error('Error actualizando vistas:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ===== INFORMACIÓN COMPLETA =====

  async getUserComplete(req, res) {
    try {
      const { id } = req.params;

      const [user] = await db.execute(`
        SELECT u.*, 
          GROUP_CONCAT(DISTINCT r.display_name) as roles,
          GROUP_CONCAT(DISTINCT p.display_name) as permissions
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = 1
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = ?
        GROUP BY u.id
      `, [id]);

      if (user.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      res.json({ success: true, user: user[0] });
    } catch (error) {
      console.error('Error obteniendo usuario completo:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  async getRoleComplete(req, res) {
    try {
      const { id } = req.params;

      const [role] = await db.execute(`
        SELECT r.*, 
          GROUP_CONCAT(DISTINCT u.username) as users,
          GROUP_CONCAT(DISTINCT p.display_name) as permissions
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = 1
        LEFT JOIN users u ON ur.user_id = u.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE r.id = ?
        GROUP BY r.id
      `, [id]);

      if (role.length === 0) {
        return res.status(404).json({ success: false, message: 'Rol no encontrado' });
      }

      res.json({ success: true, role: role[0] });
    } catch (error) {
      console.error('Error obteniendo rol completo:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ===== ESTADÍSTICAS DEL SISTEMA =====

  async getSystemStats(req, res) {
    try {
      const [stats] = await db.execute(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM roles WHERE is_active = 1) as total_roles,
          (SELECT COUNT(*) FROM permissions) as total_permissions,
          (SELECT COUNT(*) FROM user_roles WHERE is_active = 1) as total_user_roles,
          (SELECT COUNT(*) FROM role_permissions) as total_role_permissions,
          (SELECT COUNT(*) FROM role_views) as total_role_views
      `);

      res.json({ success: true, stats: stats[0] });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
}

module.exports = new AdminController();
