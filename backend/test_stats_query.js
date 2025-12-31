const { query, poolEnd } = require('./config/database');

async function testStats() {
    try {
        console.log('Testing getStats query...');
        const dateFilter = '2025-12-30';

        const rows = await query(`
            SELECT 
                COALESCE(SUM(amount), 0) as total,
                COALESCE(SUM(CASE WHEN source = 'bancolombia' THEN amount ELSE 0 END), 0) as bancolombia,
                COALESCE(SUM(CASE WHEN source = 'mercadopago' THEN amount ELSE 0 END), 0) as mercadopago,
                COALESCE(SUM(CASE WHEN source = 'caja_menor' THEN amount ELSE 0 END), 0) as caja_menor
            FROM expenses 
            WHERE date = ? AND payment_status = 'PAGADO'
        `, [dateFilter]);

        console.log('Daily Stats Result:', rows);

        const [dailyStats] = rows;
        console.log('Destructured:', dailyStats);

        const expanded = { ...dailyStats };
        console.log('Expanded:', expanded);

    } catch (e) {
        console.error('Query FAILED:', e);
    } finally {
        await poolEnd();
        process.exit();
    }
}

testStats();
