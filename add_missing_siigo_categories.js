const mysql = require('mysql2/promise');

async function addMissingSiigoCategories() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        // Categories that are visible in the SIIGO screenshot but missing from our database
        const missingSiigoCategories = [
            { name: 'productos Fabricados shotboom NO USAR', siigo_id: null },
            { name: 'productos en proceso', siigo_id: null },
            { name: 'Materia prima gravadas 5%', siigo_id: null },
            { name: 'licores materia prima', siigo_id: null },
            { name: 'SKARCHA FABRICADOS NO USAR', siigo_id: null },
            { name: 'SKARCHA NO FABRICADOS 19%', siigo_id: null },
            { name: 'SHOT NO FABRICADOS', siigo_id: null },
            { name: 'YEXIS', siigo_id: null }
        ];

        console.log('Adding missing SIIGO categories to database...\n');

        for (const category of missingSiigoCategories) {
            // Check if category already exists
            const [existing] = await connection.execute(
                'SELECT id FROM categories WHERE name = ?',
                [category.name]
            );

            if (existing.length === 0) {
                // Insert new category
                const [result] = await connection.execute(`
                    INSERT INTO categories (name, description, is_active, siigo_id, created_at, updated_at)
                    VALUES (?, ?, TRUE, ?, NOW(), NOW())
                `, [
                    category.name,
                    `Categoria sincronizada desde SIIGO: ${category.name}`,
                    category.siigo_id
                ]);

                console.log(`✅ Added category: ${category.name} (ID: ${result.insertId})`);
            } else {
                console.log(`⚠️  Category already exists: ${category.name} (ID: ${existing[0].id})`);
            }
        }

        // Verify final count
        const [allCategories] = await connection.execute(`
            SELECT name, id, siigo_id 
            FROM categories 
            WHERE is_active = TRUE 
            ORDER BY name ASC
        `);

        console.log(`\n=== ALL ACTIVE CATEGORIES (${allCategories.length}) ===`);
        allCategories.forEach(cat => {
            const siigoInfo = cat.siigo_id ? ` (SIIGO ID: ${cat.siigo_id})` : ' (Local only)';
            console.log(`${cat.name}${siigoInfo}`);
        });

        console.log(`\n✅ Total categories now available: ${allCategories.length}`);

    } catch (error) {
        console.error('Error adding missing categories:', error);
    } finally {
        await connection.end();
    }
}

addMissingSiigoCategories();
