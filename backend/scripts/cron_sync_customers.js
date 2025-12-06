#!/usr/bin/env node

/**
 * Cron job para sincronizar clientes nuevos desde SIIGO
 * Se ejecuta diariamente para mantener la base de datos actualizada
 */

require('dotenv').config();
const siigoService = require('../services/siigoService');
const customerService = require('../services/customerService');
const { query } = require('../config/database');

async function syncNewCustomers() {
    try {
        console.log(`[${new Date().toISOString()}] 🔄 Iniciando sincronización de clientes nuevos...`);

        // Obtener la fecha de la última sincronización
        const lastSync = await query(`
      SELECT MAX(created_at) as last_sync 
      FROM customers
    `);

        const lastSyncDate = lastSync[0]?.last_sync
            ? new Date(lastSync[0].last_sync)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás por defecto

        const dateFilter = lastSyncDate.toISOString().split('T')[0];
        console.log(`📅 Buscando clientes creados desde: ${dateFilter}`);

        // Autenticar con SIIGO
        await siigoService.authenticate();
        const headers = await siigoService.getHeaders();

        let page = 1;
        let totalSynced = 0;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await fetch(
                    `https://api.siigo.com/v1/customers?page=${page}&page_size=100&created_start=${dateFilter}`,
                    { headers }
                );

                if (!response.ok) {
                    if (response.status === 429) {
                        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
                        console.log(`⏳ Rate limit. Esperando ${retryAfter}s...`);
                        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                        continue;
                    }
                    console.error(`❌ Error en página ${page}:`, response.status);
                    break;
                }

                const data = await response.json();

                if (!data.results || data.results.length === 0) {
                    hasMore = false;
                    break;
                }

                // Procesar clientes
                for (const customer of data.results) {
                    try {
                        await customerService.saveCustomer(customer);
                        totalSynced++;
                    } catch (error) {
                        console.error(`❌ Error guardando cliente ${customer.id}:`, error.message);
                    }
                }

                // Verificar si hay más páginas
                const totalPages = data.pagination?.total_results
                    ? Math.ceil(data.pagination.total_results / 100)
                    : 1;
                hasMore = page < totalPages;
                page++;

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`❌ Error en página ${page}:`, error.message);
                break;
            }
        }

        console.log(`[${new Date().toISOString()}] ✅ Sincronización completada: ${totalSynced} clientes nuevos`);

        // Log a archivo para monitoreo
        const fs = require('fs');
        const logEntry = `${new Date().toISOString()} - Sincronizados ${totalSynced} clientes nuevos\n`;
        fs.appendFileSync('/var/www/gestion_de_pedidos/backend/logs/customer_sync.log', logEntry);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error fatal:`, error.message);
        process.exit(1);
    }
}

syncNewCustomers().then(() => process.exit(0));
