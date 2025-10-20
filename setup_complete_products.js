const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

async function setupProducts() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'gestion_pedidos'
    });

    console.log('=== CONFIGURANDO TABLA DE PRODUCTOS ===');

    // Crear tabla products si no existe
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_name VARCHAR(255) NOT NULL,
        description TEXT,
        barcode VARCHAR(100) UNIQUE NOT NULL,
        internal_code VARCHAR(50),
        category VARCHAR(100),
        standard_price DECIMAL(10,2),
        siigo_product_id VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_barcode (barcode),
        INDEX idx_category (category),
        INDEX idx_siigo_product_id (siigo_product_id)
      )
    `;

    await connection.execute(createTableQuery);
    console.log('✅ Tabla products creada/verificada');

    // Verificar si ya hay productos
    const [existing] = await connection.execute('SELECT COUNT(*) as count FROM products');
    if (existing[0].count > 0) {
      console.log(`ℹ️  Ya existen ${existing[0].count} productos en la base de datos`);
      await connection.end();
      return;
    }

    // Poblar con productos de ejemplo (más de 100 para probar paginación)
    console.log('📦 Poblando con productos de ejemplo...');

    const categories = ['Bebidas', 'Alimentos', 'Snacks', 'Lácteos', 'Panadería', 'Carnes', 'Frutas', 'Verduras'];
    const productTypes = [
      'COCA COLA', 'PEPSI', 'SPRITE', 'FANTA', 'AGUA CRISTAL', 'JUGO DEL VALLE',
      'LECHE COLANTA', 'YOGURT ALPINA', 'QUESO COLANTA', 'MANTEQUILLA COLANTA',
      'PAN BIMBO', 'GALLETAS NOEL', 'CHOCOLATINA JET', 'PAPAS MARGARITA',
      'AREPA BLANCA', 'AREPA AMARILLA', 'POLLO PIKO RIKO', 'CARNE ZENÚ',
      'MANZANA ROJA', 'BANANO', 'NARANJA VALENCIA', 'LIMÓN TAHITÍ',
      'TOMATE CHONTO', 'CEBOLLA CABEZONA', 'ZANAHORIA', 'LECHUGA CRESPA'
    ];

    const sizes = ['250ML', '500ML', '1L', '1.5L', '350G', '500G', '1KG', '250G', '100G', 'UNIDAD'];
    
    let products = [];
    let productId = 1;

    // Generar 150 productos variados
    for (let i = 0; i < 150; i++) {
      const productType = productTypes[i % productTypes.length];
      const size = sizes[i % sizes.length];
      const category = categories[i % categories.length];
      const variant = Math.floor(i / productTypes.length) + 1;
      
      const productName = variant > 1 ? `${productType} ${size} V${variant}` : `${productType} ${size}`;
      const barcode = `SIIGO_${String(productId).padStart(6, '0')}`;
      const internalCode = `INT_${String(productId).padStart(4, '0')}`;
      const price = (Math.random() * 50000 + 1000).toFixed(2); // Entre $1,000 y $51,000
      const siigoId = i < 120 ? `SIIGO_PROD_${productId}` : null; // 120 sincronizados, 30 manuales
      
      products.push([
        productName,
        `Descripción del producto ${productName}`,
        barcode,
        internalCode,
        category,
        price,
        siigoId,
        1 // is_active
      ]);
      
      productId++;
    }

    // Insertar productos en lotes
    const insertQuery = `
      INSERT INTO products (
        product_name, description, barcode, internal_code, 
        category, standard_price, siigo_product_id, is_active
      ) VALUES ?
    `;

    await connection.execute(insertQuery, [products]);
    console.log(`✅ Insertados ${products.length} productos exitosamente`);

    // Crear tabla product_variants para el conteo
    const createVariantsTable = `
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT,
        variant_name VARCHAR(100),
        variant_barcode VARCHAR(100) UNIQUE,
        variant_price DECIMAL(10,2),
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `;

    await connection.execute(createVariantsTable);
    console.log('✅ Tabla product_variants creada');

    // Agregar algunas variantes de ejemplo
    const variants = [
      [1, 'Sabor Limón', 'SIIGO_VAR_001', '2500.00'],
      [1, 'Sabor Naranja', 'SIIGO_VAR_002', '2500.00'],
      [2, 'Sin Azúcar', 'SIIGO_VAR_003', '3000.00'],
      [3, 'Extra Burbujas', 'SIIGO_VAR_004', '2800.00'],
      [10, 'Descremada', 'SIIGO_VAR_005', '3200.00']
    ];

    const insertVariantsQuery = `
      INSERT INTO product_variants (product_id, variant_name, variant_barcode, variant_price)
      VALUES ?
    `;

    await connection.execute(insertVariantsQuery, [variants]);
    console.log(`✅ Insertadas ${variants.length} variantes de productos`);

    // Mostrar estadísticas finales
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_products,
        COUNT(CASE WHEN siigo_product_id IS NOT NULL THEN 1 END) as siigo_synced,
        COUNT(DISTINCT category) as categories
      FROM products
    `);

    console.log('\n=== ESTADÍSTICAS FINALES ===');
    console.log(`Total productos: ${stats[0].total_products}`);
    console.log(`Productos activos: ${stats[0].active_products}`);
    console.log(`Sincronizados con SIIGO: ${stats[0].siigo_synced}`);
    console.log(`Categorías: ${stats[0].categories}`);
    
    const totalPages = Math.ceil(stats[0].total_products / 20);
    console.log(`Páginas de paginación (20 por página): ${totalPages}`);

    await connection.end();
    console.log('\n🎉 ¡Sistema de productos configurado exitosamente!');

  } catch (error) {
    console.error('Error configurando productos:', error.message);
  }
}

setupProducts();
