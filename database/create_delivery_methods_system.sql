-- Crear tabla de métodos de envío
CREATE TABLE IF NOT EXISTS delivery_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar métodos de envío por defecto
INSERT INTO delivery_methods (code, name, description, active, sort_order) VALUES
('recoge_bodega', 'Recoge en Bodega', 'El cliente recoge el pedido directamente en la bodega', TRUE, 1),
('domicilio', 'Domicilio', 'Entrega a domicilio en la ciudad', TRUE, 2),
('nacional', 'Nacional', 'Envío a nivel nacional', TRUE, 3),
('mensajeria_urbana', 'Mensajería Urbana', 'Entrega rápida dentro del área metropolitana', TRUE, 4)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description),
    active = VALUES(active),
    sort_order = VALUES(sort_order);
