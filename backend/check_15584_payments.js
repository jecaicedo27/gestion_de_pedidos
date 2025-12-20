const { query } = require('./config/database');

async function checkOrder15584() {
    try {
        console.log('🔍 Verificando pedido FV-2-15584...\n');

        // 1. Datos del pedido
        const [order] = await query(`
      SELECT id, order_number, status, delivery_method, payment_method, 
             requires_payment, payment_amount, paid_amount, siigo_balance, total_amount
      FROM orders 
      WHERE order_number = 'FV-2-15584'
    `);

        if (!order.length) {
            console.log('❌ Pedido no encontrado');
            process.exit(1);
        }

        console.log('📦 Datos del pedido:');
        console.log(JSON.stringify(order[0], null, 2));

        // 2. Registros en cash_register
        const cashRegisters = await query(`
      SELECT id, order_id, amount, payment_method, delivery_method, 
             status, registered_by, accepted_by, created_at, accepted_at
      FROM cash_register 
      WHERE order_id = ?
      ORDER BY created_at DESC
    `, [order[0].id]);

        console.log('\n💰 Registros en cash_register:');
        console.log(JSON.stringify(cashRegisters, null, 2));

        // 3. Validaciones de wallet
        const walletValidations = await query(`
      SELECT id, order_id, validation_status, validated_by, created_at
      FROM wallet_validations
      WHERE order_id = ?
      ORDER BY created_at DESC
    `, [order[0].id]);

        console.log('\n💳 Validaciones de wallet:');
        console.log(JSON.stringify(walletValidations, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkOrder15584();
