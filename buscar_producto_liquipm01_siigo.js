const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'backend', '.env') });

async function buscarProductoLIQUIPM01() {
    console.log('🔍 Buscando producto LIQUIPM01 en SIIGO...\n');
    
    try {
        // Autenticar con SIIGO
        console.log('🔐 Autenticando con SIIGO...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY,
            partner_id: process.env.SIIGO_PARTNER_ID || 'siigo'
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa\n');

        // Buscar productos con paginación para encontrar LIQUIPM01
        console.log('📋 Buscando producto con código LIQUIPM01...');
        
        let found = false;
        let page = 1;
        let productData = null;
        const pageSize = 50; // Aumentar tamaño de página para buscar más eficientemente

        while (!found && page <= 20) { // Limitar búsqueda a 20 páginas (1000 productos max)
            console.log(`   Buscando en página ${page}...`);
            
            const productsResponse = await axios.get(`https://api.siigo.com/v1/products?page=${page}&page_size=${pageSize}`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'Partner-Id': process.env.SIIGO_PARTNER_ID || 'siigo'
                }
            });

            const products = productsResponse.data.results;
            
            // Buscar el producto con código LIQUIPM01
            const targetProduct = products.find(product => product.code === 'LIQUIPM01');
            
            if (targetProduct) {
                found = true;
                productData = targetProduct;
                console.log('✅ ¡Producto LIQUIPM01 encontrado!\n');
                break;
            }

            // Si no hay más productos, terminar búsqueda
            if (products.length < pageSize) {
                console.log('   No hay más productos para revisar.');
                break;
            }

            page++;
            
            // Pequeña pausa para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (found && productData) {
            console.log('🎯 INFORMACIÓN COMPLETA DEL PRODUCTO LIQUIPM01:');
            console.log('=' .repeat(60));
            console.log(JSON.stringify(productData, null, 2));
            console.log('=' .repeat(60));
            
            // Análisis específico de campos de barcode
            console.log('\n🔍 ANÁLISIS DE CÓDIGOS DE BARRAS:');
            console.log(`Campo barcode principal: ${productData.barcode || 'NO DEFINIDO'}`);
            if (productData.additional_fields && productData.additional_fields.barcode !== undefined) {
                console.log(`Campo additional_fields.barcode: "${productData.additional_fields.barcode}" ${productData.additional_fields.barcode === '' ? '(VACÍO)' : ''}`);
            } else {
                console.log('Campo additional_fields.barcode: NO EXISTE');
            }
            
        } else {
            console.log('❌ No se encontró el producto con código LIQUIPM01 en SIIGO');
            console.log(`   Se revisaron ${page - 1} páginas de productos.`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response && error.response.data) {
            console.error('Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

buscarProductoLIQUIPM01().catch(console.error);
