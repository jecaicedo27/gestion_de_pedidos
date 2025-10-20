const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function debugProductsApiEndpoint() {
    console.log('🔍 DEPURANDO EL ENDPOINT /api/products');
    console.log('======================================');
    
    try {
        const connection = await mysql.createConnection(config);
        
        // 1. Verificar qué hay en la tabla products
        console.log('1️⃣ Estado actual de la tabla products:');
        const [products] = await connection.execute('SELECT COUNT(*) as total FROM products');
        console.log(`   Total productos en BD: ${products[0].total}`);
        
        if (products[0].total > 0) {
            const [sampleProducts] = await connection.execute(`
                SELECT id, product_name, available_quantity, stock 
                FROM products 
                LIMIT 5
            `);
            console.log('\n📦 Productos de ejemplo:');
            sampleProducts.forEach(p => {
                console.log(`   - ${p.product_name}: available_quantity=${p.available_quantity}, stock=${p.stock}`);
            });
        }
        
        // 2. Hacer una llamada simulada al endpoint como lo haría el frontend
        console.log('\n2️⃣ Simulando llamada al endpoint:');
        
        // Simular la consulta que hace el backend
        const [apiProducts] = await connection.execute(`
            SELECT 
                p.id,
                p.product_name,
                p.description,
                p.barcode,
                p.internal_code,
                p.category,
                p.subcategory,
                p.standard_price,
                p.siigo_product_id,
                p.siigo_id,
                p.is_active,
                p.available_quantity,
                p.stock,
                p.created_at,
                p.updated_at,
                p.last_sync_at,
                0 as variant_count
            FROM products p
            WHERE 1=1
            ORDER BY p.product_name ASC
            LIMIT 20
        `);
        
        console.log(`   Productos devueltos por la consulta: ${apiProducts.length}`);
        
        if (apiProducts.length > 0) {
            console.log('\n📋 Primeros productos que devolvería el endpoint:');
            apiProducts.slice(0, 3).forEach((product, index) => {
                console.log(`\n   Producto ${index + 1}:`);
                console.log(`     Nombre: ${product.product_name}`);
                console.log(`     Available Quantity: ${product.available_quantity}`);
                console.log(`     Stock: ${product.stock}`);
                console.log(`     Categoría: ${product.category}`);
                console.log(`     Código de Barras: ${product.barcode}`);
            });
        }
        
        // 3. Verificar si hay otras tablas que podrían estar siendo usadas
        console.log('\n3️⃣ Verificando otras tablas relacionadas:');
        
        const [tables] = await connection.execute(`
            SHOW TABLES LIKE '%product%'
        `);
        
        console.log('   Tablas relacionadas con productos:');
        for (let table of tables) {
            const tableName = table[Object.keys(table)[0]];
            const [count] = await connection.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
            console.log(`     - ${tableName}: ${count[0].total} registros`);
        }
        
        await connection.end();
        
        console.log('\n🚨 CONCLUSIÓN:');
        if (products[0].total === 0) {
            console.log('❌ La tabla products está vacía - los datos en el frontend NO vienen de la BD');
            console.log('💡 POSIBLES FUENTES DE LOS DATOS FICTICIOS:');
            console.log('   - Cache del navegador con datos antiguos');
            console.log('   - Datos hardcodeados en el backend o frontend');
            console.log('   - El backend está conectado a una BD diferente');
            console.log('   - Datos de prueba siendo retornados por algún middleware');
        } else {
            console.log('✅ La tabla products tiene datos - verificar si coinciden con el frontend');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugProductsApiEndpoint();
