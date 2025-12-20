const { query, poolEnd } = require('./config/database');

async function debugOrder() {
    try {
        const orderNumber = 'FV-2-15593';
        console.log(`🔍 Inspecting Order: ${orderNumber}`);

        // 1. Check Order Basic Info
        const orders = await query("SELECT id, order_number, status, payment_method, total_amount FROM orders WHERE order_number = ?", [orderNumber]);
        if (orders.length === 0) {
            console.log('❌ Order not found in orders table');
            return;
        }
        const order = orders[0];
        console.log('📦 Order Data:', order);

        // 2. Check Delivery Tracking
        const tracking = await query("SELECT * FROM delivery_tracking WHERE order_id = ? ORDER BY id DESC", [order.id]);
        console.log('🚚 Delivery Tracking Records:', tracking.length);
        tracking.forEach((t, i) => {
            console.log(`   [${i}] ID: ${t.id}, Status: ${t.status}, DeliveredAt: ${t.delivered_at}, PayMethod: ${t.payment_method}, Collected: ${t.payment_collected}`);
        });

        // 3. Check Cash Closing Details
        const closings = await query("SELECT * FROM cash_closing_details WHERE order_id = ?", [order.id]);
        console.log('💰 Cash Closing Details:', closings.length);
        closings.forEach((c, i) => {
            console.log(`   [${i}] ID: ${c.id}, Status: ${c.collection_status}, Amount: ${c.collected_amount}`);
        });

        // 4. Test the WHERE clause logic manually
        if (tracking.length > 0) {
            const dt = tracking[0]; // Assuming MAX(id)

            const isDelivered = dt.delivered_at !== null;
            const hasCollection = (dt.payment_collected > 0 || dt.delivery_fee_collected > 0);
            const isCash = (String(dt.payment_method).toLowerCase() === 'efectivo' && dt.payment_collected > 0) ||
                (String(dt.delivery_fee_payment_method).toLowerCase() === 'efectivo' && dt.delivery_fee_collected > 0);

            console.log('\n🕵️ Logic Check (Latest Tracking):');
            console.log(`   - Delivered? ${isDelivered} (${dt.delivered_at})`);
            console.log(`   - Has Collection? ${hasCollection} (Prod: ${dt.payment_collected}, Fee: ${dt.delivery_fee_collected})`);
            console.log(`   - Is Cash? ${isCash} (Method: ${dt.payment_method})`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await poolEnd();
    }
}

debugOrder();
