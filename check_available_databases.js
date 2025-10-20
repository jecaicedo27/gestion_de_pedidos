const mysql = require('mysql2/promise');

async function checkDatabases() {
    console.log('🔍 Checking available databases...\n');
    
    try {
        // Connect without specifying database
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: ''
        });
        
        // List all databases
        const [databases] = await connection.execute('SHOW DATABASES');
        console.log('📊 Available databases:');
        databases.forEach(db => {
            console.log(`  - ${db.Database}`);
        });
        
        // Check for databases that might be related to our project
        const projectDbs = databases.filter(db => {
            const name = db.Database.toLowerCase();
            return name.includes('gestion') || 
                   name.includes('pedidos') || 
                   name.includes('orders') ||
                   name.includes('inventory');
        });
        
        if (projectDbs.length > 0) {
            console.log('\n✅ Possible project databases found:');
            projectDbs.forEach(db => {
                console.log(`  - ${db.Database}`);
            });
            
            // Check tables in each possible database
            for (const db of projectDbs) {
                console.log(`\n📋 Checking tables in ${db.Database}:`);
                await connection.execute(`USE ${db.Database}`);
                const [tables] = await connection.execute('SHOW TABLES');
                
                if (tables.length > 0) {
                    tables.forEach(table => {
                        const tableName = Object.values(table)[0];
                        console.log(`    - ${tableName}`);
                    });
                } else {
                    console.log('    (No tables found)');
                }
            }
        } else {
            console.log('\n⚠️ No project-related databases found');
            console.log('\n📝 Creating gestion_pedidos database...');
            
            // Create the database
            await connection.execute('CREATE DATABASE IF NOT EXISTS gestion_pedidos');
            console.log('✅ Database gestion_pedidos created');
            
            // Switch to the new database
            await connection.execute('USE gestion_pedidos');
            
            // Create products_batch table
            console.log('\n📋 Creating products_batch table...');
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS products_batch (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    product_code VARCHAR(50),
                    name VARCHAR(255),
                    category VARCHAR(100),
                    price DECIMAL(10,2),
                    stock INT DEFAULT 0,
                    is_active TINYINT DEFAULT 1,
                    barcode VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_category (category),
                    INDEX idx_active (is_active)
                )
            `);
            console.log('✅ Table products_batch created');
            
            // Insert sample products with requested categories
            console.log('\n📦 Inserting sample products...');
            const categories = ['GENIALITY', 'LIQUIPOPS', 'MEZCLAS EN POLVO', 'Productos No fabricados 19%', 'YEXIS'];
            const products = [];
            
            for (const category of categories) {
                for (let i = 1; i <= 5; i++) {
                    products.push([
                        `${category.substring(0, 3).toUpperCase()}${i.toString().padStart(3, '0')}`,
                        `${category} - Producto ${i}`,
                        category,
                        Math.floor(Math.random() * 50000) + 10000,
                        Math.floor(Math.random() * 100) + 10,
                        1,
                        `770123456${Math.floor(Math.random() * 1000)}`
                    ]);
                }
            }
            
            await connection.execute(`
                INSERT INTO products_batch (product_code, name, category, price, stock, is_active, barcode)
                VALUES ?
            `, [products]);
            
            console.log(`✅ Inserted ${products.length} sample products`);
        }
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    }
}

checkDatabases();
