const mysql = require('mysql2/promise');

async function checkTableStructure() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        console.log('=== ESTRUCTURA DE LA TABLA ORDERS ===\n');
        
        // Obtener la estructura de la tabla orders
        const [columns] = await connection.execute('DESCRIBE orders');
        
        console.log('Columnas disponibles en la tabla orders:');
        columns.forEach((column, index) => {
            console.log(`${index + 1}. ${column.Field} (${column.Type}) - ${column.Null === 'YES' ? 'NULL' : 'NOT NULL'} - Default: ${column.Default}`);
        });

        console.log('\n=== BUSCANDO PEDIDOS DE XIMENA (con nombres de columna correctos) ===\n');
        
        // Intentar identificar la columna correcta para el nombre del cliente
        const clientColumns = columns.filter(col => 
            col.Field.toLowerCase().includes('client') || 
            col.Field.toLowerCase().includes('customer') ||
            col.Field.toLowerCase().includes('nombre')
        );
        
        if (clientColumns.length > 0) {
            console.log('Posibles columnas para nombre del cliente:');
            clientColumns.forEach(col => {
                console.log(`- ${col.Field}`);
            });
            
            // Usar la primera columna que parezca ser de cliente
            const clientColumnName = clientColumns[0].Field;
            
            console.log(`\nUsando columna: ${clientColumnName} para buscar pedidos de Ximena\n`);
            
            // Buscar pedidos con el nombre correcto de columna
            const [ximenadOrders] = await connection.execute(
                `SELECT id, ${clientColumnName}, status, messenger_status, assigned_messenger_id FROM orders WHERE ${clientColumnName} LIKE ?`,
                ['%XIMENA%']
            );
            
            console.log('Pedidos de Ximena encontrados:', ximenadOrders.length);
            ximenadOrders.forEach(order => {
                console.log(`- ID: ${order.id}, Cliente: ${order[clientColumnName]}, Status: ${order.status}, Messenger Status: ${order.messenger_status}, Assigned Messenger: ${order.assigned_messenger_id}`);
            });
        } else {
            console.log('No se encontraron columnas obvias para nombre del cliente.');
            console.log('Mostrando las primeras 3 filas para análisis:');
            
            const [sampleRows] = await connection.execute('SELECT * FROM orders LIMIT 3');
            sampleRows.forEach((row, index) => {
                console.log(`\nFila ${index + 1}:`);
                Object.keys(row).forEach(key => {
                    console.log(`  ${key}: ${row[key]}`);
                });
            });
        }

        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkTableStructure();
