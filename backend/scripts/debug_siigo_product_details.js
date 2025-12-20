const siigoService = require('../services/siigoService');
const { query } = require('../config/database');

async function debugProduct() {
    try {
        console.log('🔍 Iniciando debug de producto Siigo...');

        // 1. Autenticar
        await siigoService.authenticate();

        // 2. Buscar producto por código
        console.log('📦 Buscando producto ACT03...');
        const headers = await siigoService.getHeaders();
        const axios = require('axios');

        const response = await axios.get(`${siigoService.getBaseUrl()}/v1/products`, {
            headers,
            params: {
                code: 'ACT03',
                page_size: 1
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            const product = response.data.results[0];
            console.log('✅ Producto encontrado:');
            console.log(JSON.stringify(product, null, 2));

            // También obtener detalles completos por ID si es necesario
            console.log('\n📦 Obteniendo detalles completos por ID...');
            const details = await siigoService.getProductDetails(product.id);
            console.log(JSON.stringify(details, null, 2));
        } else {
            console.log('❌ Producto ACT03 no encontrado.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    } finally {
        process.exit();
    }
}

debugProduct();
