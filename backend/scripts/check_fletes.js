const { pool } = require('../config/database');
require('dotenv').config({ path: '../.env' });

const checkFletes = async () => {
    try {
        const query = `
            SELECT SUM(oi.price * oi.quantity) as total_fletes
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN '2025-12-01 00:00:00' AND '2025-12-31 23:59:59'
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND oi.name LIKE '%Flete%'
        `;
        const [rows] = await pool.query(query);
        console.log('Total Fletes in Dec:', rows[0].total_fletes);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkFletes();
