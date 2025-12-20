const { query } = require('../config/database');

async function checkProductCount() {
    try {
        const result = await query(`
            SELECT COUNT(DISTINCT name) as count
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
        `);
        console.log('📦 Total distinct products sold in last 30 days:', result[0].count);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkProductCount();
