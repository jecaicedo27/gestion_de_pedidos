
const { query, poolEnd } = require('../config/database');

async function debugMargins() {
    try {
        console.log("🔍 Analizando Márgenes de Productos Top (Dic 2025)...");

        // Query imitating the dashboard logic to see individual item performance
        const sql = `
            SELECT 
                oi.name as product_name,
                SUM(oi.quantity) as qty,
                ROUND(SUM(oi.quantity * (oi.price / 1.19)), 0) as total_sales_net,
                
                /* Costo Real almacenado */
                ROUND(SUM(oi.quantity * (COALESCE(NULLIF(oi.purchase_cost, 0), NULLIF(p.purchasing_price, 0)) / 1.19)), 0) as db_cost_net,
                
                /* Costo con Lógica Actual del Dashboard */
                ROUND(SUM(oi.quantity * COALESCE(
                    NULLIF(oi.purchase_cost, 0) / 1.19, 
                    NULLIF(p.purchasing_price / 1.19, 0), 
                    CASE 
                        WHEN oi.name LIKE '%Flete%' OR oi.name LIKE '%Domicilio%' OR oi.name LIKE '%Envío%' THEN (oi.price / 1.19) 
                        ELSE (oi.price / 1.19) * 0.65 
                    END
                )), 0) as dashboard_cost,

                /* Margen Resultante */
                ROUND(SUM(oi.quantity * ((oi.price / 1.19) - COALESCE(
                    NULLIF(oi.purchase_cost, 0) / 1.19, 
                    NULLIF(p.purchasing_price / 1.19, 0), 
                    CASE 
                        WHEN oi.name LIKE '%Flete%' OR oi.name LIKE '%Domicilio%' OR oi.name LIKE '%Envío%' THEN (oi.price / 1.19) 
                        ELSE (oi.price / 1.19) * 0.65 
                    END
                ))), 0) as total_profit
                
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at BETWEEN '2025-12-01' AND '2025-12-31'
            AND o.status NOT IN ('cancelado', 'anulado')
            GROUP BY oi.name
            ORDER BY total_sales_net DESC
            LIMIT 20;
        `;

        const rows = await query(sql);

        console.table(rows.map(r => ({
            ...r,
            'margin_%': r.total_sales_net > 0 ? ((r.total_profit / r.total_sales_net) * 100).toFixed(1) + '%' : '0%'
        })));

    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

debugMargins();
