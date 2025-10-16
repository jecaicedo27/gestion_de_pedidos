const siigoService = require('./backend/services/siigoService');
const { pool } = require('./backend/config/database');

async function loadProductsFromSiigo() {
    try {
        console.log('🔄 Iniciando carga de productos desde SIIGO...');
        
        // Obtener productos de SIIGO
        const siigoProducts = await siigoService.getAllProducts();
        
        if (!siigoProducts || siigoProducts.length === 0) {
            console.log('⚠️ No se encontraron productos en SIIGO');
            return;
        }

        console.log(`📦 Se encontraron ${siigoProducts.length} productos en SIIGO`);
        
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const product of siigoProducts) {
            try {
                // Extraer información del producto
                const productData = {
                    product_name: product.name || 'Producto sin nombre',
                    siigo_product_id: product.id,
                    internal_code: product.code || null,
                    category: product.category_name || 'Sin categoría',
                    description: product.description || '',
                    unit_weight: product.unit_weight || null,
                    standard_price: parseFloat(product.price) || 0,
                    barcode: null // Se extraerá de metadata si existe
                };

                // Extraer código de barras de los metadatos de SIIGO
                if (product.metadata && product.metadata.length > 0) {
                    const barcodeField = product.metadata.find(meta => 
                        meta.name && meta.name.toLowerCase().includes('barcode') ||
                        meta.name && meta.name.toLowerCase().includes('codigo') ||
                        meta.name && meta.name.toLowerCase().includes('barra')
                    );
                    
                    if (barcodeField && barcodeField.value) {
                        productData.barcode = barcodeField.value;
                    }
                }

                // Si no hay código de barras, generar uno temporal basado en el ID
                if (!productData.barcode) {
                    productData.barcode = `SIIGO_${product.id}`;
                }

                // Verificar si el producto ya existe
                const [existingProduct] = await pool.execute(
                    'SELECT id FROM product_barcodes WHERE siigo_product_id = ? OR barcode = ?',
                    [productData.siigo_product_id, productData.barcode]
                );

                if (existingProduct.length > 0) {
                    // Actualizar producto existente
                    await pool.execute(`
                        UPDATE product_barcodes 
                        SET product_name = ?, 
                            internal_code = ?, 
                            category = ?, 
                            description = ?, 
                            unit_weight = ?, 
                            standard_price = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [
                        productData.product_name,
                        productData.internal_code,
                        productData.category,
                        productData.description,
                        productData.unit_weight,
                        productData.standard_price,
                        existingProduct[0].id
                    ]);
                    
                    updatedCount++;
                    console.log(`🔄 Producto actualizado: ${productData.product_name}`);
                } else {
                    // Insertar nuevo producto
                    await pool.execute(`
                        INSERT INTO product_barcodes 
                        (product_name, barcode, internal_code, siigo_product_id, 
                         category, description, unit_weight, standard_price, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
                    `, [
                        productData.product_name,
                        productData.barcode,
                        productData.internal_code,
                        productData.siigo_product_id,
                        productData.category,
                        productData.description,
                        productData.unit_weight,
                        productData.standard_price
                    ]);
                    
                    insertedCount++;
                    console.log(`✅ Nuevo producto insertado: ${productData.product_name}`);
                }

            } catch (productError) {
                console.error(`❌ Error procesando producto ${product.name}:`, productError);
                errorCount++;
            }
        }

        console.log(`\n📊 RESUMEN DE CARGA:`);
        console.log(`📦 Total procesados: ${siigoProducts.length}`);
        console.log(`✅ Nuevos productos: ${insertedCount}`);
        console.log(`🔄 Productos actualizados: ${updatedCount}`);
        console.log(`❌ Errores: ${errorCount}`);
        console.log(`\n🎉 ¡Carga de productos desde SIIGO completada!`);

    } catch (error) {
        console.error('❌ Error cargando productos desde SIIGO:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

loadProductsFromSiigo();
