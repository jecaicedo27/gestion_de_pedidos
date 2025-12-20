const siigoService = require('./services/siigoService');
const axios = require('axios');

async function checkProduct() {
    try {
        console.log('Obteniendo headers...');
        const headers = await siigoService.getHeaders();

        console.log('Buscando producto FL01...');
        // Probar búsqueda por código
        try {
            const response = await axios.get(`${siigoService.getBaseUrl()}/v1/products?code=FL01`, { headers });
            console.log('Resultados búsqueda por código FL01:', JSON.stringify(response.data, null, 2));
        } catch (e) {
            console.log('Error buscando por código:', e.message);
        }

        // Probar getProductInfoByCode del servicio
        try {
            const info = await siigoInvoiceService.getProductInfoByCode('FL01');
            console.log('Resultado getProductInfoByCode:', info);
        } catch (e) {
            // siigoInvoiceService no está exportado directamente, instanciamos o usamos require
        }

    } catch (error) {
        console.error('Error general:', error);
    }
    process.exit(0);
}

// Mock para siigoInvoiceService si es necesario, o simplemente usar axios directo
checkProduct();
