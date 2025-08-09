const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function addCamionExternoCarrier() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('🚚 AGREGAR TRANSPORTADORA: CAMIÓN EXTERNO');
    console.log('==========================================\n');
    
    // 1. Ver transportadoras actuales
    console.log('📋 Transportadoras actuales:');
    const [carriers] = await connection.execute(
      'SELECT * FROM carriers ORDER BY name'
    );
    
    carriers.forEach(c => {
      console.log(`${c.id}. ${c.name} - ${c.description || 'Sin descripción'}`);
    });
    
    // 2. Verificar si ya existe
    const [existing] = await connection.execute(
      "SELECT * FROM carriers WHERE name LIKE '%camion%' OR name LIKE '%externo%'"
    );
    
    if (existing.length > 0) {
      console.log('\n⚠️  Ya existe una transportadora similar:', existing[0].name);
    } else {
      // 3. Verificar estructura de la tabla
      console.log('\n🔍 Verificando estructura de la tabla carriers...');
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM carriers"
      );
      
      console.log('Columnas disponibles:', columns.map(c => c.Field).join(', '));
      
      // 4. Agregar nueva transportadora
      console.log('\n✅ Agregando nueva transportadora...');
      
      const [result] = await connection.execute(
        `INSERT INTO carriers (name, active, created_at) 
         VALUES (?, ?, NOW())`,
        [
          'Camión Externo',
          1
        ]
      );
      
      console.log(`✅ Transportadora agregada con ID: ${result.insertId}`);
      
      // 5. Verificar que se agregó correctamente
      const [newCarrier] = await connection.execute(
        'SELECT * FROM carriers WHERE id = ?',
        [result.insertId]
      );
      
      console.log('\n📦 NUEVA TRANSPORTADORA:');
      console.log(`ID: ${newCarrier[0].id}`);
      console.log(`Nombre: ${newCarrier[0].name}`);
      console.log(`Estado: ${newCarrier[0].active ? 'Activa' : 'Inactiva'}`);
      console.log('\n📝 DESCRIPCIÓN:');
      console.log('Servicio de transporte en camión desde Medellín a destinos nacionales.');
      console.log('Ideal para distribuidores y envíos de gran volumen con tarifas preferenciales.');
    }
    
    // 5. Mostrar todas las transportadoras actualizadas
    console.log('\n📋 LISTA ACTUALIZADA DE TRANSPORTADORAS:');
    const [allCarriers] = await connection.execute(
      'SELECT id, name FROM carriers WHERE active = 1 ORDER BY name'
    );
    
    allCarriers.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.name} (ID: ${c.id})`);
    });
    
    console.log('\n💡 USO:');
    console.log('- Para pedidos grandes de distribuidores');
    console.log('- Envíos desde Medellín a otras ciudades');
    console.log('- Tarifas especiales por volumen');
    console.log('- Ideal para reducir costos de flete');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
addCamionExternoCarrier();
