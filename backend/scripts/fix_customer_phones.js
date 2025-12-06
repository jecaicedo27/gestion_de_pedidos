require('dotenv').config();
const { query } = require('../config/database');

async function fixCustomerPhones() {
    try {
        console.log('📞 Iniciando corrección de teléfonos de clientes...');

        // Obtener todos los clientes con teléfonos largos (> 10 dígitos)
        const customers = await query(`
      SELECT id, name, phone 
      FROM customers 
      WHERE LENGTH(phone) > 10
    `);

        console.log(`🔍 Encontrados ${customers.length} clientes con teléfonos largos.`);

        let updatedCount = 0;

        for (const customer of customers) {
            const originalPhone = customer.phone;

            // Regex para buscar un celular de 10 dígitos al final de la cadena
            // Busca '3' seguido de 9 dígitos al final ($)
            const match = originalPhone.match(/(3\d{9})$/);

            if (match) {
                const newPhone = match[1]; // Los últimos 10 dígitos

                console.log(`🛠️ Corrigiendo: ${customer.name} | ${originalPhone} -> ${newPhone}`);

                await query(`
          UPDATE customers 
          SET phone = ? 
          WHERE id = ?
        `, [newPhone, customer.id]);

                updatedCount++;
            } else {
                console.log(`⚠️ No se pudo corregir automáticamente: ${customer.name} | ${originalPhone}`);
            }
        }

        console.log(`\n✅ Proceso completado.`);
        console.log(`📊 Total corregidos: ${updatedCount}`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixCustomerPhones();
