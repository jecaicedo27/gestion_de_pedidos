const { query, poolEnd } = require('./config/database');

async function checkPendingGuides() {
    try {
        const queryStr = `
      SELECT id, order_number, status, delivery_method, transport_guide_url
      FROM orders
      WHERE (status = 'entregado_transportadora' OR status = 'enviado')
      AND delivery_method NOT IN ('domicilio', 'domicilio_local', 'domicilio_ciudad', 'mensajeria_urbana', 'recoge_bodega', 'recogida_tienda')
      AND (transport_guide_url IS NULL OR transport_guide_url = '')
      AND deleted_at IS NULL
    `;

        const orders = await query(queryStr);
        console.log(`Found ${orders.length} pending orders.`);
        orders.forEach(o => {
            console.log(`- ${o.order_number} (${o.status}) Method: ${o.delivery_method}`);
        });

        // Also check total count of 'entregado_transportadora' to see if we are missing them due to delivery_method
        const totalSent = await query("SELECT COUNT(*) as count FROM orders WHERE status = 'entregado_transportadora'");
        console.log(`Total 'entregado_transportadora': ${totalSent[0].count}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkPendingGuides();
