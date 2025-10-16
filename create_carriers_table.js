const { query } = require('./backend/config/database');

const createCarriersTable = async () => {
  try {
    console.log('🚛 Creando tabla carriers...');
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS carriers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        website VARCHAR(255),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    
    await query(createTableQuery);
    console.log('✅ Tabla carriers creada exitosamente');
    
    // Insertar transportadoras básicas
    console.log('📋 Insertando transportadoras básicas...');
    
    const insertCarriers = `
      INSERT IGNORE INTO carriers (name, email, phone, website, active) VALUES
      ('Servientrega', 'info@servientrega.com', '01-8000-111-222', 'https://servientrega.com', TRUE),
      ('TCC', 'contacto@tcc.com.co', '01-8000-122-888', 'https://tcc.com.co', TRUE),
      ('Coordinadora', 'info@coordinadora.com', '01-8000-122-202', 'https://coordinadora.com', TRUE),
      ('Deprisa', 'contacto@deprisa.com', '01-8000-376-774', 'https://deprisa.com', TRUE),
      ('Inter Rapidísimo', 'info@interrapidisimo.com', '01-8000-117-007', 'https://interrapidisimo.com', TRUE),
      ('Envía', 'contacto@envia.co', '01-8000-467-777', 'https://envia.co', TRUE)
    `;
    
    await query(insertCarriers);
    console.log('✅ Transportadoras básicas insertadas');
    
    // Verificar
    const carriers = await query('SELECT * FROM carriers WHERE active = TRUE');
    console.log('📊 Transportadoras activas:', carriers.length);
    carriers.forEach(c => console.log(`   - ${c.name}`));
    
    console.log('🎉 ¡Tabla carriers lista!');
    
  } catch (error) {
    console.error('❌ Error creando tabla carriers:', error);
  }
  
  process.exit(0);
};

createCarriersTable();
