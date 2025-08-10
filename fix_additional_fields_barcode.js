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

async function fixAdditionalFieldsBarcodes() {
    let connection;
    try {
        console.log('🔧 CORRIGIENDO CÓDIGOS DE BARRAS EN ADDITIONAL_FIELDS...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Buscar productos que tienen códigos "PENDIENTE_" y tienen siigo_product_id
        const [pendingProducts] = await connection.execute(`
            SELECT id, product_name, barcode, siigo_product_id, internal_code
            FROM products 
            WHERE barcode LIKE 'PENDIENTE_%' 
            AND siigo_product_id IS NOT NULL 
            AND siigo_product_id != ''
            ORDER BY id
            LIMIT 50
        `);
        
        console.log(`📦 Encontrados ${pendingProducts.length} productos con estado PENDIENTE para verificar...`);
        
        if (pendingProducts.length === 0) {
            console.log('✅ No hay productos pendientes con SIIGO ID para verificar');
            return;
        }

        // Obtener token de SIIGO
        const token = await getSiigoToken();
        
        let fixed = 0;
        let reallyPending = 0;
        let errors = 0;
        
        for (const product of pendingProducts) {
            try {
                console.log(`\n🔍 Verificando: ${product.internal_code} - ${product.product_name}`);
                
                // Consultar producto en SIIGO
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
                
                // Buscar código de barras en AMBAS ubicaciones
                let realBarcode = null;
                
                // Prioridad 1: Campo principal barcode
                if (siigoProduct.barcode) {
                    realBarcode = siigoProduct.barcode;
                    console.log(`   ✅ Código encontrado en campo principal: ${realBarcode}`);
                }
                // Prioridad 2: Campo additional_fields.barcode
                else if (siigoProduct.additional_fields?.barcode) {
                    realBarcode = siigoProduct.additional_fields.barcode;
                    console.log(`   ✅ Código encontrado en additional_fields: ${realBarcode}`);
                }
                
                if (realBarcode) {
                    // Actualizar con el código real
                    await connection.execute(`
                        UPDATE products 
                        SET barcode = ?
                        WHERE id = ?
                    `, [realBarcode, product.id]);
                    
                    console.log(`   🔧 CORREGIDO: ${product.barcode} → ${realBarcode}`);
                    fixed++;
                } else {
                    console.log(`   ℹ️  Realmente no tiene código de barras - PENDIENTE correcto`);
                    reallyPending++;
                }
                
                // Pausa para rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`   ❌ Error verificando ${product.internal_code}:`, error.message);
                errors++;
                
                // Pausa más larga en caso de error
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log('\n📊 RESUMEN DE CORRECCIÓN:');
        console.log(`✅ Productos corregidos: ${fixed}`);
        console.log(`ℹ️  Productos realmente pendientes: ${reallyPending}`);
        console.log(`❌ Errores: ${errors}`);
        console.log(`📝 Total procesados: ${fixed + reallyPending + errors}`);
        
        if (fixed > 0) {
            console.log('\n🎉 ¡DESCUBRIMIENTO IMPORTANTE!');
            console.log(`${fixed} productos tenían códigos de barras reales en SIIGO`);
            console.log('pero estaban marcados como PENDIENTE porque el sistema');
            console.log('no estaba buscando en additional_fields.barcode');
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar corrección
fixAdditionalFieldsBarcodes();
