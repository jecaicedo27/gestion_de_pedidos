const mysql = require('mysql2/promise');

async function checkCustomersTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
  });

  try {
    console.log('Checking customers table structure...');
    const [columns] = await connection.execute('DESCRIBE customers');
    console.log('Customers table columns:');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? col.Key : ''}`);
    });

    console.log('\nSample customer records:');
    const [records] = await connection.execute('SELECT * FROM customers LIMIT 3');
    records.forEach((record, index) => {
      console.log(`Customer ${index + 1}:`, record);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkCustomersTable();
