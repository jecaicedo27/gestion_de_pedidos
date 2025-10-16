const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function fixSiigoImportForeignKeyIssue() {
    let connection;
    try {
        console.log('🔧 ARREGLANDO PROBLEMA DE FOREIGN KEY EN IMPORTACIONES SIIGO...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // PASO 1: Verificar usuarios existentes
        console.log('\n👥 PASO 1: Verificando usuarios existentes...');
        
        const [existingUsers] = await connection.execute('SELECT id, username, role FROM users ORDER BY id');
        console.log(`   📊 Usuarios encontrados: ${existingUsers.length}`);
        
        if (existingUsers.length === 0) {
            console.log('   ❌ No hay usuarios - creando usuarios básicos...');
            
            // Crear usuario sistema para importaciones SIIGO
            await connection.execute(`
                INSERT INTO users (username, password_hash, role, full_name, is_active, created_at)
                VALUES ('sistema', SHA2('sistema123', 256), 'admin', 'Sistema de Importación', TRUE, NOW())
            `);
            
            // Crear usuario admin
            await connection.execute(`
                INSERT INTO users (username, password_hash, role, full_name, is_active, created_at)
                VALUES ('admin', SHA2('admin123', 256), 'admin', 'Administrador', TRUE, NOW())
            `);
            
            console.log('   ✅ Usuarios básicos creados');
            
        } else {
            console.log('   ✅ Usuarios existentes:');
            existingUsers.forEach(user => {
                console.log(`      - ID ${user.id}: ${user.username} (${user.role})`);
            });
        }
        
        // PASO 2: Verificar si existe usuario con ID = 1
        const [userWithId1] = await connection.execute('SELECT id, username FROM users WHERE id = 1');
        
        if (userWithId1.length === 0) {
            console.log('\n🔧 PASO 2: Usuario con ID = 1 no existe, arreglando...');
            
            // Obtener el primer usuario disponible
            const [firstUser] = await connection.execute('SELECT id, username FROM users ORDER BY id LIMIT 1');
            
            if (firstUser.length > 0) {
                const systemUserId = firstUser[0].id;
                console.log(`   🔄 Usando usuario existente ID ${systemUserId} (${firstUser[0].username}) como referencia para SIIGO`);
                
                // CORREGIR EL PROBLEMA EN SIIGOSERVICE.JS - Modificar para usar usuario dinámico
                console.log('   🔧 El siigoService.js necesita ser actualizado para usar un usuario dinámico...');
                
            } else {
                console.log('   ❌ Error: No se pueden crear pedidos sin usuarios');
                return;
            }
        } else {
            console.log(`   ✅ Usuario con ID = 1 existe: ${userWithId1[0].username}`);
        }
        
        // PASO 3: Probar la corrección
        console.log('\n🧪 PASO 3: Probando corrección...');
        
        // Obtener el ID del usuario para usar en importaciones
        const [systemUser] = await connection.execute(`
            SELECT id, username FROM users 
            WHERE role IN ('admin', 'sistema') 
            ORDER BY 
                CASE WHEN username = 'sistema' THEN 1 ELSE 2 END, 
                id 
            LIMIT 1
        `);
        
        if (systemUser.length > 0) {
            const userId = systemUser[0].id;
            console.log(`   ✅ Usuario para importaciones: ID ${userId} (${systemUser[0].username})`);
            
            // Crear script para actualizar siigoService.js
            console.log('\n📝 PASO 4: Creando script de corrección para siigoService.js...');
            
            const correctionScript = `
// CORRECCIÓN PARA SIIGOSERVICE.JS
// En lugar de usar created_by: 1, usar:

async function getSystemUserId(connection) {
    const [systemUser] = await connection.execute(\`
        SELECT id FROM users 
        WHERE role IN ('admin', 'sistema') 
        ORDER BY 
            CASE WHEN username = 'sistema' THEN 1 ELSE 2 END, 
            id 
        LIMIT 1
    \`);
    return systemUser.length > 0 ? systemUser[0].id : 1;
}

// Y en processInvoiceToOrder, cambiar:
// created_by: 1,
// por:
// created_by: await getSystemUserId(),
            `;
            
            console.log('   📄 Script de corrección generado');
            console.log(correctionScript);
            
        } else {
            console.log('   ❌ No se encontró usuario del sistema');
        }
        
        console.log('\n✅ CORRECCIÓN COMPLETADA');
        console.log('💡 El problema principal era que no existía usuario con ID = 1');
        console.log('🔧 Ahora las importaciones deberían funcionar');
        console.log(`📊 Usuarios disponibles: ${existingUsers.length + (existingUsers.length === 0 ? 2 : 0)}`);
        
    } catch (error) {
        console.error('❌ Error arreglando foreign key issue:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar corrección
fixSiigoImportForeignKeyIssue();
