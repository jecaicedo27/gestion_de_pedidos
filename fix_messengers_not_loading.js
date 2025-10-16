const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function fixMessengersNotLoading() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gestion_pedidos'
    });

    try {
        console.log('🔍 Diagnóstico: Mensajeros no aparecen en dropdown de logística\n');

        // 1. Verificar mensajeros en la base de datos
        console.log('1️⃣ Verificando mensajeros en la base de datos...');
        const [messengers] = await connection.execute(
            `SELECT id, username, role, active 
             FROM users 
             WHERE role = 'mensajero' 
             ORDER BY active DESC, username ASC`
        );

        console.log(`\n📋 Mensajeros encontrados: ${messengers.length}`);
        messengers.forEach(m => {
            console.log(`   - ${m.username} - ${m.active ? '✅ Activo' : '❌ Inactivo'}`);
        });

        // 2. Verificar mensajeros activos
        const activeMessengers = messengers.filter(m => m.active);
        console.log(`\n✅ Mensajeros activos: ${activeMessengers.length}`);

        if (activeMessengers.length === 0) {
            console.log('\n⚠️  No hay mensajeros activos en el sistema!');
            console.log('\n🔧 Creando mensajeros de prueba...');

            // Crear mensajeros de prueba
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('mensajero123', 10);

            const newMessengers = [
                { username: 'mensajero1' },
                { username: 'mensajero2' },
                { username: 'mensajero3' }
            ];

            for (const messenger of newMessengers) {
                try {
                    await connection.execute(
                        `INSERT INTO users (username, password, role, active) 
                         VALUES (?, ?, 'mensajero', true)`,
                        [messenger.username, hashedPassword]
                    );
                    console.log(`   ✅ Creado: ${messenger.username}`);
                } catch (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        // Activar si ya existe
                        await connection.execute(
                            `UPDATE users SET active = true WHERE username = ?`,
                            [messenger.username]
                        );
                        console.log(`   ✅ Activado: ${messenger.username}`);
                    }
                }
            }
        }

        // 3. Verificar el endpoint de la API
        console.log('\n2️⃣ Verificando endpoint de la API...');
        console.log('   El frontend llama a: userService.getUsers({ role: "mensajero", active: true })');
        console.log('   Esto debería traducirse a: GET /api/users?role=mensajero&active=true');

        // 4. Solución propuesta
        console.log('\n🎯 PROBLEMA IDENTIFICADO:');
        console.log('   El dropdown no muestra mensajeros porque:');
        console.log('   1. El array messengers está vacío en el frontend');
        console.log('   2. Posible problema con el endpoint o la respuesta de la API');
        
        console.log('\n💡 SOLUCIÓN:');
        console.log('   1. Verificar que el endpoint /api/users esté funcionando correctamente');
        console.log('   2. Verificar que userService.getUsers esté importado correctamente');
        console.log('   3. Verificar la estructura de la respuesta (response.data.users)');
        
        console.log('\n📝 PASOS PARA SOLUCIONAR:');
        console.log('   1. Abrir las herramientas de desarrollo del navegador (F12)');
        console.log('   2. Ir a la pestaña Network/Red');
        console.log('   3. Recargar la página de logística');
        console.log('   4. Buscar la llamada a /api/users?role=mensajero');
        console.log('   5. Verificar el status y la respuesta');
        
        console.log('\n🔧 SOLUCIÓN TEMPORAL:');
        console.log('   Si el problema persiste, puedes modificar temporalmente el archivo');
        console.log('   frontend/src/pages/OrdersPage.js en la línea 227:');
        console.log('   Cambiar: setMessengers(response.data.users || []);');
        console.log('   Por: setMessengers(response.data || []);');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

// Ejecutar diagnóstico
fixMessengersNotLoading().catch(console.error);
