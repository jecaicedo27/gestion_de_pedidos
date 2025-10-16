const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { authenticateToken } = require('../middleware/auth');

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    charset: 'utf8mb4'
};

// Obtener inventario agrupado compatible con el frontend InventoryBillingPage
router.get('/grouped', authenticateToken, async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        // Obtener productos usando la tabla 'products' real de nuestra base de datos
        const query = `
            SELECT 
                id,
                product_name,
                description,
                barcode,
                internal_code,
                category,
                subcategory,
                standard_price,
                available_quantity,
                siigo_id,
                is_active,
                created_at,
                updated_at
            FROM products
            WHERE is_active = 1 
            ORDER BY category, product_name
        `;
        
        const [products] = await connection.execute(query);
        
        res.json({
            success: true,
            data: products
        });
        
    } catch (error) {
        console.error('Error obteniendo inventario:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Buscar productos - compatible con el frontend
router.get('/search', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { q, category } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Término de búsqueda debe tener al menos 2 caracteres'
            });
        }
        
        connection = await mysql.createConnection(dbConfig);
        
        let query = `
            SELECT 
                id, product_name, barcode, standard_price, available_quantity,
                category, subcategory
            FROM products
            WHERE is_active = 1 
            AND (
                product_name LIKE ? OR 
                barcode LIKE ? OR
                siigo_id LIKE ?
            )
        `;
        
        const queryParams = [`%${q}%`, `%${q}%`, `%${q}%`];
        
        if (category) {
            query += ' AND category = ?';
            queryParams.push(category);
        }
        
        query += ' ORDER BY product_name LIMIT 20';
        
        const [products] = await connection.execute(query, queryParams);
        
        res.json({
            success: true,
            data: products
        });
        
    } catch (error) {
        console.error('Error buscando productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

module.exports = router;
