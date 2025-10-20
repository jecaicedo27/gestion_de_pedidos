const { pool } = require('./backend/config/database');

async function checkCategories() {
    try {
        // Verificar categorías en la tabla
        const [categories] = await pool.execute('SELECT * FROM categories ORDER BY name');
        console.log('=== CATEGORÍAS EN LA BASE DE DATOS ===');
        console.log('Total categorías:', categories.length);
        categories.forEach(cat => {
            console.log(`- ${cat.name} (ID: ${cat.id}, SIIGO_ID: ${cat.siigo_id}, Activa: ${cat.is_active})`);
        });
        
        // Verificar productos y sus categorías
        const [products] = await pool.execute('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category');
        console.log('\n=== CATEGORÍAS DE PRODUCTOS ===');
        console.log('Total categorías en productos:', products.length);
        products.forEach(prod => {
            console.log(`- ${prod.category}`);
        });
        
        // Verificar la consulta actual de getActiveCategories
        const [activeCategories] = await pool.execute(`
            SELECT 
                MIN(c.id) as id,
                c.name,
                MIN(c.description) as description,
                COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.name
            HAVING COUNT(p.id) > 0 OR c.name IS NOT NULL
            ORDER BY c.name ASC
        `);
        
        console.log('\n=== CATEGORÍAS ACTIVAS (QUERY ACTUAL) ===');
        console.log('Total categorías activas:', activeCategories.length);
        activeCategories.forEach(cat => {
            console.log(`- ${cat.name} (Productos: ${cat.product_count})`);
        });
        
        // Verificar todas las categorías sin filtrar por productos
        const [allCategories] = await pool.execute(`
            SELECT id, name, description, is_active, siigo_id
            FROM categories 
            WHERE is_active = TRUE
            ORDER BY name ASC
        `);
        
        console.log('\n=== TODAS LAS CATEGORÍAS ACTIVAS (SIN FILTRO) ===');
        console.log('Total todas las categorías activas:', allCategories.length);
        allCategories.forEach(cat => {
            console.log(`- ${cat.name} (SIIGO_ID: ${cat.siigo_id})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCategories();
