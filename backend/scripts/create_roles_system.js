#!/usr/bin/env node
/**
 * Crea el sistema de roles/permisos many-to-many y migra los roles actuales de users.role
 * Tablas:
 *  - roles(id, name, display_name, description, color, icon, created_at)
 *  - permissions(id, name, display_name, module, action, resource, created_at)
 *  - role_permissions(role_id, permission_id)
 *  - user_roles(user_id, role_id, assigned_at, expires_at, is_active)
 */
const { pool } = require('../config/database');

async function tableExists(conn, name) {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [name]);
  return rows.length > 0;
}

async function ensureTables(conn) {
  // roles
  await conn.query(`CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NULL,
    description VARCHAR(255) NULL,
    color VARCHAR(20) NULL,
    icon VARCHAR(50) NULL,
    created_at DATETIME NOT NULL DEFAULT NOW()
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // permissions
  await conn.query(`CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NULL,
    module VARCHAR(50) NULL,
    action VARCHAR(50) NULL,
    resource VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT NOW()
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // role_permissions
  await conn.query(`CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // user_roles
  await conn.query(`CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT NOW(),
    expires_at DATETIME NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function seedBaseRoles(conn) {
  const base = [
    { name: 'admin', display: 'Administrador', color: '#e74c3c', icon: 'Shield' },
    { name: 'facturador', display: 'Facturador', color: '#3498db', icon: 'FileText' },
    { name: 'cartera', display: 'Cartera', color: '#2ecc71', icon: 'CreditCard' },
    { name: 'logistica', display: 'Logística', color: '#f1c40f', icon: 'Package' },
    { name: 'mensajero', display: 'Mensajero', color: '#9b59b6', icon: 'Truck' }
  ];
  for (const r of base) {
    await conn.query(
      `INSERT IGNORE INTO roles (name, display_name, color, icon, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [r.name, r.display, r.color, r.icon]
    );
  }
}

async function migrateExistingUserRoles(conn) {
  // Obtener mapa nombre->id
  const [roles] = await conn.query('SELECT id, name FROM roles');
  const roleIdByName = new Map(roles.map(r => [r.name, r.id]));

  const [users] = await conn.query('SELECT id, role FROM users WHERE role IS NOT NULL AND TRIM(role) <> ""');
  for (const u of users) {
    const name = String(u.role || '').trim().toLowerCase();
    const roleId = roleIdByName.get(name);
    if (!roleId) continue; // rol no reconocido; ignorar
    await conn.query(
      `INSERT IGNORE INTO user_roles (user_id, role_id, assigned_at, is_active) VALUES (?, ?, NOW(), 1)`,
      [u.id, roleId]
    );
  }
}

async function main() {
  let conn;
  try {
    console.log('🚀 Creando sistema de roles/permisos...');
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await ensureTables(conn);
    await seedBaseRoles(conn);
    await migrateExistingUserRoles(conn);

    await conn.commit();
    console.log('✅ Sistema de roles creado y usuarios migrados.');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('❌ Error creando sistema de roles:', err.message);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
  }
}

main();
