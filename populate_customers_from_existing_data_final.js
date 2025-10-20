require('dotenv').config({ path: 'backend/.env' });
const mysql = require('mysql2/promise');

async function populateCustomersFromOrders() {
    let connection;
    
    try {
        console.log('🔧 Conectando a la base de datos...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev',
            charset: 'utf8mb4'
        });
        console.log('✅ Conexión establecida');

        // First, let's check the actual structure of customers table
        const [tableStructure] = await connection.execute(`DESCRIBE customers`);
        console.log('📊 Estructura de tabla customers:');
        tableStructure.forEach(column => {
            console.log(`   - ${column.Field}: ${column.Type} (${column.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });

        // Get unique customers from orders table
        const [uniqueCustomers] = await connection.execute(`
            SELECT 
                customer_identification,
                customer_name,
                customer_phone,
                customer_email,
                customer_address,
                customer_department,
                customer_city,
                customer_id_type,
                customer_person_type,
                customer_country,
                siigo_customer_id,
                COUNT(*) as order_count,
                MAX(created_at) as last_order_date
            FROM orders 
            WHERE customer_name IS NOT NULL 
              AND customer_name != ''
              AND customer_phone IS NOT NULL 
              AND customer_phone != ''
            GROUP BY 
                customer_identification,
                customer_name,
                customer_phone,
                customer_email
            ORDER BY order_count DESC, last_order_date DESC
        `);

        console.log(`📊 Encontrados ${uniqueCustomers.length} clientes únicos en pedidos`);

        // Check current customers table
        const [existingCustomers] = await connection.execute('SELECT COUNT(*) as count FROM customers');
        console.log(`📊 Clientes actualmente en tabla customers: ${existingCustomers[0].count}`);

        // Insert customers from orders into customers table
        let insertedCount = 0;
        let skippedCount = 0;

        for (const customer of uniqueCustomers) {
            try {
                // Check if customer already exists (by identification or phone)
                const [existing] = await connection.execute(`
                    SELECT id FROM customers 
                    WHERE (identification = ? AND identification IS NOT NULL AND identification != '') 
                       OR (phone = ? AND phone IS NOT NULL AND phone != '')
                       OR (email = ? AND email IS NOT NULL AND email != '')
                `, [
                    customer.customer_identification || null,
                    customer.customer_phone,
                    customer.customer_email || null
                ]);

                if (existing.length > 0) {
                    skippedCount++;
                    console.log(`⏩ Cliente ya existe: ${customer.customer_name} (${customer.customer_phone})`);
                    continue;
                }

                // Insert new customer - using the correct column names from the actual table structure
                await connection.execute(`
                    INSERT INTO customers (
                        name,
                        identification,
                        phone,
                        email,
                        address,
                        department,
                        city,
                        country,
                        siigo_customer_id,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                `, [
                    customer.customer_name,
                    customer.customer_identification || null,
                    customer.customer_phone,
                    customer.customer_email || null,
                    customer.customer_address || null,
                    customer.customer_department || null,
                    customer.customer_city || null,
                    customer.customer_country || 'Colombia',
                    customer.siigo_customer_id || null
                ]);

                insertedCount++;
                console.log(`✅ Cliente insertado: ${customer.customer_name} (${customer.customer_phone}) - ${customer.order_count} pedidos`);

            } catch (error) {
                console.error(`❌ Error insertando cliente ${customer.customer_name}:`, error.message);
                skippedCount++;
            }
        }

        // Final count verification
        const [finalCount] = await connection.execute('SELECT COUNT(*) as count FROM customers');
        
        console.log('\n📊 RESUMEN DE MIGRACIÓN:');
        console.log(`✅ Clientes insertados: ${insertedCount}`);
        console.log(`⏩ Clientes omitidos (ya existían): ${skippedCount}`);
        console.log(`📊 Total clientes únicos procesados: ${uniqueCustomers.length}`);
        console.log(`📊 Total clientes en tabla customers: ${finalCount[0].count}`);

        // Show some sample data
        if (finalCount[0].count > 0) {
            console.log('\n📋 Muestra de clientes insertados:');
            const [sampleCustomers] = await connection.execute(`
                SELECT name, identification, phone, email, created_at
                FROM customers 
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            sampleCustomers.forEach((customer, index) => {
                console.log(`${index + 1}. ${customer.name} - ${customer.phone} - ${customer.identification || 'Sin ID'}`);
            });
        }

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

// Execute the migration
populateCustomersFromOrders()
    .then(() => {
        console.log('🎉 Migración de clientes completada exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error fatal en la migración:', error);
        process.exit(1);
    });
