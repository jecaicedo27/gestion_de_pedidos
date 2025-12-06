
const { query } = require('../config/database');
require('dotenv').config({ path: '../.env' });

async function checkDuplicates() {
    try {
        const productName = 'SIROPE SKARCHAMOY DE 500 ML';
        console.log(`Checking duplicates for: "${productName}"`);

        const products = await query(`
      SELECT id, product_name, barcode, internal_code
      FROM products 
      WHERE product_name LIKE ?
    `, [`%${productName}%`]);

        console.log('Products found:', products);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDuplicates();
