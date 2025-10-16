const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

// Database connection
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

async function checkDatabaseTables() {
    console.log('🔍 CHECKING DATABASE TABLES STRUCTURE');
    console.log('====================================\n');
    
    let connection;
    
    try {
        // Connect to database
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Database connection established');
        console.log(`📊 Connected to database: ${process.env.DB_NAME}\n`);
        
        // 1. List all tables
        console.log('📋 1. ALL TABLES IN DATABASE');
        console.log('---------------------------');
        
        const [tables] = await connection.execute('SHOW TABLES');
        if (tables.length === 0) {
            console.log('❌ No tables found in database');
            return;
        }
        
        tables.forEach((table, index) => {
            const tableName = Object.values(table)[0];
            console.log(`${index + 1}. ${tableName}`);
        });
        console.log();
        
        // 2. Look for products-related tables
        console.log('🔍 2. PRODUCTS-RELATED TABLES');
        console.log('-----------------------------');
        
        const productTables = tables.filter(table => {
            const tableName = Object.values(table)[0].toLowerCase();
            return tableName.includes('product');
        });
        
        if (productTables.length === 0) {
            console.log('❌ No product-related tables found');
        } else {
            for (const table of productTables) {
                const tableName = Object.values(table)[0];
                console.log(`\n📊 Table: ${tableName}`);
                console.log('------------------------');
                
                try {
                    const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
                    columns.forEach(column => {
                        console.log(`   ${column.Field} (${column.Type}) ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `[${column.Key}]` : ''}`);
                    });
                    
                    // Count records
                    const [count] = await connection.execute(`SELECT COUNT(*) as total FROM ${tableName}`);
                    console.log(`   📊 Total records: ${count[0].total}`);
                } catch (error) {
                    console.log(`   ❌ Error describing table: ${error.message}`);
                }
            }
        }
        console.log();
        
        // 3. Check for inventory tables
        console.log('📦 3. INVENTORY-RELATED TABLES');
        console.log('------------------------------');
        
        const inventoryTables = tables.filter(table => {
            const tableName = Object.values(table)[0].toLowerCase();
            return tableName.includes('inventory') || tableName.includes('stock');
        });
        
        if (inventoryTables.length === 0) {
            console.log('❌ No inventory-related tables found');
        } else {
            for (const table of inventoryTables) {
                const tableName = Object.values(table)[0];
                console.log(`\n📦 Table: ${tableName}`);
                console.log('------------------------');
                
                try {
                    const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
                    columns.forEach(column => {
                        console.log(`   ${column.Field} (${column.Type}) ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${column.Key ? `[${column.Key}]` : ''}`);
                    });
                    
                    // Count records
                    const [count] = await connection.execute(`SELECT COUNT(*) as total FROM ${tableName}`);
                    console.log(`   📊 Total records: ${count[0].total}`);
                } catch (error) {
                    console.log(`   ❌ Error describing table: ${error.message}`);
                }
            }
        }
        console.log();
        
        // 4. Try to find the correct products table based on common patterns
        console.log('🔍 4. SEARCHING FOR CORRECT PRODUCTS TABLE');
        console.log('-----------------------------------------');
        
        const possibleProductTables = [
            'products',
            'products_base', 
            'product',
            'siigo_products',
            'inventory_products'
        ];
        
        let foundProductsTable = null;
        
        for (const tableName of possibleProductTables) {
            try {
                const [result] = await connection.execute(`SELECT COUNT(*) as total FROM ${tableName} LIMIT 1`);
                console.log(`✅ Found table: ${tableName} (${result[0].total} records)`);
                
                // Check if it has expected product columns
                const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
                const columnNames = columns.map(col => col.Field);
                
                if (columnNames.includes('internal_code') || columnNames.includes('product_name') || columnNames.includes('name')) {
                    foundProductsTable = tableName;
                    console.log(`   ✅ This looks like the main products table!`);
                    
                    // Show structure
                    console.log('   📊 Column structure:');
                    columns.forEach(column => {
                        console.log(`      ${column.Field} (${column.Type}) ${column.Key ? `[${column.Key}]` : ''}`);
                    });
                    
                    // Check for is_active column
                    if (columnNames.includes('is_active')) {
                        console.log('   ✅ has is_active column');
                        const [activeCount] = await connection.execute(`
                            SELECT 
                                is_active,
                                COUNT(*) as count 
                            FROM ${tableName} 
                            GROUP BY is_active
                        `);
                        console.log('   📊 Active status distribution:');
                        activeCount.forEach(row => {
                            const status = row.is_active === 1 ? 'ACTIVE' : 'INACTIVE';
                            console.log(`      ${status}: ${row.count} products`);
                        });
                    } else {
                        console.log('   ❌ Missing is_active column');
                    }
                    break;
                }
            } catch (error) {
                // Table doesn't exist, continue
            }
        }
        
        if (!foundProductsTable) {
            console.log('❌ Could not find a suitable products table');
            console.log('\n💡 RECOMMENDATION: Check the backend code to see what table name is being used for products');
        } else {
            console.log(`\n✅ MAIN PRODUCTS TABLE IDENTIFIED: ${foundProductsTable}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Execute the function
if (require.main === module) {
    checkDatabaseTables()
        .then(() => {
            console.log('\n✅ Database structure check complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

module.exports = checkDatabaseTables;
