#!/usr/bin/env node

/**
 * Script para comparar clientes en SIIGO vs Base de Datos Local
 * y encontrar clientes faltantes
 */

require('dotenv').config();
const siigoService = require('../services/siigoService');
const { query } = require('../config/database');

async function compareCustomers() {
    try {
        console.log('🔍 Comparando clientes SIIGO vs Base de Datos Local...\n');

        // 1. Obtener total de clientes locales
        const localStats = await query('SELECT COUNT(*) as total FROM customers');
        const totalLocal = localStats[0].total;
        console.log(`📊 Clientes en BD Local: ${totalLocal}`);

        // 2. Obtener clientes de SIIGO (primera página para ver el total)
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();
        const axios = require('axios');

        const response = await axios.get(
            `${siigoService.getBaseUrl()}/v1/customers`,
            {
                headers,
                params: { page: 1, page_size: 1 },
                timeout: 20000
            }
        );

        const totalSiigo = response.data.pagination?.total_results || 0;
        console.log(`📊 Clientes en SIIGO: ${totalSiigo}`);

        const difference = totalSiigo - totalLocal;
        console.log(`\n📈 Diferencia: ${difference} clientes`);

        if (difference > 0) {
            console.log(`\n⚠️  Hay ${difference} clientes en SIIGO que NO están en tu base de datos local`);
            console.log('\n💡 Recomendaciones:');
            console.log('   1. Ejecutar sincronización completa: node scripts/sync_all_customers.js');
            console.log('   2. O sincronizar clientes individuales cuando los necesites');
        } else if (difference < 0) {
            console.log(`\n⚠️  Hay ${Math.abs(difference)} clientes en tu BD local que ya no están en SIIGO (posiblemente eliminados)`);
        } else {
            console.log('\n✅ Todos los clientes están sincronizados!');
        }

        // 3. Verificar clientes creados recientemente en SIIGO
        console.log('\n🔍 Verificando clientes recientes en SIIGO (últimos 30 días)...');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

        let page = 1;
        let recentCustomers = [];
        let hasMore = true;

        while (hasMore && page <= 5) { // Limitar a 5 páginas para no tardar mucho
            const recentResponse = await axios.get(
                `${siigoService.getBaseUrl()}/v1/customers`,
                {
                    headers,
                    params: {
                        page,
                        page_size: 100,
                        created_start: dateFilter
                    },
                    timeout: 20000
                }
            );

            if (recentResponse.data.results && recentResponse.data.results.length > 0) {
                recentCustomers = recentCustomers.concat(recentResponse.data.results);
                hasMore = recentResponse.data.pagination.total_pages > page;
                page++;
            } else {
                hasMore = false;
            }
        }

        console.log(`📅 Clientes creados en SIIGO en los últimos 30 días: ${recentCustomers.length}`);

        // Verificar cuáles de estos están en la BD local
        const missingRecent = [];
        for (const customer of recentCustomers) {
            const local = await query(
                'SELECT id FROM customers WHERE siigo_id = ?',
                [customer.id]
            );

            if (local.length === 0) {
                missingRecent.push({
                    identification: customer.identification,
                    name: Array.isArray(customer.name) ? customer.name.join(' ') : customer.name,
                    created: customer.metadata?.created
                });
            }
        }

        if (missingRecent.length > 0) {
            console.log(`\n⚠️  ${missingRecent.length} clientes recientes NO están sincronizados:`);
            console.log(JSON.stringify(missingRecent.slice(0, 10), null, 2));
            if (missingRecent.length > 10) {
                console.log(`\n... y ${missingRecent.length - 10} más`);
            }
        } else {
            console.log('\n✅ Todos los clientes recientes están sincronizados');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Respuesta SIIGO:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

compareCustomers().then(() => process.exit(0));
