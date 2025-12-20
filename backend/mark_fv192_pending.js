const { query } = require('./config/database');

async function markPendingEvidence() {
    try {
        console.log('Marcando pedido FV-1-92 como pendiente de comprobante...');

        // Primero verificar el estado actual
        const before = await query(
            'SELECT id, order_number, status, payment_method, is_pending_payment_evidence FROM orders WHERE order_number = ?',
            ['FV-1-92']
        );

        console.log('Estado ANTES:', before[0]);

        // Actualizar el flag
        await query(
            'UPDATE orders SET is_pending_payment_evidence = 1 WHERE order_number = ?',
            ['FV-1-92']
        );

        // Verificar el estado después
        const after = await query(
            'SELECT id, order_number, status, payment_method, is_pending_payment_evidence FROM orders WHERE order_number = ?',
            ['FV-1-92']
        );

        console.log('Estado DESPUÉS:', after[0]);
        console.log('✅ Pedido marcado exitosamente');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

markPendingEvidence();
