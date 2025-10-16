const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function verificarProductosLiquipopsEspecificos() {
    console.log('🔍 VERIFICANDO PRODUCTOS LIQUIPOPS ESPECÍFICOS');
    console.log('===============================================');
    
    try {
        const connection = await mysql.createConnection(config);
        
        // Buscar productos LIQUIPOPS específicos que aparecen en la imagen
        const productosEnImagen = [
            'LIQUIPOPS SABOR A BLUEBERRY X 1200 GR',
            'LIQUIPOPS SABOR A BLUEBERRY X 2300 GR', 
            'LIQUIPOPS SABOR A BLUEBERRY X 3400 GR',
            'LIQUIPOPS SABOR A BLUEBERRY X 350 GR',
            'LIQUIPOPS SABOR A CAFE X 1100 GR',
            'LIQUIPOPS SABOR A CAFE X 2300 GR',
            'LIQUIPOPS SABOR A CAFE X 3400 GR',
            'LIQUIPOPS SABOR A CAFE X 350 GR',
            'LIQUIPOPS SABOR A CEREZA X 1200 GR',
            'LIQUIPOPS SABOR A CEREZA X 2300 GR'
        ];
        
        console.log('1️⃣ Buscando productos LIQUIPOPS específicos:');
        
        for (const productoNombre of productosEnImagen) {
            const [resultado] = await connection.execute(`
                SELECT 
                    product_name,
                    available_quantity,
                    stock,
                    category,
                    barcode,
                    siigo_product_id,
                    last_sync_at
                FROM products 
                WHERE product_name LIKE ?
                LIMIT 1
            `, [`%${productoNombre}%`]);
            
            if (resultado.length > 0) {
                const producto = resultado[0];
                console.log(`\n📦 ${producto.product_name}:`);
                console.log(`   🔢 Available Quantity: ${producto.available_quantity}`);
                console.log(`   📊 Stock: ${producto.stock}`);
                console.log(`   📁 Categoría: ${producto.category}`);
                console.log(`   🏷️ Código de Barras: ${producto.barcode}`);
                console.log(`   🔗 SIIGO ID: ${producto.siigo_product_id || 'No sincronizado'}`);
                console.log(`   ⏰ Última sincronización: ${producto.last_sync_at || 'Nunca'}`);
                
                // Verificar si el stock es sospechoso
                if (producto.available_quantity > 20 && producto.available_quantity < 400) {
                    console.log(`   🚨 SOSPECHOSO: Stock ${producto.available_quantity} podría ser ficticio`);
                }
            } else {
                console.log(`\n❌ ${productoNombre}: NO ENCONTRADO`);
            }
        }
        
        // Buscar todos los LIQUIPOPS con stock > 0 para ver el patrón
        console.log('\n2️⃣ Todos los LIQUIPOPS con stock > 0:');
        const [liquipopsConStock] = await connection.execute(`
            SELECT 
                product_name,
                available_quantity,
                stock,
                siigo_product_id,
                last_sync_at
            FROM products 
            WHERE product_name LIKE '%LIQUIPOP%' 
              AND (available_quantity > 0 OR stock > 0)
            ORDER BY available_quantity DESC
            LIMIT 15
        `);
        
        if (liquipopsConStock.length > 0) {
            liquipopsConStock.forEach(producto => {
                console.log(`\n📦 ${producto.product_name}:`);
                console.log(`   Stock: ${producto.available_quantity || producto.stock} unidades`);
                console.log(`   SIIGO: ${producto.siigo_product_id ? 'Sincronizado' : 'No sincronizado'}`);
                console.log(`   Última sync: ${producto.last_sync_at || 'Nunca'}`);
            });
        } else {
            console.log('   ❌ No se encontraron LIQUIPOPS con stock > 0');
        }
        
        // Verificar el patrón de stocks sospechosos
        console.log('\n3️⃣ Verificando patrones de stock sospechosos:');
        const stocksSospechosos = [22, 33, 82, 219, 370];
        
        for (const stock of stocksSospechosos) {
            const [productos] = await connection.execute(`
                SELECT product_name, available_quantity, stock, siigo_product_id
                FROM products 
                WHERE available_quantity = ? OR stock = ?
                LIMIT 3
            `, [stock, stock]);
            
            if (productos.length > 0) {
                console.log(`\n🎯 Productos con stock exacto de ${stock}:`);
                productos.forEach(p => {
                    console.log(`   - ${p.product_name}: ${p.available_quantity || p.stock} (SIIGO: ${p.siigo_product_id ? 'Sí' : 'No'})`);
                });
            }
        }
        
        await connection.end();
        
        console.log('\n📋 CONCLUSIÓN:');
        console.log('Si encuentras productos con stocks exactos como 22, 33, 82, 219, 370');
        console.log('y NO tienen siigo_product_id, entonces son datos ficticios.');
        console.log('Los datos auténticos de SIIGO deberían tener siigo_product_id.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verificarProductosLiquipopsEspecificos();
