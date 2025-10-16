const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkDeliveryMethods() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos'
  });

  try {
    console.log('🔍 Verificando métodos de envío disponibles...\n');

    // Verificar métodos de envío
    const [methods] = await connection.execute(
      'SELECT * FROM delivery_methods WHERE active = true ORDER BY name'
    );

    console.log('📦 Métodos de envío activos:');
    console.log('==========================');
    methods.forEach(method => {
      console.log(`  - Código: ${method.code}`);
      console.log(`    Nombre: ${method.name}`);
      console.log(`    ID: ${method.id}`);
      if (method.code.includes('domicilio') || method.name.toLowerCase().includes('domicilio')) {
        console.log('    🎯 CONTIENE "DOMICILIO"');
      }
      console.log('  ---');
    });

    // Verificar transportadoras
    console.log('\n🚚 Transportadoras disponibles:');
    console.log('================================');
    const [carriers] = await connection.execute(
      'SELECT * FROM carriers WHERE active = true ORDER BY name'
    );

    carriers.forEach(carrier => {
      console.log(`  - ID: ${carrier.id}`);
      console.log(`    Nombre: ${carrier.name}`);
      if (carrier.name.toLowerCase().includes('mensajería') || carrier.name.toLowerCase().includes('local')) {
        console.log('    🎯 MENSAJERÍA LOCAL');
      }
      console.log('  ---');
    });

    // Buscar específicamente Mensajería Local con ID 32
    const [mensajeriaLocal] = await connection.execute(
      'SELECT * FROM carriers WHERE id = 32'
    );

    if (mensajeriaLocal.length > 0) {
      console.log('\n✅ CONFIRMADO: Mensajería Local existe con ID 32');
      console.log('  Nombre:', mensajeriaLocal[0].name);
      console.log('  Activo:', mensajeriaLocal[0].active ? 'Sí' : 'No');
    } else {
      console.log('\n⚠️ ADVERTENCIA: No existe transportadora con ID 32');
      
      // Buscar cualquier transportadora que contenga "mensajería" o "local"
      const [localCarriers] = await connection.execute(
        `SELECT * FROM carriers 
         WHERE LOWER(name) LIKE '%mensajería%' 
         OR LOWER(name) LIKE '%mensajeria%'
         OR LOWER(name) LIKE '%local%'`
      );

      if (localCarriers.length > 0) {
        console.log('\n📍 Transportadoras relacionadas con mensajería local:');
        localCarriers.forEach(carrier => {
          console.log(`  - ID: ${carrier.id} - ${carrier.name}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

checkDeliveryMethods().catch(console.error);
