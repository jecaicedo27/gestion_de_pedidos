const { query, poolEnd } = require('./config/database');

async function checkAndAddColumns() {
  try {
    console.log('🔍 Verificando columnas en tabla orders...');

    const columns = await query("SHOW COLUMNS FROM orders LIKE 'validation_%'");
    const existingColumns = columns.map(c => c.Field);
    console.log('Columnas existentes:', existingColumns);

    if (!existingColumns.includes('validation_status')) {
      console.log('➕ Agregando columna validation_status...');
      await query("ALTER TABLE orders ADD COLUMN validation_status VARCHAR(50) DEFAULT 'pending'");
    }

    if (!existingColumns.includes('validation_notes')) {
      console.log('➕ Agregando columna validation_notes...');
      await query("ALTER TABLE orders ADD COLUMN validation_notes TEXT");
    }

    console.log('✅ Verificación completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await poolEnd();
  }
}

checkAndAddColumns();
