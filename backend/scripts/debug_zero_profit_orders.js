
const { query, poolEnd } = require('../config/database');

async function findZeroProfitOrders() {
    try {
        console.log("🔍 Buscando pedidos sin costo registrado en Diciembre 2025...");
        const sql = `
            SELECT 
                o.id as order_id, 
                o.created_at,
                oi.name as product_name, 
                oi.quantity, 
                oi.price, 
                oi.purchase_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at BETWEEN '2025-12-01' AND '2025-12-31'
            AND (oi.purchase_cost IS NULL OR oi.purchase_cost = 0)
            AND (p.purchasing_price IS NULL OR p.purchasing_price = 0)
            AND o.status NOT IN ('cancelado', 'anulado')
            LIMIT 15;
        `;

        const rows = await query(sql);
        console.table(rows);
    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

findZeroProfitOrders();
