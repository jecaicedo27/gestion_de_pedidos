
const { query, poolEnd } = require('../config/database');
const axios = require('axios'); // For sending alerts if needed (e.g. Slack/Email) - optional

async function monitorZeroCostItems() {
    try {
        console.log('🔍 Checking for items imported with Zero Cost in the last 24 hours...');

        const results = await query(`
            SELECT 
                o.order_number,
                o.created_at,
                oi.product_code,
                oi.name,
                oi.purchase_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.purchase_cost = 0 
            AND o.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.payment_method != 'reposicion'
            AND oi.product_code NOT IN ('FL01', 'PROPINA') -- Exclude known zero-cost items
        `);

        if (results.length > 0) {
            console.error(`❌ ALERT: Found ${results.length} items with ZERO COST!`);
            console.table(results);

            // Here you could add logic to send an email or Slack notification
            // await sendAlert(results);

            // For now, we log to stdout which can be captured by cron/pm2
        } else {
            console.log('✅ No zero-cost items found in the last 24h.');
        }

    } catch (error) {
        console.error('Error monitoring zero cost items:', error);
    } finally {
        await poolEnd();
    }
}

monitorZeroCostItems();
