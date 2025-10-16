const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

// Configuración de base de datos
const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_pedidos_dev',
  port: process.env.DB_PORT || 3306
});

async function verifySetup() {
  console.log('🔍 Verificando configuración para cotizaciones SIIGO...\n');

  // 1. Verificar tabla de clientes
  console.log('1️⃣ Verificando tabla de clientes...');
  const checkCustomers = () => new Promise((resolve, reject) => {
    connection.query('SELECT COUNT(*) as count FROM customers', (err, results) => {
      if (err) {
        console.error('❌ Error verificando clientes:', err.message);
        reject(err);
      } else {
        console.log(`✅ Tabla customers existe con ${results[0].count} registros`);
        resolve(results[0].count);
      }
    });
  });

  // 2. Verificar cliente de prueba con siigo_id
  console.log('\n2️⃣ Verificando clientes con siigo_id...');
  const checkSiigoCustomers = () => new Promise((resolve, reject) => {
    connection.query('SELECT id, name, siigo_id FROM customers WHERE siigo_id IS NOT NULL LIMIT 5', (err, results) => {
      if (err) {
        console.error('❌ Error buscando clientes con siigo_id:', err.message);
        reject(err);
      } else {
        if (results.length > 0) {
          console.log(`✅ Encontrados ${results.length} clientes con siigo_id:`);
          results.forEach(c => console.log(`   - ${c.name} (ID: ${c.id}, SIIGO: ${c.siigo_id})`));
        } else {
          console.log('⚠️ No hay clientes con siigo_id configurado');
        }
        resolve(results);
      }
    });
  });

  // 3. Verificar tabla de cotizaciones (si existe)
  console.log('\n3️⃣ Verificando tabla de cotizaciones...');
  const checkQuotations = () => new Promise((resolve, reject) => {
    connection.query("SHOW TABLES LIKE 'quotations'", (err, results) => {
      if (err) {
        console.error('❌ Error verificando tabla quotations:', err.message);
        reject(err);
      } else if (results.length === 0) {
        console.log('⚠️ Tabla quotations no existe - creándola...');
        const createTable = `
          CREATE TABLE IF NOT EXISTS quotations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quotation_number VARCHAR(50),
            customer_id INT,
            siigo_customer_id VARCHAR(100),
            siigo_quotation_number VARCHAR(100),
            raw_request TEXT,
            notes TEXT,
            status ENUM('draft', 'sent', 'approved', 'rejected') DEFAULT 'draft',
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            INDEX idx_quotation_number (quotation_number),
            INDEX idx_siigo_quotation (siigo_quotation_number)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
        
        connection.query(createTable, (err) => {
          if (err) {
            console.error('❌ Error creando tabla:', err.message);
            reject(err);
          } else {
            console.log('✅ Tabla quotations creada exitosamente');
            resolve(true);
          }
        });
      } else {
        console.log('✅ Tabla quotations existe');
        resolve(true);
      }
    });
  });

  // 4. Verificar tabla de items de cotización
  console.log('\n4️⃣ Verificando tabla de items de cotización...');
  const checkQuotationItems = () => new Promise((resolve, reject) => {
    connection.query("SHOW TABLES LIKE 'quotation_items'", (err, results) => {
      if (err) {
        console.error('❌ Error verificando tabla quotation_items:', err.message);
        reject(err);
      } else if (results.length === 0) {
        console.log('⚠️ Tabla quotation_items no existe - creándola...');
        const createTable = `
          CREATE TABLE IF NOT EXISTS quotation_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quotation_id INT,
            product_code VARCHAR(100),
            product_name VARCHAR(255),
            quantity INT DEFAULT 1,
            unit_price DECIMAL(10, 2) DEFAULT 0,
            confidence_score DECIMAL(3, 2) DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
            INDEX idx_quotation (quotation_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
        
        connection.query(createTable, (err) => {
          if (err) {
            console.error('❌ Error creando tabla:', err.message);
            reject(err);
          } else {
            console.log('✅ Tabla quotation_items creada exitosamente');
            resolve(true);
          }
        });
      } else {
        console.log('✅ Tabla quotation_items existe');
        resolve(true);
      }
    });
  });

  // 5. Verificar configuración de SIIGO
  console.log('\n5️⃣ Verificando configuración de SIIGO...');
  const checkSiigoConfig = () => {
    const hasConfig = process.env.SIIGO_API_USERNAME && process.env.SIIGO_API_ACCESS_KEY;
    if (hasConfig) {
      console.log('✅ Credenciales SIIGO configuradas');
      console.log(`   - Usuario: ${process.env.SIIGO_API_USERNAME}`);
      console.log(`   - API URL: ${process.env.SIIGO_API_BASE_URL || 'https://api.siigo.com'}`);
    } else {
      console.log('❌ Credenciales SIIGO no configuradas en .env');
      console.log('   Necesitas configurar:');
      console.log('   - SIIGO_API_USERNAME');
      console.log('   - SIIGO_API_ACCESS_KEY');
    }
    return hasConfig;
  };

  // 6. Crear cliente de prueba si no existe
  console.log('\n6️⃣ Asegurando cliente de prueba...');
  const ensureTestCustomer = () => new Promise((resolve, reject) => {
    // Primero verificar si existe
    connection.query(
      "SELECT * FROM customers WHERE document = '123456789' LIMIT 1",
      (err, results) => {
        if (err) {
          reject(err);
        } else if (results.length > 0) {
          console.log('✅ Cliente de prueba ya existe:', results[0].name);
          resolve(results[0]);
        } else {
          // Crear cliente de prueba
          const insertQuery = `
            INSERT INTO customers (
              name, document, siigo_id, email, phone, address, 
              is_active, created_at, updated_at
            ) VALUES (
              'Cliente Prueba Cotizaciones',
              '123456789',
              '9999',
              'prueba@example.com',
              '3001234567',
              'Dirección de prueba',
              1,
              NOW(),
              NOW()
            )`;
          
          connection.query(insertQuery, (err, result) => {
            if (err) {
              console.error('❌ Error creando cliente de prueba:', err.message);
              reject(err);
            } else {
              console.log('✅ Cliente de prueba creado con ID:', result.insertId);
              resolve({ id: result.insertId, name: 'Cliente Prueba Cotizaciones' });
            }
          });
        }
      }
    );
  });

  try {
    await checkCustomers();
    const siigoCustomers = await checkSiigoCustomers();
    await checkQuotations();
    await checkQuotationItems();
    const hasSiigoConfig = checkSiigoConfig();
    const testCustomer = await ensureTestCustomer();

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE VERIFICACIÓN:');
    console.log('='.repeat(60));
    
    if (siigoCustomers.length > 0 && hasSiigoConfig) {
      console.log('✅ Sistema listo para crear cotizaciones en SIIGO');
      console.log('\n📝 Puedes usar estos clientes para pruebas:');
      siigoCustomers.slice(0, 3).forEach(c => {
        console.log(`   - ${c.name} (ID: ${c.id})`);
      });
    } else {
      console.log('⚠️ Faltan configuraciones:');
      if (siigoCustomers.length === 0) {
        console.log('   - No hay clientes con siigo_id');
        console.log('   - Ejecuta sincronización de clientes desde SIIGO');
      }
      if (!hasSiigoConfig) {
        console.log('   - Configura las credenciales de SIIGO en backend/.env');
      }
    }

    console.log('\n💡 Si ves error 500 al crear cotización:');
    console.log('   1. Verifica que el backend esté corriendo');
    console.log('   2. Revisa los logs del backend para ver el error específico');
    console.log('   3. Asegúrate de que el cliente tenga siigo_id configurado');

  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error.message);
  } finally {
    connection.end();
  }
}

verifySetup();
