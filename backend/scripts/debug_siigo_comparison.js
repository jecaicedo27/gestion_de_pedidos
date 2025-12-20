const siigoService = require('../services/siigoService');
const axios = require('axios');

async function debugComparison() {
    try {
        console.log('🔍 Buscando producto de comparación (CEREZA)...');
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();

        const response = await axios.get(`${siigoService.getBaseUrl()}/v1/products`, {
            headers,
            params: {
                name: 'CEREZA', // Buscar por nombre
                page_size: 1
            }
        });

        if (response.data.results && response.data.results.length > 0) {
            const product = response.data.results[0];
            console.log('✅ Producto CEREZA encontrado:');
            console.log(JSON.stringify(product, null, 2));
        } else {
            console.log('❌ Producto CEREZA no encontrado.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit();
    }
}

debugComparison();
