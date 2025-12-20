const { pool } = require('./config/database');

async function searchProducts() {
    try {
        const [rows] = await pool.query(`
      SELECT id, product_name, siigo_id, internal_code, barcode 
      FROM products 
      WHERE product_name LIKE '%Flete%' 
         OR product_name LIKE '%Transporte%' 
         OR product_name LIKE '%Domicilio%'
    `);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

searchProducts();
