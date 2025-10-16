const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function cleanDuplicateCategories() {
    try {
        console.log('🔍 Conectando a la base de datos...');
        const connection = await mysql.createConnection(dbConfig);
        
        console.log('📋 Analizando duplicados en la tabla categories...');
        
        // 1. Verificar duplicados actuales
        const [duplicates] = await connection.execute(`
            SELECT name, COUNT(*) as count
            FROM categories 
            GROUP BY name 
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `);
        
        if (duplicates.length > 0) {
            console.log(`❌ Encontrados ${duplicates.length} nombres de categorías duplicadas:`);
            duplicates.forEach(dup => {
                console.log(`   - "${dup.name}": ${dup.count} registros`);
            });
            
            console.log('\n🧹 Limpiando duplicados...');
            
            // 2. Para cada categoría duplicada, mantener solo el primer registro
            for (const duplicate of duplicates) {
                const categoryName = duplicate.name;
                
                console.log(`\n🔧 Procesando: "${categoryName}"`);
                
                // Obtener todos los registros de esta categoría
                const [records] = await connection.execute(`
                    SELECT id, is_active, created_at 
                    FROM categories 
                    WHERE name = ?
                    ORDER BY created_at ASC
                `, [categoryName]);
                
                console.log(`   📋 Encontrados ${records.length} registros`);
                
                // Mantener el primer registro (más antiguo)
                const keepRecord = records[0];
                const deleteRecords = records.slice(1);
                
                console.log(`   ✅ Mantener ID: ${keepRecord.id} (creado: ${keepRecord.created_at})`);
                console.log(`   🗑️  Eliminar ${deleteRecords.length} registros duplicados`);
                
                // Eliminar los registros duplicados
                for (const record of deleteRecords) {
                    console.log(`      🗑️  Eliminando ID: ${record.id}`);
                    await connection.execute(`
                        DELETE FROM categories WHERE id = ?
                    `, [record.id]);
                }
            }
            
            console.log('\n✅ Limpieza completada!');
            
        } else {
            console.log('✅ No se encontraron duplicados en la tabla categories');
        }
        
        // 3. Verificar estado final
        console.log('\n📊 Estado final de la tabla:');
        const [final] = await connection.execute(`
            SELECT COUNT(*) as total_categories,
                   COUNT(DISTINCT name) as unique_names
            FROM categories
        `);
        
        console.log(`   Total categorías: ${final[0].total_categories}`);
        console.log(`   Nombres únicos: ${final[0].unique_names}`);
        
        if (final[0].total_categories === final[0].unique_names) {
            console.log('✅ Todos los nombres son únicos ahora');
        } else {
            console.log('⚠️  Aún hay duplicados');
        }
        
        await connection.end();
        console.log('\n🏁 Proceso completado');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Ejecutar limpieza
cleanDuplicateCategories();
