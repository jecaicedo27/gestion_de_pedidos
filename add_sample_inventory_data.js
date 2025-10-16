const mysql = require('mysql2/promise');

async function addSampleInventoryData() {
  console.log('📦 Agregando datos de inventario de ejemplo...\n');

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev'
    });

    // Datos de ejemplo para productos LIQUIPOPS
    const sampleInventory = [
      // LIQUIPOPS 1100 GR
      { name: 'LIQUIPOP BLUEBERRY 1100 GR', stock: 248 },
      { name: 'LIQUIPOP CAFE 1100 GR', stock: 0 },
      { name: 'LIQUIPOP CEREZA 1100 GR', stock: 64 },
      { name: 'LIQUIPOP CHAMOY 1100 GR', stock: 339 },
      { name: 'LIQUIPOP CHICLE 1100 GR', stock: 245 },
      { name: 'LIQUIPOP COCO 1100 GR', stock: 235 },
      { name: 'LIQUIPOP FRESA 1100 GR', stock: 27 },
      { name: 'LIQUIPOP ICE PINK 1100 GR', stock: 215 },
      { name: 'LIQUIPOP LYCHE 1100 GR', stock: 274 },
      { name: 'LIQUIPOP MANGO BICHE 1100 GR', stock: 21 },
      { name: 'LIQUIPOP MANGO BICHE CON SAL 1100 GR', stock: 0 },
      { name: 'LIQUIPOP MANZANA VERDE 1100 GR', stock: 251 },
      { name: 'LIQUIPOP MARACUYA 1100 GR', stock: 250 },
      { name: 'LIQUIPOP SANDIA 1100 GR', stock: 218 },

      // LIQUIPOPS 350 GR  
      { name: 'LIQUIPOP BLUEBERRY 350 GR', stock: 342 },
      { name: 'LIQUIPOP CAFE 350 GR', stock: 0 },
      { name: 'LIQUIPOP CEREZA 350 GR', stock: 146 },
      { name: 'LIQUIPOP CHAMOY 350 GR', stock: 203 },
      { name: 'LIQUIPOP CHICLE 350 GR', stock: 227 },
      { name: 'LIQUIPOP COCO 350 GR', stock: 211 },
      { name: 'LIQUIPOP FRESA 350 GR', stock: 289 },
      { name: 'LIQUIPOP ICE PINK 350 GR', stock: 212 },
      { name: 'LIQUIPOP LYCHE 350 GR', stock: 142 },
      { name: 'LIQUIPOP MANGO BICHE 350 GR', stock: 228 },
      { name: 'LIQUIPOP MANGO BICHE CON SAL 350 GR', stock: 309 },
      { name: 'LIQUIPOP MANZANA VERDE 350 GR', stock: 87 },
      { name: 'LIQUIPOP MARACUYA 350 GR', stock: 351 },
      { name: 'LIQUIPOP SANDIA 350 GR', stock: 196 },

      // LIQUIPOPS 3400 GR
      { name: 'LIQUIPOP BLUEBERRY 3400 GR', stock: 67 },
      { name: 'LIQUIPOP CAFE 3400 GR', stock: 0 },
      { name: 'LIQUIPOP CEREZA 3400 GR', stock: 39 },
      { name: 'LIQUIPOP CHAMOY 3400 GR', stock: 10 },
      { name: 'LIQUIPOP CHICLE 3400 GR', stock: 18 },
      { name: 'LIQUIPOP COCO 3400 GR', stock: 57 },
      { name: 'LIQUIPOP FRESA 3400 GR', stock: 33 },
      { name: 'LIQUIPOP ICE PINK 3400 GR', stock: 19 },
      { name: 'LIQUIPOP LYCHE 3400 GR', stock: 48 },
      { name: 'LIQUIPOP MANGO BICHE 3400 GR', stock: 45 },
      { name: 'LIQUIPOP MANGO BICHE CON SAL 3400 GR', stock: 20 },
      { name: 'LIQUIPOP MANZANA VERDE 3400 GR', stock: 70 },
      { name: 'LIQUIPOP MARACUYA 3400 GR', stock: 97 },
      { name: 'LIQUIPOP SANDIA 3400 GR', stock: 18 },

      // MEZCLAS EN POLVO
      { name: 'MEZCLA EN POLVO CAFE 500 GR', stock: 0 },
      { name: 'MEZCLA EN POLVO GR 500 GR', stock: 0 }
    ];

    console.log('1️⃣ Actualizando productos existentes con stock de ejemplo...');
    
    let updatedCount = 0;
    
    for (const item of sampleInventory) {
      // Buscar productos que coincidan parcialmente con el nombre
      const searchTerms = item.name.split(' ');
      let whereConditions = [];
      let queryParams = [];
      
      searchTerms.forEach(term => {
        if (term.length > 2) { // Solo términos significativos
          whereConditions.push('product_name LIKE ?');
          queryParams.push(`%${term}%`);
        }
      });
      
      if (whereConditions.length > 0) {
        const whereClause = whereConditions.join(' AND ');
        
        const updateResult = await connection.execute(`
          UPDATE products 
          SET available_quantity = ?, last_sync_at = NOW()
          WHERE ${whereClause}
          LIMIT 5
        `, [item.stock, ...queryParams]);
        
        if (updateResult[0].affectedRows > 0) {
          console.log(`✅ ${item.name} - Stock: ${item.stock} (${updateResult[0].affectedRows} productos actualizados)`);
          updatedCount += updateResult[0].affectedRows;
        }
      }
    }

    // 2. Asegurar que algunos productos tienen categoría LIQUIPOPS
    console.log('\n2️⃣ Asegurando categorías correctas...');
    
    await connection.execute(`
      UPDATE products 
      SET category = 'LIQUIPOPS' 
      WHERE product_name LIKE '%LIQUIPOP%' AND (category IS NULL OR category = '')
    `);
    
    await connection.execute(`
      UPDATE products 
      SET category = 'MEZCLAS EN POLVO' 
      WHERE product_name LIKE '%MEZCLA%' AND (category IS NULL OR category = '')
    `);

    // 3. Verificar resultados
    console.log('\n3️⃣ Verificando productos actualizados...');
    
    const [verifyResults] = await connection.execute(`
      SELECT 
        product_name, 
        category, 
        available_quantity,
        standard_price
      FROM products 
      WHERE available_quantity > 0 
      ORDER BY category, available_quantity DESC
      LIMIT 15
    `);

    console.log('📦 Productos con stock > 0:');
    verifyResults.forEach(product => {
      const stockStatus = product.available_quantity > 50 ? '🟢' : product.available_quantity > 0 ? '🟡' : '🔴';
      console.log(`   ${stockStatus} ${product.product_name} - Stock: ${product.available_quantity} - Precio: $${product.standard_price || 0}`);
    });

    await connection.end();

    console.log(`\n🎉 DATOS DE INVENTARIO AGREGADOS!`);
    console.log(`✅ ${updatedCount} productos actualizados con stock de ejemplo`);
    console.log(`✅ Categorías asignadas correctamente`);
    console.log(`\n🚀 Ahora puedes:`)
    console.log(`   1. Ir a la página "Inventario + Facturación"`);
    console.log(`   2. Ver productos con colores reales (verde/amarillo/rojo)`);
    console.log(`   3. Hacer click en productos para agregar al carrito`);
    console.log(`   4. Probar la facturación directa`);
    console.log(`\n📝 NOTA: Estos son datos de ejemplo hasta que se configure SIIGO correctamente`);

  } catch (error) {
    console.error('❌ Error agregando datos de inventario:', error.message);
  }
}

// Ejecutar
addSampleInventoryData();
