const axios = require('axios');
require('dotenv').config({ path: 'backend/.env' });

// Intentar usar jwt desde backend, si no está disponible crear token simple
let jwt;
try {
  jwt = require('./backend/node_modules/jsonwebtoken');
} catch (error) {
  // Crear un token simple sin jwt si no está disponible
  jwt = {
    sign: (payload, secret) => {
      const header = Buffer.from(JSON.stringify({typ: 'JWT', alg: 'HS256'})).toString('base64');
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
      return `${header}.${payloadBase64}.fake-signature`;
    }
  };
}

console.log('🔍 DIAGNÓSTICO: Problema de autenticación en dropdown de mensajeros');
console.log('================================================================\n');

async function debugAuthenticationIssue() {
  try {
    console.log('1️⃣ Creando token de prueba para admin...');
    
    // Crear un token válido como lo haría el sistema
    const payload = {
      id: 1,
      username: 'admin',
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Token creado exitosamente');
    console.log(`📝 Token: ${token.substring(0, 50)}...`);

    console.log('\n2️⃣ Probando endpoint sin autenticación...');
    try {
      const responseNoAuth = await axios.get('http://localhost:3001/api/users?role=mensajero&active=true');
      console.log('❌ ERROR: El endpoint debería requerir autenticación pero no lo hace');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Correcto: El endpoint requiere autenticación (401)');
      } else {
        console.log('❌ Error inesperado:', error.message);
      }
    }

    console.log('\n3️⃣ Probando endpoint CON autenticación...');
    const responseWithAuth = await axios.get('http://localhost:3001/api/users?role=mensajero&active=true', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log(`📡 Status: ${responseWithAuth.status}`);
    console.log(`📊 Data structure:`, JSON.stringify(responseWithAuth.data, null, 2));

    const data = responseWithAuth.data;
    
    console.log('\n4️⃣ Analizando respuesta...');
    
    let messengers = [];
    if (Array.isArray(data)) {
      messengers = data;
      console.log('✅ Respuesta es array directo');
    } else if (data.success && data.data) {
      if (data.data.users) {
        messengers = data.data.users;
        console.log('✅ Respuesta tiene estructura { success, data: { users } }');
      } else if (Array.isArray(data.data)) {
        messengers = data.data;
        console.log('✅ Respuesta tiene estructura { success, data: array }');
      }
    }

    console.log(`👥 Mensajeros encontrados: ${messengers.length}`);
    messengers.forEach((m, index) => {
      console.log(`   ${index + 1}. ID: ${m.id}, full_name: "${m.full_name}", username: "${m.username}"`);
    });

    console.log('\n5️⃣ Verificando headers de respuesta...');
    console.log('Response headers:', responseWithAuth.headers);

    console.log('\n🎯 DIAGNÓSTICO COMPLETO:');
    console.log('========================');
    if (messengers.length > 0) {
      console.log('✅ API funciona correctamente con autenticación');
      console.log('✅ Mensajeros disponibles en la respuesta');
      console.log('');
      console.log('🚨 PROBLEMA IDENTIFICADO:');
      console.log('   El frontend NO está enviando el token de autenticación correctamente');
      console.log('   O el token está expirado/inválido');
      console.log('');
      console.log('🔧 SOLUCIÓN REQUERIDA:');
      console.log('   1. Verificar que useAuth() devuelve un token válido');
      console.log('   2. Verificar que el token se está enviando en headers');
      console.log('   3. Verificar que el token no ha expirado');
    } else {
      console.log('❌ API no devuelve mensajeros incluso con autenticación');
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico con autenticación:', error.message);
    if (error.response) {
      console.log(`📡 Status: ${error.response.status}`);
      console.log(`📋 Data:`, error.response.data);
    }
  }
}

debugAuthenticationIssue().catch(console.error);
