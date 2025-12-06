const { query } = require('./backend/config/database');

async function addMissingFields() {
  try {
    console.log('🔧 Agregando campos faltantes a las tablas...');
    
    // Agregar campos faltantes a company_config
    console.log('\n📊 Agregando campos a company_config...');
    
    const companyFields = [
      "ADD COLUMN company_name VARCHAR(100) DEFAULT 'Mi Empresa'",
      "ADD COLUMN nit VARCHAR(50) DEFAULT NULL",
      "ADD COLUMN whatsapp VARCHAR(20) DEFAULT NULL", 
      "ADD COLUMN city VARCHAR(100) DEFAULT NULL",
      "ADD COLUMN department VARCHAR(100) DEFAULT NULL",
      "ADD COLUMN postal_code VARCHAR(20) DEFAULT NULL",
      "ADD COLUMN website VARCHAR(255) DEFAULT NULL"
    ];
    
    for (const field of companyFields) {
      try {
        await query(`ALTER TABLE company_config ${field}`);
        console.log(`   ✅ ${field}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`   ⚠️ Campo ya existe: ${field}`);
        } else {
          console.log(`   ❌ Error: ${field} - ${error.message}`);
        }
      }
    }
    
    // Agregar campos faltantes a orders
    console.log('\n📊 Agregando campos a orders...');
    
    const orderFields = [
      "ADD COLUMN carrier_id INT DEFAULT NULL",
      "ADD COLUMN tracking_number VARCHAR(100) DEFAULT NULL",
      "ADD COLUMN logistics_notes TEXT DEFAULT NULL",
      "ADD COLUMN shipping_date DATETIME DEFAULT NULL",
      "ADD COLUMN electronic_payment_type VARCHAR(50) DEFAULT NULL",
      "ADD COLUMN electronic_payment_notes VARCHAR(255) DEFAULT NULL"
    ];
    
    for (const field of orderFields) {
      try {
        await query(`ALTER TABLE orders ${field}`);
        console.log(`   ✅ ${field}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`   ⚠️ Campo ya existe: ${field}`);
        } else {
          console.log(`   ❌ Error: ${field} - ${error.message}`);
        }
      }
    }
    
    // Actualizar company_config con datos iniciales
    console.log('\n📊 Actualizando datos de company_config...');
    try {
      await query(`
        UPDATE company_config 
        SET 
          company_name = 'PERLAS EXPLOSIVAS COLOMBIA S.A.S',
          nit = '901745588',
          city = 'Medellín',
          department = 'Antioquia',
          whatsapp = '315 0006559',
          website = 'https://perlas-explosivas.com'
        WHERE id = 1
      `);
      console.log('   ✅ Datos de empresa actualizados');
    } catch (error) {
      console.log(`   ❌ Error actualizando datos: ${error.message}`);
    }
    
    console.log('\n✅ Campos agregados exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error general:', error.message);
    process.exit(1);
  }
}

addMissingFields();
