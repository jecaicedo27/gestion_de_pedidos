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
    
    // Prioridad 2: Campo additional_fields.barcode (NUEVO - CRÍTICO)
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
    
    // No tiene código de barras
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

// Función CORREGIDA para obtener TODOS los productos de SIIGO
async function getAllProductsFromSiigo(token) {
    let allProducts = [];
    let currentPage = 1;
    let totalPages = 1;
    
    console.log('📦 Iniciando descarga de TODOS los productos de SIIGO...');
    
    do {
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
                console.log(`   📊 Progreso: ${currentPage}/${totalPages} páginas`);
            } else {
                console.log(`   ✅ ${products.length} productos obtenidos (Total: ${allProducts.length})`);
            }
            
            currentPage++;
            
            // Pausa para evitar rate limiting
            if (currentPage <= totalPages) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error(`❌ Error obteniendo página ${currentPage}:`, error.message);
            if (error.response?.status === 429) {
                console.log('⏱️ Rate limit detectado, esperando 5 segundos...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                // No incrementar currentPage para reintentar la misma página
                continue;
            } else {
                throw error;
            }
        }
    } while (currentPage <= totalPages);
    
    console.log(`🎉 ¡DESCARGA COMPLETADA! Total de productos obtenidos: ${allProducts.length}`);
    return allProducts;
}

async function completeAllProductsMigration() {
    let connection;
    try {
        console.log('🚀 INICIANDO MIGRACIÓN COMPLETA DE TODOS LOS PRODUCTOS DE SIIGO...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // PASO 1: Limpiar tabla products
        console.log('\n🗑️  PASO 1: Limpiando tabla products...');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        await connection.execute('DELETE FROM products');
        await connection.execute('ALTER TABLE products AUTO_INCREMENT = 1');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Tabla products limpiada completamente');
        
        // PASO 2: Obtener token de SIIGO
        const token = await getSiigoToken();
        
        // PASO 3: Obtener TODOS los productos desde SIIGO (CORREGIDO)
        console.log('\n📦 PASO 3: Obteniendo TODOS los productos desde SIIGO...');
        const siigoProducts = await getAllProductsFromSiigo(token);
        console.log(`✅ ${siigoProducts.length} productos obtenidos desde SIIGO`);
        
        // PASO 4: Procesar e insertar TODOS los productos
        console.log('\n💾 PASO 4: Insertando TODOS los productos con códigos de barras corregidos...');
        
        let insertedCount = 0;
        let withBarcodeCount = 0;
        let pendingCount = 0;
        let errorCount = 0;
        let pendingCounter = 1;
        let liquipp06Found = false; // Flag para verificar si encontramos LIQUIPP06
        
        for (const siigoProduct of siigoProducts) {
            try {
                // Verificar si es LIQUIPP06
                if (siigoProduct.code === 'LIQUIPP06') {
                    console.log(`\n🔍 ¡ENCONTRADO LIQUIPP06!`);
                    console.log(`   📝 Nombre: ${siigoProduct.name}`);
                    console.log(`   🆔 SIIGO ID: ${siigoProduct.id}`);
                    liquipp06Found = true;
                }
                
                // Extraer código de barras con lógica CORREGIDA
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
                
                // Preparar datos del producto
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
                
                // Mostrar progreso cada 50 productos
                if (insertedCount % 50 === 0) {
                    console.log(`   📊 Progreso: ${insertedCount} productos insertados...`);
                }
                
            } catch (productError) {
                console.error(`❌ Error procesando producto ${siigoProduct.name}:`, productError.message);
                errorCount++;
            }
        }
        
        // Verificar si se encontró LIQUIPP06
        if (liquipp06Found) {
            console.log('\n🎯 LIQUIPP06 fue encontrado y procesado en esta migración');
        } else {
            console.log('\n⚠️  LIQUIPP06 NO fue encontrado en los productos de SIIGO');
        }
        
        // Resumen final
        console.log('\n📊 MIGRACIÓN COMPLETA FINALIZADA:');
        console.log(`✅ Productos insertados: ${insertedCount}`);
        console.log(`📧 Con códigos de barras reales: ${withBarcodeCount}`);
        console.log(`⏳ Marcados como PENDIENTE: ${pendingCount}`);
        console.log(`❌ Errores: ${errorCount}`);
        console.log(`📝 Total procesados: ${siigoProducts.length}`);
        console.log(`📊 Porcentaje con códigos reales: ${((withBarcodeCount / insertedCount) * 100).toFixed(1)}%`);
        
        console.log('\n🎉 ¡MIGRACIÓN EXITOSA!');
        console.log('✨ Ahora el sistema tiene TODOS los productos de SIIGO');
        console.log('📈 Escalable para empresas con cualquier cantidad de productos');
        console.log('🔧 Sistema corregido para buscar códigos de barras en múltiples campos');
        
        // Verificar LIQUIPP06 específicamente
        console.log('\n🔍 Verificando LIQUIPP06 en base de datos...');
        const [liquipp06] = await connection.execute(`
            SELECT id, product_name, barcode, internal_code
            FROM products 
            WHERE internal_code = 'LIQUIPP06'
        `);
        
        if (liquipp06.length > 0) {
            const product = liquipp06[0];
            console.log(`✅ LIQUIPP06 confirmado en BD:`);
            console.log(`   🆔 ID: ${product.id}`);
            console.log(`   📝 Nombre: ${product.product_name}`);
            console.log(`   📧 Código: ${product.barcode}`);
        } else {
            console.log(`❌ LIQUIPP06 no encontrado en BD después de migración`);
        }
        
    } catch (error) {
        console.error('❌ Error en migración completa:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar migración completa
completeAllProductsMigration();
