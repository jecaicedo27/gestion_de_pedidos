const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

async function debugProductStatusSync() {
    console.log('🔍 Investigando discrepancias en estado activo/inactivo de productos...\n');
    
    let connection;
    
    try {
        // Conexión a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });
        
        console.log('✅ Conectado a la base de datos');
        
        // 1. Verificar productos que están activos en BD pero inactivos en SIIGO
        console.log('\n📊 Consultando productos en la base de datos...');
        const [products] = await connection.execute(`
            SELECT siigo_id, internal_code, product_name, is_active, stock
            FROM products 
            WHERE siigo_id IS NOT NULL
            ORDER BY internal_code
            LIMIT 50
        `);
        
        console.log(`📦 ${products.length} productos encontrados en BD`);
        
        // 2. Preparar autenticación SIIGO
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        });
        
        const token = authResponse.data.access_token;
        console.log('🔐 Autenticado con SIIGO');
        
        // 3. Verificar estado de productos en SIIGO vs BD
        console.log('\n🔍 Verificando estado de productos en SIIGO vs BD...');
        
        let discrepancies = [];
        let checked = 0;
        
        for (const product of products) {
            try {
                const siigoResponse = await axios.get(`https://api.siigo.com/v1/products/${product.siigo_id}`, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    }
                });
                
                const siigoProduct = siigoResponse.data;
                const siigoActive = siigoProduct.active;
                const bdActive = product.is_active === 1;
                
                checked++;
                
                // Detectar discrepancias
                if (siigoActive !== bdActive) {
                    discrepancies.push({
                        code: product.internal_code,
                        name: product.product_name,
                        siigo_id: product.siigo_id,
                        siigo_active: siigoActive,
                        bd_active: bdActive,
                        stock: product.stock
                    });
                    
                    console.log(`❌ ${product.internal_code}: SIIGO=${siigoActive} vs BD=${bdActive}`);
                } else {
                    console.log(`✅ ${product.internal_code}: SIIGO=${siigoActive} = BD=${bdActive}`);
                }
                
                // Rate limiting
                if (checked % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.log(`⚠️  Error verificando ${product.internal_code}: ${error.message}`);
            }
        }
        
        // 4. Mostrar resumen
        console.log(`\n📋 RESUMEN:`);
        console.log(`Total productos verificados: ${checked}`);
        console.log(`Discrepancias encontradas: ${discrepancies.length}`);
        
        if (discrepancies.length > 0) {
            console.log('\n❌ PRODUCTOS CON DISCREPANCIAS:');
            discrepancies.forEach(disc => {
                console.log(`- ${disc.code} (${disc.name})`);
                console.log(`  SIIGO: ${disc.siigo_active ? 'ACTIVO' : 'INACTIVO'} | BD: ${disc.bd_active ? 'ACTIVO' : 'INACTIVO'}`);
                console.log(`  Stock: ${disc.stock} | SIIGO ID: ${disc.siigo_id}\n`);
            });
            
            // 5. Ofrecer corrección
            console.log('🔧 ¿Deseas corregir estas discrepancias? (y/n)');
            
            // Para este script de debug, mostraremos qué SQL ejecutar
            console.log('\n💡 SQL para corregir discrepancias:');
            discrepancies.forEach(disc => {
                const newStatus = disc.siigo_active ? 1 : 0;
                console.log(`UPDATE products SET is_active = ${newStatus} WHERE siigo_id = '${disc.siigo_id}';`);
            });
        } else {
            console.log('✅ No se encontraron discrepancias en los productos verificados');
        }
        
        // 6. Verificar productos específicos de la imagen
        console.log('\n🔍 Verificando productos específicos de la captura de pantalla...');
        const specificCodes = ['SHOT000', 'MP172', 'MP171', 'MP170', 'SKAR021', 'SKAR10', 'MP168', 'MP167', 'MP166'];
        
        for (const code of specificCodes) {
            const [productRows] = await connection.execute(
                'SELECT siigo_id, internal_code, product_name, is_active FROM products WHERE internal_code = ?', 
                [code]
            );
            
            if (productRows.length > 0) {
                const product = productRows[0];
                try {
                    const siigoResponse = await axios.get(`https://api.siigo.com/v1/products/${product.siigo_id}`, {
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Partner-Id': 'siigo'
                        }
                    });
                    
                    const siigoActive = siigoResponse.data.active;
                    const bdActive = product.is_active === 1;
                    
                    console.log(`${code}: SIIGO=${siigoActive ? 'ACTIVO' : 'INACTIVO'} | BD=${bdActive ? 'ACTIVO' : 'INACTIVO'} ${siigoActive !== bdActive ? '❌' : '✅'}`);
                    
                } catch (error) {
                    console.log(`${code}: Error verificando - ${error.message}`);
                }
            } else {
                console.log(`${code}: No encontrado en BD`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Detalles:', error.response.data);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

debugProductStatusSync();
