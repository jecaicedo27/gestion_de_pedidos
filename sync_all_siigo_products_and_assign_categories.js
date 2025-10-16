const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos'
};

const siigoConfig = {
    baseURL: 'https://api.siigo.com/v1',
    username: process.env.SIIGO_USERNAME,
    access_key: process.env.SIIGO_ACCESS_KEY
};

let siigoToken = null;

async function getSiigoToken() {
    try {
        console.log('🔑 Obteniendo token de SIIGO...');
        const response = await axios.post(`${siigoConfig.baseURL}/auth`, {
            username: siigoConfig.username,
            access_key: siigoConfig.access_key
        });
        
        siigoToken = response.data.access_token;
        console.log('✅ Token obtenido exitosamente');
        return siigoToken;
    } catch (error) {
        console.error('❌ Error obteniendo token:', error.response?.data || error.message);
        throw error;
    }
}

async function getAllSiigoProducts() {
    try {
        console.log('📦 Consultando todos los productos de SIIGO...');
        
        if (!siigoToken) {
            await getSiigoToken();
        }

        let allProducts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            console.log(`   Consultando página ${page}...`);
            
            const response = await axios.get(`${siigoConfig.baseURL}/products`, {
                headers: {
                    'Authorization': siigoToken,
                    'Content-Type': 'application/json'
                },
                params: {
                    page: page,
                    page_size: 100
                }
            });

            const products = response.data.results || [];
            allProducts = allProducts.concat(products);
            
            console.log(`   Productos obtenidos en página ${page}: ${products.length}`);
            
            // Verificar si hay más páginas
            hasMore = products.length === 100;
            page++;
            
            // Evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`✅ Total productos obtenidos de SIIGO: ${allProducts.length}`);
        return allProducts;
    } catch (error) {
        console.error('❌ Error consultando productos de SIIGO:', error.response?.data || error.message);
        throw error;
    }
}

function assignCategoryToProduct(product) {
    const productName = (product.name || '').toLowerCase();
    const productCode = (product.code || '').toLowerCase();
    const productCategory = (product.category || '').toLowerCase();
    const productReference = (product.reference || '').toLowerCase();
    
    // Reglas de asignación de categorías
    const categoryRules = [
        {
            category: 'YEXIS',
            keywords: ['yexis', 'yex'],
            codePatterns: ['yex', 'yexis']
        },
        {
            category: 'LIQUIPOPS',
            keywords: ['liquipop', 'liqui pop', 'liquipp'],
            codePatterns: ['liquipp', 'liquipop']
        },
        {
            category: 'GENIALITY',
            keywords: ['geniality', 'genial'],
            codePatterns: ['gen', 'geniality']
        },
        {
            category: 'MEZCLAS EN POLVO',
            keywords: ['mezclas', 'polvo', 'mezcla'],
            codePatterns: ['mezc', 'polvo']
        },
        {
            category: 'Servicios',
            keywords: ['servicio', 'service', 'mano de obra'],
            codePatterns: ['serv', 'service']
        },
        {
            category: 'Materia prima gravadas 19%',
            keywords: ['materia prima', 'gravada', '19%', 'gravadas 19'],
            codePatterns: ['mp19', 'mat19']
        },
        {
            category: 'Materia prima gravadas 5%',
            keywords: ['materia prima', 'gravada', '5%', 'gravadas 5'],
            codePatterns: ['mp5', 'mat5']
        },
        {
            category: 'productos en proceso',
            keywords: ['proceso', 'en proceso', 'semi'],
            codePatterns: ['proc', 'proceso']
        },
        {
            category: 'productos Fabricados shotboom NO USAR',
            keywords: ['shotboom', 'shot boom', 'fabricado'],
            codePatterns: ['shotb', 'boom']
        },
        {
            category: 'licores materia prima',
            keywords: ['licor', 'alcohol', 'etanol'],
            codePatterns: ['lic', 'alc', 'etanol']
        },
        {
            category: 'SKARCHA FABRICADOS NO USAR',
            keywords: ['skarcha', 'fabricado'],
            codePatterns: ['skar', 'skarcha']
        },
        {
            category: 'SKARCHA NO FABRICADOS 19%',
            keywords: ['skarcha', 'no fabricado', '19%'],
            codePatterns: ['skar']
        },
        {
            category: 'SHOT NO FABRICADOS',
            keywords: ['shot', 'no fabricado'],
            codePatterns: ['shot']
        },
        {
            category: 'VENTA PROPIEDAD PLANTA Y EQUIPO NO USAR',
            keywords: ['propiedad', 'planta', 'equipo', 'venta'],
            codePatterns: ['ppe', 'planta']
        },
        {
            category: 'VENTA PROPIEDAD PLANTA Y EQUIPO NUEVO',
            keywords: ['propiedad', 'planta', 'equipo', 'nuevo'],
            codePatterns: ['ppen', 'nuevo']
        },
        {
            category: 'Productos No fabricados 19%',
            keywords: ['no fabricado', '19%'],
            codePatterns: ['nf19']
        }
    ];

    // Buscar coincidencias
    for (const rule of categoryRules) {
        // Buscar en keywords
        const matchKeyword = rule.keywords.some(keyword => 
            productName.includes(keyword) || 
            productCategory.includes(keyword) ||
            productReference.includes(keyword)
        );
        
        // Buscar en códigos
        const matchCode = rule.codePatterns.some(pattern => 
            productCode.includes(pattern) ||
            productReference.includes(pattern)
        );
        
        if (matchKeyword || matchCode) {
            return rule.category;
        }
    }

    // Si no encuentra coincidencia específica, usar categoría por defecto basada en el tipo
    if (productCategory.includes('servicio')) return 'Servicios';
    if (productCategory.includes('materia prima')) return 'Materia prima gravadas 19%';
    
    return null; // Sin categoría asignada
}

