const { query, poolEnd } = require('./config/database');

async function fixSchema() {
    try {
        console.log('Modifying source column...');
        // Add 'caja_menor' AND allow NULL
        await query("ALTER TABLE expenses MODIFY COLUMN source ENUM('bancolombia', 'mercadopago', 'caja_menor') NULL");
        console.log('Column modified successfully.');

        console.log('Verifying change...');
        const result = await query("DESCRIBE expenses source");
        console.table(result);
    } catch (e) {
        console.error('Error modifying schema:', e);
    } finally {
        await poolEnd();
        process.exit();
    }
}

fixSchema();
