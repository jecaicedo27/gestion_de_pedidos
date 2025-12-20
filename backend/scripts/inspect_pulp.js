
const { query, poolEnd } = require('../config/database');

async function inspectProduct() {
    try {
        console.log("🔍 Inspeccionando 'PULPA DE FRUTA'...");

        const sql = `
            SELECT 
                oi.name,
                oi.price as sale_price_raw,
                oi.purchase_cost as order_item_cost_raw,
                p.purchasing_price as product_table_cost_raw,
                p.standard_price as product_table_price_result
            FROM order_items oi
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE oi.name LIKE '%PULPA%'
            LIMIT 5;
        `;

        const rows = await query(sql);
        console.table(rows);
    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

inspectProduct();
