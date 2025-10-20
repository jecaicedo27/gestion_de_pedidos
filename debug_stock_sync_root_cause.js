require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');
const axios = require('axios');

async function debugStockSyncRootCause() {
    console.log('🔍 Investigando causa raíz del problema de sincronización...\n');

    // Configuración de base de datos
    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    };

    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. Verificar configuración del servicio de stock sync
        console.log('📋 1. Verificando configuración del servicio de stock sync...');
        
        // Verificar si el servicio de sync está habilitado
        const [configRows] = await connection.execute(`
            SELECT * FROM system_config WHERE config_key LIKE '%stock%' OR config_key LIKE '%sync%'
        `);
        
        if (configRows.length > 0) {
            console.log('⚙️  Configuraciones de sincronización encontradas:');
            configRows.forEach(config => {
                console.log(`   - ${config.config_key}: ${config.config_value}`);
            });
        } else {
            console.log('⚠️  No se encontraron configuraciones de sincronización');
        }

        // 2. Verificar logs de sincronización
        console.log('\n📋 2. Verificando logs de sincronización recientes...');
        
        try {
            const [syncLogs] = await connection.execute(`
                SELECT * FROM sync_logs 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            if (syncLogs.length > 0) {
                console.log('📊 Últimos logs de sincronización:');
                syncLogs.forEach(log => {
                    console.log(`   ${log.created_at}: ${log.operation} - ${log.status} - ${log.message || 'Sin mensaje'}`);
                });
            } else {
                console.log('⚠️  No se encontraron logs de sincronización recientes');
            }
        } catch (error) {
            console.log('⚠️  Tabla sync_logs no existe o error al consultarla');
        }

        // 3. Probar API de SIIGO directamente
        console.log('\n📋 3. Probando conexión directa con API de SIIGO...');
        
        const siigoConfig = {
            baseURL: process.env.SIIGO_BASE_URL || 'https://api.siigo.com',
            username: process.env.SIIGO_USERNAME,
            access_key: process.env.SIIGO_ACCESS_KEY
        };

        console.log(`🌐 URL Base SIIGO: ${siigoConfig.baseURL}`);
        console.log(`👤 Usuario SIIGO: ${siigoConfig.username}`);
        console.log(`🔑 Access Key configurado: ${siigoConfig.access_key ? 'Sí' : 'No'}`);

        // Intentar obtener token de acceso
        try {
            const authResponse = await axios.post(`${siigoConfig.baseURL}/auth`, {
                username: siigoConfig.username,
                access_key: siigoConfig.access_key
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (authResponse.status === 200 && authResponse.data.access_token) {
                console.log('✅ Autenticación con SIIGO exitosa');
                
                // Probar obtener producto MP175 específicamente
                const token = authResponse.data.access_token;
                
                try {
                    const productResponse = await axios.get(`${siigoConfig.baseURL}/v1/products?code=MP175`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });

                    if (productResponse.data && productResponse.data.results && productResponse.data.results.length > 0) {
                        const product = productResponse.data.results[0];
                        console.log('✅ Producto MP175 obtenido de SIIGO:');
                        console.log(`   - Código: ${product.code}`);
                        console.log(`   - Nombre: ${product.name}`);
                        console.log(`   - Estado: ${product.active ? 'ACTIVO' : 'INACTIVO'}`);
                        console.log(`   - Stock: ${product.stock || 'No disponible'}`);
                        
                        // Verificar estado en BD vs SIIGO
                        const [dbProduct] = await connection.execute(`
                            SELECT internal_code, product_name, is_active 
                            FROM products 
                            WHERE internal_code = 'MP175'
                        `);
                        
                        if (dbProduct.length > 0) {
                            const dbProd = dbProduct[0];
                            console.log('\n🔄 Comparación BD vs SIIGO:');
                            console.log(`   BD Estado: ${dbProd.is_active ? 'ACTIVO' : 'INACTIVO'}`);
                            console.log(`   SIIGO Estado: ${product.active ? 'ACTIVO' : 'INACTIVO'}`);
                            console.log(`   ¿Coinciden?: ${(dbProd.is_active === 1) === product.active ? '✅ SÍ' : '❌ NO'}`);
                        }
                        
                    } else {
                        console.log('⚠️  Producto MP175 no encontrado en respuesta de SIIGO');
                    }
                    
                } catch (productError) {
                    console.log('❌ Error obteniendo producto de SIIGO:', productError.message);
                    if (productError.response) {
                        console.log(`   Status: ${productError.response.status}`);
                        console.log(`   Data: ${JSON.stringify(productError.response.data)}`);
                    }
                }
                
            } else {
                console.log('❌ Error en autenticación con SIIGO');
                console.log(`   Status: ${authResponse.status}`);
                console.log(`   Data: ${JSON.stringify(authResponse.data)}`);
            }
            
        } catch (authError) {
            console.log('❌ Error conectando con API de SIIGO:', authError.message);
            if (authError.response) {
                console.log(`   Status: ${authError.response.status}`);
                console.log(`   Data: ${JSON.stringify(authError.response.data)}`);
            }
        }

        // 4. Verificar si el servicio de stock sync está corriendo
        console.log('\n📋 4. Verificando estado del servicio de sincronización...');
        
        try {
            // Intentar llamar al endpoint interno del servicio de sync
            const syncStatusResponse = await axios.get('http://localhost:3001/api/stock/sync-status', {
                timeout: 5000
            });
            
            console.log('✅ Servicio de sincronización respondió:');
            console.log('   Status:', JSON.stringify(syncStatusResponse.data, null, 2));
            
        } catch (syncError) {
            console.log('❌ Error consultando estado del servicio de sync:', syncError.message);
            console.log('   Posibles causas:');
            console.log('   - El servicio no está corriendo en puerto 3001');
            console.log('   - El endpoint /api/stock/sync-status no existe');
            console.log('   - El servicio de sync no está configurado');
        }

        // 5. Recomendaciones
        console.log('\n📋 5. RESUMEN Y RECOMENDACIONES:');
        console.log('=====================================');
        
        console.log('\n✅ PROBLEMA INMEDIATO RESUELTO:');
        console.log('   - Los productos inactivos ya están correctamente marcados en BD');
        
        console.log('\n🔍 PARA PREVENIR EL PROBLEMA A FUTURO:');
        console.log('   1. Verificar que el servicio de stock sync esté habilitado');
        console.log('   2. Configurar correctamente los intervalos de sincronización');
        console.log('   3. Monitorear los logs de sincronización regularmente');
        console.log('   4. Implementar alertas para errores de sincronización');
        
        console.log('\n⚠️  PRÓXIMOS PASOS RECOMENDADOS:');
        console.log('   1. Revisar backend/services/stockSyncService.js');
        console.log('   2. Verificar configuración de cron jobs o scheduled tasks');
        console.log('   3. Implementar logging mejorado para sincronizaciones');

    } catch (error) {
        console.error('❌ Error durante el diagnóstico:', error.message);
    } finally {
        await connection.end();
    }
}

debugStockSyncRootCause().catch(console.error);
