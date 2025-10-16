const siigoService = require('./backend/services/siigoService');
const { pool } = require('./backend/config/database');

async function debugSpecificProduct() {
    console.log('🔍 Buscando producto específico LIQUIPP07...');
    
    try {
        console.log('📦 Obteniendo TODOS los productos de SIIGO...');
        
        // Obtener TODOS los productos de SIIGO (función recursiva)
        console.log('📦 Obteniendo todos los productos...');
        const allProducts = await siigoService.getAllProducts();
        
        console.log(`📊 Total productos obtenidos de SIIGO: ${allProducts.length}`);
        
        let foundProduct = null;
        let productsProcessed = 0;
        let productsUpdated = 0;
        
        console.log(`\n📄 Procesando todos los productos...`);
        
        for (const product of allProducts) {
            productsProcessed++;
            
            // Buscar específicamente LIQUIPP07
            if (product.code === 'LIQUIPP07') {
                foundProduct = product;
                console.log('\n🎯 ¡ENCONTRADO! LIQUIPP07:');
                console.log(`📦 Nombre: ${product.name}`);
                console.log(`🆔 ID SIIGO: ${product.id}`);
                console.log(`📂 Categoría RAW: ${JSON.stringify(product.account_group)}`);
                console.log(`📂 Categoría extraída: "${product.account_group?.name || 'Sin categoría'}"`);
                console.log(`💰 Precio RAW: ${JSON.stringify(product.prices)}`);
                console.log(`💰 Precio extraído: $${extractPriceFromSiigo(product)}`);
                console.log(`✅ Estado: ${product.active}`);
                
                // Ver qué hay en la BD actualmente
                const [existing] = await pool.execute(
                    'SELECT * FROM products WHERE internal_code = ? OR siigo_product_id = ?',
                    [product.code, product.id]
                );
                
                if (existing.length > 0) {
                    console.log(`🗄️ En BD actualmente:`);
                    console.log(`   - Nombre: "${existing[0].product_name}"`);
                    console.log(`   - Categoría: "${existing[0].category}"`);
                    console.log(`   - Precio: $${existing[0].standard_price}`);
                    console.log(`   - Activo: ${existing[0].is_active}`);
                    console.log(`   - SIIGO ID: ${existing[0].siigo_product_id}`);
                } else {
                    console.log(`🗄️ Producto NO encontrado en BD`);
                }
            }
            
            // Actualizar TODOS los productos que encontremos
            try {
                const category = product.account_group?.name || 'Sin categoría';
                const price = extractPriceFromSiigo(product);
                const isActive = product.active !== false;
                
                // Buscar producto en BD por código o siigo_product_id
                const [existing] = await pool.execute(
                    'SELECT id, product_name, category, standard_price, is_active FROM products WHERE internal_code = ? OR siigo_product_id = ?',
                    [product.code, product.id]
                );
                
                if (existing.length > 0) {
                    const current = existing[0];
                    const needsUpdate = 
                        current.category !== category ||
                        parseFloat(current.standard_price) !== price ||
                        Boolean(current.is_active) !== isActive;
                    
                    if (needsUpdate) {
                        await pool.execute(`
                            UPDATE products 
                            SET product_name = ?, 
                                category = ?, 
                                standard_price = ?,
                                is_active = ?,
                                siigo_product_id = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [
                            product.name,
                            category,
                            price,
                            isActive,
                            product.id,
                            current.id
                        ]);
                        
                        productsUpdated++;
                        
                        if (product.code === 'LIQUIPP07') {
                            console.log(`🔄 ✅ LIQUIPP07 ACTUALIZADO!`);
                            console.log(`   - Nueva categoría: "${category}"`);
                            console.log(`   - Nuevo precio: $${price}`);
                        }
                    }
                }
                
            } catch (updateError) {
                console.error(`❌ Error actualizando ${product.code}:`, updateError.message);
            }
            
            // Log de progreso cada 50 productos
            if (productsProcessed % 50 === 0) {
                console.log(`📊 Progreso: ${productsProcessed}/${allProducts.length} productos procesados, ${productsUpdated} actualizados`);
            }
        }
                
                console.log(`📦 Productos en página ${page}: ${products.length}`);
                
                for (const product of products) {
                    productsProcessed++;
                    
                    // Buscar específicamente LIQUIPP07
                    if (product.code === 'LIQUIPP07') {
                        foundProduct = product;
                        console.log('\n🎯 ¡ENCONTRADO! LIQUIPP07:');
                        console.log(`📦 Nombre: ${product.name}`);
                        console.log(`🆔 ID SIIGO: ${product.id}`);
                        console.log(`📂 Categoría RAW: ${JSON.stringify(product.account_group)}`);
                        console.log(`📂 Categoría extraída: "${product.account_group?.name || 'Sin categoría'}"`);
                        console.log(`💰 Precio RAW: ${JSON.stringify(product.prices)}`);
                        console.log(`💰 Precio extraído: $${extractPriceFromSiigo(product)}`);
                        console.log(`✅ Estado: ${product.active}`);
                        
                        // Ver qué hay en la BD actualmente
                        const [existing] = await pool.execute(
                            'SELECT * FROM products WHERE internal_code = ? OR siigo_product_id = ?',
                            [product.code, product.id]
                        );
                        
                        if (existing.length > 0) {
                            console.log(`🗄️ En BD actualmente:`);
                            console.log(`   - Nombre: "${existing[0].product_name}"`);
                            console.log(`   - Categoría: "${existing[0].category}"`);
                            console.log(`   - Precio: $${existing[0].standard_price}`);
                            console.log(`   - Activo: ${existing[0].is_active}`);
                            console.log(`   - SIIGO ID: ${existing[0].siigo_product_id}`);
                        } else {
                            console.log(`🗄️ Producto NO encontrado en BD`);
                        }
                    }
                    
                    // Actualizar TODOS los productos que encontremos
                    try {
                        const category = product.account_group?.name || 'Sin categoría';
                        const price = extractPriceFromSiigo(product);
                        const isActive = product.active !== false;
                        
                        // Buscar producto en BD por código o siigo_product_id
                        const [existing] = await pool.execute(
                            'SELECT id, product_name, category, standard_price, is_active FROM products WHERE internal_code = ? OR siigo_product_id = ?',
                            [product.code, product.id]
                        );
                        
                        if (existing.length > 0) {
                            const current = existing[0];
                            const needsUpdate = 
                                current.category !== category ||
                                parseFloat(current.standard_price) !== price ||
                                Boolean(current.is_active) !== isActive;
                            
                            if (needsUpdate) {
                                await pool.execute(`
                                    UPDATE products 
                                    SET product_name = ?, 
                                        category = ?, 
                                        standard_price = ?,
                                        is_active = ?,
                                        siigo_product_id = ?,
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ?
                                `, [
                                    product.name,
                                    category,
                                    price,
                                    isActive,
                                    product.id,
                                    current.id
                                ]);
                                
                                productsUpdated++;
                                
                                if (product.code === 'LIQUIPP07') {
                                    console.log(`🔄 ✅ LIQUIPP07 ACTUALIZADO!`);
                                    console.log(`   - Nueva categoría: "${category}"`);
                                    console.log(`   - Nuevo precio: $${price}`);
                                }
                            }
                        }
                        
                    } catch (updateError) {
                        console.error(`❌ Error actualizando ${product.code}:`, updateError.message);
                    }
                }
                
                console.log(`📊 Progreso: ${productsProcessed}/${totalProducts} productos procesados, ${productsUpdated} actualizados`);
                
            } catch (pageError) {
                console.error(`❌ Error en página ${page}:`, pageError.message);
                
                // Si es rate limiting, esperar más tiempo
                if (pageError.response?.status === 429) {
                    console.log('🚦 Rate limit, esperando 10 segundos...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }
        }
        
        console.log(`\n🎉 Proceso completado!`);
        console.log(`📊 Total procesados: ${productsProcessed}`);
        console.log(`🔄 Total actualizados: ${productsUpdated}`);
        
        if (foundProduct) {
            console.log(`\n✅ LIQUIPP07 encontrado y procesado!`);
        } else {
            console.log(`\n❌ LIQUIPP07 no encontrado en SIIGO`);
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        process.exit(0);
    }
}

function extractPriceFromSiigo(product) {
    try {
        if (product.prices && 
            Array.isArray(product.prices) && 
            product.prices.length > 0 &&
            product.prices[0].price_list &&
            Array.isArray(product.prices[0].price_list) &&
            product.prices[0].price_list.length > 0) {
            
            return parseFloat(product.prices[0].price_list[0].value) || 0;
        }
        return 0;
    } catch (error) {
        console.warn('Error extrayendo precio:', error.message);
        return 0;
    }
}

debugSpecificProduct();
