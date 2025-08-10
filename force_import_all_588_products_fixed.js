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

function extractBarcodeFromSiigo(siigoProduct) {
    if (siigoProduct.barcode && siigoProduct.barcode.trim()) {
        return siigoProduct.barcode.trim();
    }
    if (siigoProduct.additional_fields?.barcode && siigoProduct.additional_fields.barcode.trim()) {
        return siigoProduct.additional_fields.barcode.trim();
    }
    if (siigoProduct.metadata && Array.isArray(siigoProduct.metadata)) {
        const barcodeField = siigoProduct.metadata.find(meta => 
            meta.name && (
                meta.name.toLowerCase().includes('barcode') ||
                meta.name.toLowerCase().includes('codigo') ||
                meta.name.toLowerCase().includes('barra')
            )
        );
        if (barcodeField && barcodeField.value && barcodeField.value.trim()) {
            return barcodeField.value.trim();
        }
    }
    return null;
}

function extractPriceFromSiigo(siigoProduct) {
    try {
        if (siigoProduct.prices?.[0]?.price_list?.[0]?.value) {
            return parseFloat(siigoProduct.prices[0].price_list[0].value) || 0;
        }
        return 0;
    } catch (error) {
        return 0;
    }
}

async function forceGetAllProductsFromSiigo(token) {
    let allProducts = [];
    let currentPage = 1;
    let totalResults = 0;
    let maxRetries = 3;
    
    console.log('🔥 FORZANDO DESCARGA DE TODAS LAS PÁGINAS...');
    
    // Primero obtener la primera página para conocer el total
    try {
        const firstResponse = await axios.get(`https://api.siigo.com/v1/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            },
            params: { page: 1, page_size: 100 },
            timeout: 30000
        });
        
        allProducts = firstResponse.data.results || [];
        totalResults = firstResponse.data.pagination?.total_results || 0;
        
        console.log(`📊 Primera página: ${allProducts.length} productos`);
        console.log(`📈 Total esperado en SIIGO: ${totalResults} productos`);
        
        const expectedPages = Math.ceil(totalResults / 100);
        console.log(`📄 Páginas calculadas: ${expectedPages}`);
        
        // Continuar con las demás páginas FORZANDO la descarga
        for (let page = 2; page <= expectedPages; page++) {
            let retries = 0;
            let pageSuccess = false;
            
            while (!pageSuccess && retries < maxRetries) {
                try {
                    console.log(`   🔥 FORZANDO página ${page} (intento ${retries + 1}/${maxRetries})...`);
                    
                    const pageResponse = await axios.get(`https://api.siigo.com/v1/products`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'Partner-Id': 'siigo'
                        },
                        params: { page: page, page_size: 100 },
                        timeout: 30000
                    });
                    
                    const pageProducts = pageResponse.data.results || [];
                    allProducts = allProducts.concat(pageProducts);
                    pageSuccess = true;
                    
                    console.log(`   ✅ Página ${page}: ${pageProducts.length} productos (Total: ${allProducts.length})`);
                    
                    // Rate limiting más agresivo
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                } catch (pageError) {
                    retries++;
                    if (pageError.response?.status === 429) {
                        const waitTime = 30000 * retries; // 30s, 60s, 90s
                        console.log(`   🚫 Rate limit en página ${page}. Esperando ${waitTime/1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        console.error(`   ❌ Error en página ${page}:`, pageError.message);
                        if (retries >= maxRetries) {
                            console.log(`   ⚠️  Saltando página ${page} después de ${maxRetries} intentos`);
                            pageSuccess = true; // Continuar con la siguiente página
                        }
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error en primera página:', error.message);
        throw error;
    }
    
    console.log(`🎯 DESCARGA FORZADA COMPLETADA: ${allProducts.length} productos obtenidos`);
    console.log(`📊 Esperados vs Obtenidos: ${totalResults} vs ${allProducts.length}`);
    
    return allProducts;
}

async function forceImportAll588Products() {
    let connection;
    try {
        console.log('🔥 INICIANDO IMPORTACIÓN FORZADA DE TODOS LOS PRODUCTOS...');
        
        connection = await mysql.createConnection(dbConfig);
        
        console.log('\n🗑️  Limpiando tabla products...');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('DELETE FROM products');
        await connection.execute('ALTER TABLE products AUTO_INCREMENT = 1');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Tabla products limpiada');
        
        const token = await getSiigoToken();
        
        console.log('\n🔥 Obteniendo TODOS los productos con descarga forzada...');
        const siigoProducts = await forceGetAllProductsFromSiigo(token);
        
        console.log(`\n💾 Insertando ${siigoProducts.length} productos...`);
        
        let insertedCount = 0;
        let withBarcodeCount = 0;
        let pendingCount = 0;
        let errorCount = 0;
        let pendingCounter = 1;
        let liquipp06Found = false;
        
        for (const siigoProduct of siigoProducts) {
            try {
                if (siigoProduct.code === 'LIQUIPP06') {
                    console.log(`\n🎯 ¡LIQUIPP06 ENCONTRADO!`);
                    console.log(`   📝 Nombre: ${siigoProduct.name}`);
                    console.log(`   📧 Barcode: ${siigoProduct.barcode || 'NO TIENE'}`);
                    console.log(`   🔍 Additional fields:`, siigoProduct.additional_fields);
                    liquipp06Found = true;
                }
                
                const realBarcode = extractBarcodeFromSiigo(siigoProduct);
                let finalBarcode;
                
                if (realBarcode) {
                    finalBarcode = realBarcode;
                    withBarcodeCount++;
                    if (siigoProduct.code === 'LIQUIPP06') {
                        console.log(`   ✅ LIQUIPP06 con código: ${realBarcode}`);
                    }
                } else {
                    finalBarcode = `PENDIENTE_${String(pendingCounter).padStart(6, '0')}`;
                    pendingCounter++;
                    pendingCount++;
                    if (siigoProduct.code === 'LIQUIPP06') {
                        console.log(`   ⏳ LIQUIPP06 sin código: ${finalBarcode}`);
                    }
                }
                
                await connection.execute(`
                    INSERT INTO products 
                    (product_name, barcode, internal_code, siigo_product_id, 
                     category, description, standard_price, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    siigoProduct.name || 'Producto sin nombre',
                    finalBarcode,
                    siigoProduct.code || null,
                    siigoProduct.id,
                    siigoProduct.account_group?.name || 'Sin categoría',
                    siigoProduct.description || '',
                    extractPriceFromSiigo(siigoProduct),
                    siigoProduct.active !== false
                ]);
                
                insertedCount++;
                
                if (insertedCount % 50 === 0) {
                    console.log(`   📊 ${insertedCount}/${siigoProducts.length} productos insertados...`);
                }
                
            } catch (productError) {
                console.error(`❌ Error procesando ${siigoProduct.name}:`, productError.message);
                errorCount++;
            }
        }
        
        // Verificar LIQUIPP06 en BD
        if (liquipp06Found) {
            const [liquipp06] = await connection.execute(`
                SELECT id, product_name, barcode, internal_code
                FROM products WHERE internal_code = 'LIQUIPP06'
            `);
            
            if (liquipp06.length > 0) {
                console.log(`\n🎯 LIQUIPP06 CONFIRMADO EN BD:`);
                console.log(`   🆔 ID: ${liquipp06[0].id}`);
                console.log(`   📝 Nombre: ${liquipp06[0].product_name}`);
                console.log(`   📧 Código: ${liquipp06[0].barcode}`);
            }
        }
        
        console.log('\n🎉 IMPORTACIÓN FORZADA COMPLETADA!');
        console.log(`📊 RESUMEN:`);
        console.log(`   ✅ Insertados: ${insertedCount}`);
        console.log(`   📧 Con códigos: ${withBarcodeCount} (${((withBarcodeCount/insertedCount)*100).toFixed(1)}%)`);
        console.log(`   ⏳ Pendientes: ${pendingCount}`);
        console.log(`   🎯 LIQUIPP06: ${liquipp06Found ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        if (connection) await connection.end();
    }
}

// Ejecutar
forceImportAll588Products();
