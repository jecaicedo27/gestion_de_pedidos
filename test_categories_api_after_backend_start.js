#!/usr/bin/env node

/**
 * TEST CATEGORIES API AFTER BACKEND START
 * ====================================
 * 
 * Después de iniciar el backend exitosamente, vamos a verificar:
 * 1. Que el endpoint de categorías funcione
 * 2. Que todas las categorías estén disponibles
 * 3. Que el frontend pueda cargar el dropdown completo
 * 
 * ESTADO PREVIO:
 * - ❌ API 404 error (backend no funcionando)  
 * - ✅ 16 categorías en base de datos
 * - ✅ 589 productos asignados a categorías correctas
 * 
 * ESTADO ACTUAL:
 * - ✅ Backend iniciado en puerto 3001
 * - ⏳ Verificando API de categorías...
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testCategoriesAPI() {
    console.log('\n🧪 PROBANDO API DE CATEGORÍAS POST-RESTART');
    console.log('============================================');

    try {
        // Test 1: Verificar que el servidor responda
        console.log('\n📊 Test 1: Verificando que el backend responda...');
        const healthCheck = await axios.get(`${BASE_URL}/config/public`);
        console.log(`✅ Backend responde: ${healthCheck.status}`);
        
        // Test 2: Probar endpoint de categorías sin autenticación
        console.log('\n📊 Test 2: Probando endpoint de categorías...');
        const categoriesResponse = await axios.get(`${BASE_URL}/products/categories`);
        
        console.log(`✅ Categories API Status: ${categoriesResponse.status}`);
        console.log(`📋 Total categorías encontradas: ${categoriesResponse.data.length}`);
        
        if (categoriesResponse.data.length > 0) {
            console.log('\n📋 CATEGORÍAS DISPONIBLES:');
            categoriesResponse.data.forEach((category, index) => {
                console.log(`   ${index + 1}. ${category.name} (ID: ${category.id})`);
            });
            
            // Verificar categorías esperadas
            const expectedCategories = [
                'LIQUIPOPS',
                'GENIALITY', 
                'MEZCLAS EN POLVO',
                'Productos No fabricados 19%',
                'Materia prima gravadas 19%'
            ];
            
            console.log('\n🔍 VERIFICACIÓN DE CATEGORÍAS ESPERADAS:');
            expectedCategories.forEach(expectedCategory => {
                const found = categoriesResponse.data.find(cat => cat.name.includes(expectedCategory));
                if (found) {
                    console.log(`   ✅ ${expectedCategory} - ENCONTRADA`);
                } else {
                    console.log(`   ❌ ${expectedCategory} - NO ENCONTRADA`);
                }
            });
            
        } else {
            console.log('❌ No se encontraron categorías');
        }
        
        console.log('\n🎯 RESULTADO FINAL:');
        if (categoriesResponse.data.length >= 5) {
            console.log('✅ SUCCESS: El dropdown de categorías debería funcionar correctamente');
            console.log('✅ El usuario puede ahora ver todas las categorías en el frontend');
            console.log('\n📋 PRÓXIMOS PASOS:');
            console.log('1. Abrir http://localhost:3000/inventory en el navegador');
            console.log('2. Verificar que el dropdown de categorías muestre todas las opciones');
            console.log('3. Confirmar que el filtrado por categoría funcione');
        } else {
            console.log('❌ ISSUE: Pocas categorías encontradas, puede haber un problema');
        }
        
    } catch (error) {
        console.log('\n❌ ERROR PROBANDO CATEGORÍAS API:');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Backend no está ejecutándose en puerto 3001');
            console.log('💡 Asegúrese de que start_backend_simple.js siga ejecutándose');
        } else if (error.response) {
            console.log(`❌ HTTP Error: ${error.response.status}`);
            console.log(`❌ Response: ${JSON.stringify(error.response.data, null, 2)}`);
        } else {
            console.log(`❌ Error: ${error.message}`);
        }
    }
}

// Ejecutar test
testCategoriesAPI().catch(console.error);
