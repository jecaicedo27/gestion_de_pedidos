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

// Función CORREGIDA para extraer código de barras de SIIGO
function extractBarcodeFromSiigo(siigoProduct) {
    // Prioridad 1: Campo principal barcode
    if (siigoProduct.barcode && siigoProduct.barcode.trim()) {
        return siigoProduct.barcode.trim();
    }
    
    // Prioridad 2: Campo additional_fields.barcode (CRÍTICO)
    if (siigoProduct.additional_fields?.barcode && siigoProduct.additional_fields.barcode.trim()) {
        return siigoProduct.additional_fields.barcode.trim();
    }
    
    // Prioridad 3: Buscar en metadata (legacy)
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

// Función para extraer precio de SIIGO
function extractPriceFromSiigo(siigoProduct) {
    try {
        if (siigoProduct.prices && 
            Array.isArray(siigoProduct.prices) && 
            siigoProduct.prices.length > 0 &&
            siigoProduct.prices[0].price_list &&
            Array.isArray(siigoProduct.prices[0].price_list) &&
            siigoProduct.prices[0].price_list.length > 0) {
            
            return parseFloat(siigoProduct.prices[0].price_list[0].value) || 0;
        }
        return 0;
    } catch (error) {
        console.warn('Error extrayendo precio de SIIGO:', error.message);
        return 0;
    }
}

// Función MEJORADA con manejo de rate limiting
async function getAllProductsFromSiigoWithRateLimit(token) {
    let allProducts = [];
    let currentPage = 1;
    let totalPages = 1;
    let retryCount = 0;
    const maxRetries = 3;
    
    console.log('📦 Iniciando importación de TODOS los productos de SIIGO con rate limiting...');
    
    while (currentPage <= totalPages) {
        try {
            console.log(`   📄 Obteniendo página ${currentPage} de ${totalPages}...`);
            
            const response = await axios.get(`https://api.siigo.com/v1/products`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'siigo'
                },
                params: {
                    page: currentPage,
                    page_size: 100
                },
                timeout: 30000
            });
            
            const products = response.data.results || [];
            allProducts = allProducts.concat(products);
            
            // Actualizar información de paginación
            if (response.data.pagination) {
                totalPages = response.data.pagination.total_pages || 1;
                console.log(`   ✅ ${products.length} productos obtenidos (Total: ${allProducts.length})`);
                console.log(`   📊 Progreso: ${currentPage}/${totalPages} páginas (${Math.round((currentPage/totalPages)*100)}%)`);
            }
            
            currentPage++;
            retryCount = 0; // Reset retry count on success
            
            // Rate limiting progresivo
            if (currentPage <= totalPages) {
                const waitTime = Math.min(2000 + (currentPage * 500), 10000); // Aumentar progresivamente hasta 10s
                console.log(`   ⏳ Esperando ${waitTime/1000}s para evitar rate limiting...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
        } catch (error) {
            if (error.response?.status === 429) {
                retryCount++;
                if (retryCount <= maxRetries) {
                    const waitTime = 60000 * retryCount; // Esperar 1, 2, 3 minutos
                    console.log(`   🚫 Rate limit alcanzado. Reintento ${retryCount}/${maxRetries} después de ${waitTime/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // No incrementar currentPage, reintentar la misma página
                } else {
                    console.error('   ❌ Máximo número de reintentos alcanzado');
                    throw error;
                }
            } else {
                console.error(`   ❌ Error en página ${currentPage}:`, error.message);
                throw error;
            }
        }
    }
    
    console.log(`🎉 ¡IMPORTACIÓN COMPLETADA! Total de productos obtenidos: ${allProducts.length}`);
    return allProducts;
}

