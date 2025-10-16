const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function populateCustomersFromExistingData() {
    let connection;
    
    try {
        console.log('🔧 Conectando a la base de datos...');
        
        // Crear conexión a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });

        console.log('✅ Conexión establecida');

        // Verificar cuántos clientes ya existen en la base de datos
        const [existingCustomers] = await connection.execute(
            'SELECT COUNT(*) as count FROM customers'
        );

        console.log(`📊 Clientes existentes en BD: ${existingCustomers[0].count}`);

        // Obtener datos únicos de clientes desde las órdenes existentes
        console.log('📋 Extrayendo datos de clientes desde órdenes existentes...');
        
        const [orders] = await connection.execute(`
            SELECT DISTINCT
                siigo_customer_id,
                customer_name,
                customer_phone,
                customer_document,
                customer_email,
                customer_address,
                customer_city,
                customer_state,
                notes
            FROM orders 
            WHERE siigo_customer_id IS NOT NULL 
            AND siigo_customer_id != ''
            AND customer_name IS NOT NULL 
            AND customer_name != ''
            ORDER BY customer_name
        `);

        console.log(`✅ Encontrados ${orders.length} clientes únicos en órdenes`);

        if (orders.length === 0) {
            console.log('⚠️  No se encontraron datos de clientes en las órdenes');
            return;
        }

        // Preparar query de inserción
        const insertQuery = `
            INSERT INTO customers (
                siigo_id, document_type, identification, 
                name, commercial_name, phone, address, city, state, 
                country, email, active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                identification = VALUES(identification),
                name = VALUES(name),
                commercial_name = VALUES(commercial_name),
                phone = VALUES(phone),
                address = VALUES(address),
                city = VALUES(city),
                state = VALUES(state),
                country = VALUES(country),
                email = VALUES(email),
                active = VALUES(active),
                updated_at = NOW()
        `;

        let imported = 0;
        let errors = 0;

        console.log('💾 Importando clientes a la base de datos...');

        for (const order of orders) {
            try {
                const siigoId = order.siigo_customer_id;
                const name = order.customer_name || '';
                const phone = order.customer_phone || '';
                const email = order.customer_email || '';
                const address = order.customer_address || '';
                const city = order.customer_city || '';
                const state = order.customer_state || '';
                const identification = order.customer_document || '';
                
                // Intentar determinar el tipo de documento basado en el número
                let documentType = 'CC'; // Por defecto Cédula de Ciudadanía
                if (identification) {
                    if (identification.includes('-')) {
                        documentType = 'NIT'; // Si tiene guión, probablemente es NIT
                    } else if (identification.length >= 9) {
                        documentType = 'CC'; // Si es largo, probablemente cédula
                    }
                }

                await connection.execute(insertQuery, [
                    siigoId, 
                    documentType, 
                    identification,
                    name, 
                    name, // usar el mismo nombre como nombre comercial
                    phone, 
                    address, 
                    city, 
                    state,
                    'Colombia', 
                    email, 
                    true // activo
                ]);

                imported++;
                
                if (imported % 50 === 0) {
                    console.log(`📥 Procesados: ${imported}/${orders.length} clientes`);
                }

            } catch (error) {
                errors++;
                if (errors <= 5) { // Solo mostrar los primeros 5 errores
                    console.error(`❌ Error importando cliente ${order.customer_name}:`, error.message);
                }
            }
        }

        console.log('📊 Resumen de importación:');
        console.log(`✅ Clientes procesados: ${imported}`);
        console.log(`❌ Errores: ${errors}`);

        // Verificar el total final
        const [finalCustomers] = await connection.execute(
            'SELECT COUNT(*) as count FROM customers'
        );

        console.log(`📊 Total clientes en BD después de importar: ${finalCustomers[0].count}`);
        
        if (finalCustomers[0].count > 0) {
            console.log('✅ Sistema de cotizaciones ahora tiene acceso a datos de clientes');
            
            // Mostrar algunos ejemplos de clientes importados
            const [sampleCustomers] = await connection.execute(`
                SELECT name, identification, city, phone 
                FROM customers 
                WHERE name IS NOT NULL AND name != ''
                ORDER BY created_at DESC 
                LIMIT 5
            `);
            
            console.log('📝 Ejemplos de clientes importados:');
            sampleCustomers.forEach(customer => {
                console.log(`   - ${customer.name} (${customer.identification}) - ${customer.city} - ${customer.phone}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) {
            console.error('🔍 Código de error:', error.code);
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

// Ejecutar la función
populateCustomersFromExistingData();
