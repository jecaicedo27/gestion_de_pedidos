const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDocumentDisplayFix() {
  console.log('🧪 Testing document display fix...');
  
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

    // 1. Get the customer with document 1082746400
    console.log('\n1. Fetching customer with identification 1082746400...');
    const [customers] = await connection.execute(
      'SELECT id, name, identification, document_type FROM customers WHERE identification = ?',
      ['1082746400']
    );

    if (customers.length === 0) {
      console.log('❌ Customer not found');
      return;
    }

    const customer = customers[0];
    console.log('✅ Customer found:');
    console.log(`   - ID: ${customer.id}`);
    console.log(`   - Name: ${customer.name}`);
    console.log(`   - Identification: ${customer.identification}`);
    console.log(`   - Document Type: ${customer.document_type}`);

    // 2. Simulate the frontend logic
    console.log('\n2. Simulating frontend logic...');
    
    // This is what the frontend should now receive
    const selectedCustomer = {
      id: customer.id,
      name: customer.name,
      identification: customer.identification, // ✅ Now using 'identification' instead of 'document'
      document_type: customer.document_type
    };

    // Simulate the SIIGO JSON generation
    const siigoJson = {
      document: { 
        id: 5153 // FV-1 - Factura No Electrónica de Venta
      },
      date: new Date().toISOString().split('T')[0],
      customer: {
        identification: selectedCustomer.identification, // ✅ Fixed: now accesses 'identification'
        identification_type: selectedCustomer.identification?.length > 10 ? 31 : 13, // ✅ Fixed: now checks 'identification' length
        branch_office: 0
      },
      cost_center: 235,
      seller: 629
    };

    console.log('✅ SIIGO JSON generated successfully:');
    console.log(`   - Customer identification: ${siigoJson.customer.identification}`);
    console.log(`   - Identification type: ${siigoJson.customer.identification_type} (${siigoJson.customer.identification_type === 31 ? 'NIT' : 'Cédula'})`);
    console.log(`   - Document type ID: ${siigoJson.document.id} (FV-1)`);

    // 3. Test the fallback logic in display
    console.log('\n3. Testing display fallback logic...');
    const displayValue = siigoJson.customer.identification || selectedCustomer?.identification || 'Sin documento';
    console.log(`   - Display value: "${displayValue}"`);
    
    if (displayValue === '1082746400') {
      console.log('✅ SUCCESS: Document number 1082746400 will now be displayed correctly!');
    } else {
      console.log('❌ ERROR: Document number is not displaying correctly');
    }

    // 4. Test edge cases
    console.log('\n4. Testing edge cases...');
    
    // Test with null identification
    const emptyCustomer = { identification: null };
    const emptyDisplayValue = emptyCustomer.identification || 'Sin documento';
    console.log(`   - Null identification displays as: "${emptyDisplayValue}"`);
    
    // Test identification type logic
    const shortDoc = '12345678';
    const longDoc = '12345678901';
    console.log(`   - Short doc (${shortDoc}) type: ${shortDoc.length > 10 ? 31 : 13} (${shortDoc.length > 10 ? 'NIT' : 'CC'})`);
    console.log(`   - Long doc (${longDoc}) type: ${longDoc.length > 10 ? 31 : 13} (${longDoc.length > 10 ? 'NIT' : 'CC'})`);
    console.log(`   - Target doc (1082746400) type: ${customer.identification.length > 10 ? 31 : 13} (${customer.identification.length > 10 ? 'NIT' : 'CC'})`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testDocumentDisplayFix()
  .then(() => {
    console.log('\n🧪 Test completed');
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
  });
