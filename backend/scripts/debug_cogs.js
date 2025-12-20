const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const debugCogs = async () => {
    try {
        const cogsQuery = `
            SELECT 
                DATE(o.created_at) as sale_date, 
                SUM(oi.purchase_cost * oi.quantity) as daily_cogs
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 10 DAY)
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial') 
            GROUP BY sale_date
            LIMIT 5
        `;

        const [rows] = await pool.query(cogsQuery);
        console.log('Rows returned:', rows.length);
        if (rows.length > 0) {
            console.log('First row:', rows[0]);
            console.log('Type of sale_date:', typeof rows[0].sale_date);
            console.log('sale_date.toString():', rows[0].sale_date.toString());
            // Check if it's a Date object
            if (rows[0].sale_date instanceof Date) {
                console.log('Is Date Object: YES');
                console.log('ISO String:', rows[0].sale_date.toISOString());
            } else {
                console.log('Is Date Object: NO');
            }
        } else {
            console.log('No COGS found in last 10 days.');
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

debugCogs();
