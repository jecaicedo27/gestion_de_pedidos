const { query, transaction } = require('../config/database');

async function fixOrders() {
    try {
        console.log('Starting order fix...');

        await transaction(async (connection) => {
            // 1. Fix FV-2-15296 (ID 135)
            console.log('Fixing FV-2-15296 (ID 135)...');

            // Update Order: payment_method -> transferencia, is_pending_payment_evidence -> 1
            await connection.execute(
                `UPDATE orders 
         SET payment_method = 'transferencia', is_pending_payment_evidence = 1 
         WHERE id = 135`
            );

            // Update Delivery Tracking: payment_method -> transferencia, payment_collected -> 0
            // This removes it from "Pending Cash" view which looks for payment_collected > 0
            await connection.execute(
                `UPDATE delivery_tracking 
         SET payment_method = 'transferencia', payment_collected = 0 
         WHERE order_id = 135`
            );


            // 2. Fix FV-1-86 (ID 279)
            console.log('Fixing FV-1-86 (ID 279)...');

            // Update Order: is_pending_payment_evidence -> 1
            // (Payment method is already 'transferencia' for product, but delivery fee was cash)
            await connection.execute(
                `UPDATE orders 
         SET is_pending_payment_evidence = 1 
         WHERE id = 279`
            );

            // Update Delivery Tracking: delivery_fee_payment_method -> transferencia, delivery_fee_collected -> 0
            // This removes it from "Pending Cash" view which looks for delivery_fee_collected > 0
            await connection.execute(
                `UPDATE delivery_tracking 
         SET delivery_fee_payment_method = 'transferencia', delivery_fee_collected = 0 
         WHERE order_id = 279`
            );

        });

        console.log('Fix applied successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Error applying fix:', error);
        process.exit(1);
    }
}

fixOrders();
