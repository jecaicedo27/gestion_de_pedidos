const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function checkProductsTableColumns() {
    console.log('🔍 VERIFICANDO ESTRUCTURA DE LA TABLA PRODUCTS');
    console.log('==============================================');
    
    try {
        const connection = await mysql.createConnection(config);
        
        // Describir la estructura de la tabla
        console.log('1️⃣ Estructura de la tabla products:');
        const [columns] = await connection.execute('DESCRIBE products');
        
        console.log('📋 Columnas encontradas:');
        columns.forEach(column => {
            console.log(`   - ${column.Field} (${column.Type}) ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
        // Obtener algunos registros para ver los datos
        console.log('\n2️⃣ Ejemplo de datos (primeros 5 productos):');
        const [products] = await connection.execute(`
            SELECT * FROM products 
            LIMIT 5
        `);
        
        if (products.length > 0) {
            console.log('📦 Datos de ejemplo:');
            products.forEach((product, index) => {
                console.log(`\n   Producto ${index + 1}:`);
                Object.keys(product).forEach(key => {
                    console.log(`     ${key}: ${product[key]}`);
                });
            });
        } else {
            console.log('❌ No hay productos en la tabla');
        }
        
        // Verificar productos con stock
        console.log('\n3️⃣ Verificando productos con stock:');
        const [stockQuery] = await connection.execute(`
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN stock IS NOT NULL AND stock > 0 THEN 1 END) as with_stock,
                   COUNT(CASE WHEN available_quantity IS NOT NULL AND available_quantity > 0 THEN 1 END) as with_available_quantity
            FROM products
        `);
        
        console.log('📊 Resumen de stock:');
        console.log(`   Total productos: ${stockQuery[0].total}`);
        console.log(`   Con stock > 0: ${stockQuery[0].with_stock}`);
        console.log(`   Con disponible > 0: ${stockQuery[0].with_available_quantity}`);
        
        await connection.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkProductsTableColumns();
