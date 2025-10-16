const axios = require('axios');
require('dotenv').config();

async function debugSiigoProductStructure() {
    console.log('🔍 Investigando estructura de productos en SIIGO para códigos de barras...\n');
    
    try {
        // Autenticar con SIIGO
        console.log('🔐 Autenticando con SIIGO...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY,
            partner_id: process.env.SIIGO_PARTNER_ID
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');

        // Obtener algunos productos para ver su estructura
        console.log('\n📋 Consultando productos en SIIGO...');
        const productsResponse = await axios.get('https://api.siigo.com/v1/products?page=1&page_size=5', {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'Partner-Id': process.env.SIIGO_PARTNER_ID
            }
        });

        const products = productsResponse.data.results;
        console.log(`\nEstructura de ${products.length} productos en SIIGO:\n`);

        products.forEach((product, index) => {
            console.log(`${index + 1}. Producto: ${product.name}`);
            console.log(`   ID: ${product.id}`);
            console.log(`   Code (Código interno): ${product.code}`);
            console.log(`   Barcode: ${product.barcode || 'NO DEFINIDO'}`);
            console.log(`   Reference: ${product.reference || 'NO DEFINIDO'}`);
            console.log('   Estructura completa:');
            console.log(JSON.stringify(product, null, 2));
            console.log('\n' + '='.repeat(80) + '\n');
        });

        // Buscar un producto específico que sabemos que existe
        console.log('🔍 Buscando producto específico que sabemos que tiene problema...');
        const specificProductResponse = await axios.get('https://api.siigo.com/v1/products/34a18971-f364-4f6d-a66d-555c9d3ad586', {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'Partner-Id': process.env.SIIGO_PARTNER_ID
            }
        });

        const specificProduct = specificProductResponse.data;
        console.log('Estructura del producto específico (MEZCLA BUBBLE TEA TARO):');
        console.log(`Nombre: ${specificProduct.name}`);
        console.log(`Code: ${specificProduct.code}`);
        console.log(`Barcode: ${specificProduct.barcode || 'NO DEFINIDO'}`);
        console.log(`Reference: ${specificProduct.reference || 'NO DEFINIDO'}`);
        console.log('\nEstructura completa:');
        console.log(JSON.stringify(specificProduct, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response && error.response.data) {
            console.error('Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugSiigoProductStructure().catch(console.error);
