const mysql = require('mysql2/promise');
const axios = require('axios');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function debugCarriersNotShowing() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🔍 DEBUG: TRANSPORTADORAS NO VISIBLES');
    console.log('=====================================\n');
    
    // 1. Verificar en la base de datos
    console.log('📊 TRANSPORTADORAS EN LA BASE DE DATOS:');
    const [carriers] = await connection.execute(
      'SELECT id, name, active FROM carriers ORDER BY name'
    );
    
    carriers.forEach(c => {
      console.log(`${c.active ? '✅' : '❌'} ${c.id}. ${c.name} (Activa: ${c.active})`);
    });
    
    // 2. Verificar específicamente Camión Externo
    const [camionExterno] = await connection.execute(
      "SELECT * FROM carriers WHERE name = 'Camión Externo'"
    );
    
    if (camionExterno.length > 0) {
      console.log('\n✅ "Camión Externo" SÍ existe en la BD:');
      console.log(`   ID: ${camionExterno[0].id}`);
      console.log(`   Activa: ${camionExterno[0].active}`);
      console.log(`   Creada: ${camionExterno[0].created_at}`);
    } else {
      console.log('\n❌ "Camión Externo" NO encontrado en la BD');
    }
    
    // 3. Probar el endpoint del backend
    console.log('\n🌐 PROBANDO ENDPOINT DEL BACKEND:');
    console.log('GET http://localhost:3001/api/carriers');
    
    try {
      const response = await axios.get('http://localhost:3001/api/carriers', {
        headers: {
          'Authorization': 'Bearer test' // Puede necesitar un token real
        }
      });
      
      console.log('\n✅ Respuesta del endpoint:');
      console.log(`Total transportadoras: ${response.data.length}`);
      
      const hasCarrierExterno = response.data.some(c => c.name === 'Camión Externo');
      console.log(`¿Incluye "Camión Externo"? ${hasCarrierExterno ? '✅ SÍ' : '❌ NO'}`);
      
      if (!hasCarrierExterno) {
        console.log('\n⚠️  El backend NO está devolviendo "Camión Externo"');
      }
    } catch (error) {
      console.log('\n❌ Error al conectar con el backend:', error.message);
      console.log('Posible causa: El backend no está corriendo o requiere autenticación');
    }
    
    // 4. Posibles soluciones
    console.log('\n💡 POSIBLES SOLUCIONES:');
    console.log('1. Reiniciar el backend: Ctrl+C y npm run dev');
    console.log('2. Limpiar caché del navegador: Ctrl+Shift+R');
    console.log('3. Verificar si hay filtros en el código del frontend');
    console.log('4. Revisar si el controlador del backend filtra transportadoras');
    
    // 5. Verificar si hay algún problema con el orden
    console.log('\n🔢 ORDEN DE LAS TRANSPORTADORAS:');
    const [orderedCarriers] = await connection.execute(
      'SELECT id, name FROM carriers WHERE active = 1 ORDER BY id'
    );
    
    orderedCarriers.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.name} (ID: ${c.id})`);
    });
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
debugCarriersNotShowing();
