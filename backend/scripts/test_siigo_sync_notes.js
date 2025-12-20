
const { query, transaction, connection } = require('../config/database');
const siigoService = require('../services/siigoService');
const orderController = require('../controllers/orderController');

// Mock request and response objects
const mockReq = (id) => ({
    params: { id },
    user: { id: 1, role: 'admin', full_name: 'Test Admin' }
});

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

async function testSyncNotes() {
    try {
        console.log('🧪 Starting test: Sync Notes from Siigo');

        // 1. Find an order with a Siigo Invoice ID
        const orders = await query('SELECT id, order_number, siigo_invoice_id, siigo_observations, notes FROM orders WHERE siigo_invoice_id IS NOT NULL LIMIT 1');

        if (orders.length === 0) {
            console.log('❌ No orders with Siigo Invoice ID found. Cannot run test.');
            process.exit(1);
        }

        const order = orders[0];
        console.log(`📋 Testing with Order ID: ${order.id}, Number: ${order.order_number}`);
        console.log(`   Current DB Observations: "${order.siigo_observations || 'NULL'}"`);
        console.log(`   Current DB Notes: "${order.notes || 'NULL'}"`);

        // 2. Fetch the actual invoice from Siigo to see what notes it has
        console.log('🔄 Fetching invoice from Siigo...');
        const invoice = await siigoService.getInvoiceDetails(order.siigo_invoice_id);

        if (!invoice) {
            console.log('❌ Could not fetch invoice from Siigo.');
            process.exit(1);
        }

        const siigoNotes = invoice.observations || '';
        console.log(`   Siigo Invoice Observations: "${siigoNotes}"`);

        if (!siigoNotes) {
            console.log('⚠️ The selected invoice has no observations in Siigo. Test might be inconclusive regarding note updates.');
        }

        // 3. Run the sync function
        console.log('🔄 Running syncOrderFromSiigo...');
        const req = mockReq(order.id);
        const res = mockRes();

        await orderController.syncOrderFromSiigo(req, res);

        if (res.statusCode && res.statusCode !== 200) {
            console.log(`❌ Sync failed with status ${res.statusCode}:`, res.data);
            process.exit(1);
        }

        console.log('✅ Sync completed.');

        // 4. Verify the update in the database
        const updatedOrder = await query('SELECT siigo_observations, notes FROM orders WHERE id = ?', [order.id]);
        const newObs = updatedOrder[0].siigo_observations;
        const newNotes = updatedOrder[0].notes;

        console.log(`   New DB Observations: "${newObs || 'NULL'}"`);
        console.log(`   New DB Notes: "${newNotes || 'NULL'}"`);

        if (newObs === siigoNotes) {
            console.log('✅ SUCCESS: siigo_observations matches Siigo data.');
        } else {
            console.log('❌ FAILURE: siigo_observations does NOT match Siigo data.');
            console.log(`   Expected: "${siigoNotes}"`);
            console.log(`   Actual:   "${newObs}"`);
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    }
}

testSyncNotes();
