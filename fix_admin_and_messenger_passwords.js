const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixPasswords() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('🔧 Fixing admin and messenger passwords...');
        console.log('================================================');

        // Hash for "password123" using bcrypt
        const hashedPassword = '$2a$10$YjRzKXmPqJZ.tpDmPWvOZOxNDkyH0N1sMT5CKkfvNXJJYYxXHhWba';

        // Fix admin password
        console.log('\n1. Fixing admin password...');
        const [adminResult] = await connection.execute(
            'UPDATE users SET password = ?, active = 1 WHERE username = ?',
            [hashedPassword, 'admin']
        );
        
        if (adminResult.affectedRows > 0) {
            console.log('✅ Admin password reset to: password123');
        } else {
            console.log('⚠️ Admin user not found, creating it...');
            await connection.execute(`
                INSERT INTO users (username, email, phone, password, role, active) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['admin', 'admin@perlas.com', '3000000000', hashedPassword, 'admin', 1]);
            console.log('✅ Admin user created with password: password123');
        }

        // Fix mensajero1 password
        console.log('\n2. Fixing mensajero1 password...');
        const [mensajeroResult] = await connection.execute(
            'UPDATE users SET password = ?, active = 1 WHERE username = ?',
            [hashedPassword, 'mensajero1']
        );
        
        if (mensajeroResult.affectedRows > 0) {
            console.log('✅ mensajero1 password reset to: password123');
        } else {
            console.log('⚠️ mensajero1 not found, creating it...');
            await connection.execute(`
                INSERT INTO users (username, email, phone, password, role, active) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['mensajero1', 'mensajero1@perlas.com', '3001234567', hashedPassword, 'mensajero', 1]);
            console.log('✅ mensajero1 created with password: password123');
        }

        // Verify users
        console.log('\n3. Verifying users...');
        const [users] = await connection.execute(`
            SELECT username, email, role, active 
            FROM users 
            WHERE username IN ('admin', 'mensajero1')
        `);

        console.log('\n📋 User Status:');
        users.forEach(user => {
            console.log(`   ${user.username}: ${user.role} (${user.active ? 'Active' : 'Inactive'})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

fixPasswords();
