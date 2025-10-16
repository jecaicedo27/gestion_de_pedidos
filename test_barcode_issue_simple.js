const axios = require('axios');
const { query } = require('./backend/config/database');

async function createTestOrderAndTestBarcode() {
    console.log('🔍 TESTEO: Crear pedido de prueba y probar escaneo múltiple');
    console.log('========================================================');
    
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
        
        // Create test order directly in database
        console.log('\n📦 Creando pedido de prueba...');
        
        // Insert test order (adding created_by field to fix foreign key constraint)
        const timestamp = Date.now();
        const testOrderResult = await query(`
            INSERT INTO orders (
                order_number, 
                customer_name, 
                customer_phone,
                customer_address,
                status, 
                total_amount,
                created_by,
                created_at
            ) VALUES (
                'TEST-BARCODE-${timestamp}',
                'Cliente Test Barcode',
                '3001234567',
                'Dirección test',
                'empacado',
                50000,
                11,
                NOW()
            )
        `);
        
        const testOrderId = testOrderResult.insertId;
        console.log(`✅ Pedido test creado con ID: ${testOrderId}`);
        
        // Insert test items with different quantities
        const testItems = [
            { name: 'Producto con 1 unidad', quantity: 1, price: 10000 },
            { name: 'Producto con 3 unidades', quantity: 3, price: 15000 },
            { name: 'Producto con 5 unidades', quantity: 5, price: 5000 }
        ];
        
        console.log('\n📦 Agregando items de prueba...');
        for (let item of testItems) {
            await query(`
                INSERT INTO order_items (
                    order_id, 
                    name, 
                    quantity, 
                    price
                ) VALUES (?, ?, ?, ?)
            `, [testOrderId, item.name, item.quantity, item.price]);
            
            console.log(`   ✅ ${item.name} - Cantidad: ${item.quantity}`);
        }
        
        // Create test products with barcodes
        console.log('\n🏷️ Creando productos con códigos de barras...');
        for (let i = 0; i < testItems.length; i++) {
            const item = testItems[i];
            const barcode = `TEST_BARCODE_${i + 1}`;
            
            await query(`
                INSERT INTO products (
                    product_name,
                    barcode,
                    internal_code,
                    is_active
                ) VALUES (?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                barcode = VALUES(barcode),
                internal_code = VALUES(internal_code)
            `, [item.name, barcode, `TEST_CODE_${i + 1}`]);
            
            console.log(`   ✅ ${item.name} - Código: ${barcode}`);
        }
        
        // Test barcode scanning on the multi-unit item
        const multiUnitItem = testItems[1]; // Producto con 3 unidades
        const testBarcode = 'TEST_BARCODE_2';
        
        console.log(`\n🧪 TESTEO DE ESCANEO MÚLTIPLE:`);
        console.log(`   - Item: ${multiUnitItem.name}`);
        console.log(`   - Cantidad requerida: ${multiUnitItem.quantity}`);
        console.log(`   - Código de barras: ${testBarcode}`);
        
        // Get item ID for testing
        const itemResult = await query(`
            SELECT id FROM order_items 
            WHERE order_id = ? AND name = ?
        `, [testOrderId, multiUnitItem.name]);
        
        if (itemResult.length === 0) {
            console.log('❌ No se encontró el item para probar');
            return;
        }
        
        const testItemId = itemResult[0].id;
        console.log(`   - Item ID: ${testItemId}`);
        
        // Now test multiple scans
        for (let scanNumber = 1; scanNumber <= multiUnitItem.quantity; scanNumber++) {
            console.log(`\n📱 ESCANEO #${scanNumber}:`);
            
            try {
                const scanResponse = await axios.post(
                    `${baseURL}/api/packaging/verify-barcode/${testOrderId}`, 
                    {
                        barcode: testBarcode
                    }, 
                    { headers: authHeaders }
                );
                
                console.log(`   ✅ Respuesta del servidor:`);
                console.log(`      - Status: ${scanResponse.status}`);
                console.log(`      - Mensaje: ${scanResponse.data.message}`);
                console.log(`      - Progreso: ${scanResponse.data.data?.scan_progress || 'N/A'}`);
                console.log(`      - Verificado: ${scanResponse.data.data?.is_verified ? 'SÍ' : 'NO'}`);
                console.log(`      - Número de escaneo: ${scanResponse.data.data?.scan_number || 'N/A'}`);
                
                // Verificar en la base de datos directamente
                const dbCheck = await query(`
                    SELECT 
                        piv.scanned_count,
                        piv.required_scans,
                        piv.is_verified,
                        COUNT(sbs.id) as individual_scans
                    FROM packaging_item_verifications piv
                    LEFT JOIN simple_barcode_scans sbs ON piv.order_id = sbs.order_id AND piv.item_id = sbs.item_id
                    WHERE piv.order_id = ? AND piv.item_id = ?
                    GROUP BY piv.id
                `, [testOrderId, testItemId]);
                
                if (dbCheck.length > 0) {
                    const dbData = dbCheck[0];
                    console.log(`   📊 VERIFICACIÓN EN BD:`);
                    console.log(`      - Escaneados (contador): ${dbData.scanned_count}`);
                    console.log(`      - Escaneos individuales: ${dbData.individual_scans}`);
                    console.log(`      - Requeridos: ${dbData.required_scans}`);
                    console.log(`      - Verificado en BD: ${dbData.is_verified ? 'SÍ' : 'NO'}`);
                    
                    // VERIFICAR EL PROBLEMA ESPECÍFICO
                    if (scanNumber === 1) {
                        if (dbData.scanned_count >= 1 && dbData.individual_scans >= 1) {
                            console.log(`   ✅ PRIMER ESCANEO REGISTRADO CORRECTAMENTE`);
                        } else {
                            console.log(`   ❌ PROBLEMA DETECTADO: Primer escaneo no se guardó`);
                            console.log(`      - Este ES el problema reportado por el usuario`);
                        }
                    }
                } else {
                    console.log(`   ⚠️ No se encontró registro en BD para verificación`);
                }
                
                // Esperar un momento entre escaneos
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (scanError) {
                console.log(`   ❌ Error en escaneo #${scanNumber}:`, scanError.message);
                if (scanError.response) {
                    console.log(`      - Status: ${scanError.response.status}`);
                    console.log(`      - Data:`, JSON.stringify(scanError.response.data, null, 2));
                }
                break;
            }
        }
        
        // Verificación final
        console.log(`\n📊 RESUMEN FINAL:`);
        const finalCheck = await query(`
            SELECT 
                piv.scanned_count,
                piv.required_scans,
                piv.is_verified,
                COUNT(sbs.id) as total_individual_scans
            FROM packaging_item_verifications piv
            LEFT JOIN simple_barcode_scans sbs ON piv.order_id = sbs.order_id AND piv.item_id = sbs.item_id
            WHERE piv.order_id = ? AND piv.item_id = ?
            GROUP BY piv.id
        `, [testOrderId, testItemId]);
        
        if (finalCheck.length > 0) {
            const final = finalCheck[0];
            console.log(`   - Escaneos registrados: ${final.scanned_count}/${final.required_scans}`);
            console.log(`   - Escaneos individuales guardados: ${final.total_individual_scans}`);
            console.log(`   - Item verificado: ${final.is_verified ? 'SÍ' : 'NO'}`);
            
            // Diagnóstico del problema
            if (final.scanned_count !== final.total_individual_scans) {
                console.log(`   ⚠️ INCONSISTENCIA: Contador (${final.scanned_count}) ≠ Escaneos individuales (${final.total_individual_scans})`);
            }
            
            if (final.scanned_count < multiUnitItem.quantity) {
                console.log(`   ❌ PROBLEMA CONFIRMADO: No se registraron todos los escaneos`);
                console.log(`      - Esperados: ${multiUnitItem.quantity}`);
                console.log(`      - Registrados: ${final.scanned_count}`);
            } else {
                console.log(`   ✅ Todos los escaneos se registraron correctamente`);
            }
        }
        
        // Cleanup - eliminar pedido de prueba
        console.log(`\n🧹 Limpieza - eliminando datos de prueba...`);
        await query(`DELETE FROM simple_barcode_scans WHERE order_id = ?`, [testOrderId]);
        await query(`DELETE FROM packaging_item_verifications WHERE order_id = ?`, [testOrderId]);
        await query(`DELETE FROM order_items WHERE order_id = ?`, [testOrderId]);
        await query(`DELETE FROM orders WHERE id = ?`, [testOrderId]);
        await query(`DELETE FROM products WHERE product_name LIKE 'Producto con % unidad%'`);
        console.log(`✅ Datos de prueba eliminados`);
        
    } catch (error) {
        console.log('❌ Error durante la prueba:', error.message);
        if (error.response) {
            console.log('📊 Response status:', error.response.status);
            console.log('📊 Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
createTestOrderAndTestBarcode().catch(console.error);
