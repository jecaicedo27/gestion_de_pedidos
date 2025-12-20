const { query } = require('../config/database');

async function addABCColumn() {
    try {
        console.log('🔍 Checking if abc_classification column exists...');

        const [columns] = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
        AND TABLE_NAME = 'product_inventory_config' 
        AND COLUMN_NAME = 'abc_classification'
    `);

        if (columns) {
            console.log('✅ Column abc_classification already exists. Skipping.');
            return;
        }

        console.log('➕ Adding abc_classification column...');
        await query(`
      ALTER TABLE product_inventory_config
      ADD COLUMN abc_classification ENUM('A', 'B', 'C') DEFAULT NULL AFTER last_analysis_date
    `);

        console.log('✅ Column abc_classification added successfully.');
    } catch (error) {
        console.error('❌ Error adding column:', error);
        process.exit(1);
    }
}

addABCColumn();
