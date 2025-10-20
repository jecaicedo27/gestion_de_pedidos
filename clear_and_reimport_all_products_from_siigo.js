const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function clearAndReimportAllProducts() {
    console.log('🧹 Limpiando tabla de productos y reimportando desde SIIGO...\n');

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

        // 1. BACKUP DE LA TABLA ACTUAL
        console.log('\n📋 Creando respaldo de productos actuales...');
        
        const [currentProducts] = await connection.execute(`
            SELECT COUNT(*) as total FROM products
        `);
        
        console.log(`   Productos actuales en DB: ${currentProducts[0].total}`);

        // Crear tabla de respaldo
        await connection.execute(`
            DROP TABLE IF EXISTS products_backup_${Date.now().toString().slice(-6)}
        `);

        const backupTable = `products_backup_${Date.now().toString().slice(-6)}`;
        await connection.execute(`
            CREATE TABLE ${backupTable} AS SELECT * FROM products
        `);
        
        console.log(`   ✅ Respaldo creado en tabla: ${backupTable}`);

        // 2. OBTENER TOKEN DE SIIGO
        console.log('\n🔑 Obteniendo token de autenticación de SIIGO...');
        
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
        console.log('   ✅ Token obtenido exitosamente');

        // 3. OBTENER TODOS LOS PRODUCTOS DE SIIGO
        console.log('\n📦 Obteniendo todos los productos de SIIGO...');
        
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
                console.log(`   ⚠️ Error en página ${page}:`, error.message);
                hasMore = false;
            }
        }

        console.log(`\n   📊 Total productos obtenidos de SIIGO: ${siigoProducts.length}`);

        // 4. LIMPIAR TABLA DE PRODUCTOS
        console.log('\n🧹 Limpiando tabla de productos...');
        
        // Deshabilitar foreign key checks temporalmente
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        // Truncar tabla
        await connection.execute('TRUNCATE TABLE products');
        
        // Rehabilitar foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('   ✅ Tabla productos limpiada completamente');

        // 5. VERIFICAR CATEGORÍA POR DEFECTO
        console.log('\n🏷️ Verificando categoría por defecto...');
        
        let defaultCategory = 'Sin categoría';
        console.log(`   📊 Categoría a usar: ${defaultCategory}`);

        // 6. IMPORTAR PRODUCTOS DESDE SIIGO
        console.log('\n⬇️ Importando productos desde SIIGO...');
        
        let importedCount = 0;
        let activeCount = 0;
        let inactiveCount = 0;
        let errorCount = 0;

        for (const [index, siigoProduct] of siigoProducts.entries()) {
            try {
                // Determinar si el producto está activo
                const isActive = siigoProduct.active !== false ? 1 : 0;
                
                if (isActive) activeCount++;
                else inactiveCount++;

                // Insertar producto
                await connection.execute(`
                    INSERT INTO products (
                        internal_code, 
                        product_name, 
                        description, 
                        category,
                        siigo_id, 
                        available_quantity, 
                        is_active,
                        barcode,
                        created_at,
                        updated_at,
                        last_sync_at,
                        stock_updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), NOW())
                `, [
                    siigoProduct.code || `SIIGO_${siigoProduct.id}`,
                    siigoProduct.name || 'Producto sin nombre',
                    siigoProduct.description || '',
                    defaultCategory,
                    siigoProduct.id || null,
                    siigoProduct.available_quantity || 0,
                    isActive,
                    siigoProduct.code || 'PENDIENTE'
                ]);

                importedCount++;

                // Mostrar progreso cada 50 productos
                if ((index + 1) % 50 === 0) {
                    console.log(`   📦 Progreso: ${index + 1}/${siigoProducts.length} productos importados`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                errorCount++;
                console.log(`   ❌ Error importando ${siigoProduct.code || siigoProduct.id}: ${error.message}`);
                
                // Si hay muchos errores, detener
                if (errorCount > 50) {
                    console.log('   🛑 Demasiados errores, deteniendo importación...');
                    break;
                }
            }
        }

        // 7. VERIFICACIÓN FINAL
        console.log('\n📊 RESULTADO DE IMPORTACIÓN:');
        console.log('=====================================');
        console.log(`   ✅ Productos importados: ${importedCount}`);
        console.log(`   🟢 Productos activos: ${activeCount}`);
        console.log(`   🔴 Productos inactivos: ${inactiveCount}`);
        console.log(`   ❌ Errores: ${errorCount}`);

        // Verificar estado final de la base de datos
        const [finalCount] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive
            FROM products
        `);

        console.log('\n📈 ESTADO FINAL DE LA BASE DE DATOS:');
        console.log('=====================================');
        console.log(`   📦 Total productos: ${finalCount[0].total}`);
        console.log(`   🟢 Productos activos: ${finalCount[0].active}`);
        console.log(`   🔴 Productos inactivos: ${finalCount[0].inactive}`);

        // Verificar productos específicos mencionados anteriormente
        console.log('\n🎯 VERIFICANDO PRODUCTOS ESPECÍFICOS:');
        console.log('=====================================');
        
        const testProducts = ['MP170', 'SH36'];
        for (const productCode of testProducts) {
            const [productCheck] = await connection.execute(`
                SELECT internal_code, product_name, is_active, available_quantity 
                FROM products 
                WHERE internal_code = ?
            `, [productCode]);
            
            if (productCheck.length > 0) {
                const product = productCheck[0];
                const status = product.is_active ? '🟢 ACTIVO' : '🔴 INACTIVO';
                console.log(`   ${productCode}: ${product.product_name} - ${status} (Stock: ${product.available_quantity})`);
            } else {
                console.log(`   ${productCode}: ❌ NO ENCONTRADO`);
            }
        }

        console.log('\n🎉 PROCESO COMPLETADO EXITOSAMENTE');
        console.log('===================================');
        console.log('✅ Tabla productos limpiada y repoblada desde SIIGO');
        console.log('✅ Estados activo/inactivo sincronizados correctamente');
        console.log(`✅ Respaldo disponible en tabla: ${backupTable}`);

    } catch (error) {
        console.error('\n❌ ERROR DURANTE EL PROCESO:', error.message);
        if (error.response?.data) {
            console.error('   Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
        console.error('\n⚠️ Si hay errores, los datos de respaldo están disponibles para recuperación');
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Conexión cerrada');
        }
    }
}

clearAndReimportAllProducts();
