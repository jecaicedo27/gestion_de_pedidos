-- Sistema Avanzado de Roles y Permisos
-- Permite que un usuario tenga múltiples roles y un rol sea usado por múltiples usuarios

-- 1. Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6B7280',
    icon VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_active (is_active)
);

-- 2. Tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL, -- 'orders', 'users', 'logistics', 'billing', etc.
    action VARCHAR(50) NOT NULL, -- 'view', 'create', 'edit', 'delete', 'manage', etc.
    resource VARCHAR(50), -- 'all', 'own', 'assigned', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_module (module),
    INDEX idx_action (action),
    INDEX idx_name (name)
);

-- 3. Tabla pivot: usuarios - roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_by INT, -- ID del usuario que asignó este rol
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, -- Para roles temporales
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_role (user_id, role_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id),
    INDEX idx_active (is_active)
);

-- 4. Tabla pivot: roles - permisos (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INT, -- ID del usuario que otorgó este permiso
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_role_permission (role_id, permission_id),
    INDEX idx_role_id (role_id),
    INDEX idx_permission_id (permission_id)
);

-- 5. Tabla de configuración de vistas por rol
CREATE TABLE IF NOT EXISTS role_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    view_name VARCHAR(100) NOT NULL, -- 'dashboard', 'orders', 'logistics', etc.
    is_visible BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    custom_config JSON, -- Configuraciones específicas de la vista
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_view (role_id, view_name),
    INDEX idx_role_id (role_id),
    INDEX idx_view_name (view_name)
);

-- 6. Insertar roles predefinidos
INSERT INTO roles (name, display_name, description, color, icon) VALUES
('super_admin', 'Super Administrador', 'Acceso completo al sistema', '#DC2626', 'shield'),
('admin', 'Administrador', 'Gestión general del sistema', '#7C3AED', 'settings'),
('facturador', 'Facturador', 'Gestión de facturación y pedidos', '#059669', 'file-text'),
('cartera', 'Cartera', 'Gestión de pagos y validaciones', '#0891B2', 'credit-card'),
('logistica', 'Logística', 'Gestión de envíos y logística', '#EA580C', 'truck'),
('empaque', 'Empaque', 'Gestión de empaque y preparación', '#7C2D12', 'package'),
('mensajero', 'Mensajero', 'Gestión de entregas', '#16A34A', 'bike'),
('vendedor', 'Vendedor', 'Gestión de ventas', '#2563EB', 'user-check'),
('supervisor', 'Supervisor', 'Supervisión de procesos', '#9333EA', 'eye'),
('contabilidad', 'Contabilidad', 'Gestión contable y financiera', '#BE123C', 'calculator')
ON DUPLICATE KEY UPDATE 
    display_name = VALUES(display_name),
    description = VALUES(description),
    color = VALUES(color),
    icon = VALUES(icon);

-- 7. Insertar permisos predefinidos
INSERT INTO permissions (name, display_name, module, action, resource, description) VALUES
-- Dashboard
('view_dashboard', 'Ver Dashboard', 'dashboard', 'view', 'all', 'Acceso al panel principal'),
('view_analytics', 'Ver Analíticas', 'dashboard', 'view', 'analytics', 'Ver estadísticas y reportes'),

-- Pedidos
('view_orders', 'Ver Pedidos', 'orders', 'view', 'all', 'Ver lista de pedidos'),
('view_own_orders', 'Ver Propios Pedidos', 'orders', 'view', 'own', 'Ver solo pedidos propios'),
('create_orders', 'Crear Pedidos', 'orders', 'create', 'all', 'Crear nuevos pedidos'),
('edit_orders', 'Editar Pedidos', 'orders', 'edit', 'all', 'Modificar pedidos existentes'),
('delete_orders', 'Eliminar Pedidos', 'orders', 'delete', 'all', 'Eliminar pedidos'),
('change_order_status', 'Cambiar Estado Pedidos', 'orders', 'edit', 'status', 'Modificar estado de pedidos'),
('assign_orders', 'Asignar Pedidos', 'orders', 'edit', 'assignment', 'Asignar pedidos a usuarios'),

