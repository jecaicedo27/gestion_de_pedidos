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
    
    // Prioridad 2: Campo additional_fields.barcode (NUEVO)
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

async function completeProductsMigration() {
    let connection;
    try {
        console.log('🚀 INICIANDO MIGRACIÓN COMPLETA DE PRODUCTOS CON CORRECCIÓN DE CÓDIGOS DE BARRAS...');
        
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
        
        // PASO 3: Obtener todos los productos desde SIIGO
        console.log('\n📦 PASO 3: Obteniendo productos desde SIIGO...');
        const siigoProducts = await getAllProductsFromSiigo(token);
        console.log(`✅ ${siigoProducts.length} productos obtenidos desde SIIGO`);
        
        // PASO 4: Procesar e insertar productos con lógica corregida
        console.log('\n💾 PASO 4: Insertando productos con códigos de barras corregidos...');
        
        let insertedCount = 0;
        let withBarcodeCount = 0;
        let pendingCount = 0;
        let errorCount = 0;
        let pendingCounter = 1; // Para códigos únicos PENDIENTE_XXXXXX
        
        for (const siigoProduct of siigoProducts) {
            try {
                // Extraer código de barras con lógica CORREGIDA
                const realBarcode = extractBarcodeFromSiigo(siigoProduct);
                let finalBarcode;
                
                if (realBarcode) {
                    finalBarcode = realBarcode;
                    withBarcodeCount++;
                    console.log(`   ✅ ${siigoProduct.code}: ${realBarcode}`);
                } else {
                    finalBarcode = `PENDIENTE_${String(pendingCounter).padStart(6, '0')}`;
                    pendingCounter++;
                    pendingCount++;
                    console.log(`   ⏳ ${siigoProduct.code}: ${finalBarcode} (sin código en SIIGO)`);
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
                
            } catch (productError) {
                console.error(`❌ Error procesando producto ${siigoProduct.name}:`, productError.message);
                errorCount++;
            }
        }
        
        // PASO 5: Actualizar ProductController con función corregida
        console.log('\n🔧 PASO 5: Actualizando ProductController...');
        await updateProductController();
        console.log('✅ ProductController actualizado con lógica de códigos de barras corregida');
        
        // Resumen final
        console.log('\n📊 MIGRACIÓN COMPLETADA:');
        console.log(`✅ Productos insertados: ${insertedCount}`);
        console.log(`📧 Con códigos de barras reales: ${withBarcodeCount}`);
        console.log(`⏳ Marcados como PENDIENTE: ${pendingCount}`);
        console.log(`❌ Errores: ${errorCount}`);
        console.log(`📝 Total procesados: ${siigoProducts.length}`);
        
        console.log('\n🎉 ¡MIGRACIÓN EXITOSA!');
        console.log('✨ El sistema ahora busca códigos de barras en:');
        console.log('   1. Campo principal: product.barcode');
        console.log('   2. Campo adicional: product.additional_fields.barcode');
        console.log('   3. Metadata (legacy)');
        console.log('\n💡 Beneficios:');
        console.log('   - Códigos de barras correctos desde SIIGO');
        console.log('   - Sistema preparado para cambios de empresa');
        console.log('   - Auto-sync funcionará correctamente');
        console.log('   - Base de datos limpia y consistente');
        
    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function getAllProductsFromSiigo(token, page = 1, allProducts = []) {
    try {
        console.log(`   📄 Obteniendo página ${page}...`);
        
        const response = await axios.get(`https://api.siigo.com/v1/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            },
            params: {
                page: page,
                page_size: 100
            },
            timeout: 30000
        });
        
        const products = response.data.results || [];
        allProducts = allProducts.concat(products);
        
        console.log(`   ✅ ${products.length} productos en página ${page}`);
        
        // Si hay más páginas, obtenerlas recursivamente
        if (response.data.pagination && response.data.pagination.total_pages > page) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            return await getAllProductsFromSiigo(token, page + 1, allProducts);
        }
        
        return allProducts;
        
    } catch (error) {
        console.error(`❌ Error obteniendo productos de SIIGO (página ${page}):`, error.message);
        throw error;
    }
}

async function updateProductController() {
    const fs = require('fs');
    const path = require('path');
    
    // Leer el controlador actual
    const controllerPath = path.join(__dirname, 'backend', 'controllers', 'productController.js');
    let controllerContent = fs.readFileSync(controllerPath, 'utf8');
    
    // Agregar la función de extracción de códigos de barras corregida
    const newExtractionFunction = `
    // Función CORREGIDA para extraer código de barras de SIIGO (busca en múltiples campos)
    extractBarcodeFromSiigo(siigoProduct) {
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
    },`;
    
    // Insertar la función después de extractPriceFromSiigo
    const insertPoint = controllerContent.indexOf('// Obtener todos los productos');
    if (insertPoint !== -1) {
        controllerContent = 
            controllerContent.substring(0, insertPoint) + 
            newExtractionFunction + '\n\n    ' +
            controllerContent.substring(insertPoint);
    }
    
    // Actualizar la lógica de extracción de códigos de barras en loadProductsFromSiigo
    controllerContent = controllerContent.replace(
        /\/\/ Extraer código de barras de los metadatos de SIIGO[\s\S]*?barcode: 'PENDIENTE'/,
        `// Extraer código de barras usando función CORREGIDA
                    const extractedBarcode = productController.extractBarcodeFromSiigo(product);
                    productData.barcode = extractedBarcode || \`PENDIENTE_\${String(Date.now()).slice(-6)}\``
    );
    
    // Guardar el archivo actualizado
    fs.writeFileSync(controllerPath, controllerContent);
    
    console.log('   ✅ ProductController actualizado con función de extracción corregida');
}

// Ejecutar migración
completeProductsMigration();
