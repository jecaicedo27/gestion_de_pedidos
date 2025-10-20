const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'backend', '.env') });

async function debugEnvAndSiigoAuth() {
    console.log('🔍 Debugging variables de entorno y autenticación SIIGO...\n');
    
    // Verificar qué variables están cargadas
    console.log('📋 Variables de entorno cargadas:');
    console.log('SIIGO_API_USERNAME:', process.env.SIIGO_API_USERNAME);
    console.log('SIIGO_API_ACCESS_KEY:', process.env.SIIGO_API_ACCESS_KEY ? '[PRESENTE]' : '[FALTANTE]');
    console.log('SIIGO_PARTNER_ID:', process.env.SIIGO_PARTNER_ID);
    
    // Verificar datos de autenticación
    const authData = {
        username: process.env.SIIGO_API_USERNAME,
        access_key: process.env.SIIGO_API_ACCESS_KEY,
        partner_id: process.env.SIIGO_PARTNER_ID || 'siigo'
    };
    
    console.log('\n🔐 Datos que se van a enviar para autenticación:');
    console.log('username:', authData.username);
    console.log('access_key:', authData.access_key ? '[PRESENTE]' : '[FALTANTE]');
    console.log('partner_id:', authData.partner_id);
    
    try {
        console.log('\n🔐 Intentando autenticar con SIIGO...');
        const authResponse = await axios.post('https://api.siigo.com/auth', authData);

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        console.log('Token recibido:', token ? '[PRESENTE]' : '[FALTANTE]');

        // Obtener algunos productos para ver su estructura
        console.log('\n📋 Consultando productos en SIIGO...');
        const productsResponse = await axios.get('https://api.siigo.com/v1/products?page=1&page_size=3', {
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'Partner-Id': authData.partner_id
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
            
            // Mostrar campos relacionados con códigos de barras
            console.log('   🔍 Campos relacionados con códigos:');
            if (product.additional_fields) {
                console.log(`   additional_fields:`, JSON.stringify(product.additional_fields, null, 4));
            } else {
                console.log(`   additional_fields: NO DEFINIDO`);
            }
            
            console.log('\n' + '-'.repeat(80) + '\n');
        });

        // CONCLUSIÓN IMPORTANTE sobre códigos de barras
        console.log('🎯 CONCLUSIONES IMPORTANTES SOBRE CÓDIGOS DE BARRAS EN SIIGO:');
        console.log('1. Campo "barcode": Es donde SIIGO almacena el código de barras real del producto');
        console.log('2. Campo "code": Es el código interno de SIIGO (diferente al barcode)');
        console.log('3. Campo "reference": Es una referencia adicional del producto');
        console.log('4. Campo "additional_fields": Puede contener información adicional');
        
        console.log('\n✅ Investigación completada. Ahora entendemos la estructura real de SIIGO.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response && error.response.data) {
            console.error('Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
        
        // Debugs adicionales
        console.log('\n🔧 Debug adicional:');
        console.log('URL de autenticación:', 'https://api.siigo.com/auth');
        console.log('Método:', 'POST');
        console.log('Datos enviados:', JSON.stringify(authData, null, 2));
    }
}

debugEnvAndSiigoAuth().catch(console.error);
