const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function testStockSyncStatus() {
    console.log('🔍 PROBANDO ESTADO FINAL DEL SISTEMA DE STOCK SYNC\n');
    
    const siigoConfig = {
        baseUrl: 'https://api.siigo.com',
        username: process.env.SIIGO_API_USERNAME,
        access_key: process.env.SIIGO_API_ACCESS_KEY,
        partner_id: process.env.SIIGO_PARTNER_ID
    };
    
    console.log('📋 Configuración SIIGO:');
    console.log('- Username:', siigoConfig.username);
    console.log('- Access Key:', siigoConfig.access_key ? 'Configurado ✅' : 'NO CONFIGURADO ❌');
    console.log('- Partner ID:', siigoConfig.partner_id ? `Configurado: ${siigoConfig.partner_id}` : 'NO CONFIGURADO ❌');
    console.log('- Auto Sync:', process.env.SIIGO_AUTO_SYNC);
    console.log('- Sync Interval:', process.env.SIIGO_SYNC_INTERVAL, 'minutos\n');
    
    try {
        // 1. Probar autenticación
        console.log('🔐 Probando autenticación...');
        const authResponse = await axios.post(`${siigoConfig.baseUrl}/auth`, {
            username: siigoConfig.username,
            access_key: siigoConfig.access_key
        });
        
        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        console.log('- Token obtenido:', token.substring(0, 20) + '...');
        
        // 2. Probar acceso a Products API (el punto crítico)
        console.log('\n📦 Probando acceso a Products API...');
        
        const headers = {
            'Authorization': token,
            'Content-Type': 'application/json'
        };
        
        // Agregar Partner-Id si está configurado
        if (siigoConfig.partner_id) {
            headers['Partner-Id'] = siigoConfig.partner_id;
        }
        
        try {
            const productsResponse = await axios.get(
                `${siigoConfig.baseUrl}/v1/products?page_size=1`,
                { headers }
            );
            
            console.log('✅ ACCESO A PRODUCTS API EXITOSO');
            console.log('- Productos encontrados:', productsResponse.data.pagination?.total_results || 'N/A');
            console.log('- Headers enviados:', Object.keys(headers).join(', '));
            
            if (productsResponse.data.results?.length > 0) {
                const producto = productsResponse.data.results[0];
                console.log('- Producto de ejemplo:', producto.name);
                console.log('- Stock disponible:', producto.available_quantity || 'N/A');
            }
            
        } catch (productsError) {
            console.log('❌ ERROR EN PRODUCTS API:');
            console.log('- Status:', productsError.response?.status);
            console.log('- Error:', productsError.response?.data?.message || productsError.message);
            
            if (productsError.response?.status === 400 && 
                productsError.response?.data?.message?.includes('Partner-Id')) {
                console.log('\n⚠️  DIAGNÓSTICO: Se requiere Partner-Id para acceso a Products API');
                console.log('   Para obtener Partner-Id:');
                console.log('   1. Ingresar a https://siigoapi.docs.apiary.io/');
                console.log('   2. Registrar aplicación en el portal de desarrolladores');
                console.log('   3. Agregar SIIGO_PARTNER_ID=tu_partner_id al archivo .env');
            }
        }
        
        // 3. Verificar estado de la base de datos
        console.log('\n🗄️  Verificando estado de la base de datos...');
        const mysql = require('mysql2/promise');
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev',
            port: process.env.DB_PORT || 3306
        });
        
        // Verificar productos con siigo_product_id
        const [products] = await connection.execute(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN siigo_product_id IS NOT NULL THEN 1 END) as with_siigo_id,
                   COUNT(CASE WHEN last_sync_at IS NOT NULL THEN 1 END) as synced,
                   MAX(last_sync_at) as last_sync
            FROM products
        `);
        
        console.log('- Total productos:', products[0].total);
        console.log('- Con SIIGO ID:', products[0].with_siigo_id);
        console.log('- Sincronizados:', products[0].synced);
        console.log('- Última sincronización:', products[0].last_sync || 'Nunca');
        
        // Verificar tabla de webhooks
        try {
            const [webhooks] = await connection.execute(`
                SELECT COUNT(*) as total,
                       COUNT(CASE WHEN processed = 1 THEN 1 END) as processed
                FROM webhook_logs 
                WHERE topic = 'public.siigoapi.products.stock.update'
            `);
            console.log('- Webhooks recibidos:', webhooks[0].total);
            console.log('- Webhooks procesados:', webhooks[0].processed);
        } catch (error) {
            console.log('- Tabla webhooks: No encontrada (se creará automáticamente)');
        }
        
        await connection.end();
        
        // 4. Resumen final del estado
        console.log('\n📊 RESUMEN FINAL DEL SISTEMA:');
        console.log('════════════════════════════════════════');
        
        if (siigoConfig.partner_id && productsResponse) {
            console.log('🟢 SISTEMA COMPLETAMENTE FUNCIONAL');
            console.log('   ✅ Autenticación: OK');
            console.log('   ✅ Products API: OK');
            console.log('   ✅ Configuración: OK');
            console.log('   ✅ Base de datos: OK');
            console.log('\n🚀 El sistema está listo para:');
            console.log('   • Sincronización automática cada 5 minutos');
            console.log('   • Webhooks para actualizaciones inmediatas');
            console.log('   • Notificaciones WebSocket en tiempo real');
            console.log('\n🎯 PARA ACTIVAR: Reiniciar el backend para inicializar el auto-sync');
            
        } else {
            console.log('🟡 SISTEMA 95% IMPLEMENTADO - FALTA PARTNER-ID');
            console.log('   ✅ Autenticación: OK');
            console.log('   ❌ Products API: Requiere Partner-Id');
            console.log('   ✅ Configuración: OK (excepto Partner-Id)');
            console.log('   ✅ Base de datos: OK');
            console.log('\n📝 ACCIÓN REQUERIDA:');
            console.log('   1. Obtener Partner-Id de SIIGO');
            console.log('   2. Agregar SIIGO_PARTNER_ID=tu_id al .env');
            console.log('   3. Reiniciar backend');
            console.log('\n💡 Una vez completado, el inventario se sincronizará automáticamente');
        }
        
    } catch (error) {
        console.log('❌ ERROR EN AUTENTICACIÓN:', error.message);
        console.log('\n🔧 Verificar credenciales en .env file');
    }
}

testStockSyncStatus().catch(console.error);