async function syncProductsToDatabase(products) {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('💾 Sincronizando productos a la base de datos...');
        
        let inserted = 0;
        let updated = 0;
        let categorized = 0;
        
        for (const siigoProduct of products) {
            try {
                // Asignar categoría
                const assignedCategory = assignCategoryToProduct(siigoProduct);
                
                // Preparar datos del producto
                const productData = {
                    product_name: siigoProduct.name || 'Sin nombre',
                    internal_code: siigoProduct.code || 'Sin código',
                    category: assignedCategory,
                    barcode: 'PENDIENTE',
                    is_active: true,
                    siigo_id: siigoProduct.id,
                    unit_cost: parseFloat(siigoProduct.unit_cost || 0),
                    sale_price: parseFloat(siigoProduct.prices?.[0]?.price_list?.[0]?.value || 0),
                    reference: siigoProduct.reference || null,
                    description: siigoProduct.description || null
                };
                
                // Verificar si el producto ya existe
                const [existingProduct] = await connection.execute(
                    'SELECT id, category FROM products WHERE siigo_id = ? OR internal_code = ?',
                    [siigoProduct.id, siigoProduct.code]
                );
                
                if (existingProduct.length > 0) {
                    // Actualizar producto existente
                    const currentCategory = existingProduct[0].category;
                    const newCategory = assignedCategory || currentCategory;
                    
                    await connection.execute(`
                        UPDATE products SET 
                            product_name = ?,
                            category = ?,
                            unit_cost = ?,
                            sale_price = ?,
                            reference = ?,
                            description = ?,
                            siigo_id = ?,
                            is_active = true
                        WHERE id = ?
                    `, [
                        productData.product_name,
                        newCategory,
                        productData.unit_cost,
                        productData.sale_price,
                        productData.reference,
                        productData.description,
                        productData.siigo_id,
                        existingProduct[0].id
                    ]);
                    
                    updated++;
                    if (assignedCategory && assignedCategory !== currentCategory) {
                        categorized++;
                    }
                } else {
                    // Insertar nuevo producto
                    await connection.execute(`
                        INSERT INTO products (
                            product_name, internal_code, category, barcode, is_active,
                            siigo_id, unit_cost, sale_price, reference, description
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        productData.product_name,
                        productData.internal_code,
                        productData.category,
                        productData.barcode,
                        productData.is_active,
                        productData.siigo_id,
                        productData.unit_cost,
                        productData.sale_price,
                        productData.reference,
                        productData.description
                    ]);
                    
                    inserted++;
                    if (assignedCategory) {
                        categorized++;
                    }
                }
                
                if ((inserted + updated) % 50 === 0) {
                    console.log(`   Procesados: ${inserted + updated} productos...`);
                }
                
            } catch (error) {
                console.error(`❌ Error procesando producto ${siigoProduct.code}:`, error.message);
                continue;
            }
        }
        
        console.log('\n✅ Sincronización completada:');
        console.log(`   📦 Productos insertados: ${inserted}`);
        console.log(`   🔄 Productos actualizados: ${updated}`);
        console.log(`   🏷️ Productos categorizados: ${categorized}`);
        
    } finally {
        await connection.end();
    }
}

async function getProductCountByCategory() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('\n📊 Conteo de productos por categoría:');
        
        const [results] = await connection.execute(`
            SELECT 
                c.name as categoria,
                COUNT(p.id) as productos
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name
            ORDER BY productos DESC, c.name ASC
        `);
        
        results.forEach(row => {
            console.log(`   ${row.categoria}: ${row.productos} productos`);
        });
        
        return results;
    } finally {
        await connection.end();
    }
}

async function main() {
    try {
        console.log('🚀 INICIANDO SINCRONIZACIÓN COMPLETA DE PRODUCTOS SIIGO');
        console.log('='.repeat(60));
        
        // 1. Obtener productos de SIIGO
        const siigoProducts = await getAllSiigoProducts();
        
        if (siigoProducts.length === 0) {
            console.log('⚠️ No se encontraron productos en SIIGO');
            return;
        }
        
        // 2. Sincronizar productos a la base de datos
        await syncProductsToDatabase(siigoProducts);
        
        // 3. Mostrar estadísticas finales
        await getProductCountByCategory();
        
        console.log('\n🎉 ¡Sincronización completada exitosamente!');
        
    } catch (error) {
        console.error('💥 Error en la sincronización:', error.message);
        process.exit(1);
    }
}

// Ejecutar el script
main();
