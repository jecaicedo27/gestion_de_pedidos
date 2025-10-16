const mysql = require('mysql2/promise');

async function verifyCustomerStructure() {
    let connection;
    
    try {
        console.log('\n=== Verificando estructura de tabla customers ===\n');
        
        // 1. Conectar a la base de datos
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        // 2. Verificar estructura de la tabla
        console.log('1. Estructura de la tabla customers:');
        const [columns] = await connection.execute('DESCRIBE customers');
        
        console.log('\nColumnas disponibles:');
        columns.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });
        
        // 3. Buscar cliente por ID que podría ser 1082746400
        console.log('\n2. Buscando cliente con ID o identificación 1082746400...');
        
        // Intentar buscar por ID
        const [byId] = await connection.execute(
            'SELECT * FROM customers WHERE id = ?',
            ['1082746400']
        );
        
        if (byId.length > 0) {
            console.log('✓ Cliente encontrado por ID:');
            console.log(`  - ID: ${byId[0].id}`);
            console.log(`  - Nombre: ${byId[0].business_name || byId[0].name || 'Sin nombre'}`);
            return;
        }
        
        // Intentar buscar por siigo_id
        const [bySiigoId] = await connection.execute(
            'SELECT * FROM customers WHERE siigo_id = ?',
            ['1082746400']
        );
        
        if (bySiigoId.length > 0) {
            console.log('✓ Cliente encontrado por siigo_id:');
            console.log(`  - ID: ${bySiigoId[0].id}`);
            console.log(`  - SIIGO ID: ${bySiigoId[0].siigo_id}`);
            console.log(`  - Nombre: ${bySiigoId[0].business_name || bySiigoId[0].name || 'Sin nombre'}`);
            return;
        }
        
        // Buscar en cualquier campo que contenga el valor
        console.log('\n3. Buscando en todos los campos relevantes...');
        const [anyField] = await connection.execute(
            `SELECT * FROM customers 
             WHERE id = ? 
             OR siigo_id = ? 
             OR (business_name IS NOT NULL AND business_name LIKE ?)
             LIMIT 5`,
            ['1082746400', '1082746400', '%1082746400%']
        );
        
        if (anyField.length > 0) {
            console.log(`✓ Se encontraron ${anyField.length} cliente(s):`);
            anyField.forEach(customer => {
                console.log(`\n  Cliente ID: ${customer.id}`);
                console.log(`  - SIIGO ID: ${customer.siigo_id || 'N/A'}`);
                console.log(`  - Nombre: ${customer.business_name || customer.name || 'Sin nombre'}`);
            });
        } else {
            console.log('✗ No se encontró ningún cliente con ese identificador');
            
            // Mostrar algunos clientes disponibles
            console.log('\n4. Clientes disponibles en la base de datos:');
            const [allCustomers] = await connection.execute(
                'SELECT id, siigo_id, business_name FROM customers LIMIT 5'
            );
            
            if (allCustomers.length > 0) {
                allCustomers.forEach(customer => {
                    console.log(`  - ID: ${customer.id}, SIIGO: ${customer.siigo_id || 'N/A'}, Nombre: ${customer.business_name || 'Sin nombre'}`);
                });
            } else {
                console.log('  No hay clientes en la base de datos');
            }
        }
        
    } catch (error) {
        console.log('\n✗ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar verificación
verifyCustomerStructure();
