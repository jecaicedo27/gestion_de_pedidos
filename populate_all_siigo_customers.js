require('dotenv').config({ path: 'backend/.env' });
const mysql = require('mysql2/promise');
const siigoService = require('./backend/services/siigoService');

async function populateAllSiigoCustomers() {
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

        // Check current customers count
        const [existingCustomers] = await connection.execute('SELECT COUNT(*) as count FROM customers WHERE active = 1');
        console.log(`📊 Clientes actuales en BD: ${existingCustomers[0].count}`);

        console.log('📋 Obteniendo todos los clientes desde SIIGO...');
        
        let page = 1;
        let totalCustomers = 0;
        let insertedCount = 0;
        let skippedCount = 0;
        let hasMorePages = true;
        const pageSize = 50; // Smaller page size to avoid rate limits

        while (hasMorePages && page <= 20) { // Limit to 20 pages (1000 customers max)
            try {
                console.log(`🔍 Obteniendo página ${page}...`);
                
                // Use the same method that the system uses internally
                const customers = await siigoService.getCustomers(page, pageSize);
                
                if (!customers || customers.length === 0) {
                    console.log(`⏹️  No se encontraron más clientes en la página ${page}`);
                    hasMorePages = false;
                    break;
                }

                console.log(`📊 Encontrados ${customers.length} clientes en página ${page}`);
                totalCustomers += customers.length;

                // Process each customer
                for (const customer of customers) {
                    try {
                        // Check if customer already exists by siigo_id
                        const [existing] = await connection.execute(`
                            SELECT id FROM customers WHERE siigo_id = ?
                        `, [customer.id]);

                        if (existing.length > 0) {
                            skippedCount++;
                            continue;
                        }

                        // Map SIIGO customer data to our structure
                        const customerData = {
                            siigo_id: customer.id,
                            document_type: customer.person_type?.toString() === '1' ? 'CC' : (customer.identification?.type || 'CC'),
                            identification: customer.identification?.number || '',
                            name: customer.name || customer.commercial_name || 'Sin nombre',
                            commercial_name: customer.commercial_name || null,
                            phone: customer.phones?.[0]?.number || null,
                            address: customer.address?.address || null,
                            city: customer.address?.city?.name || null,
                            state: customer.address?.city?.state?.name || null,
                            country: customer.address?.city?.country?.name || 'Colombia',
                            email: customer.contacts?.[0]?.email || null,
                            active: 1
                        };

                        // Insert customer
                        await connection.execute(`
                            INSERT INTO customers (
                                siigo_id,
                                document_type,
                                identification,
                                name,
                                commercial_name,
                                phone,
                                address,
                                city,
                                state,
                                country,
                                email,
                                active,
                                created_at,
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                        `, [
                            customerData.siigo_id,
                            customerData.document_type,
                            customerData.identification,
                            customerData.name,
                            customerData.commercial_name,
                            customerData.phone,
                            customerData.address,
                            customerData.city,
                            customerData.state,
                            customerData.country,
                            customerData.email,
                            customerData.active
                        ]);

                        insertedCount++;
                        console.log(`✅ Cliente insertado: ${customerData.name} (${customerData.siigo_id})`);

                    } catch (error) {
                        console.error(`❌ Error insertando cliente ${customer.name}:`, error.message);
                        skippedCount++;
                    }
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
                page++;
                
                // Check if there might be more pages
                if (customers.length < pageSize) {
                    hasMorePages = false;
                }

            } catch (error) {
                console.error(`❌ Error obteniendo página ${page}:`, error.message);
                if (error.message.includes('429') || error.message.includes('rate')) {
                    console.log('⏳ Rate limit alcanzado, esperando 5 segundos...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    hasMorePages = false;
                }
            }
        }

        // Final count verification
        const [finalCount] = await connection.execute('SELECT COUNT(*) as count FROM customers WHERE active = 1');
        
        console.log('\n📊 RESUMEN DE IMPORTACIÓN SIIGO:');
        console.log(`📊 Total clientes procesados de SIIGO: ${totalCustomers}`);
        console.log(`✅ Clientes nuevos insertados: ${insertedCount}`);
        console.log(`⏩ Clientes omitidos (ya existían): ${skippedCount}`);
        console.log(`📊 Total clientes en BD después de importación: ${finalCount[0].count}`);

        if (finalCount[0].count > 0) {
            // Show sample of all customers
            console.log('\n📋 Muestra de todos los clientes (incluyendo locales y SIIGO):');
            const [allCustomers] = await connection.execute(`
                SELECT name, identification, phone, city, siigo_id, created_at
                FROM customers 
                WHERE active = 1
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            allCustomers.forEach((customer, index) => {
                const source = customer.siigo_id && customer.siigo_id.includes('temp_') ? 'Local' : 'SIIGO';
                console.log(`   ${index + 1}. ${customer.name} - ${customer.phone || 'Sin teléfono'} - ${customer.city || 'Sin ciudad'} (${source})`);
            });
        }

    } catch (error) {
        console.error('❌ Error en la importación:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión cerrada');
        }
    }
}

// Execute the import
populateAllSiigoCustomers()
    .then(() => {
        console.log('🎉 Importación de clientes SIIGO completada exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error fatal en la importación:', error);
        process.exit(1);
    });
