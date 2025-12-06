const { query, poolEnd } = require('./config/database');

async function addTransportGuideNotesColumn() {
    try {
        // Check if column exists
        const check = await query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'gestion_pedidos'
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'transport_guide_notes'
    `);

        if (check.length === 0) {
            console.log('Adding transport_guide_notes column...');
            await query(`
        ALTER TABLE orders
        ADD COLUMN transport_guide_notes TEXT DEFAULT NULL AFTER transport_guide_url
      `);
            console.log('Column added successfully.');
        } else {
            console.log('Column transport_guide_notes already exists.');
        }

    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        await poolEnd();
    }
}

addTransportGuideNotesColumn();
