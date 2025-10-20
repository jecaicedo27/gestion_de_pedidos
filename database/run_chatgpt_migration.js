const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runChatGPTMigration() {
    console.log('🚀 Starting ChatGPT Migration...');
    
    let connection;
    
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev',
            charset: 'utf8mb4'
        });

        console.log('✅ Connected to database');

        // Read and execute the ChatGPT table creation SQL
        const sqlPath = path.join(__dirname, 'create_chatgpt_log_table.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        await connection.execute(sqlContent);
        console.log('✅ ChatGPT processing log table created successfully');

        // Verify the table was created
        const [tables] = await connection.execute(`
            SHOW TABLES LIKE 'chatgpt_processing_log'
        `);
        
        if (tables.length > 0) {
            console.log('✅ Table verification successful');
            
            // Show table structure
            const [columns] = await connection.execute(`
                DESCRIBE chatgpt_processing_log
            `);
            
            console.log('\n📋 Table Structure:');
            columns.forEach(column => {
                console.log(`  - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
            });
        } else {
            throw new Error('Table was not created successfully');
        }

        console.log('\n🎉 ChatGPT migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Load environment variables
require('dotenv').config({ path: '../backend/.env' });

// Run migration
runChatGPTMigration();
