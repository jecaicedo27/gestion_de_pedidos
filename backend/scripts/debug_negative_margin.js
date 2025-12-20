
const { query, poolEnd } = require('../config/database');

async function findNegativeMargins() {
    try {
        console.log("🔍 Buscando items con Margen Negativo (Costo > Precio)...");

        const sql = `
            SELECT 
                oi.name as product_name,
                SUM(oi.quantity) as qty,
                AVG(oi.price) as avg_price,
                
                /* Costo Real almacenado (promedio) */
                AVG(COALESCE(NULLIF(oi.purchase_cost, 0), NULLIF(p.purchasing_price, 0))) as avg_stored_cost,
                
                /* Margen Promedio */
                (AVG(oi.price) - AVG(COALESCE(NULLIF(oi.purchase_cost, 0), NULLIF(p.purchasing_price, 0)))) as avg_profit
                
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at BETWEEN '2025-12-01' AND '2025-12-31'
            AND o.status NOT IN ('cancelado', 'anulado')
            GROUP BY oi.name
            HAVING avg_stored_cost > avg_price
            ORDER BY qty DESC
            LIMIT 20;
        `;

        const rows = await query(sql);
        console.table(rows);
    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

findNegativeMargins();
