const mysql = require('mysql2/promise');

async function checkProductsTableStructure() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_de_pedidos'
        });

        console.log('🔍 Checking products table structure...\n');
        
        // Show table structure
        const [columns] = await connection.execute('DESCRIBE products');
        
        console.log('📋 PRODUCTS TABLE COLUMNS:');
        console.log('==========================');
        columns.forEach(column => {
            console.log(`${column.Field.padEnd(25)} | ${column.Type.padEnd(20)} | ${column.Null.padEnd(5)} | ${column.Key.padEnd(5)} | ${column.Default}`);
        });
        
        console.log('\n🔍 Checking for specific columns we need...\n');
        
        // Check if specific columns exist
        const requiredColumns = ['name', 'product_name', 'active', 'available_quantity', 'code', 'deleted_at'];
        
        for (const col of requiredColumns) {
            const exists = columns.some(column => column.Field === col);
            console.log(`${col.padEnd(20)} | ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        }

        console.log('\n📊 Sample data from table:');
        console.log('===========================');
        
        try {
            const [sampleData] = await connection.execute(`
                SELECT id, code, name, active, available_quantity 
                FROM products 
                LIMIT 5
            `);
            
            sampleData.forEach(row => {
                console.log(`ID: ${row.id} | Code: ${row.code} | Name: ${row.name} | Active: ${row.active} | Stock: ${row.available_quantity}`);
            });
        } catch (error) {
            console.log('❌ Error getting sample data:', error.message);
            
            // Try with different column name
            try {
                const [sampleData2] = await connection.execute(`
                    SELECT id, code, product_name, active, available_quantity 
                    FROM products 
                    LIMIT 5
                `);
                
                console.log('Using product_name column:');
                sampleData2.forEach(row => {
                    console.log(`ID: ${row.id} | Code: ${row.code} | Name: ${row.product_name} | Active: ${row.active} | Stock: ${row.available_quantity}`);
                });
            } catch (error2) {
                console.log('❌ Error with product_name column too:', error2.message);
            }
        }

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkProductsTableStructure();
