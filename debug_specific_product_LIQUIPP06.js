const mysql = require('mysql2/promise');
const SiigoService = require('./backend/services/siigoService');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function debugLIQUIPP06() {
    let connection;
    try {
        console.log('🔍 Investigando producto LIQUIPP06...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Primero verificar las columnas de la tabla
        console.log('\n📋 0. Verificando estructura de tabla products:');
        const [columns] = await connection.execute(`
            SHOW COLUMNS FROM products
        `);
        
        console.log('📊 Columnas disponibles:');
        columns.forEach(col => console.log(`   - ${col.Field} (${col.Type})`));
        
        // Buscar el producto en nuestra base de datos
        console.log('\n📋 1. Consultando producto LIQUIPP06 en base de datos local:');
        const [localProduct] = await connection.execute(`
            SELECT id, product_name, barcode, siigo_product_id, category, internal_code
            FROM products 
            WHERE internal_code = 'LIQUIPP06'
            OR product_name LIKE '%LIQUIPP06%'
            LIMIT 1
        `);
        
        if (localProduct.length === 0) {
            console.log('❌ No se encontró producto LIQUIPP06 en base de datos local');
            return;
        }
        
        const product = localProduct[0];
        console.log('✅ Producto encontrado en BD local:');
        console.log(`   📦 ID: ${product.id}`);
        console.log(`   📝 Nombre: ${product.product_name}`);
        console.log(`   📧 Código de barras actual: ${product.barcode}`);
        console.log(`   🆔 SIIGO Product ID: ${product.siigo_product_id}`);
        console.log(`   🏷️ Código interno: ${product.internal_code || 'NO TIENE'}`);
        console.log(`   📂 Categoría: ${product.category}`);
        
        // Consultar el producto directamente en SIIGO
        console.log('\n📋 2. Consultando producto en SIIGO API:');
        
        if (!product.siigo_product_id) {
            console.log('❌ No tiene siigo_product_id para consultar en SIIGO');
            return;
        }
        
        const siigoService = new SiigoService();
        await siigoService.initialize();
        
        console.log(`🔍 Consultando producto ${product.siigo_product_id} en SIIGO...`);
        
        const siigoProduct = await siigoService.getProductById(product.siigo_product_id);
        
        if (!siigoProduct) {
            console.log('❌ No se pudo obtener el producto desde SIIGO');
            return;
        }
        
        console.log('✅ Producto obtenido desde SIIGO:');
        console.log(`   📦 ID: ${siigoProduct.id}`);
        console.log(`   📝 Nombre: ${siigoProduct.name}`);
        console.log(`   📧 Código de barras SIIGO: ${siigoProduct.barcode || 'NO TIENE'}`);
        console.log(`   📋 Código de referencia: ${siigoProduct.code}`);
        console.log(`   💰 Precio: ${siigoProduct.prices?.[0]?.price_list?.[0]?.value || 'N/A'}`);
        console.log(`   📊 Estado: ${siigoProduct.active ? 'Activo' : 'Inactivo'}`);
        
        // Comparar los códigos de barras
        console.log('\n📊 3. Comparación:');
        console.log(`   BD Local: ${product.barcode}`);
        console.log(`   SIIGO API: ${siigoProduct.barcode || 'NO TIENE'}`);
        
        if (siigoProduct.barcode && siigoProduct.barcode !== product.barcode) {
            console.log('🚨 ¡DISCREPANCIA DETECTADA!');
            console.log(`   ❌ El código en BD local (${product.barcode}) NO coincide con SIIGO (${siigoProduct.barcode})`);
            console.log(`   ✅ Código correcto según SIIGO: ${siigoProduct.barcode}`);
            
            // Actualizar el producto con el código correcto
            console.log('\n🔧 4. Actualizando con código correcto de SIIGO...');
            await connection.execute(`
                UPDATE products 
                SET barcode = ?
                WHERE id = ?
            `, [siigoProduct.barcode, product.id]);
            
            console.log(`✅ Producto ${product.id} actualizado con código correcto: ${siigoProduct.barcode}`);
        } else if (!siigoProduct.barcode) {
            console.log('ℹ️  El producto realmente NO tiene código de barras en SIIGO');
        } else {
            console.log('✅ Los códigos coinciden correctamente');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('📄 Respuesta de error:', error.response.data);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar debug
debugLIQUIPP06();
