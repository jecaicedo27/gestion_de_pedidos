const { query, transaction, pool } = require('../config/database');

// Utilidades
const tableExists = async (name) => {
  // Nota: MySQL/MariaDB no permite usar placeholders en sentencias SHOW.
  // Usamos escape del pool para evitar inyección y construir la consulta segura.
  const sql = `SHOW TABLES LIKE ${pool.escape(name)}`;
  const rows = await query(sql);
  return rows.length > 0;
};

// ============ USERS (administración básica) ============ //
exports.getUsers = async (req, res) => {
  try {
    // Construir SELECT dinámico según columnas existentes para máxima compatibilidad
    const wanted = ['id', 'username', 'email', 'role', 'full_name', 'phone', 'active', 'created_at', 'last_login'];
    let existingCols = new Set();
    try {
      const cols = await query('SHOW COLUMNS FROM users');
      existingCols = new Set(cols.map(c => c.Field || c.COLUMN_NAME || c.field));
    } catch (_) {
      // Si falla, usar mínimo indispensable
      existingCols = new Set(['id', 'username']);
    }

    const selectCols = wanted.filter(c => existingCols.has(c));
    if (!selectCols.includes('id')) selectCols.unshift('id');
    if (!selectCols.includes('username')) selectCols.splice(1, 0, 'username');

    const orderBy = existingCols.has('created_at') ? 'created_at' : 'id';

    const users = await query(`SELECT ${selectCols.join(', ')} FROM users ORDER BY ${orderBy} DESC`);
    res.json({ success: true, data: users });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role, full_name, phone } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'username y password son requeridos' });
    await query(
      `INSERT INTO users (username, email, password, role, full_name, phone, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [username, email || null, password, role || 'user', full_name || username, phone || null]
    );
    res.json({ success: true, message: 'Usuario creado' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    const map = { username: 'username', email: 'email', role: 'role', full_name: 'full_name', phone: 'phone', active: 'active' };
    for (const [k, dbk] of Object.entries(map)) {
      if (req.body[k] !== undefined) { fields.push(`${dbk} = ?`); values.push(req.body[k]); }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Sin cambios' });
    values.push(id);
    await query(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    res.json({ success: true, message: 'Usuario actualizado' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ============ ROLES ============ //
exports.getRoles = async (req, res) => {
  try {
    if (!(await tableExists('roles'))) return res.json({ success: true, data: [] });
    const rows = await query('SELECT id, name, display_name, description, color, icon, created_at FROM roles ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, display_name, description, color, icon } = req.body;
    await query(`INSERT INTO roles (name, display_name, description, color, icon, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [name, display_name || null, description || null, color || null, icon || null]);
    res.json({ success: true, message: 'Rol creado' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, description, color, icon } = req.body;
    await query(`UPDATE roles SET name = COALESCE(?, name), display_name = COALESCE(?, display_name), description = COALESCE(?, description), color = COALESCE(?, color), icon = COALESCE(?, icon) WHERE id = ?`,
      [name, display_name, description, color, icon, id]);
    res.json({ success: true, message: 'Rol actualizado' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM roles WHERE id = ?', [id]);
    res.json({ success: true, message: 'Rol eliminado' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ============ PERMISSIONS ============ //
exports.getPermissions = async (req, res) => {
  try {
    if (!(await tableExists('permissions'))) return res.json({ success: true, data: [] });
    const rows = await query('SELECT id, name, display_name, module, action, resource, created_at FROM permissions ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.createPermission = async (req, res) => {
  try {
    const { name, display_name, module, action, resource } = req.body;
    await query(`INSERT INTO permissions (name, display_name, module, action, resource, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [name, display_name || null, module || null, action || null, resource || null]);
    res.json({ success: true, message: 'Permiso creado' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, module, action, resource } = req.body;
    await query(`UPDATE permissions SET name = COALESCE(?, name), display_name = COALESCE(?, display_name), module = COALESCE(?, module), action = COALESCE(?, action), resource = COALESCE(?, resource) WHERE id = ?`,
      [name, display_name, module, action, resource, id]);
    res.json({ success: true, message: 'Permiso actualizado' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.deletePermission = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM permissions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Permiso eliminado' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ============ USER ROLES ============ //
exports.getUserRoles = async (req, res) => {
  try {
    // Si las tablas no existen, devolver vacío para evitar 500 en el frontend
    const hasUserRoles = await tableExists('user_roles');
    const hasRoles = await tableExists('roles');
    if (!hasUserRoles || !hasRoles) {
      return res.json({ success: true, data: [] });
    }

    const rows = await query(
      `SELECT ur.user_id, ur.role_id, r.name as role_name, r.display_name, ur.assigned_at, ur.expires_at, ur.is_active
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       ORDER BY ur.user_id`
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.assignRoleToUser = async (req, res) => {
  try {
    const { user_id, role_id, expires_at } = req.body;

    // Validar que el sistema de roles esté inicializado
    const hasUserRoles = await tableExists('user_roles');
    if (!hasUserRoles) {
      return res.status(400).json({ success: false, message: 'Sistema de roles no inicializado' });
    }

    await query(
      `INSERT INTO user_roles (user_id, role_id, assigned_at, expires_at, is_active) VALUES (?, ?, NOW(), ?, 1)
       ON DUPLICATE KEY UPDATE is_active = 1, expires_at = VALUES(expires_at)`,
      [user_id, role_id, expires_at || null]
    );
    res.json({ success: true, message: 'Rol asignado al usuario' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removeRoleFromUser = async (req, res) => {
  try {
    const { user_id, role_id } = req.body;

    // Validar que el sistema de roles esté inicializado
    const hasUserRoles = await tableExists('user_roles');
    if (!hasUserRoles) {
      return res.status(400).json({ success: false, message: 'Sistema de roles no inicializado' });
    }

    await query('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [user_id, role_id]);
    res.json({ success: true, message: 'Rol removido del usuario' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ============ ROLE PERMISSIONS ============ //
exports.getRolePermissions = async (req, res) => {
  try {
    // Si las tablas no existen, devolver vacío para evitar 500 en el frontend
    const hasRolePerms = await tableExists('role_permissions');
    const hasPerms = await tableExists('permissions');
    const hasRoles = await tableExists('roles');
    if (!hasRolePerms || !hasPerms || !hasRoles) {
      return res.json({ success: true, data: [] });
    }

    const rows = await query(
      `SELECT rp.role_id, rp.permission_id, r.name as role_name, p.name as permission_name
       FROM role_permissions rp JOIN roles r ON rp.role_id = r.id JOIN permissions p ON rp.permission_id = p.id
       ORDER BY r.name, p.name`
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.assignPermissionToRole = async (req, res) => {
  try {
    const { role_id, permission_id } = req.body;
    await query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [role_id, permission_id]);
    res.json({ success: true, message: 'Permiso asignado al rol' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.removePermissionFromRole = async (req, res) => {
  try {
    const { role_id, permission_id } = req.body;
    await query('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?', [role_id, permission_id]);
    res.json({ success: true, message: 'Permiso removido del rol' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ============ VISTAS / INFO ============ //
exports.getRoleViews = async (req, res) => {
  // Placeholder: se podría mapear vistas por rol desde BD; por ahora devolver vacío para compatibilidad
  res.json({ success: true, data: [] });
};

exports.updateRoleViews = async (req, res) => {
  res.json({ success: true, message: 'Configuración de vistas actualizada (placeholder)' });
};

exports.getUserComplete = async (req, res) => {
  try {
    const { id } = req.params;
    const [user] = await query('SELECT id, username, email, role, full_name, phone, active, created_at FROM users WHERE id = ?', [id]);
    const roles = await query(`SELECT r.id as role_id, r.name as role_name, r.display_name, ur.assigned_at, ur.expires_at, ur.is_active FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?`, [id]);
    res.json({ success: true, data: { user, roles } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getRoleComplete = async (req, res) => {
  try {
    const { id } = req.params;
    const [role] = await query('SELECT id, name, display_name, description, color, icon FROM roles WHERE id = ?', [id]);
    const permissions = await query(`SELECT p.id, p.name, p.display_name, p.module, p.action, p.resource FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id WHERE rp.role_id = ?`, [id]);
    res.json({ success: true, data: { role, permissions } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

exports.getSystemStats = async (req, res) => {
  try {
    const [usersCount] = await query('SELECT COUNT(*) as total FROM users');
    const roles = (await tableExists('roles')) ? await query('SELECT COUNT(*) as total FROM roles') : [{ total: 0 }];
    const perms = (await tableExists('permissions')) ? await query('SELECT COUNT(*) as total FROM permissions') : [{ total: 0 }];
    res.json({ success: true, data: { users: usersCount[0].total, roles: roles[0].total, permissions: perms[0].total } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
