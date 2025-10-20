const axios = require('axios');

async function testMultipleUnitsIssue() {
    console.log('🔍 TESTEO ESPECÍFICO: Problema con múltiples unidades en escaneo de código de barras');
    console.log('================================================================================');
    
    const baseURL = 'http://localhost:3001';
    let authToken = null;
    
    try {
        // Login
        console.log('\n🔐 Obteniendo token de autenticación...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        if (loginResponse.data.success && loginResponse.data.data && loginResponse.data.data.token) {
            authToken = loginResponse.data.data.token;
            console.log('✅ Token obtenido exitosamente');
        } else {
            console.log('❌ No se obtuvo token en respuesta de login');
            return;
        }
        
        const authHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };
        
        // Get any available order
        console.log('\n📦 Buscando pedidos disponibles...');
        const ordersResponse = await axios.get(`${baseURL}/api/orders?limit=5`, { headers: authHeaders });
        
        if (!ordersResponse.data.orders || ordersResponse.data.orders.length === 0) {
            console.log('❌ No se encontraron pedidos para probar');
            return;
        }
        
        const order = ordersResponse.data.orders[0];
        console.log(`✅ Usando pedido: #${order.invoice_number || order.order_number} (ID: ${order.id})`);
        console.log(`📊 Estado actual: ${order.status}`);
        
        // Get checklist to see items and their scan status
        console.log('\n📋 Obteniendo checklist del pedido...');
        try {
            const checklistResponse = await axios.get(`${baseURL}/api/packaging/checklist/${order.id}`, { headers: authHeaders });
            console.log('✅ Checklist obtenido correctamente');
            
            const checklist = checklistResponse.data.data.checklist;
            console.log(`📦 Items encontrados: ${checklist.length}`);
            
            // Find an item with quantity > 1 for testing multiple units
            const multiUnitItem = checklist.find(item => item.required_quantity > 1);
            
            if (!multiUnitItem) {
                console.log('⚠️  No se encontraron items con cantidad > 1. Usando primer item disponible.');
                if (checklist.length === 0) {
                    console.log('❌ No hay items en el checklist para probar');
                    return;
                }
            }
            
            const testItem = multiUnitItem || checklist[0];
            console.log(`\n🎯 ITEM SELECCIONADO PARA PRUEBA:`);
            console.log(`   - Nombre: ${testItem.item_name}`);
            console.log(`   - Cantidad requerida: ${testItem.required_quantity}`);
            console.log(`   - Escaneados: ${testItem.scanned_count || 0}/${testItem.required_scans || testItem.required_quantity}`);
            console.log(`   - Verificado: ${testItem.is_verified ? 'SÍ' : 'NO'}`);
            console.log(`   - Código de barras: ${testItem.barcode || 'N/A'}`);
            
            // Test barcode scanning
            const testBarcode = testItem.barcode || 'TEST_BARCODE_123';
            const requiredScans = testItem.required_quantity;
            
            console.log(`\n🧪 INICIANDO PRUEBA DE ESCANEOS MÚLTIPLES:`);
            console.log(`   - Código a escanear: ${testBarcode}`);
            console.log(`   - Escaneos requeridos: ${requiredScans}`);
            
            // Perform multiple scans to test the issue
            for (let scanNumber = 1; scanNumber <= Math.min(requiredScans, 3); scanNumber++) {
                console.log(`\n📱 ESCANEO #${scanNumber}:`);
                console.log(`   - Enviando código: ${testBarcode}`);
                
                try {
                    const scanResponse = await axios.post(
                        `${baseURL}/api/packaging/scan-barcode`, 
                        {
                            orderId: order.id,
                            barcode: testBarcode
                        }, 
                        { headers: authHeaders }
                    );
                    
                    console.log(`✅ Escaneo #${scanNumber} exitoso:`);
                    console.log(`   - Status: ${scanResponse.status}`);
                    console.log(`   - Mensaje: ${scanResponse.data.message}`);
                    console.log(`   - Progreso: ${scanResponse.data.data?.scan_progress || 'N/A'}`);
                    console.log(`   - Verificado: ${scanResponse.data.data?.is_verified ? 'SÍ' : 'NO'}`);
                    console.log(`   - Número de escaneo: ${scanResponse.data.data?.scan_number || 'N/A'}`);
                    
                    // Check if the scan was saved by getting updated checklist
                    console.log(`\n🔍 VERIFICANDO ESTADO EN BASE DE DATOS:`);
                    const updatedChecklistResponse = await axios.get(`${baseURL}/api/packaging/checklist/${order.id}`, { headers: authHeaders });
                    const updatedItem = updatedChecklistResponse.data.data.checklist.find(item => item.id === testItem.id);
                    
                    if (updatedItem) {
                        console.log(`   - Escaneados actualizados: ${updatedItem.scanned_count || 0}/${updatedItem.required_scans || updatedItem.required_quantity}`);
                        console.log(`   - Progreso: ${updatedItem.scan_progress || 'N/A'}`);
                        console.log(`   - Verificado en BD: ${updatedItem.is_verified ? 'SÍ' : 'NO'}`);
                        
                        // CHECK FOR THE SPECIFIC ISSUE: First scan not being marked
                        if (scanNumber === 1) {
                            if (updatedItem.scanned_count >= 1) {
                                console.log('✅ PRIMER ESCANEO REGISTRADO CORRECTAMENTE');
                            } else {
                                console.log('❌ PROBLEMA DETECTADO: El primer escaneo NO se registró');
                                console.log('   - Este es el problema reportado por el usuario');
                            }
                        }
                        
                        // Check if progress is being saved correctly
                        if (updatedItem.scanned_count != scanNumber) {
                            console.log(`⚠️  INCONSISTENCIA: Se esperaba scanned_count = ${scanNumber}, pero se obtuvo ${updatedItem.scanned_count}`);
                        } else {
                            console.log(`✅ Contador de escaneos correcto: ${updatedItem.scanned_count}`);
                        }
                    }
                    
                    // Wait a bit between scans
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (scanError) {
                    console.log(`❌ Error en escaneo #${scanNumber}:`, scanError.message);
                    if (scanError.response) {
                        console.log(`   - Status: ${scanError.response.status}`);
                        console.log(`   - Data:`, JSON.stringify(scanError.response.data, null, 2));
                    }
                    break;
                }
            }
            
            // Final verification
            console.log(`\n📊 VERIFICACIÓN FINAL:`);
            const finalChecklistResponse = await axios.get(`${baseURL}/api/packaging/checklist/${order.id}`, { headers: authHeaders });
            const finalItem = finalChecklistResponse.data.data.checklist.find(item => item.id === testItem.id);
            
            if (finalItem) {
                console.log(`   - Estado final: ${finalItem.scanned_count || 0}/${finalItem.required_scans || finalItem.required_quantity}`);
                console.log(`   - Verificado final: ${finalItem.is_verified ? 'SÍ' : 'NO'}`);
                console.log(`   - Necesita múltiples escaneos: ${finalItem.needs_multiple_scans ? 'SÍ' : 'NO'}`);
            }
            
        } catch (checklistError) {
            console.log('❌ Error obteniendo checklist:', checklistError.message);
            if (checklistError.response) {
                console.log('📊 Response status:', checklistError.response.status);
                console.log('📊 Response data:', JSON.stringify(checklistError.response.data, null, 2));
            }
        }
        
    } catch (error) {
        console.log('❌ Error durante la prueba:', error.message);
        if (error.response) {
            console.log('📊 Response status:', error.response.status);
            console.log('📊 Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testMultipleUnitsIssue().catch(console.error);
