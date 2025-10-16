const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function debugMessengersDropdown() {
  console.log('🔍 === DEBUG: PROBLEMA DE DROPDOWN DE MENSAJEROS ===\n');

  let connection;
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev',
      charset: 'utf8mb4'
    });

    console.log('📊 1. Verificando estructura de tabla users...\n');

    // Primero verificar estructura de tabla users
    const [tableStructure] = await connection.execute('DESCRIBE users');
    console.log('Columnas de la tabla users:');
    tableStructure.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n📊 2. Verificando usuarios con rol mensajero...\n');

    // Verificar usuarios con rol mensajero - usar solo columnas que existen
    const [messengers] = await connection.execute(
      `SELECT id, username, email, role, active, created_at 
       FROM users 
       WHERE role = 'mensajero' 
       ORDER BY created_at DESC`
    );

    console.log(`📋 Total de usuarios con rol 'mensajero': ${messengers.length}`);

    if (messengers.length === 0) {
      console.log('❌ NO SE ENCONTRARON MENSAJEROS en la base de datos');
      console.log('   Esta es la causa del problema del dropdown vacío\n');
      
      // Sugerir creación de mensajeros
      console.log('💡 SOLUCIÓN: Necesitas crear usuarios mensajeros');
      console.log('   Puedes hacerlo desde el panel de administración en:');
      console.log('   /users -> Crear Usuario -> Rol: Mensajero\n');
      
      // Verificar estructura de tabla users
      console.log('📊 2. Verificando estructura de tabla users...\n');
      const [tableStructure] = await connection.execute('DESCRIBE users');
      console.log('Columnas de la tabla users:');
      tableStructure.forEach(col => {
        console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
    } else {
      console.log('\n📋 Mensajeros encontrados:');
      messengers.forEach((messenger, index) => {
        console.log(`   ${index + 1}. ID: ${messenger.id}`);
        console.log(`      Username: ${messenger.username}`);
        console.log(`      Email: ${messenger.email}`);
        console.log(`      Activo: ${messenger.active ? '✅ SÍ' : '❌ NO'}`);
        console.log(`      Creado: ${messenger.created_at}`);
        console.log('');
      });

      // Verificar mensajeros activos
      const activeMessengers = messengers.filter(m => m.active);
      console.log(`📊 Mensajeros activos: ${activeMessengers.length}/${messengers.length}`);
      
      if (activeMessengers.length === 0) {
        console.log('❌ NO HAY MENSAJEROS ACTIVOS');
        console.log('   Los mensajeros existen pero están desactivados');
        console.log('   Esto explica por qué no aparecen en el dropdown\n');
        
        console.log('💡 SOLUCIÓN: Activar mensajeros existentes');
        console.log('   UPDATE users SET active = TRUE WHERE role = "mensajero";\n');
      } else {
        console.log('✅ HAY MENSAJEROS ACTIVOS disponibles\n');
        
        console.log('📊 3. Verificando endpoint de usuarios...\n');
        
        // Simular la query que hace el frontend (usar solo columnas que existen)
        const [frontendQuery] = await connection.execute(
          `SELECT id, username, email, role, active, created_at 
           FROM users 
           WHERE role = 'mensajero' AND active = TRUE 
           ORDER BY username ASC`
        );
        
        console.log(`📋 Query del frontend devolvería: ${frontendQuery.length} mensajeros`);
        
        if (frontendQuery.length === 0) {
          console.log('❌ La query del frontend no encuentra mensajeros activos');
        } else {
          console.log('✅ El backend debería devolver estos mensajeros:');
          frontendQuery.forEach(m => {
            console.log(`   - ${m.username} (ID: ${m.id})`);
          });
        }
      }
    }

    console.log('\n📊 4. Verificando pedidos que requieren mensajería local...\n');

    // Verificar pedidos listos para entrega con mensajería local
    const [localMessagingOrders] = await connection.execute(`
      SELECT 
        o.id, o.order_number, o.customer_name, o.status, o.delivery_method,
        c.name as carrier_name,
        o.assigned_messenger_id
      FROM orders o
      LEFT JOIN carriers c ON o.carrier_id = c.id
      WHERE o.status IN ('listo_para_entrega', 'empacado', 'listo')
        AND (o.delivery_method = 'mensajeria_local' 
             OR c.name LIKE '%mensajeria%' 
             OR c.name = 'Mensajería Local'
             OR (o.delivery_method IS NULL AND o.carrier_id IS NULL))
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    console.log(`📦 Pedidos que requieren mensajería local: ${localMessagingOrders.length}`);
    
    if (localMessagingOrders.length > 0) {
      console.log('\n📋 Pedidos encontrados:');
      localMessagingOrders.forEach((order, index) => {
        console.log(`   ${index + 1}. ${order.order_number} - ${order.customer_name}`);
        console.log(`      Estado: ${order.status}`);
        console.log(`      Método: ${order.delivery_method || 'Sin asignar'}`);
        console.log(`      Transportadora: ${order.carrier_name || 'Sin asignar'}`);
        console.log(`      Mensajero asignado: ${order.assigned_messenger_id || 'Sin asignar'}`);
        console.log('');
      });
    } else {
      console.log('   No hay pedidos que requieran mensajería local actualmente');
    }

    console.log('\n📊 5. Verificando tabla carriers para mensajería local...\n');

    const [messagingCarriers] = await connection.execute(`
      SELECT id, name, code, active, created_at 
      FROM carriers 
      WHERE name LIKE '%mensajeria%' OR name = 'Mensajería Local'
      ORDER BY created_at DESC
    `);

    console.log(`📋 Transportadoras de mensajería encontradas: ${messagingCarriers.length}`);
    
    if (messagingCarriers.length > 0) {
      messagingCarriers.forEach(carrier => {
        console.log(`   - ${carrier.name} (ID: ${carrier.id}) - ${carrier.active ? 'Activa' : 'Inactiva'}`);
      });
    }

    console.log('\n🔍 === DIAGNÓSTICO FINAL ===');
    
    if (messengers.length === 0) {
      console.log('❌ CAUSA PRINCIPAL: No existen usuarios con rol "mensajero"');
      console.log('📝 ACCIÓN REQUERIDA: Crear usuarios mensajeros desde el panel de administración');
    } else if (activeMessengers.length === 0) {
      console.log('❌ CAUSA PRINCIPAL: Los mensajeros existen pero están desactivados');
      console.log('📝 ACCIÓN REQUERIDA: Activar los mensajeros existentes');
    } else {
      console.log('🤔 PROBLEMA POTENCIAL: Los mensajeros existen y están activos');
      console.log('📝 POSIBLES CAUSAS:');
      console.log('   1. Error en el frontend al cargar mensajeros');
      console.log('   2. Problema de autenticación en el endpoint');
      console.log('   3. Error en la estructura de respuesta del API');
      console.log('   4. Los dropdowns no se están renderizando por condición lógica');
    }

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Solo ejecutar si se llama directamente
if (require.main === module) {
  debugMessengersDropdown();
}

module.exports = { debugMessengersDropdown };
