
require('dotenv').config();
const { query } = require('./config/database');
const siigoService = require('./services/siigoService');

async function fixOrderTotals() {
    try {
        console.log('🚀 Starting order total fix script...');

        // 1. Get orders from the last 30 days that might need fixing
        console.log(`Searching for orders from the last 30 days...`);

        const orders = await query(
            `SELECT id, order_number, siigo_invoice_id, total_amount 
       FROM orders 
       WHERE siigo_invoice_id IS NOT NULL 
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ORDER BY created_at DESC`
        );
        if (orders.length === 0) {
            console.log('❌ Order not found.');
            return;
        }

        for (const order of orders) {
            console.log(`\nProcessing order: ${order.order_number} (ID: ${order.id})`);
            console.log(`Current Total in DB: ${order.total_amount}`);

            if (!order.siigo_invoice_id) {
                console.log('⚠️ No Siigo Invoice ID found. Skipping.');
                continue;
            }

            // 2. Fetch full invoice details from Siigo
            try {
                const fullInvoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);

                if (!fullInvoice) {
                    console.log('❌ Could not fetch invoice from Siigo.');
                    continue;
                }

                // 3. Calculate correct total using the service logic (which we know prioritizes 'total')
                // We can manually replicate the logic here to be sure, or trust the service if we were calling a method.
                // Since calculateTotal is internal to processInvoiceToOrder, we'll replicate the priority logic here
                // to determine what the NEW total should be.

                let newTotal = 0;
                if (fullInvoice.total !== undefined && !isNaN(parseFloat(fullInvoice.total))) {
                    newTotal = parseFloat(fullInvoice.total);
                    console.log(`Found 'total' in Siigo response: ${newTotal}`);
                } else if (fullInvoice.total_amount !== undefined && !isNaN(parseFloat(fullInvoice.total_amount))) {
                    newTotal = parseFloat(fullInvoice.total_amount);
                    console.log(`Found 'total_amount' in Siigo response: ${newTotal}`);
                } else {
                    console.log('⚠️ Neither "total" nor "total_amount" found in Siigo response. Falling back to items (Gross Value).');
                    if (fullInvoice.items && Array.isArray(fullInvoice.items)) {
                        newTotal = fullInvoice.items.reduce((sum, item) => {
                            const quantity = parseFloat(item.quantity || 1);
                            const price = parseFloat(item.unit_price || item.price || 0);
                            return sum + (quantity * price);
                        }, 0);
                    }
                }

                console.log(`Correct Total should be: ${newTotal}`);

                // 4. Update DB if different
                if (Math.abs(newTotal - order.total_amount) > 0.01) {
                    console.log(`Mismatch detected! Updating DB...`);
                    await query(
                        'UPDATE orders SET total_amount = ? WHERE id = ?',
                        [newTotal, order.id]
                    );
                    console.log(`✅ Order ${order.order_number} updated successfully.`);
                } else {
                    console.log(`✅ Totals match. No update needed.`);
                }

            } catch (err) {
                console.error(`❌ Error processing order ${order.order_number}:`, err.message);
            }
        }

        console.log('\n🏁 Fix script finished.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

fixOrderTotals();
