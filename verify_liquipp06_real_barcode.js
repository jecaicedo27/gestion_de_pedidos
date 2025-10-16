const mysql = require('mysql2/promise');
const axios = require('axios');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function getSiigoToken() {
    try {
        console.log('🔑 Obteniendo token de SIIGO...');
        
        const response = await axios.post('https://api.siigo.com/auth', {
            username: 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
            access_key: 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk='
        });
        
        console.log('✅ Token obtenido exitosamente');
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error obteniendo token:', error.message);
        throw error;
    }
}

async function verifyLiquipp06RealBarcode() {
    let connection;
    try {
        console.log('🔍 Verificando código de barras real para LIQUIPP06...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Buscar el producto LIQUIPP06
        const [products] = await connection.execute(`
            SELECT id, product_name, barcode, siigo_product_id, internal_code
            FROM products 
            WHERE internal_code = 'LIQUIPP06'
        `);
        
        if (products.length === 0) {
            console.log('❌ No se encontró producto LIQUIPP06');
            return;
        }
        
        const product = products[0];
        console.log('\n📦 Producto encontrado:');
        console.log(`   🆔 ID: ${product.id}`);
        console.log(`   📝 Nombre: ${product.product_name}`);
        console.log(`   📧 Código actual: ${product.barcode}`);
        console.log(`   🌐 SIIGO ID: ${product.siigo_product_id}`);
        
        // Obtener token de SIIGO
        const token = await getSiigoToken();
        
        // Consultar el producto en SIIGO
        console.log('\n🌐 Consultando producto en SIIGO...');
        const siigoResponse = await axios.get(
            `https://api.siigo.com/v1/products/${product.siigo_product_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'siigo'
                }
            }
        );
        
        const siigoProduct = siigoResponse.data;
        
        console.log('\n✅ Respuesta COMPLETA de SIIGO:');
        console.log('📄 JSON COMPLETO:');
        console.log(JSON.stringify(siigoProduct, null, 2));
        
        console.log('\n📊 CAMPOS PRINCIPALES:');
        console.log(`   📦 ID: ${siigoProduct.id}`);
        console.log(`   📝 Nombre: ${siigoProduct.name}`);
        console.log(`   📋 Código de referencia: ${siigoProduct.code}`);
        console.log(`   📧 Código de barras: ${siigoProduct.barcode || 'NO TIENE'}`);
        console.log(`   📊 Estado: ${siigoProduct.active ? 'Activo' : 'Inactivo'}`);
        
        // Análisis
        console.log('\n📊 ANÁLISIS:');
        if (siigoProduct.barcode) {
            console.log(`✅ El producto SÍ tiene código de barras en SIIGO: ${siigoProduct.barcode}`);
            console.log(`🔍 Código actual en BD: ${product.barcode}`);
            
            if (siigoProduct.barcode !== product.barcode) {
                console.log(`🚨 DISCREPANCIA CONFIRMADA:`);
                console.log(`   ❌ BD Local: ${product.barcode}`);
                console.log(`   ✅ SIIGO Real: ${siigoProduct.barcode}`);
                
                // Actualizar con el código real
                console.log('\n🔧 Actualizando con código real de SIIGO...');
                await connection.execute(`
                    UPDATE products 
                    SET barcode = ?
                    WHERE id = ?
                `, [siigoProduct.barcode, product.id]);
                
                console.log(`✅ Producto actualizado con código real: ${siigoProduct.barcode}`);
                console.log(`💡 Este producto confirma que mi sistema anterior generaba códigos cuando SIIGO SÍ tenía códigos reales`);
            } else {
                console.log(`✅ Los códigos ya coinciden correctamente`);
            }
        } else {
            console.log(`ℹ️  El producto realmente NO tiene código de barras en SIIGO`);
            console.log(`✅ El estado "PENDIENTE" es correcto`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('📄 Respuesta de error:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar verificación
verifyLiquipp06RealBarcode();
