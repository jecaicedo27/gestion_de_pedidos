const { query, poolEnd } = require('./config/database');

async function updateSaleChannel() {
    try {
        console.log('Actualizando sale_channel para pedidos de prueba...');

        // Actualizar pedidos FV-1-132 y FV-1-133 a POS
        const result = await query(
            "UPDATE orders SET sale_channel = 'pos' WHERE order_number IN ('FV-1-132', 'FV-1-133')",
            []
        );

        console.log(`✅ ${result.affectedRows} pedidos actualizados`);

        // Verificar
        const orders = await query(
            "SELECT id, order_number, customer_name, sale_channel FROM orders WHERE order_number IN ('FV-1-132', 'FV-1-133')",
            []
        );

        console.log('\n📊 Pedidos actualizados:');
        orders.forEach(order => {
            console.log(`  - ${order.order_number}: ${order.customer_name} -> sale_channel: ${order.sale_channel}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await poolEnd();
    }
}

updateSaleChannel();
