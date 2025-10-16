const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugCustomerDocumentIssue() {
  console.log('🔍 Debugging customer document display issue...');
  
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

    // 1. Check if customer with document 1082746400 exists
    console.log('\n1. Searching for customer with document 1082746400...');
    const [customers] = await connection.execute(
      'SELECT id, name, document, commercial_name, email, phone FROM customers WHERE document = ? OR document LIKE ?',
      ['1082746400', '%1082746400%']
    );

    if (customers.length > 0) {
      console.log('✅ Found customer(s):');
      customers.forEach(customer => {
        console.log(`   - ID: ${customer.id}`);
        console.log(`   - Name: ${customer.name}`);
        console.log(`   - Document: ${customer.document}`);
        console.log(`   - Commercial Name: ${customer.commercial_name}`);
        console.log(`   - Email: ${customer.email}`);
        console.log(`   - Phone: ${customer.phone}`);
        console.log('   ---');
      });
    } else {
      console.log('❌ No customer found with document 1082746400');
    }

    // 2. Check all customers to see document patterns
    console.log('\n2. Checking all customer documents for patterns...');
    const [allCustomers] = await connection.execute(
      'SELECT id, name, document FROM customers WHERE document IS NOT NULL AND document != "" ORDER BY id LIMIT 10'
    );

    console.log('📋 Sample customer documents:');
    allCustomers.forEach(customer => {
      console.log(`   - ID: ${customer.id}, Name: ${customer.name}, Document: "${customer.document}" (Length: ${customer.document ? customer.document.length : 0})`);
    });

    // 3. Search for documents containing '1082746400'
    console.log('\n3. Searching for documents containing 1082746400...');
    const [containingCustomers] = await connection.execute(
      'SELECT id, name, document FROM customers WHERE document LIKE ?',
      ['%1082746400%']
    );

    if (containingCustomers.length > 0) {
      console.log('✅ Found customers with documents containing 1082746400:');
      containingCustomers.forEach(customer => {
        console.log(`   - ID: ${customer.id}, Name: ${customer.name}, Document: "${customer.document}"`);
      });
    } else {
      console.log('❌ No customers found with documents containing 1082746400');
    }

    // 4. Check customers table structure
    console.log('\n4. Checking customers table structure...');
    const [columns] = await connection.execute('DESCRIBE customers');
    console.log('📋 Customers table columns:');
    columns.forEach(column => {
      console.log(`   - ${column.Field}: ${column.Type} (Null: ${column.Null}, Key: ${column.Key}, Default: ${column.Default})`);
    });

    // 5. Check if there are any quotations or recent activity
    console.log('\n5. Checking for recent quotations...');
    const [quotations] = await connection.execute(`
      SELECT q.id, q.customer_id, c.name as customer_name, c.document as customer_document, 
             q.created_at
      FROM quotations q 
      LEFT JOIN customers c ON q.customer_id = c.id 
      ORDER BY q.created_at DESC 
      LIMIT 5
    `);

    if (quotations.length > 0) {
      console.log('📋 Recent quotations:');
      quotations.forEach(quote => {
        console.log(`   - Quote ID: ${quote.id}, Customer: ${quote.customer_name}, Document: "${quote.customer_document}", Created: ${quote.created_at}`);
      });
    } else {
      console.log('❌ No quotations found');
    }

    // 6. Test the JSON generation logic
    console.log('\n6. Testing JSON generation logic for document types...');
    
    const testDocuments = [
      '1082746400',
      '12345678',
      '1234567890123',
      null,
      '',
      undefined
    ];

    testDocuments.forEach(doc => {
      const identificationType = doc && doc.length > 10 ? 31 : 13;
      console.log(`   - Document: "${doc}" (Length: ${doc ? doc.length : 0}) => Type: ${identificationType} (${identificationType === 31 ? 'NIT' : 'CC'})`);
    });

    // 7. Search for similar documents (in case of typos)
    console.log('\n7. Searching for similar documents...');
    const [similarDocs] = await connection.execute(
      'SELECT id, name, document FROM customers WHERE document REGEXP ? LIMIT 5',
      ['108274']  // First 6 digits
    );

    if (similarDocs.length > 0) {
      console.log('📋 Documents starting with 108274:');
      similarDocs.forEach(customer => {
        console.log(`   - ID: ${customer.id}, Name: ${customer.name}, Document: "${customer.document}"`);
      });
    } else {
      console.log('❌ No documents found starting with 108274');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the debug
debugCustomerDocumentIssue()
  .then(() => {
    console.log('\n🔍 Debug completed');
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
  });
