const { query, poolEnd } = require('./config/database');

async function checkCustomer() {
    try {
        const name = "Juan Carlos Ortiz Mantilla";
        const startDate = "2025-12-01";
        const endDate = "2025-12-31 23:59:59";

        console.log(`Searching for customer: ${name}`);

        const [customer] = await query("SELECT * FROM customers WHERE name LIKE ?", [`%${name}%`]);

        if (!customer) {
            console.log("Customer not found");
            return;
        }

        console.log(`Found Customer: ${customer.name} (ID: ${customer.identification})`);

        const items = await query(`
            SELECT oi.name, oi.quantity, oi.price, o.created_at
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.customer_identification = ?
            AND o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')
        `, [customer.identification, startDate, endDate]);

        console.log(`\nItems purchased in Dec 2025 (${items.length}):`);
        items.forEach(item => {
            const isPearl = item.name.toUpperCase().includes('PERLA') || item.name.toUpperCase().includes('EXPLOSIVA');
            console.log(`- ${item.name} (Qty: ${item.quantity}) ${isPearl ? '[MATCHES PERLA FILTER]' : ''}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await poolEnd();
    }
}

checkCustomer();
