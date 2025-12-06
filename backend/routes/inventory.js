const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const stockSyncManager = require('../services/stockSyncManager');
const { query } = require('../config/database');

// Obtener inventario agrupado compatible con el frontend InventoryBillingPage
router.get('/grouped', authenticateToken, async (req, res) => {
    try {
        const sql = `
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
        const products = await query(sql);
        res.json({ success: true, data: products });
    } catch (error) {
        console.error('Error obteniendo inventario:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

// Buscar productos - compatible con el frontend
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q, category } = req.query;
        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Término de búsqueda debe tener al menos 2 caracteres'
            });
        }
        let sql = `
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
        const params = [`%${q}%`, `%${q}%`, `%${q}%`];
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        sql += ' ORDER BY product_name LIMIT 20';
        const products = await query(sql, params);
        res.json({ success: true, data: products });
    } catch (error) {
        console.error('Error buscando productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
});

/**
 * Forzar sincronización puntual de un producto (por product_id o siigo_id)
 * body: { product_id?: number, siigo_id?: string }
 */
router.post('/sync-product', authenticateToken, async (req, res) => {
    try {
        const { product_id, siigo_id } = req.body || {};
        if (!product_id && !siigo_id) {
            return res.status(400).json({ success: false, message: 'Se requiere product_id o siigo_id' });
        }

        // Resolver siigo_id desde product_id si no vino
        let siigoProductId = siigo_id;
        if (!siigoProductId) {
            const rows = await query('SELECT siigo_id FROM products WHERE id = ? LIMIT 1', [product_id]);
            if (!rows.length || !rows[0].siigo_id) {
                return res.status(404).json({ success: false, message: 'Producto no encontrado o sin siigo_id' });
            }
            siigoProductId = rows[0].siigo_id;
        }

        const svc = stockSyncManager && stockSyncManager.getInstance ? stockSyncManager.getInstance() : null;
        if (!svc || typeof svc.syncSpecificProduct !== 'function') {
            return res.status(500).json({ success: false, message: 'Servicio de sincronización no disponible' });
        }

        // No bloquear la respuesta: lanzar en background y devolver ack
        setTimeout(() => {
            svc.syncSpecificProduct(siigoProductId).catch(() => {});
        }, 100);

        return res.json({ success: true, message: 'Sync puntual encolada', siigo_id: siigoProductId });
    } catch (e) {
        console.error('Error en /inventory/sync-product:', e?.message || e);
        return res.status(500).json({ success: false, message: e.message });
    }
});

/**
 * Obtener un producto por ID (para refresco puntual en UI)
 */
router.get('/product/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ success: false, message: 'ID inválido' });
        }
        const rows = await query(
            `SELECT id, product_name, category, subcategory, standard_price, available_quantity, siigo_id, is_active, updated_at, stock_updated_at
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }
        return res.json({ success: true, data: rows[0] });
    } catch (e) {
        console.error('Error en /inventory/product/:id', e?.message || e);
        return res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