async function importAll588Products() {
    let connection;
    try {
        console.log('🚀 INICIANDO IMPORTACIÓN COMPLETA DE TODOS LOS 588 PRODUCTOS...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // PASO 1: Limpiar tabla products
        console.log('\n🗑️  PASO 1: Limpiando tabla products...');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('DELETE FROM products');
        await connection.execute('ALTER TABLE products AUTO_INCREMENT = 1');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Tabla products limpiada completamente');
        
        // PASO 2: Obtener token
        const token = await getSiigoToken();
        
        // PASO 3: Obtener TODOS los productos (588) con rate limiting
        console.log('\n📦 PASO 3: Obteniendo TODOS los 588 productos...');
        const siigoProducts = await getAllProductsFromSiigoWithRateLimit(token);
        console.log(`✅ ${siigoProducts.length} productos obtenidos desde SIIGO`);
        
        if (siigoProducts.length !== 588) {
            console.log(`⚠️  Se esperaban 588 productos, se obtuvieron ${siigoProducts.length}`);
        }
        
        // PASO 4: Procesar e insertar productos
        console.log('\n💾 PASO 4: Insertando productos con códigos de barras corregidos...');
        
        let insertedCount = 0;
        let withBarcodeCount = 0;
        let pendingCount = 0;
        let errorCount = 0;
        let pendingCounter = 1;
        let liquipp06Found = false;
        
        for (const siigoProduct of siigoProducts) {
            try {
                // Verificar si es LIQUIPP06
                if (siigoProduct.code === 'LIQUIPP06') {
                    console.log(`\n🎯 ¡ENCONTRADO LIQUIPP06!`);
                    console.log(`   📝 Nombre: ${siigoProduct.name}`);
                    console.log(`   🆔 SIIGO ID: ${siigoProduct.id}`);
                    console.log(`   📧 Barcode principal: ${siigoProduct.barcode || 'NO TIENE'}`);
                    console.log(`   🔍 Additional fields:`, siigoProduct.additional_fields);
                    liquipp06Found = true;
                }
                
                // Extraer código de barras
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
                
                // Preparar datos
                const productData = {
                    product_name: siigoProduct.name || 'Producto sin nombre',
                    siigo_product_id: siigoProduct.id,
                    internal_code: siigoProduct.code || null,
                    category: siigoProduct.account_group?.name || 'Sin categoría',
                    description: siigoProduct.description || '',
                    standard_price: extractPriceFromSiigo(siigoProduct),
                    barcode: finalBarcode,
                    is_active: siigoProduct.active !== false
                };
                
                // Insertar producto
                await connection.execute(`
                    INSERT INTO products 
                    (product_name, barcode, internal_code, siigo_product_id, 
                     category, description, standard_price, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [
                    productData.product_name,
                    productData.barcode,
                    productData.internal_code,
                    productData.siigo_product_id,
                    productData.category,
                    productData.description,
                    productData.standard_price,
                    productData.is_active
                ]);
                
                insertedCount++;
                
                // Progress cada 25 productos
                if (insertedCount % 25 === 0) {
                    console.log(`   📊 Progreso: ${insertedCount}/${siigoProducts.length} productos insertados (${Math.round((insertedCount/siigoProducts.length)*100)}%)`);
                }
                
            } catch (productError) {
                console.error(`❌ Error procesando producto ${siigoProduct.name}:`, productError.message);
                errorCount++;
            }
        }
        
        // PASO 5: Verificar LIQUIPP06 en BD
        if (liquipp06Found) {
            console.log('\n🔍 Verificando LIQUIPP06 en base de datos...');
            const [liquipp06] = await connection.execute(`
                SELECT id, product_name, barcode, internal_code
                FROM products 
                WHERE internal_code = 'LIQUIPP06'
            `);
            
            if (liquipp06.length > 0) {
                const product = liquipp06[0];
                console.log(`✅ LIQUIPP06 CONFIRMADO EN BD:`);
                console.log(`   🆔 ID: ${product.id}`);
                console.log(`   📝 Nombre: ${product.product_name}`);
                console.log(`   📧 Código: ${product.barcode}`);
            }
        }
        
        // Resumen final
        console.log('\n🎉 ¡IMPORTACIÓN TOTAL COMPLETADA!');
        console.log(`📊 RESUMEN FINAL:`);
        console.log(`   ✅ Productos insertados: ${insertedCount}`);
        console.log(`   📧 Con códigos de barras: ${withBarcodeCount}`);
        console.log(`   ⏳ Pendientes: ${pendingCount}`);
        console.log(`   ❌ Errores: ${errorCount}`);
        console.log(`   🎯 LIQUIPP06 encontrado: ${liquipp06Found ? 'SÍ' : 'NO'}`);
        console.log(`   📈 Porcentaje con códigos: ${((withBarcodeCount / insertedCount) * 100).toFixed(1)}%`);
        
        console.log('\n✨ SISTEMA LISTO PARA PRODUCCIÓN CON TODOS LOS PRODUCTOS');
        
    } catch (error) {
        console.error('❌ Error en importación total:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar importación total
importAll588Products();
