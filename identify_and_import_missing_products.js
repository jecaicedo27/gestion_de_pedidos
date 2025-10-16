const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config();

async function identifyAndImportMissingProducts() {
    console.log('🔍 Identificando e importando productos faltantes desde SIIGO...\n');

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

        // Obtener token de SIIGO
        console.log('🔑 Obteniendo token de autenticación de SIIGO...');
        
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Partner-Id': process.env.SIIGO_PARTNER_ID || 'siigo'
            }
        });

        if (!authResponse.data.access_token) {
            throw new Error('No se pudo obtener el token de autenticación');
        }

        const token = authResponse.data.access_token;
        console.log('✅ Token obtenido exitosamente');

        // Obtener todos los productos de SIIGO
        console.log('📦 Obteniendo todos los productos de SIIGO...');
        
        const siigoProducts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await axios.get(`https://api.siigo.com/v1/products?page=${page}&page_size=100`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'siigo'
                    }
                });

                if (response.data.results && response.data.results.length > 0) {
                    siigoProducts.push(...response.data.results);
                    console.log(`   📄 Página ${page}: ${response.data.results.length} productos obtenidos`);
                    page++;
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.log(`⚠️  Error en página ${page}:`, error.message);
                hasMore = false;
            }
        }

        console.log(`\n📊 Total productos en SIIGO: ${siigoProducts.length}`);

        // Obtener productos existentes en la base de datos local
        console.log('🗄️  Consultando productos existentes en base de datos local...');
        
        const [existingProducts] = await connection.execute(`
            SELECT code, siigo_id, product_name 
            FROM products 
            WHERE code IS NOT NULL AND code != ''
        `);

        console.log(`📊 Total productos en base de datos local: ${existingProducts.length}`);

        // Crear un mapa de productos existentes por código
        const existingProductsMap = new Map();
        existingProducts.forEach(product => {
            if (product.code) {
                existingProductsMap.set(product.code.toUpperCase(), product);
            }
        });

        // Identificar productos faltantes
        const missingProducts = [];
        const inactiveProducts = [];
        
        siigoProducts.forEach(siigoProduct => {
            const code = siigoProduct.code ? siigoProduct.code.toUpperCase() : null;
            
            if (code && !existingProductsMap.has(code)) {
                missingProducts.push(siigoProduct);
            }
            
            // También revisar productos inactivos en SIIGO
            if (siigoProduct.active === false) {
                inactiveProducts.push({
                    code: siigoProduct.code,
                    name: siigoProduct.name,
                    active: siigoProduct.active,
                    existing: existingProductsMap.has(code)
                });
            }
        });

        console.log(`\n🔍 ANÁLISIS DE PRODUCTOS:`);
        console.log(`   ❌ Productos faltantes en base de datos: ${missingProducts.length}`);
        console.log(`   🚫 Productos inactivos en SIIGO: ${inactiveProducts.length}`);

        // Mostrar productos faltantes más relevantes
        if (missingProducts.length > 0) {
            console.log('\n📋 PRODUCTOS FALTANTES (primeros 10):');
            missingProducts.slice(0, 10).forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.code} - ${product.name} (Activo: ${product.active})`);
            });
        }

        // Mostrar productos inactivos relevantes
        if (inactiveProducts.length > 0) {
            console.log('\n🚫 PRODUCTOS INACTIVOS EN SIIGO (primeros 10):');
            inactiveProducts.slice(0, 10).forEach((product, index) => {
                const status = product.existing ? 'EXISTE EN DB' : 'FALTA EN DB';
                console.log(`   ${index + 1}. ${product.code} - ${product.name} (${status})`);
            });
        }

        // Buscar específicamente MP170
        const mp170 = siigoProducts.find(p => p.code && p.code.toUpperCase() === 'MP170');
        if (mp170) {
            console.log('\n🎯 PRODUCTO MP170 ENCONTRADO EN SIIGO:');
            console.log(`   Código: ${mp170.code}`);
            console.log(`   Nombre: ${mp170.name}`);
            console.log(`   Activo: ${mp170.active}`);
            console.log(`   ID SIIGO: ${mp170.id}`);
            console.log(`   Existe en DB local: ${existingProductsMap.has('MP170') ? 'SÍ' : 'NO'}`);
        } else {
            console.log('\n❌ PRODUCTO MP170 NO ENCONTRADO EN SIIGO');
        }

        // Importar productos faltantes (máximo 50 para evitar sobrecarga)
        const productsToImport = missingProducts.slice(0, 50);
        
        if (productsToImport.length > 0) {
            console.log(`\n⬇️  IMPORTANDO ${productsToImport.length} PRODUCTOS FALTANTES...`);
            
            let importedCount = 0;
            let errorCount = 0;

            for (const siigoProduct of productsToImport) {
                try {
                    // Obtener categoría por defecto
                    const [categories] = await connection.execute(`
                        SELECT id FROM categories WHERE name = 'Sin categoría' LIMIT 1
                    `);
                    
                    const categoryId = categories.length > 0 ? categories[0].id : 1;

                    // Insertar producto
                    await connection.execute(`
                        INSERT INTO products (
                            code, 
                            product_name, 
                            description, 
                            category_id,
                            siigo_id, 
                            available_quantity, 
                            is_active,
                            barcode,
                            created_at,
                            updated_at,
                            last_sync_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
                    `, [
                        siigoProduct.code || null,
                        siigoProduct.name || 'Producto sin nombre',
                        siigoProduct.description || '',
                        categoryId,
                        siigoProduct.id || null,
                        siigoProduct.available_quantity || 0,
                        siigoProduct.active !== false ? 1 : 0,
                        siigoProduct.code || 'PENDIENTE'
                    ]);

                    importedCount++;
                    console.log(`   ✅ ${siigoProduct.code} - ${siigoProduct.name}`);
                    
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    errorCount++;
                    console.log(`   ❌ Error importando ${siigoProduct.code}: ${error.message}`);
                }
            }

            console.log(`\n📊 RESULTADO DE IMPORTACIÓN:`);
            console.log(`   ✅ Productos importados: ${importedCount}`);
            console.log(`   ❌ Errores: ${errorCount}`);
        }

        // Verificar estado final
        const [finalCount] = await connection.execute(`
            SELECT COUNT(*) as total FROM products
        `);

        console.log(`\n📈 ESTADO FINAL:`);
        console.log(`   Total productos en base de datos: ${finalCount[0].total}`);

        if (mp170 && !existingProductsMap.has('MP170')) {
            console.log('\n🔄 Verificando si MP170 fue importado...');
            const [mp170Check] = await connection.execute(`
                SELECT code, product_name, is_active 
                FROM products 
                WHERE code = 'MP170'
            `);
            
            if (mp170Check.length > 0) {
                console.log(`   ✅ MP170 importado: ${mp170Check[0].product_name} (Activo: ${mp170Check[0].is_active})`);
            } else {
                console.log('   ❌ MP170 aún no está en la base de datos');
            }
        }

        console.log('\n🎉 Proceso completado exitosamente');

    } catch (error) {
        console.error('❌ Error durante el proceso:', error.message);
        if (error.response?.data) {
            console.error('   Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

identifyAndImportMissingProducts();
