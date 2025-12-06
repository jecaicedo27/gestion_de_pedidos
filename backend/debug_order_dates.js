const { query, poolEnd } = require('./config/database');

async function checkOrder() {
    try {
        // Check if column exists first to avoid error
        const cols = await query("SHOW COLUMNS FROM orders LIKE 'siigo_invoice_created_at'");
        const hasCol = cols.length > 0;
        console.log('Has siigo_invoice_created_at:', hasCol);

        let sql = 'SELECT id, order_number, created_at, updated_at';
        if (hasCol) sql += ', siigo_invoice_created_at';

        // Check for siigo_invoice_date
        const cols2 = await query("SHOW COLUMNS FROM orders LIKE 'siigo_invoice_date'");
        if (cols2.length > 0) sql += ', siigo_invoice_date';

        sql += ' FROM orders WHERE order_number LIKE "%15430%"';

        const rows = await query(sql);
        console.log(rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await poolEnd();
    }
}

checkOrder();
