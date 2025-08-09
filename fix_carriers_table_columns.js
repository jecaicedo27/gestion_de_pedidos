const mysql = require('mysql2');

// Configuración de conexión a MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
});

async function fixCarriersTable() {
  try {
    console.log('🔧 Verificando estructura de la tabla carriers...');
    
    // Verificar estructura actual de la tabla
    const [columns] = await connection.promise().query("DESCRIBE carriers");
    console.log('📋 Columnas actuales:', columns.map(col => col.Field));
    
    // Verificar si existe la columna 'code'
    const codeColumn = columns.find(col => col.Field === 'code');
    
    if (!codeColumn) {
      console.log('➕ Agregando columna code a la tabla carriers...');
      await connection.promise().query(`
        ALTER TABLE carriers 
        ADD COLUMN code VARCHAR(50) AFTER name
      `);
      
      // Generar códigos para los registros existentes
      const [carriers] = await connection.promise().query('SELECT id, name FROM carriers');
      for (const carrier of carriers) {
        const code = carrier.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        await connection.promise().query(
          'UPDATE carriers SET code = ? WHERE id = ?',
          [code, carrier.id]
        );
      }
      console.log('✅ Columna code agregada y códigos generados');
    } else {
      console.log('✅ La columna code ya existe');
    }
    
    // Verificar otras columnas necesarias
    const requiredColumns = [
      { name: 'contact_phone', type: 'VARCHAR(20)', after: 'code' },
      { name: 'contact_email', type: 'VARCHAR(100)', after: 'contact_phone' },
      { name: 'website', type: 'VARCHAR(255)', after: 'contact_email' },
      { name: 'active', type: 'BOOLEAN DEFAULT TRUE', after: 'website' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP', after: 'active' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', after: 'created_at' }
    ];
    
    for (const col of requiredColumns) {
      const existingColumn = columns.find(c => c.Field === col.name);
      if (!existingColumn) {
        console.log(`➕ Agregando columna ${col.name}...`);
        await connection.promise().query(`
          ALTER TABLE carriers 
          ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}
        `);
        console.log(`✅ Columna ${col.name} agregada`);
      }
    }
    
    // Verificar y crear transportadoras básicas si no existen
    const [existingCarriers] = await connection.promise().query('SELECT name FROM carriers');
    const existingNames = existingCarriers.map(c => c.name.toLowerCase());
    
    const defaultCarriers = [
      { name: 'Interrapidísimo', code: 'INTER', contact_phone: '01-8000-111-770' },
      { name: 'Transprensa', code: 'TRANSPRENSA', contact_phone: '01-8000-111-000' },
      { name: 'Envia', code: 'ENVIA', contact_phone: '01-8000-111-111' },
      { name: 'Camión Externo', code: 'CAMION_EXT', contact_phone: '3105244298' },
      { name: 'Mensajería Local', code: 'MENSAJERIA', contact_phone: '3105244298' },
      { name: 'Coordinadora', code: 'COORDINADORA', contact_phone: '01-8000-122-000' },
      { name: 'Servientrega', code: 'SERVIENTREGA', contact_phone: '01-8000-111-234' }
    ];
    
    for (const carrier of defaultCarriers) {
      if (!existingNames.includes(carrier.name.toLowerCase())) {
        console.log(`➕ Creando transportadora: ${carrier.name}`);
        await connection.promise().query(`
          INSERT INTO carriers (name, code, contact_phone, active, created_at) 
          VALUES (?, ?, ?, TRUE, NOW())
        `, [carrier.name, carrier.code, carrier.contact_phone]);
        console.log(`✅ Transportadora ${carrier.name} creada`);
      }
    }
    
    console.log('✅ Tabla carriers configurada correctamente');
    
    // Mostrar estructura final
    const [finalColumns] = await connection.promise().query("DESCRIBE carriers");
    console.log('📋 Estructura final:', finalColumns.map(col => `${col.Field} (${col.Type})`));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    connection.end();
  }
}

fixCarriersTable();