-- Usuarios
('view_users', 'Ver Usuarios', 'users', 'view', 'all', 'Ver lista de usuarios'),
('create_users', 'Crear Usuarios', 'users', 'create', 'all', 'Crear nuevos usuarios'),
('edit_users', 'Editar Usuarios', 'users', 'edit', 'all', 'Modificar usuarios'),
('delete_users', 'Eliminar Usuarios', 'users', 'delete', 'all', 'Eliminar usuarios'),
('manage_roles', 'Gestionar Roles', 'users', 'manage', 'roles', 'Asignar y quitar roles'),

-- Cartera
('view_wallet', 'Ver Cartera', 'wallet', 'view', 'all', 'Acceso a gestión de cartera'),
('validate_payments', 'Validar Pagos', 'wallet', 'validate', 'payments', 'Validar pagos de clientes'),
('reject_payments', 'Rechazar Pagos', 'wallet', 'reject', 'payments', 'Rechazar pagos'),

-- Logística
('view_logistics', 'Ver Logística', 'logistics', 'view', 'all', 'Acceso a gestión logística'),
('process_logistics', 'Procesar Logística', 'logistics', 'process', 'all', 'Procesar envíos'),
('generate_guides', 'Generar Guías', 'logistics', 'create', 'guides', 'Generar guías de envío'),

-- Empaque
('view_packaging', 'Ver Empaque', 'packaging', 'view', 'all', 'Acceso a gestión de empaque'),
('process_packaging', 'Procesar Empaque', 'packaging', 'process', 'all', 'Procesar empaque de pedidos'),

-- Facturación
('view_billing', 'Ver Facturación', 'billing', 'view', 'all', 'Acceso a facturación'),
('create_invoices', 'Crear Facturas', 'billing', 'create', 'invoices', 'Crear nuevas facturas'),
('siigo_integration', 'Integración SIIGO', 'billing', 'manage', 'siigo', 'Gestionar integración con SIIGO'),

-- Configuración
('view_config', 'Ver Configuración', 'config', 'view', 'all', 'Ver configuración del sistema'),
('edit_config', 'Editar Configuración', 'config', 'edit', 'all', 'Modificar configuración'),

-- Reportes
('view_reports', 'Ver Reportes', 'reports', 'view', 'all', 'Acceso a reportes'),
('export_data', 'Exportar Datos', 'reports', 'export', 'all', 'Exportar información')

ON DUPLICATE KEY UPDATE 
    display_name = VALUES(display_name),
    description = VALUES(description);

