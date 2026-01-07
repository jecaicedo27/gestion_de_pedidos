require('dotenv').config({ path: '../.env' });
const siigoService = require('../services/siigoService');
const { query } = require('../config/database');

async function debugSync() {
    try {
        console.log('🔄 Iniciando prueba de conexión con SIIGO...');

        // 1. Test Login/Auth
        console.log('🔑 Intentando autenticación...');
        const token = await siigoService.authenticate();
        console.log('✅ Token obtenido:', token ? token.substring(0, 20) + '...' : 'NULL');

        // 2. Test Product Fetch (just 1)
        console.log('📦 Consultando productos (limit 1)...');
        const products = await siigoService.getProducts({ page_size: 1 });

        if (products && products.results && products.results.length > 0) {
            console.log('✅ Producto obtenido:', products.results[0].code, products.results[0].name);
            console.log('   Stock:', products.results[0].available_quantity);
        } else {
            console.log('⚠️ No se obtuvieron productos o lista vacía.');
        }

        // 3. Test Stock Sync for specific product (Mango Biche)
        // Find a product locally
        const [localProd] = await query("SELECT id, siigo_id, product_name FROM products WHERE product_name LIKE '%MANGO BICHE%' LIMIT 1");
        if (localProd) {
            console.log(`🔄 Probando sync para ${localProd.product_name} (${localProd.siigo_id})...`);
            // We can't easily call private methods, but we can call getProduct from siigoService
            const details = await siigoService.getProduct(localProd.siigo_id);
            console.log('✅ Datos en Siigo:', details.available_quantity);
        }

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        process.exit();
    }
}

debugSync();
