const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugCustomersWithoutDocuments() {
  console.log('🔍 Investigating customers without documents...');
  
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gestion_pedidos_dev'
    });

    console.log('✅ Connected to database');

    // 1. Find customers with null or empty identification
    console.log('\n1. Finding customers without identification...');
    const [customersWithoutId] = await connection.execute(`
      SELECT id, name, commercial_name, identification, document_type, phone, email 
      FROM customers 
      WHERE identification IS NULL OR identification = '' OR TRIM(identification) = ''
      ORDER BY name
      LIMIT 10
    `);

    if (customersWithoutId.length > 0) {
      console.log(`❌ Found ${customersWithoutId.length} customers without identification:`);
      customersWithoutId.forEach(customer => {
        console.log(`   - ID: ${customer.id} | Name: ${customer.name} | Identification: "${customer.identification}" | Email: ${customer.email}`);
      });
    } else {
      console.log('✅ No customers found without identification');
    }

    // 2. Check specific customers mentioned in the image
    console.log('\n2. Checking specific customers from the image...');
    const customerNames = [
      'Adriana Patricia Holguin',
      'Alejandra Espinosa', 
      'Alexandra Zapata Silva'
    ];

    for (const name of customerNames) {
      const [results] = await connection.execute(
        'SELECT id, name, identification, document_type, email FROM customers WHERE name LIKE ? LIMIT 3',
        [`%${name}%`]
      );

      if (results.length > 0) {
        console.log(`\n   Customer: ${name}`);
        results.forEach(customer => {
          console.log(`     - ID: ${customer.id} | Identification: "${customer.identification}" | Type: ${customer.document_type}`);
        });
      } else {
        console.log(`   ❌ Customer "${name}" not found in database`);
      }
    }

    // 3. Check total customers with and without identification
    console.log('\n3. Statistics overview...');
    const [totalCount] = await connection.execute('SELECT COUNT(*) as total FROM customers');
    const [withId] = await connection.execute(`
      SELECT COUNT(*) as count FROM customers 
      WHERE identification IS NOT NULL AND identification != '' AND TRIM(identification) != ''
    `);
    const [withoutId] = await connection.execute(`
      SELECT COUNT(*) as count FROM customers 
      WHERE identification IS NULL OR identification = '' OR TRIM(identification) = ''
    `);

    console.log(`   - Total customers: ${totalCount[0].total}`);
    console.log(`   - With identification: ${withId[0].count}`);
    console.log(`   - Without identification: ${withoutId[0].count}`);

    // 4. Check if this is a SIIGO sync issue
    console.log('\n4. Checking SIIGO sync status...');
    const [siigoCustomers] = await connection.execute(`
      SELECT COUNT(*) as count FROM customers WHERE siigo_id IS NOT NULL AND siigo_id != ''
    `);
    console.log(`   - Customers synced from SIIGO: ${siigoCustomers[0].count}`);

    // 5. Find customers that might have documents in other fields
    console.log('\n5. Checking for identification in other possible fields...');
    const [alternativeFields] = await connection.execute(`
      SELECT id, name, identification, check_digit, phone, email
      FROM customers 
      WHERE (identification IS NULL OR identification = '' OR TRIM(identification) = '')
      AND (phone IS NOT NULL AND phone != '' AND phone REGEXP '^[0-9]+$' AND LENGTH(phone) >= 7)
      LIMIT 5
    `);

    if (alternativeFields.length > 0) {
      console.log('   📋 Customers that might have phone numbers as potential IDs:');
      alternativeFields.forEach(customer => {
        console.log(`     - ${customer.name} | Phone: ${customer.phone} | Email: ${customer.email}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the investigation
debugCustomersWithoutDocuments()
  .then(() => {
    console.log('\n🔍 Investigation completed');
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
  });