-- 8. Asignar permisos a roles
-- Super Admin: todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Admin: casi todos los permisos excepto super admin específicos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
AND p.name NOT IN ('manage_roles') -- Los super admin manejan roles
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Facturador
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'facturador'
AND p.name IN (
    'view_dashboard', 'view_orders', 'create_orders', 'edit_orders',
    'change_order_status', 'view_billing', 'create_invoices', 'siigo_integration'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Cartera
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'cartera'
AND p.name IN (
    'view_dashboard', 'view_orders', 'view_wallet', 'validate_payments', 'reject_payments'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Logística
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'logistica'
AND p.name IN (
    'view_dashboard', 'view_orders', 'change_order_status', 'assign_orders',
    'view_logistics', 'process_logistics', 'generate_guides', 'view_packaging', 'process_packaging'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Empaque
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'empaque'
AND p.name IN (
    'view_dashboard', 'view_orders', 'change_order_status',
    'view_packaging', 'process_packaging'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- Mensajero
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'mensajero'
AND p.name IN (
    'view_dashboard', 'view_own_orders', 'change_order_status'
)
ON DUPLICATE KEY UPDATE role_id = role_id;

-- 9. Configurar vistas por defecto para cada rol
INSERT INTO role_views (role_id, view_name, is_visible, sort_order) VALUES
-- Super Admin: todas las vistas
((SELECT id FROM roles WHERE name = 'super_admin'), 'dashboard', TRUE, 1),
((SELECT id FROM roles WHERE name = 'super_admin'), 'orders', TRUE, 2),
((SELECT id FROM roles WHERE name = 'super_admin'), 'users', TRUE, 3),
((SELECT id FROM roles WHERE name = 'super_admin'), 'billing', TRUE, 4),
((SELECT id FROM roles WHERE name = 'super_admin'), 'wallet', TRUE, 5),
((SELECT id FROM roles WHERE name = 'super_admin'), 'logistics', TRUE, 6),
((SELECT id FROM roles WHERE name = 'super_admin'), 'packaging', TRUE, 7),
((SELECT id FROM roles WHERE name = 'super_admin'), 'reports', TRUE, 8),
((SELECT id FROM roles WHERE name = 'super_admin'), 'config', TRUE, 9),

-- Admin: gestión general
((SELECT id FROM roles WHERE name = 'admin'), 'dashboard', TRUE, 1),
((SELECT id FROM roles WHERE name = 'admin'), 'orders', TRUE, 2),
((SELECT id FROM roles WHERE name = 'admin'), 'users', TRUE, 3),
((SELECT id FROM roles WHERE name = 'admin'), 'billing', TRUE, 4),
((SELECT id FROM roles WHERE name = 'admin'), 'wallet', TRUE, 5),
((SELECT id FROM roles WHERE name = 'admin'), 'logistics', TRUE, 6),
((SELECT id FROM roles WHERE name = 'admin'), 'packaging', TRUE, 7),
((SELECT id FROM roles WHERE name = 'admin'), 'reports', TRUE, 8),

-- Facturador
((SELECT id FROM roles WHERE name = 'facturador'), 'dashboard', TRUE, 1),
((SELECT id FROM roles WHERE name = 'facturador'), 'orders', TRUE, 2),
((SELECT id FROM roles WHERE name = 'facturador'), 'billing', TRUE, 3),

-- Cartera
((SELECT id FROM roles WHERE name = 'cartera'), 'dashboard', TRUE, 1),
((SELECT id FROM roles WHERE name = 'cartera'), 'orders', TRUE, 2),
((SELECT id FROM roles WHERE name = 'cartera'), 'wallet', TRUE, 3),

-- Logística
((SELECT id FROM roles WHERE name = 'logistica'), 'dashboard', TRUE, 1),
((SELECT id FROM roles WHERE name = 'logistica'), 'orders', TRUE, 2),
((SELECT id FROM roles WHERE name = 'logistica'), 'logistics', TRUE, 3),
((SELECT id FROM roles WHERE name = 'logistica'), 'packaging', TRUE, 4),

-- Empaque
((SELECT id FROM roles WHERE name = 'empaque'), 'dashboard', TRUE, 1),
((SELECT id FROM roles WHERE name = 'empaque'), 'orders', TRUE, 2),
((SELECT id FROM roles WHERE name = 'empaque'), 'packaging', TRUE, 3),

-- Mensajero
((SELECT id FROM roles WHERE name = 'mensajero'), 'dashboard', TRUE, 1),
((SELECT id FROM roles WHERE name = 'mensajero'), 'orders', TRUE, 2)

ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);

-- 10. Migrar usuarios existentes al nuevo sistema
-- Los usuarios admin existentes se convierten en super_admin
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, 1
FROM users u, roles r
WHERE u.role = 'admin' AND r.name = 'super_admin'
ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by);

-- Otros usuarios mantienen su rol actual
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, 1
FROM users u, roles r
WHERE u.role = r.name AND u.role != 'admin'
ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by);

COMMIT;

-- Mostrar resumen de la migración
SELECT 
    'ROLES CREADOS' as tipo,
    COUNT(*) as cantidad
FROM roles
UNION ALL
SELECT 
    'PERMISOS CREADOS' as tipo,
    COUNT(*) as cantidad
FROM permissions
UNION ALL
SELECT 
    'USUARIOS MIGRADOS' as tipo,
    COUNT(*) as cantidad
FROM user_roles
UNION ALL
SELECT 
    'VISTAS CONFIGURADAS' as tipo,
    COUNT(*) as cantidad
FROM role_views;
