const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos',
    port: process.env.DB_PORT || 3306
};

async function debugOrder() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        const [orders] = await connection.execute(`
      SELECT 
        o.id, o.order_number, o.status, o.delivery_method,
        o.payment_method, o.requires_payment,
        o.payment_amount, o.paid_amount, o.siigo_balance,
        o.total_amount,
        (SELECT COUNT(*) FROM cash_register cr WHERE cr.order_id = o.id) AS cash_register_count,
        (SELECT COUNT(*) FROM wallet_validations wv WHERE wv.order_id = o.id AND wv.validation_status = 'approved') AS wallet_validations_approved,
        (SELECT COUNT(*) FROM cash_register crc WHERE crc.order_id = o.id AND crc.status = 'collected') AS cash_register_collected_count
      FROM orders o
      WHERE o.order_number = 'FV-2-15584'
      LIMIT 1
    `);

        if (orders.length === 0) {
            console.log('❌ Pedido FV-2-15584 no encontrado');
            return;
        }

        const order = orders[0];
        console.log('\n📦 Datos del pedido FV-2-15584:\n');
        console.log(JSON.stringify(order, null, 2));

        // Simular computeCollectionAmounts
        const total = Number(order.total_amount || 0);
        const paidAmount = Number(order.paid_amount || 0);
        const paymentAmount = Number(order.payment_amount || 0);
        const siigoBalance = Number(order.siigo_balance || 0);

        const baseProduct = (paymentAmount > 0 ? paymentAmount : (siigoBalance > 0 ? siigoBalance : total));
        const productDue = Math.max(0, baseProduct - paidAmount);

        console.log('\n💰 Cálculos de cobro:');
        console.log({
            total,
            paidAmount,
            paymentAmount,
            siigoBalance,
            baseProduct,
            productDue,
            formula: paymentAmount > 0
                ? `payment_amount (${paymentAmount}) - paid_amount (${paidAmount}) = ${productDue}`
                : siigoBalance > 0
                    ? `siigo_balance (${siigoBalance}) - paid_amount (${paidAmount}) = ${productDue}`
                    : `total (${total}) - paid_amount (${paidAmount}) = ${productDue}`
        });

        console.log('\n🔍 Condiciones del botón "Registrar Pago":');
        const pmNorm = String(order.payment_method || '').toLowerCase();
        const isCredit = pmNorm.includes('credito') || pmNorm.includes('cliente_credito');
        const regCount = Number(order.cash_register_count || 0);

        console.log({
            isCredit,
            regCount,
            productDue,
            shouldShowButton: !isCredit && regCount === 0 && productDue > 0
        });

    } finally {
        await connection.end();
    }
}

debugOrder().catch(console.error);
