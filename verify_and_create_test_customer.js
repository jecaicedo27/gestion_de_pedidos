const mysql = require('mysql2/promise');

async function verifyAndCreateCustomer() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        console.log('=== VERIFICANDO CLIENTES EN LA BASE DE DATOS ===\n');
        
        // Verificar si hay clientes
        const [customers] = await connection.execute('SELECT COUNT(*) as count FROM customers');
        console.log(`Clientes existentes: ${customers[0].count}`);
        
        if (customers[0].count === 0) {
            console.log('\n📝 Creando cliente de prueba...');
            
            // Crear un cliente de prueba
            await connection.execute(`
                INSERT INTO customers (
                    identification, 
                    name, 
                    commercial_name,
                    address,
                    phone,
                    email,
                    siigo_id,
                    created_by
                ) VALUES (
                    '1082746400',
                    'JOHN EDISSON CAICEDO BENAVIDES',
                    'JOHN CAICEDO',
                    'CLL 44 B SUR #26 C 16',
                    '3005074950',
                    'jecaicedo27@gmail.com',
                    '749d2c4a-f4dc-4d71-8fea-37c96e969e26',
                    1
                )
            `);
            
            console.log('✅ Cliente de prueba creado exitosamente');
        }
        
        // Mostrar clientes disponibles
        const [allCustomers] = await connection.execute(`
            SELECT id, identification, name, commercial_name, email 
            FROM customers 
            LIMIT 5
        `);
        
        console.log('\n=== CLIENTES DISPONIBLES ===');
        allCustomers.forEach(customer => {
            console.log(`
ID: ${customer.id}
Identificación: ${customer.identification}
Nombre: ${customer.name}
Nombre comercial: ${customer.commercial_name || 'N/A'}
Email: ${customer.email || 'N/A'}
---`);
        });
        
        console.log('\n✅ Base de datos lista para pruebas');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

verifyAndCreateCustomer();
