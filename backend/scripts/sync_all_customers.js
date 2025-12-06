#!/usr/bin/env node

/**
 * Script para sincronizar TODOS los clientes desde SIIGO
 * Sincroniza página por página para evitar timeouts
 */

require('dotenv').config();
const customerService = require('../services/customerService');

async function syncAllCustomers() {
    try {
        console.log('🔄 Iniciando sincronización completa de clientes desde SIIGO...\n');

        const result = await customerService.syncCustomersFromSiigo();

        if (result.success) {
            console.log(`\n✅ Sincronización completada exitosamente!`);
            console.log(`📊 Total de clientes sincronizados: ${result.totalSynced}`);
        } else {
            console.error(`\n❌ Error en la sincronización: ${result.error}`);
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Error fatal:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

syncAllCustomers().then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
});
