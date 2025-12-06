
const { query } = require('../config/database');
require('dotenv').config({ path: '../.env' });

async function checkNetValue() {
    try {
        const totalOrders = await query('SELECT COUNT(*) as count FROM orders');
        const ordersWithNetValue = await query('SELECT COUNT(*) as count FROM orders WHERE net_value IS NOT NULL');
        const ordersWithSiigoId = await query('SELECT COUNT(*) as count FROM orders WHERE siigo_invoice_id IS NOT NULL');
        const ordersWithSiigoIdAndNoNetValue = await query('SELECT COUNT(*) as count FROM orders WHERE siigo_invoice_id IS NOT NULL AND net_value IS NULL');

        console.log('Total Orders:', totalOrders[0].count);
        console.log('Orders with Net Value:', ordersWithNetValue[0].count);
        console.log('Orders with Siigo ID:', ordersWithSiigoId[0].count);
        console.log('Orders with Siigo ID but NO Net Value:', ordersWithSiigoIdAndNoNetValue[0].count);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkNetValue();
