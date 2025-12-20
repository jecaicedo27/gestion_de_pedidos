const { query, poolEnd } = require('./config/database');

async function checkLifetime() {
    try {
        const name = "Juan Carlos Ortiz Mantilla";
        console.log(`Checking lifetime pearl purchases for: ${name}`);

        const [customer] = await query("SELECT * FROM customers WHERE name LIKE ?", [`%${name}%`]);

        if (!customer) {
            console.log("Customer not found");
            return;
        }

        const items = await query(`
            SELECT oi.name, oi.quantity, o.created_at
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.customer_identification = ?
            AND (oi.name LIKE '%PERLA%' OR oi.name LIKE '%EXPLOSIVA%')
            AND o.status NOT IN ('cancelado', 'anulado')
            ORDER BY o.created_at DESC
        `, [customer.identification]);

        if (items.length > 0) {
            console.log(`✅ Customer HAS bought pearls before (${items.length} times).`);
            console.log("Most recent:", items[0]);
        } else {
            console.log("❌ Customer has NEVER bought pearls matching filter.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await poolEnd();
    }
}

checkLifetime();
