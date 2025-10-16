const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testBarcodeScanning() {
    console.log('🧪 PROBANDO SISTEMA DE ESCANEO DE CÓDIGOS DE BARRAS\n');
    
    try {
        // 1. Login como usuario admin
        console.log('📋 PASO 1: Login como usuario admin...');
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        const headers = { 'authorization': token };  // Usar minúsculas para el header
        console.log('   ✅ Login exitoso\n');
        
        // 2. Obtener pedidos pendientes de empaque
        console.log('📋 PASO 2: Obteniendo pedidos pendientes...');
        const ordersResponse = await axios.get(`${API_BASE}/packaging/pending`, { headers });
        const orders = ordersResponse.data.data;
        
        if (orders.length === 0) {
            console.log('   ⚠️ No hay pedidos pendientes');
            return;
        }
        
        const orderId = orders[0].id;
        console.log(`   ✅ Pedido seleccionado: ID ${orderId}\n`);
        
        // 3. Obtener checklist del pedido
        console.log('📋 PASO 3: Obteniendo checklist del pedido...');
        const checklistResponse = await axios.get(`${API_BASE}/packaging/checklist/${orderId}`, { headers });
        const checklist = checklistResponse.data.data.checklist;
        
        console.log(`   📦 Items del pedido:`);
        checklist.forEach(item => {
            console.log(`      - ${item.item_name}`);
            console.log(`        Cantidad: ${item.required_quantity}`);
            console.log(`        Código de barras: ${item.barcode || 'SIN CÓDIGO'}`);
            console.log(`        Código interno: ${item.product_code || 'N/A'}`);
        });
        console.log();
        
        // 4. Simular escaneo de códigos de barras
        console.log('📋 PASO 4: Simulando escaneo de códigos de barras...\n');
        
        for (const item of checklist) {
            if (item.barcode && !item.is_verified) {
                console.log(`   🔍 Escaneando: ${item.barcode}`);
                console.log(`      Producto: ${item.item_name}`);
                
                try {
                    const scanResponse = await axios.post(
                        `${API_BASE}/packaging/verify-barcode/${orderId}`,
                        { barcode: item.barcode },
                        { headers }
                    );
                    
                    if (scanResponse.data.success) {
                        console.log(`      ✅ ${scanResponse.data.message}`);
                        if (scanResponse.data.data.auto_completed) {
                            console.log(`      🎉 PEDIDO COMPLETADO AUTOMÁTICAMENTE`);
                        }
                    }
                } catch (error) {
                    console.log(`      ❌ Error: ${error.response?.data?.message || error.message}`);
                }
                console.log();
            }
        }
        
        // 5. Verificar estado final del pedido
        console.log('📋 PASO 5: Verificando estado final...');
        const finalChecklistResponse = await axios.get(`${API_BASE}/packaging/checklist/${orderId}`, { headers });
        const finalChecklist = finalChecklistResponse.data.data.checklist;
        
        const allVerified = finalChecklist.every(item => item.is_verified);
        console.log(`   ${allVerified ? '✅' : '⚠️'} Estado: ${allVerified ? 'TODOS LOS ITEMS VERIFICADOS' : 'AÚN HAY ITEMS PENDIENTES'}`);
        
        if (allVerified) {
            console.log('\n🎉 SISTEMA DE ESCANEO FUNCIONANDO CORRECTAMENTE');
            console.log('\n📝 INSTRUCCIONES PARA USO REAL:');
            console.log('   1. Para productos con código real (ej: 7708949649979): Escanear el código de barras');
            console.log('   2. Para productos con código temporal (ej: TEMP_LIQUIPM02): Escribir manualmente el código');
            console.log('   3. El sistema valida automáticamente que el producto corresponda al pedido');
            console.log('   4. Cuando todos los items estén verificados, el pedido pasa automáticamente a "listo para entrega"');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data?.message || error.message);
    }
}

// Ejecutar prueba
testBarcodeScanning();
