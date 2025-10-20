const siigoService = require('./backend/services/siigoService');
const { pool } = require('./backend/config/database');

async function fixAll588Products() {
    console.log('🔧 Corrigiendo TODOS los 588 productos de SIIGO...');
    
    try {
        const pageSize = 100;
        const totalProducts = 588; // Sabemos que hay 588
        const totalPages = Math.ceil(totalProducts / pageSize);
        
        console.log(`📊 Total productos esperados: ${totalProducts}`);
        console.log(`📄 Páginas a procesar: ${totalPages}`);
        
        let allProducts = [];
        let foundLIQUIPP07 = null;
        let totalUpdated = 0;
        
        // Obtener todas las páginas manualmente
        for (let page = 1; page <= totalPages; page++) {
            console.log(`\n📄 Procesando página ${page} de ${totalPages}...`);
            
            try {
                // Pequeña pausa entre páginas para evitar rate limiting
                if (page > 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                // Usar función directa del servicio para obtener página específica
                const headers = await siigoService.getHeaders();
                const axios = require('axios');
                
                const response = await axios.get(`${siigoService.baseURL}/v1/products`, {
                    headers,
                    params: {
                        page: page,
                        page_size: pageSize
                    },
                    timeout: 30000
                });
                
                const products = response.data.results || [];
                console.log(`📦 Productos obtenidos en página ${page}: ${products.length}`);
                
                // Agregar productos al array total
                allProducts = allProducts.concat(products);
                
                // Buscar LIQUIPP07 específicamente
                const liquipp07 = products.find(p => p.code === 'LIQUIPP07');
                if (liquipp07) {
                    foundLIQUIPP07 = liquipp07;
                    console.log('\n🎯 ¡ENCONTRADO LIQUIPP07 EN PÁGINA ' + page + '!');
                    console.log(`📦 Nombre: ${liquipp07.name}`);
                    console.log(`🆔 ID SIIGO: ${liquipp07.id}`);
                    console.log(`📂 Categoría RAW: ${JSON.stringify(liquipp07.account_group)}`);
                    console.log(`📂 Categoría extraída: "${liquipp07.account_group?.name || 'Sin categoría'}"`);
                    console.log(`💰 Precio RAW: ${JSON.stringify(liquipp07.prices)}`);
                    console.log(`💰 Precio extraído: $${extractPriceFromSiigo(liquipp07)}`);
                    console.log(`✅ Estado: ${liquipp07.active}`);
                }
                
            } catch (pageError) {
                console.error(`❌ Error en página ${page}:`, pageError.message);
                
                if (pageError.response?.status === 429) {
                    console.log('🚦 Rate limit, esperando 10 segundos...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    page--; // Reintentar la misma página
                    continue;
                }
            }
        }
        
        console.log(`\n📊 Total productos recopilados: ${allProducts.length} de ${totalProducts} esperados`);
        
        if (foundLIQUIPP07) {
            console.log(`\n🎯 LIQUIPP07 encontrado! Verificando en base de datos...`);
            
            // Ver qué hay en la BD actualmente para LIQUIPP07
            const [existing] = await pool.execute(
                'SELECT * FROM products WHERE internal_code = ? OR siigo_product_id = ?',
                [foundLIQUIPP07.code, foundLIQUIPP07.id]
            );
            
            if (existing.length > 0) {
                console.log(`🗄️ LIQUIPP07 en BD actualmente:`);
                console.log(`   - Nombre: "${existing[0].product_name}"`);
                console.log(`   - Categoría: "${existing[0].category}"`);
                console.log(`   - Precio: $${existing[0].standard_price}`);
                console.log(`   - Activo: ${existing[0].is_active}`);
            }
        }
        
        // Ahora actualizar todos los productos
        console.log(`\n🔄 Actualizando todos los productos en base de datos...`);
        
        for (let i = 0; i < allProducts.length; i++) {
            const product = allProducts[i];
            
            try {
                const category = product.account_group?.name || 'Sin categoría';
                const price = extractPriceFromSiigo(product);
                const isActive = product.active !== false;
                
                // Buscar producto en BD
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
                        
                        totalUpdated++;
                        
                        if (product.code === 'LIQUIPP07') {
                            console.log(`\n🔄 ✅ LIQUIPP07 ACTUALIZADO EXITOSAMENTE!`);
                            console.log(`   - Nueva categoría: "${category}"`);
                            console.log(`   - Nuevo precio: $${price}`);
                            console.log(`   - Estado: ${isActive}`);
                        }
                    }
                }
                
            } catch (updateError) {
                console.error(`❌ Error actualizando ${product.code}:`, updateError.message);
            }
            
            // Log de progreso cada 100 productos
            if ((i + 1) % 100 === 0) {
                console.log(`📊 Progreso: ${i + 1}/${allProducts.length} productos procesados, ${totalUpdated} actualizados`);
            }
        }
        
        console.log(`\n🎉 ¡Actualización completada!`);
        console.log(`📊 Total productos procesados: ${allProducts.length}`);
        console.log(`🔄 Total productos actualizados: ${totalUpdated}`);
        
        if (foundLIQUIPP07) {
            console.log(`\n✅ LIQUIPP07 encontrado y procesado exitosamente!`);
            console.log(`📂 Categoría corregida: "${foundLIQUIPP07.account_group?.name}"`);
        } else {
            console.log(`\n❌ LIQUIPP07 no encontrado en ninguna página de SIIGO`);
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

fixAll588Products();
