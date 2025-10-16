const mysql = require('mysql2/promise');
const axios = require('axios');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

// Configuración por defecto para nuevas empresas
const systemDefaults = {
    carriers: [
        { name: 'ENVIA', type: 'externa' },
        { name: 'SERVIENTREGA', type: 'externa' },
        { name: 'INTERRAPIDISIMO', type: 'externa' },
        { name: 'TCC', type: 'externa' },
        { name: 'MENSAJERIA LOCAL', type: 'local' },
        { name: 'CAMION EXTERNO', type: 'externa' }
    ],
    users: [
        { username: 'admin', role: 'admin', name: 'Administrador' },
        { username: 'empaque', role: 'empaque', name: 'Personal de Empaque' },
        { username: 'logistica', role: 'logistica', name: 'Personal de Logística' }
    ]
};

async function getSiigoToken(credentials) {
    try {
        console.log('🔑 Obteniendo token de SIIGO...');
        
        const response = await axios.post('https://api.siigo.com/auth', {
            username: credentials.username,
            access_key: credentials.access_key
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

async function getAllProductsFromSiigo(token) {
    let allProducts = [];
    
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
        const totalResults = firstResponse.data.pagination?.total_results || 0;
        const expectedPages = Math.ceil(totalResults / 100);
        
        console.log(`📊 Total productos en SIIGO: ${totalResults} (${expectedPages} páginas)`);
        
        for (let page = 2; page <= expectedPages; page++) {
            try {
                console.log(`   📄 Obteniendo página ${page}/${expectedPages}...`);
                
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
                
                await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
                
            } catch (pageError) {
                console.error(`   ❌ Error en página ${page}:`, pageError.message);
                if (pageError.response?.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    continue;
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error obteniendo productos:', error.message);
        throw error;
    }
    
    console.log(`✅ Total productos obtenidos: ${allProducts.length}`);
    return allProducts;
}

async function createSystemSchema(siigoCredentials, companyInfo) {
    let connection;
    try {
        console.log('🚀 INICIANDO CREACIÓN DE ESQUEMA DEL SISTEMA...');
        console.log(`🏢 Empresa: ${companyInfo.name}`);
        
        connection = await mysql.createConnection(dbConfig);
        
        // PASO 1: Limpiar todas las tablas principales
        console.log('\n🗑️  PASO 1: Limpiando esquema anterior...');
        const tablesToClean = [
            'products', 'categories', 'users', 'carriers', 
            'orders', 'order_items', 'system_config'
        ];
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        for (const table of tablesToClean) {
            try {
                await connection.execute(`DELETE FROM ${table}`);
                await connection.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
                console.log(`   ✅ ${table} limpiada`);
            } catch (e) {
                console.log(`   ⚠️  ${table} no existe o ya está limpia`);
            }
        }
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        // PASO 2: Configurar información de la empresa
        console.log('\n🏢 PASO 2: Configurando información de la empresa...');
        await connection.execute(`
            INSERT INTO system_config (config_key, config_value, description, created_at) 
            VALUES 
            ('company_name', ?, 'Nombre de la empresa', NOW()),
            ('siigo_username', ?, 'Usuario de SIIGO', NOW()),
            ('siigo_access_key', ?, 'Clave de acceso SIIGO', NOW()),
            ('schema_created_at', NOW(), 'Fecha de creación del esquema', NOW())
            ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_at = NOW()
        `, [companyInfo.name, siigoCredentials.username, siigoCredentials.access_key]);
        console.log('✅ Configuración de empresa guardada');
        
        // PASO 3: Crear usuarios por defecto
        console.log('\n👥 PASO 3: Creando usuarios por defecto...');
        for (const user of systemDefaults.users) {
            await connection.execute(`
                INSERT INTO users (username, password_hash, role, full_name, is_active, created_at)
                VALUES (?, SHA2('123456', 256), ?, ?, TRUE, NOW())
            `, [user.username, user.role, user.name]);
            console.log(`   ✅ Usuario ${user.username} (${user.role})`);
        }
        
        // PASO 4: Crear transportadoras
        console.log('\n🚚 PASO 4: Configurando transportadoras...');
        for (const carrier of systemDefaults.carriers) {
            await connection.execute(`
                INSERT INTO carriers (name, type, is_active, created_at)
                VALUES (?, ?, TRUE, NOW())
            `, [carrier.name, carrier.type]);
            console.log(`   ✅ Transportadora ${carrier.name} (${carrier.type})`);
        }
        
        // PASO 5: Obtener token de SIIGO
        const token = await getSiigoToken(siigoCredentials);
        
        // PASO 6: Importar productos desde SIIGO
        console.log('\n📦 PASO 6: Importando productos desde SIIGO...');
        const siigoProducts = await getAllProductsFromSiigo(token);
        
        let insertedCount = 0;
        let withBarcodeCount = 0;
        let pendingCount = 0;
        let pendingCounter = 1;
        
        for (const siigoProduct of siigoProducts) {
            try {
                const realBarcode = extractBarcodeFromSiigo(siigoProduct);
                let finalBarcode;
                
                if (realBarcode) {
                    finalBarcode = realBarcode;
                    withBarcodeCount++;
                } else {
                    finalBarcode = `PENDIENTE_${String(pendingCounter).padStart(6, '0')}`;
                    pendingCounter++;
                    pendingCount++;
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
                
                if (insertedCount % 100 === 0) {
                    console.log(`   📊 ${insertedCount}/${siigoProducts.length} productos procesados...`);
                }
                
            } catch (productError) {
                console.error(`   ❌ Error procesando ${siigoProduct.name}:`, productError.message);
            }
        }
        
        // PASO 7: Crear categorías dinámicas
        console.log('\n📂 PASO 7: Creando sistema de categorías...');
        const [categories] = await connection.execute(`
            SELECT DISTINCT category, COUNT(*) as product_count 
            FROM products 
            WHERE category IS NOT NULL 
            GROUP BY category
        `);
        
        for (const cat of categories) {
            await connection.execute(`
                INSERT INTO categories (name, product_count, is_active, created_at)
                VALUES (?, ?, TRUE, NOW())
            `, [cat.category, cat.product_count]);
        }
        console.log(`✅ ${categories.length} categorías creadas`);
        
        // PASO 8: Configuraciones finales
        console.log('\n⚙️  PASO 8: Configuraciones finales del sistema...');
        await connection.execute(`
            INSERT INTO system_config (config_key, config_value, description, created_at) 
            VALUES 
            ('auto_sync_enabled', 'true', 'Auto sincronización habilitada', NOW()),
            ('barcode_system_version', '2.0', 'Versión del sistema de códigos de barras', NOW()),
            ('products_imported_count', ?, 'Número de productos importados', NOW())
            ON DUPLICATE KEY UPDATE 
            config_value = VALUES(config_value),
            updated_at = NOW()
        `, [insertedCount.toString()]);
        
        // Resumen final
        console.log('\n🎉 ¡ESQUEMA DEL SISTEMA CREADO EXITOSAMENTE!');
        console.log(`📊 RESUMEN COMPLETO:`);
        console.log(`   🏢 Empresa: ${companyInfo.name}`);
        console.log(`   📦 Productos: ${insertedCount} importados`);
        console.log(`   📧 Con códigos: ${withBarcodeCount} (${((withBarcodeCount/insertedCount)*100).toFixed(1)}%)`);
        console.log(`   ⏳ Pendientes: ${pendingCount}`);
        console.log(`   👥 Usuarios: ${systemDefaults.users.length} creados`);
        console.log(`   🚚 Transportadoras: ${systemDefaults.carriers.length} configuradas`);
        console.log(`   📂 Categorías: ${categories.length} creadas`);
        
        console.log('\n✨ SISTEMA LISTO PARA OPERAR CON NUEVA EMPRESA');
        console.log('🔧 El sistema está completamente configurado y funcional');
        
        return {
            success: true,
            company: companyInfo.name,
            products: insertedCount,
            withBarcodes: withBarcodeCount,
            pending: pendingCount,
            users: systemDefaults.users.length,
            carriers: systemDefaults.carriers.length,
            categories: categories.length
        };
        
    } catch (error) {
        console.error('❌ Error creando esquema:', error.message);
        throw error;
    } finally {
        if (connection) await connection.end();
    }
}

// Función para usar desde API endpoint
async function createSchemaForCompany(companyData) {
    return await createSystemSchema(
        {
            username: companyData.siigoUsername,
            access_key: companyData.siigoAccessKey
        },
        {
            name: companyData.companyName
        }
    );
}

module.exports = { createSystemSchema, createSchemaForCompany };

// Ejecución directa para testing
if (require.main === module) {
    // Ejemplo de uso:
    createSystemSchema(
        {
            username: 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
            access_key: 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk='
        },
        {
            name: 'PERLAS EXPLOSIVAS COLOMBIA SAS'
        }
    ).catch(console.error);
}
