
const { query, poolEnd } = require('../config/database');

async function checkShipping() {
    try {
        console.log("🚚 Analizando Fletes y Envíos (Dic 2025)...");

        // 1. Total Global
        const totalSql = `
            SELECT 
                COUNT(*) as count,
                SUM(oi.quantity * (oi.price / 1.19)) as total_net,
                SUM(oi.quantity * oi.price) as total_gross
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN '2025-12-01' AND '2025-12-31'
            AND o.status NOT IN ('cancelado', 'anulado')
            AND (oi.name LIKE '%Flete%' OR oi.name LIKE '%Domicilio%' OR oi.name LIKE '%Envío%');
        `;
        const total = await query(totalSql);
        console.log(`\n📊 RESUMEN GLOBAL:`);
        console.log(`   Pedidos con flete: ${total[0].count}`);
        console.log(`   Total Fletes (Neto): $${parseFloat(total[0].total_net).toLocaleString('es-CO')}`);
        console.log(`   Total Fletes (Bruto): $${parseFloat(total[0].total_gross).toLocaleString('es-CO')}`);

        // 2. Top 20 Pedidos con Flete más alto
        const listSql = `
            SELECT 
                o.id,
                o.order_number,
                o.customer_name,
                oi.name as item_name,
                oi.quantity,
                oi.price as unit_price,
                (oi.quantity * oi.price) as total_charge
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN '2025-12-01' AND '2025-12-31'
            AND o.status NOT IN ('cancelado', 'anulado')
            AND (oi.name LIKE '%Flete%' OR oi.name LIKE '%Domicilio%' OR oi.name LIKE '%Envío%')
            ORDER BY total_charge DESC
            LIMIT 20;
        `;

        const rows = await query(listSql);
        console.log(`\n🔝 TOP 20 FLETES MÁS COSTOSOS:`);
        console.table(rows.map(r => ({
            pedido: r.order_number,
            cliente: r.customer_name ? r.customer_name.substring(0, 20) : 'N/A',
            item: r.item_name,
            valor: `$${parseFloat(r.total_charge).toLocaleString('es-CO')}`
        })));

    } catch (error) {
        console.error(error);
    } finally {
        poolEnd();
    }
}

checkShipping();
