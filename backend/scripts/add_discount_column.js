const { query, poolEnd } = require('../config/database');

async function addDiscountColumn() {
    try {
        console.log("🔧 Agregando columna discount_percent a order_items...");

        // Check if column already exists
        const columns = await query("SHOW COLUMNS FROM order_items LIKE 'discount_percent'");

        if (columns.length > 0) {
            console.log("✅ La columna discount_percent ya existe");
            return;
        }

        // Add the column
        await query(`
      ALTER TABLE order_items 
      ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0 COMMENT 'Porcentaje de descuento desde SIIGO'
    `);

        console.log("✅ Columna discount_percent agregada exitosamente");

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        poolEnd();
    }
}

addDiscountColumn();
