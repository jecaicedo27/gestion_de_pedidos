require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

async function debugTimeline() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'gestion_pedidos'
        });

        console.log('Connected to database');

        // 1. Check if order_history table exists
        try {
            const [rows] = await connection.execute('DESCRIBE order_history');
            console.log('order_history table structure:', rows);
        } catch (error) {
            console.error('Error describing order_history:', error.message);
        }

        // 2. Try the specific query
        try {
            const orderId = 15364; // Using the ID from the screenshot/context if possible, or just a dummy
            const [history] = await connection.execute(
                'SELECT action, description, created_at FROM order_history WHERE order_id = ? AND action = "payment_evidence_uploaded" ORDER BY created_at ASC',
                [orderId]
            );
            console.log('Query successful. Rows:', history);
        } catch (error) {
            console.error('Error executing timeline query:', error);
        }

        await connection.end();
    } catch (error) {
        console.error('Database connection error:', error);
    }
}

debugTimeline();
