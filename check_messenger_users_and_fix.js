const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkAndFixMessengerUsers() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('🔍 Checking messenger users in database...');
        console.log('===============================================');

        // Check all messenger users
        const [messengers] = await connection.execute(`
            SELECT id, username, email, phone, role, active 
            FROM users 
            WHERE role = 'mensajero'
            ORDER BY id
        `);

        console.log(`\n📋 Found ${messengers.length} messenger users:`);
        messengers.forEach(user => {
            console.log(`\n👤 ${user.username}:`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Phone: ${user.phone}`);
            console.log(`   Active: ${user.active ? 'Yes' : 'No'}`);
        });

        // Reset mensajero1 password to password123
        console.log('\n🔧 Resetting mensajero1 password...');
        
        // First check if mensajero1 exists
        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            ['mensajero1']
        );

        if (existing.length === 0) {
            console.log('⚠️ mensajero1 not found, creating it...');
            
            // Create mensajero1 with bcrypt hashed password for "password123"
            const hashedPassword = '$2a$10$YjRzKXmPqJZ.tpDmPWvOZOxNDkyH0N1sMT5CKkfvNXJJYYxXHhWba';
            
            await connection.execute(`
                INSERT INTO users (username, email, phone, password, role, active) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['mensajero1', 'mensajero1@perlas.com', '3001234567', hashedPassword, 'mensajero', 1]);
            
            console.log('✅ mensajero1 created successfully');
        } else {
            // Update password for existing mensajero1
            const hashedPassword = '$2a$10$YjRzKXmPqJZ.tpDmPWvOZOxNDkyH0N1sMT5CKkfvNXJJYYxXHhWba';
            
            await connection.execute(`
                UPDATE users 
                SET password = ?, active = 1 
                WHERE username = ?
            `, [hashedPassword, 'mensajero1']);
            
            console.log('✅ mensajero1 password reset to: password123');
        }

        // Check order 537 status and assignment
        console.log('\n📦 Checking order 537 (Ximena\'s order)...');
        const [order] = await connection.execute(`
            SELECT 
                o.id, 
                o.order_number, 
                o.customer_name,
                o.status, 
                o.assigned_messenger_id,
                o.delivery_method,
                u.username as messenger_username
            FROM orders o
            LEFT JOIN users u ON o.assigned_messenger_id = u.id
            WHERE o.id = 537
        `);

        if (order.length > 0) {
            console.log('\nOrder 537 details:');
            console.log(`  Order Number: ${order[0].order_number}`);
            console.log(`  Customer: ${order[0].customer_name}`);
            console.log(`  Status: ${order[0].status}`);
            console.log(`  Delivery Method: ${order[0].delivery_method}`);
            console.log(`  Assigned Messenger ID: ${order[0].assigned_messenger_id || 'None'}`);
            console.log(`  Assigned Messenger: ${order[0].messenger_username || 'None'}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkAndFixMessengerUsers();
