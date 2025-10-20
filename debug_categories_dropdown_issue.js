#!/usr/bin/env node

/**
 * DEBUG CATEGORIES DROPDOWN ISSUE
 * ==============================
 * 
 * El usuario solo ve 6 categorías en el frontend:
 * - Todas las categorías
 * - Productos No fabricados 19%
 * - Materia prima gravadas 19%
 * - LIQUIPOPS
 * - MEZCLAS EN POLVO
 * - GENIALITY
 * 
 * Pero deberíamos tener 16 categorías en la base de datos.
 * Vamos a investigar qué está pasando.
 */

const axios = require('axios');
const mysql = require('mysql2/promise');

async function debugCategoriesIssue() {
    console.log('\n🔍 INVESTIGANDO PROBLEMA DE CATEGORÍAS');
    console.log('=======================================');

    try {
        // 1. Verificar categorías directamente en la base de datos
        console.log('\n📊 1. Verificando categorías en la base de datos...');
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        const [categories] = await connection.execute(`
            SELECT c.id, c.name, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id
            GROUP BY c.id, c.name
            ORDER BY c.name
        `);

        console.log(`✅ Total categorías en BD: ${categories.length}`);
        console.log('\n📋 CATEGORÍAS COMPLETAS EN BD:');
        categories.forEach((cat, index) => {
            console.log(`   ${index + 1}. ${cat.name} (ID: ${cat.id}) - ${cat.product_count} productos`);
        });

        await connection.end();

        // 2. Intentar API con autenticación
        console.log('\n📊 2. Verificando API de categorías con autenticación...');
        
        // Primero hacer login
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log(`✅ Login exitoso, token obtenido`);

        // Ahora probar el endpoint de categorías con autenticación
        const categoriesResponse = await axios.get('http://localhost:3001/api/products/categories', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`✅ Categories API Status: ${categoriesResponse.status}`);
        console.log(`📋 Total categorías desde API: ${categoriesResponse.data.length}`);
        
        console.log('\n📋 CATEGORÍAS DESDE API:');
        categoriesResponse.data.forEach((category, index) => {
            console.log(`   ${index + 1}. ${category.name} (ID: ${category.id})`);
        });

        // 3. Comparar resultados
        console.log('\n🔍 ANÁLISIS COMPARATIVO:');
        console.log(`📊 BD: ${categories.length} categorías`);
        console.log(`📊 API: ${categoriesResponse.data.length} categorías`);

        if (categories.length !== categoriesResponse.data.length) {
            console.log('❌ DISCREPANCIA DETECTADA: BD y API no coinciden');
            
            const bdNames = categories.map(c => c.name);
            const apiNames = categoriesResponse.data.map(c => c.name);
            
            const missingInApi = bdNames.filter(name => !apiNames.includes(name));
            const extraInApi = apiNames.filter(name => !bdNames.includes(name));
            
            if (missingInApi.length > 0) {
                console.log('\n❌ CATEGORÍAS FALTANTES EN API:');
                missingInApi.forEach(name => console.log(`   - ${name}`));
            }
            
            if (extraInApi.length > 0) {
                console.log('\n⚠️ CATEGORÍAS EXTRA EN API:');
                extraInApi.forEach(name => console.log(`   - ${name}`));
            }
        } else {
            console.log('✅ BD y API coinciden en número de categorías');
        }

        // 4. Verificar endpoint específico que usa el frontend
        console.log('\n📊 3. Verificando endpoint específico del frontend...');
        
        try {
            const frontendResponse = await axios.get('http://localhost:3001/api/products/categories', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`✅ Frontend Categories API: ${frontendResponse.status}`);
            console.log(`📋 Categorías para frontend: ${frontendResponse.data.length}`);
            
            // Mostrar la estructura exacta que recibe el frontend
            console.log('\n📋 ESTRUCTURA EXACTA PARA FRONTEND:');
            console.log(JSON.stringify(frontendResponse.data, null, 2));
            
        } catch (error) {
            console.log(`❌ Error en endpoint frontend: ${error.message}`);
        }

        console.log('\n🎯 DIAGNÓSTICO:');
        if (categoriesResponse.data.length < 10) {
            console.log('❌ PROBLEMA: Solo se están retornando pocas categorías desde la API');
            console.log('💡 POSIBLE CAUSA: Filtro incorrecto en el backend o query SQL limitada');
            console.log('🔧 ACCIÓN REQUERIDA: Revisar el controller de categorías en el backend');
        } else {
            console.log('✅ API retorna cantidad correcta de categorías');
            console.log('💡 El problema puede estar en el frontend o en el caché del navegador');
        }

    } catch (error) {
        console.log('\n❌ ERROR EN DIAGNÓSTICO:');
        console.log(`❌ ${error.message}`);
        if (error.response) {
            console.log(`❌ Status: ${error.response.status}`);
            console.log(`❌ Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
}

debugCategoriesIssue().catch(console.error);
