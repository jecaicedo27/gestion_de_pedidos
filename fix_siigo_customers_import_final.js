require('dotenv').config({ path: 'backend/.env' });
const mysql = require('mysql2/promise');
const siigoService = require('./backend/services/siigoService');

async function fixSiigoCustomersImportFinal() {
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

        console.log('\n📋 Obteniendo todos los clientes desde SIIGO...');
        
        let page = 1;
        let totalCustomers = 0;
        let insertedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let hasMorePages = true;
        const pageSize = 25; // Smaller page size to avoid rate limits

        while (hasMorePages && page <= 20) { // Limit to 20 pages (500 customers max per run)
            try {
                console.log(`🔍 Obteniendo página ${page}...`);
                
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
                            console.log(`⏩ Cliente ya existe: ${Array.isArray(customer.name) ? customer.name.join(' ') : customer.name} (${customer.id})`);
                            skippedCount++;
                            continue;
                        }

                        // Extract check digit if available
                        let checkDigit = null;
                        if (customer.identification && customer.identification.check_digit !== undefined) {
                            checkDigit = customer.identification.check_digit?.toString() || null;
                        }

                        // Helper function to safely convert values to strings
                        const safeString = (value, maxLength = 255) => {
                            if (value === null || value === undefined) return null;
                            if (Array.isArray(value)) {
                                return value.join(' ').substring(0, maxLength);
                            }
                            return value.toString().substring(0, maxLength);
                        };

                        // Map SIIGO customer data to our structure with proper type conversion
                        const customerData = {
                            siigo_id: customer.id,
                            document_type: customer.person_type?.toString() === '1' ? 'CC' : (customer.identification?.type || 'CC'),
                            identification: customer.identification?.number || '',
                            check_digit: checkDigit,
                            name: safeString(customer.name || customer.commercial_name || 'Sin nombre', 255),
                            commercial_name: safeString(customer.commercial_name, 255),
                            phone: safeString(customer.phones?.[0]?.number, 50),
                            address: safeString(customer.address?.address, 500),
                            city: safeString(customer.address?.city?.name, 100),
                            state: safeString(customer.address?.city?.state?.name, 100),
                            country: safeString(customer.address?.city?.country?.name || 'Colombia', 100),
                            email: safeString(customer.contacts?.[0]?.email, 255),
                            active: 1
                        };

                        // Validate essential fields
                        if (!customerData.name || customerData.name.trim() === '') {
                            console.log(`⚠️  Cliente sin nombre válido, omitido: ${customer.id}`);
                            skippedCount++;
                            continue;
                        }

                        // Insert customer with ALL required columns
                        await connection.execute(`
                            INSERT INTO customers (
                                siigo_id,
                                document_type,
                                identification,
                                check_digit,
                                name,
                                commercial_name,
                                phone,
                                address,
                                city,
                                state,
                                country,
                                email,
                                active
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            customerData.siigo_id,
                            customerData.document_type,
                            customerData.identification,
                            customerData.check_digit,
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
                        console.error(`❌ Error insertando cliente ${Array.isArray(customer.name) ? customer.name.join(' ') : customer.name}:`, error.message);
                        errorCount++;
                        
                        // Log more details for debugging
                        if (error.message.includes('mysqld_stmt_execute')) {
                            console.error('🔍 Detalles del cliente que falló:', {
                                siigo_id: customer.id,
                                name: customer.name,
                                name_type: Array.isArray(customer.name) ? 'array' : typeof customer.name,
                                identification: customer.identification
                            });
                        }
                    }
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                page++;
                
                // Check if there might be more pages
                if (customers.length < pageSize) {
                    hasMorePages = false;
                }

            } catch (error) {
                console.error(`❌ Error obteniendo página ${page}:`, error.message);
                if (error.message.includes('429') || error.message.includes('rate')) {
                    console.log('⏳ Rate limit alcanzado, esperando 10 segundos...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    hasMorePages = false;
                }
            }
        }

        // Final count verification
        const [finalCount] = await connection.execute('SELECT COUNT(*) as count FROM customers WHERE active = 1');
        
        console.log('\n📊 RESUMEN DE IMPORTACIÓN SIIGO FINAL:');
        console.log(`📊 Total clientes procesados de SIIGO: ${totalCustomers}`);
        console.log(`✅ Clientes nuevos insertados: ${insertedCount}`);
        console.log(`⏩ Clientes omitidos (ya existían): ${skippedCount}`);
        console.log(`❌ Clientes con errores: ${errorCount}`);
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

            // Show SIIGO-only customers count
            const [siigoCount] = await connection.execute(`
                SELECT COUNT(*) as count FROM customers 
                WHERE active = 1 AND siigo_id NOT LIKE 'temp_%'
            `);
            console.log(`\n📊 Total clientes importados desde SIIGO: ${siigoCount[0].count}`);
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
fixSiigoCustomersImportFinal()
    .then(() => {
        console.log('🎉 Importación FINAL corregida de clientes SIIGO completada exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Error fatal en la importación:', error);
        process.exit(1);
    });
