const { query, poolEnd } = require('./config/database');

async function resetOrder() {
    try {
        const sql = "UPDATE orders SET status = 'revision_cartera', validation_status = 'pending' WHERE order_number = 'FV-2-15627'";
        await query(sql);
        console.log('Order reset to revision_cartera');
    } catch (error) {
        console.error('Error resetting order:', error);
    } finally {
        await poolEnd();
    }
}

resetOrder();
