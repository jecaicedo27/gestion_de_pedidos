const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

// Función idéntica a la que está en siigoService.js
async function getSystemUserId(connection) {
    try {
      const [result] = await connection.execute(`
        SELECT id FROM users 
        WHERE role IN ('admin', 'sistema') 
        ORDER BY 
          CASE WHEN username = 'sistema' THEN 1 ELSE 2 END, 
          id 
        LIMIT 1
      `);
      return result.length > 0 ? result[0].id : null;
    } catch (error) {
      console.warn('Error obteniendo usuario del sistema:', error.message);
      return null;
    }
}

async function debugGetSystemUserId() {
    let connection;
    try {
        console.log('🔍 DEBUGGEANDO getSystemUserId()...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // PASO 1: Ver todos los usuarios
        console.log('\n👥 PASO 1: Todos los usuarios en la base de datos...');
        const [allUsers] = await connection.execute('SELECT id, username, role FROM users ORDER BY id');
        
        console.log(`   📊 Total usuarios: ${allUsers.length}`);
        allUsers.forEach(user => {
            console.log(`      - ID ${user.id}: ${user.username} (${user.role})`);
        });
        
        // PASO 2: Probar el query específico
        console.log('\n🔍 PASO 2: Probando query específico...');
        const query = `
        SELECT id FROM users 
        WHERE role IN ('admin', 'sistema') 
        ORDER BY 
          CASE WHEN username = 'sistema' THEN 1 ELSE 2 END, 
          id 
        LIMIT 1
        `;
        
        console.log('📋 Query ejecutado:', query.trim());
        
        const [result] = await connection.execute(query);
        console.log(`   📊 Resultados: ${result.length}`);
        
        if (result.length > 0) {
            console.log(`   ✅ Usuario encontrado: ID ${result[0].id}`);
        } else {
            console.log(`   ❌ No se encontró usuario`);
        }
        
        // PASO 3: Probar la función
        console.log('\n🧪 PASO 3: Probando función getSystemUserId()...');
        const userId = await getSystemUserId(connection);
        console.log(`   📊 Resultado de función: ${userId}`);
        
        if (userId) {
            console.log(`   ✅ Función devolvió ID: ${userId}`);
            
            // Verificar que el usuario existe realmente
            const [userExists] = await connection.execute('SELECT id, username, role FROM users WHERE id = ?', [userId]);
            if (userExists.length > 0) {
                console.log(`   ✅ Usuario verificado: ${userExists[0].username} (${userExists[0].role})`);
            } else {
                console.log(`   ❌ ERROR: El ID ${userId} no existe en la tabla users`);
            }
        } else {
            console.log(`   ❌ Función devolvió NULL`);
        }
        
        // PASO 4: Analizar el problema
        console.log('\n🎯 PASO 4: Análisis del problema...');
        
        const [adminUsers] = await connection.execute(`SELECT id, username FROM users WHERE role = 'admin'`);
        const [sistemaUsers] = await connection.execute(`SELECT id, username FROM users WHERE role = 'sistema'`);
        
        console.log(`   👑 Usuarios admin: ${adminUsers.length}`);
        adminUsers.forEach(user => {
            console.log(`      - ID ${user.id}: ${user.username}`);
        });
        
        console.log(`   🤖 Usuarios sistema: ${sistemaUsers.length}`);
        sistemaUsers.forEach(user => {
            console.log(`      - ID ${user.id}: ${user.username}`);
        });
        
        if (adminUsers.length === 0 && sistemaUsers.length === 0) {
            console.log('   ❌ PROBLEMA: No hay usuarios admin ni sistema');
            console.log('   💡 SOLUCIÓN: Crear usuario admin o cambiar rol de usuario existente');
        }
        
    } catch (error) {
        console.error('❌ Error en debug:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar debug
debugGetSystemUserId();
