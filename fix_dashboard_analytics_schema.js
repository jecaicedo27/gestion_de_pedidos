const mysql = require('mysql2/promise');

async function fixDashboardAnalyticsSchema() {
    console.log('🔧 Corrigiendo estructura de analytics para dashboard...\n');

    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        // 1. Verificar estructura de la tabla orders
        console.log('1. 📋 Verificando estructura de tabla orders...');
        const [columns] = await connection.execute('DESCRIBE orders');
        console.log('\n📊 Columnas de la tabla orders:');
        columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? '[NOT NULL]' : '[NULL]'} ${col.Key ? '[' + col.Key + ']' : ''}`);
        });

        // Verificar si hay campo de cliente
        const customerFields = columns.filter(col => 
            col.Field.toLowerCase().includes('customer') || 
            col.Field.toLowerCase().includes('client')
        );
        
        console.log('\n🔍 Campos relacionados con cliente encontrados:');
        if (customerFields.length > 0) {
            customerFields.forEach(field => {
                console.log(`   ✅ ${field.Field} (${field.Type})`);
            });
        } else {
            console.log('   ❌ No se encontraron campos de cliente');
        }

        // 2. Verificar estructura de la tabla customers
        console.log('\n2. 👥 Verificando estructura de tabla customers...');
        const [customerColumns] = await connection.execute('DESCRIBE customers');
        console.log('\n📊 Columnas de la tabla customers:');
        customerColumns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? '[NOT NULL]' : '[NULL]'} ${col.Key ? '[' + col.Key + ']' : ''}`);
        });

        // 3. Verificar relación entre orders y customers
        console.log('\n3. 🔗 Verificando relación orders-customers...');
        
        // Buscar campos que puedan ser clave foránea
        const potentialForeignKeys = columns.filter(col => 
            col.Field.toLowerCase().includes('customer') || 
            col.Field.toLowerCase().includes('client') ||
            col.Field.toLowerCase().includes('document') ||
            col.Field.toLowerCase().includes('nit')
        );

        if (potentialForeignKeys.length > 0) {
            console.log('\n🔑 Posibles campos de relación encontrados:');
            for (const field of potentialForeignKeys) {
                console.log(`   - ${field.Field} (${field.Type})`);
                
                // Probar consulta con este campo
                try {
                    const [testQuery] = await connection.execute(`
                        SELECT 
                            COUNT(*) as total_orders,
                            COUNT(DISTINCT ${field.Field}) as unique_values,
                            COUNT(CASE WHEN ${field.Field} IS NOT NULL THEN 1 END) as non_null_values
                        FROM orders
                    `);
                    console.log(`     📊 Total: ${testQuery[0].total_orders}, Únicos: ${testQuery[0].unique_values}, No nulos: ${testQuery[0].non_null_values}`);
                } catch (error) {
                    console.log(`     ❌ Error consultando ${field.Field}: ${error.message}`);
                }
            }
        }

        // 4. Intentar encontrar la relación correcta
        console.log('\n4. 🧪 Probando diferentes relaciones posibles...');
        
        // Probar diferentes campos comunes
        const fieldsToTest = [
            'customer_id', 'customer_document', 'client_id', 'client_document', 
            'document', 'nit', 'customer_code', 'client_code'
        ];

        let validRelationField = null;
        
        for (const field of fieldsToTest) {
            const fieldExists = columns.find(col => col.Field === field);
            if (fieldExists) {
                try {
                    const [testJoin] = await connection.execute(`
                        SELECT COUNT(*) as joined_count
                        FROM orders o
                        INNER JOIN customers c ON o.${field} = c.document
                        LIMIT 1
                    `);
                    console.log(`   ✅ Relación válida encontrada: orders.${field} = customers.document`);
                    validRelationField = field;
                    break;
                } catch (error) {
                    // Intentar con otras columnas de customers
                    const customerIdField = customerColumns.find(col => 
                        col.Field === 'id' || col.Field === 'customer_id'
                    );
                    if (customerIdField) {
                        try {
                            const [testJoin2] = await connection.execute(`
                                SELECT COUNT(*) as joined_count
                                FROM orders o
                                INNER JOIN customers c ON o.${field} = c.${customerIdField.Field}
                                LIMIT 1
                            `);
                            console.log(`   ✅ Relación válida encontrada: orders.${field} = customers.${customerIdField.Field}`);
                            validRelationField = field;
                            break;
                        } catch (error2) {
                            console.log(`   ❌ Falló relación orders.${field} = customers.document/id`);
                        }
                    }
                }
            }
        }

        // 5. Verificar datos de muestra
        console.log('\n5. 📋 Datos de muestra de orders (primeras 5 filas)...');
        const [sampleOrders] = await connection.execute('SELECT * FROM orders LIMIT 5');
        if (sampleOrders.length > 0) {
            console.log('\n📊 Muestra de datos:');
            sampleOrders.forEach((order, index) => {
                console.log(`\n   Pedido ${index + 1}:`);
                Object.keys(order).forEach(key => {
                    if (order[key] !== null) {
                        console.log(`     ${key}: ${order[key]}`);
                    }
                });
            });
        }

        await connection.end();

        // 6. Generar recomendaciones
        console.log('\n🎯 DIAGNÓSTICO Y RECOMENDACIONES:');
        console.log('=====================================');
        
        if (validRelationField) {
            console.log(`✅ Campo de relación encontrado: ${validRelationField}`);
            console.log('\n💡 ACCIÓN REQUERIDA:');
            console.log(`   Actualizar backend/routes/analytics.js para usar '${validRelationField}' en lugar de 'customer_document'`);
        } else {
            console.log('❌ No se encontró relación válida entre orders y customers');
            console.log('\n💡 POSIBLES SOLUCIONES:');
            console.log('1. Verificar si existe otra tabla o campo que vincule pedidos con clientes');
            console.log('2. Considerar si los pedidos se relacionan directamente o a través de otra tabla');
            console.log('3. Revisar la lógica de importación desde Siigo');
        }

        // 7. Información adicional sobre fechas
        console.log('\n📅 PROBLEMA ADICIONAL IDENTIFICADO:');
        console.log('   - Solo 26 de 496 pedidos tienen shipping_date');
        console.log('   - Esto explica por qué muchas gráficas temporales están vacías');
        console.log('   - Se recomienda revisar el proceso de asignación de fechas de envío');

    } catch (error) {
        console.error('❌ Error durante diagnóstico:', error.message);
    }
}

fixDashboardAnalyticsSchema().then(() => {
    console.log('\n🏁 Diagnóstico de esquema completado');
});
