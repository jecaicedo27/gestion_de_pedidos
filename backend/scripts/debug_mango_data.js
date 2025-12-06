
const { query } = require('../config/database');

async function debugMangoProducts() {
    try {
        console.log('Searching for LIQUIPOPS with "MANGO"...');
        const sql = `
            SELECT id, product_name, category, subcategory, is_active 
            FROM products 
            WHERE product_name LIKE '%LIQUIPOPS%MANGO%' 
            ORDER BY product_name
        `;
        const products = await query(sql);

        console.log(`Found ${products.length} products:`);
        products.forEach(p => {
            console.log(`[${p.id}] ${p.product_name}`);
            console.log(`    Category: ${p.category}`);
            console.log(`    Subcategory: ${p.subcategory}`);
            console.log(`    Active: ${p.is_active}`);
            console.log('---');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugMangoProducts();
