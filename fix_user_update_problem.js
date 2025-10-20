const mysql = require('mysql2');
const axios = require('axios');

console.log('🔧 SOLUCIONANDO PROBLEMA DE ACTUALIZACIÓN DE USUARIOS\n');

// Configuración de base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gestion_pedidos_dev'
};

async function testUserUpdateAPI() {
    try {
        console.log('🔍 PASO 1: Verificando conectividad del backend...');
        
        // Verificar si el backend está funcionando
        const pingResponse = await axios.get('http://localhost:3001/api/users').catch(e => {
            console.log('❌ Backend no está ejecutándose en puerto 3001');
            return null;
        });

        if (!pingResponse) {
            console.log('⚠️  El backend no está ejecutándose. Necesita iniciarse manualmente.');
            console.log('📋 Para iniciar el backend:');
            console.log('   1. cd backend');
            console.log('   2. node server.js');
            return false;
        }

        console.log('✅ Backend está ejecutándose correctamente');
        return true;

    } catch (error) {
        console.error('❌ Error verificando backend:', error.message);
        return false;
    }
}

async function testDirectDatabaseUpdate() {
    console.log('\n🔍 PASO 2: Probando actualización directa en base de datos...');
    
    const connection = mysql.createConnection(dbConfig);
    
    try {
        // Test directo en base de datos
        const testUserId = 15; // mensajero1
        const newName = `TEST DIRECTO - ${new Date().toISOString()}`;
        
        console.log(`📝 Actualizando usuario ${testUserId} con nombre: "${newName}"`);
        
        const updateQuery = 'UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?';
        
        await new Promise((resolve, reject) => {
            connection.query(updateQuery, [newName, testUserId], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`✅ Actualización directa exitosa. Filas afectadas: ${results.affectedRows}`);
                    resolve(results);
                }
            });
        });
        
        // Verificar la actualización
        const selectQuery = 'SELECT id, username, full_name, updated_at FROM users WHERE id = ?';
        
        const user = await new Promise((resolve, reject) => {
            connection.query(selectQuery, [testUserId], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results[0]);
                }
            });
        });
        
        console.log('📊 Estado actual del usuario en BD:');
        console.log(`   - ID: ${user.id}`);
        console.log(`   - Username: ${user.username}`);
        console.log(`   - Nombre: ${user.full_name}`);
        console.log(`   - Actualizado: ${user.updated_at}`);
        
        // Verificar si el cambio se aplicó
        if (user.full_name === newName) {
            console.log('✅ La actualización directa en BD funciona correctamente');
            return true;
        } else {
            console.log('❌ La actualización directa en BD falló');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error en actualización directa:', error);
        return false;
    } finally {
        connection.end();
    }
}

async function testAPIUpdate() {
    console.log('\n🔍 PASO 3: Probando actualización vía API...');
    
    try {
        // Login para obtener token
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso, token obtenido');
        
        // Intentar actualización
        const testUserId = 15; // mensajero1
        const newName = `API TEST - ${new Date().toISOString()}`;
        
        console.log(`📝 Intentando actualizar usuario ${testUserId} via API...`);
        
        const updateResponse = await axios.put(`http://localhost:3001/api/users/${testUserId}`, {
            full_name: newName
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📋 Respuesta del API:');
        console.log(JSON.stringify(updateResponse.data, null, 2));
        
        if (updateResponse.data.success) {
            console.log('✅ API respondió exitosamente');
            
            // Verificar en base de datos
            const connection = mysql.createConnection(dbConfig);
            const user = await new Promise((resolve, reject) => {
                connection.query('SELECT full_name, updated_at FROM users WHERE id = ?', [testUserId], (error, results) => {
                    connection.end();
                    if (error) reject(error);
                    else resolve(results[0]);
                });
            });
            
            console.log(`📊 Nombre actual en BD: "${user.full_name}"`);
            console.log(`📅 Última actualización: ${user.updated_at}`);
            
            if (user.full_name === newName) {
                console.log('✅ La actualización vía API funciona correctamente!');
                return true;
            } else {
                console.log('❌ API devolvió éxito pero BD no se actualizó');
                return false;
            }
        } else {
            console.log('❌ API devolvió error');
            return false;
        }
        
    } catch (error) {
        console.log('❌ Error en actualización vía API:', error.message);
        if (error.response) {
            console.log('📋 Respuesta de error:', error.response.data);
        }
        return false;
    }
}

async function generateSolution() {
    console.log('\n🔧 PASO 4: Generando solución...\n');
    
    const backendRunning = await testUserUpdateAPI();
    
    if (!backendRunning) {
        console.log('❌ PROBLEMA IDENTIFICADO: Backend no está ejecutándose');
        console.log('\n💡 SOLUCIÓN:');
        console.log('1. Abrir una nueva terminal');
        console.log('2. Ejecutar: cd backend');
        console.log('3. Ejecutar: node server.js');
        console.log('4. Verificar que aparezca: "Servidor ejecutándose en puerto 3001"');
        console.log('5. Probar actualizar usuario en el frontend');
        return;
    }
    
    const dbWorks = await testDirectDatabaseUpdate();
    const apiWorks = await testAPIUpdate();
    
    console.log('\n📋 RESUMEN DE DIAGNÓSTICO:');
    console.log(`   - Backend ejecutándose: ${backendRunning ? '✅' : '❌'}`);
    console.log(`   - Base de datos funciona: ${dbWorks ? '✅' : '❌'}`);
    console.log(`   - API de actualización funciona: ${apiWorks ? '✅' : '❌'}`);
    
    if (backendRunning && dbWorks && apiWorks) {
        console.log('\n🎉 PROBLEMA RESUELTO!');
        console.log('💡 El sistema de actualización de usuarios está funcionando correctamente.');
        console.log('📝 El usuario puede ahora actualizar nombres en el frontend.');
    } else {
        console.log('\n⚠️  PROBLEMA PERSISTENTE:');
        if (!dbWorks) {
            console.log('   - Hay un problema con la conexión a la base de datos');
        }
        if (!apiWorks) {
            console.log('   - Hay un problema con el endpoint de actualización de usuarios');
            console.log('   - Revisar backend/routes/users.js');
            console.log('   - Revisar backend/controllers/userController.js');
        }
    }
}

// Ejecutar el diagnóstico y solución
generateSolution().catch(error => {
    console.error('❌ Error ejecutando solución:', error);
});
