const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

async function populateCustomersFromSiigo() {
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

        // Configurar headers para SIIGO API
        const siigoHeaders = {
            'Authorization': `Bearer ${process.env.SIIGO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'gestion_pedidos'
        };

        console.log('📋 Obteniendo clientes desde SIIGO API...');
        console.log('🔍 URL Base SIIGO:', process.env.SIIGO_API_BASE_URL);
        
        // Obtener clientes desde SIIGO con paginación
        let allCustomers = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await axios.get(`${process.env.SIIGO_API_BASE_URL}/v1/customers`, {
                    headers: siigoHeaders,
                    params: {
                        page: page,
                        page_size: 100
                    }
                });

                const customers = response.data.results || response.data;
                console.log(`📄 Página ${page}: ${customers.length} clientes obtenidos`);
                
                allCustomers = allCustomers.concat(customers);
                
                // Verificar si hay más páginas
                if (customers.length < 100 || !response.data.pagination || page >= (response.data.pagination.total_pages || 1)) {
                    hasMore = false;
                } else {
                    page++;
                }

                // Agregar un pequeño delay para no sobrecargar la API
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`❌ Error obteniendo página ${page}:`, error.response?.data || error.message);
                hasMore = false;
            }
        }

        console.log(`✅ Total de clientes obtenidos desde SIIGO: ${allCustomers.length}`);

        if (allCustomers.length === 0) {
            console.log('⚠️  No se encontraron clientes en SIIGO');
            return;
        }

        // Verificar cuántos clientes ya existen en la base de datos
        const [existingCustomers] = await connection.execute(
            'SELECT COUNT(*) as count FROM customers'
        );

        console.log(`📊 Clientes existentes en BD: ${existingCustomers[0].count}`);

        // Preparar query de inserción
        const insertQuery = `
            INSERT INTO customers (
                siigo_id, document_type, identification, check_digit,
                name, commercial_name, phone, address, city, state, 
                country, email, active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                document_type = VALUES(document_type),
                identification = VALUES(identification),
                check_digit = VALUES(check_digit),
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
        let updated = 0;
        let errors = 0;

        console.log('💾 Importando clientes a la base de datos...');

        for (const customer of allCustomers) {
            try {
                // Extraer datos del cliente
                const siigoId = customer.id;
                const documentType = customer.identification?.type?.code || 'CC';
                const identification = customer.identification?.number || '';
                const checkDigit = customer.identification?.check_digit || null;
                const name = customer.name || customer.commercial_name || '';
                const commercialName = customer.commercial_name || customer.name || '';
                
                // Obtener información de contacto
                const phone = customer.phones?.[0]?.number || 
                             customer.contacts?.[0]?.phone || 
                             customer.phone || '';
                             
                const email = customer.mail?.[0]?.email || 
                             customer.contacts?.[0]?.email || 
                             customer.email || '';

                // Obtener dirección
                const address = customer.address?.address || 
                               customer.contacts?.[0]?.address || 
                               customer.address || '';
                               
                const city = customer.address?.city?.city_name || 
                            customer.city || '';
                            
                const state = customer.address?.city?.state_name || 
                             customer.state || '';

                const country = 'Colombia';
                const active = customer.active !== false;

                await connection.execute(insertQuery, [
                    siigoId, documentType, identification, checkDigit,
                    name, commercialName, phone, address, city, state,
                    country, email, active
                ]);

                imported++;
                
                if (imported % 50 === 0) {
                    console.log(`📥 Procesados: ${imported}/${allCustomers.length} clientes`);
                }

            } catch (error) {
                errors++;
                if (errors <= 5) { // Solo mostrar los primeros 5 errores
                    console.error(`❌ Error importando cliente ${customer.id}:`, error.message);
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
populateCustomersFromSiigo();
