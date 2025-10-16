const fetch = require('node-fetch');
require('dotenv').config({ path: './backend/.env' });

async function testUsersAPI() {
    try {
        console.log('🔍 Probando API de usuarios...\n');

        // Primero hacer login como admin
        console.log('1️⃣ Haciendo login como admin...');
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });

        if (!loginResponse.ok) {
            throw new Error('Error en login');
        }

        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✅ Login exitoso\n');

        // Ahora probar el endpoint de usuarios
        console.log('2️⃣ Probando endpoint /api/users?role=mensajero&active=true...');
        const usersResponse = await fetch('http://localhost:3001/api/users?role=mensajero&active=true', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('📡 Status:', usersResponse.status);
        console.log('📡 Headers:', Object.fromEntries(usersResponse.headers));

        const responseText = await usersResponse.text();
        console.log('\n📦 Respuesta completa (texto):', responseText);

        try {
            const responseData = JSON.parse(responseText);
            console.log('\n📊 Estructura de la respuesta:');
            console.log('   - Tipo:', typeof responseData);
            console.log('   - Es array:', Array.isArray(responseData));
            console.log('   - Claves:', Object.keys(responseData));
            
            if (responseData.users) {
                console.log('   - users es array:', Array.isArray(responseData.users));
                console.log('   - Cantidad de usuarios:', responseData.users.length);
                console.log('\n👥 Usuarios encontrados:');
                responseData.users.forEach(user => {
                    console.log(`   - ${user.username} (ID: ${user.id})`);
                });
            } else if (Array.isArray(responseData)) {
                console.log('   - La respuesta es directamente un array');
                console.log('   - Cantidad de usuarios:', responseData.length);
                console.log('\n👥 Usuarios encontrados:');
                responseData.forEach(user => {
                    console.log(`   - ${user.username} (ID: ${user.id})`);
                });
            }

            console.log('\n🎯 SOLUCIÓN IDENTIFICADA:');
            if (responseData.users) {
                console.log('   ✅ El backend devuelve { users: [...] }');
                console.log('   ✅ El código del frontend está correcto');
                console.log('   ❌ Puede haber un problema con el timing o el cache');
            } else if (Array.isArray(responseData)) {
                console.log('   ❌ El backend devuelve directamente un array');
                console.log('   🔧 SOLUCIÓN: Cambiar en OrdersPage.js línea 227:');
                console.log('      De: setMessengers(response.data.users || []);');
                console.log('      A:  setMessengers(response.data || []);');
            }

        } catch (parseError) {
            console.error('❌ Error parseando respuesta JSON:', parseError);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Ejecutar test
testUsersAPI().catch(console.error);
