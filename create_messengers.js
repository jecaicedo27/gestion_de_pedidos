const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });

async function createMessengers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev'
  });

  try {
    console.log('🔍 Verificando estructura de la tabla users...');
    const [columns] = await connection.execute('DESCRIBE users');
    console.log('Columnas de la tabla users:');
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

    // Verificar mensajeros existentes
    const [existingMessengers] = await connection.execute(
      'SELECT * FROM users WHERE role = ?', 
      ['mensajero']
    );
    
    console.log(`\n📋 Mensajeros existentes: ${existingMessengers.length}`);
    existingMessengers.forEach(m => console.log(`- ${m.full_name || 'Sin nombre'} (ID: ${m.id})`));

    // Crear Juan si no existe
    const [juanExists] = await connection.execute(
      'SELECT id FROM users WHERE full_name = ? AND role = ?',
      ['Juan', 'mensajero']
    );

    if (juanExists.length === 0) {
      await connection.execute(
        `INSERT INTO users (full_name, username, password, email, role, active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        ['Juan', 'juan.mensajero', '$2a$10$defaulthashedpassword', 'juan@empresa.com', 'mensajero', 1]
      );
      console.log('✅ Mensajero Juan creado exitosamente');
    } else {
      console.log('ℹ️  Mensajero Juan ya existe');
    }

    // Crear Julian si no existe
    const [julianExists] = await connection.execute(
      'SELECT id FROM users WHERE full_name = ? AND role = ?',
      ['Julian', 'mensajero']
    );

    if (julianExists.length === 0) {
      await connection.execute(
        `INSERT INTO users (full_name, username, password, email, role, active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        ['Julian', 'julian.mensajero', '$2a$10$defaulthashedpassword', 'julian@empresa.com', 'mensajero', 1]
      );
      console.log('✅ Mensajero Julian creado exitosamente');
    } else {
      console.log('ℹ️  Mensajero Julian ya existe');
    }

    // Verificar mensajeros después de la creación
    const [finalMessengers] = await connection.execute(
      'SELECT id, full_name, username, active FROM users WHERE role = ? ORDER BY full_name', 
      ['mensajero']
    );
    
    console.log(`\n🎉 Mensajeros finales en el sistema: ${finalMessengers.length}`);
    finalMessengers.forEach(m => {
      console.log(`- ${m.full_name || 'Sin nombre'} (ID: ${m.id}, Username: ${m.username}, Activo: ${m.active ? 'Sí' : 'No'})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createMessengers().catch(console.error);
