const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

async function checkProducts() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'gestion_pedidos'
    });
    
    const [rows] = await connection.execute('SELECT COUNT(*) as total FROM products');
    console.log('=== VERIFICACIÓN DE PRODUCTOS ===');
    console.log('Total productos en base de datos:', rows[0].total);
    
    // Ver productos por páginas
    const [pages] = await connection.execute('SELECT COUNT(*) as total FROM products');
    const totalProducts = pages[0].total;
    const pageSize = 20;
    const totalPages = Math.ceil(totalProducts / pageSize);
    
    console.log(`Productos por página: ${pageSize}`);
    console.log(`Total de páginas: ${totalPages}`);
    
    // Muestra de productos
    const [sample] = await connection.execute('SELECT product_name, barcode, siigo_product_id FROM products LIMIT 5');
    console.log('\nMuestra de productos:');
    sample.forEach((p, i) => {
      console.log(`${i+1}. ${p.product_name} - ${p.barcode} ${p.siigo_product_id ? '(SIIGO)' : '(Manual)'}`);
    });
    
    await connection.end();
  } catch (error) {
    console.error('Error verificando productos:', error.message);
  }
}

checkProducts();
