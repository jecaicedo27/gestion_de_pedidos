
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });
const mysql = require('mysql2/promise');

async function checkOrder(orderNumber) {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log(`Looking for Order Number ${orderNumber}...`);

        const [orders] = await connection.execute('SELECT id, order_number FROM orders WHERE order_number LIKE ?', [`%${orderNumber}%`]);

        if (orders.length === 0) {
            console.log('Order not found');
            return;
        }

        const orderId = orders[0].id;
        console.log(`Found Order ID: ${orderId}`);

        const [items] = await connection.execute(`
      SELECT id, name, quantity, product_code 
      FROM order_items 
      WHERE order_id = ?
    `, [orderId]);

        console.log(`Found ${items.length} items.`);

        if (items.length > 0) {
            const itemIds = items.map(i => i.id);
            const placeholders = itemIds.map(() => '?').join(',');

            const [verifications] = await connection.execute(`
        SELECT item_id, scanned_count, required_scans, is_verified 
        FROM packaging_item_verifications 
        WHERE item_id IN (${placeholders})
      `, itemIds);

            console.log('Verifications:', verifications);

            // Check for mismatches
            items.forEach(item => {
                const verif = verifications.find(v => v.item_id === item.id);
                if (verif) {
                    if (item.quantity !== verif.required_scans) {
                        console.log(`MISMATCH: Item ${item.id} (${item.name}): Qty=${item.quantity}, ReqScans=${verif.required_scans}, Scanned=${verif.scanned_count}, Verified=${verif.is_verified}`);
                    }
                } else {
                    console.log(`Item ${item.id} has no verification record.`);
                }
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

checkOrder('15341');
