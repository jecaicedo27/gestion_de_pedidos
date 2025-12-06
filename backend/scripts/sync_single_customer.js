#!/usr/bin/env node

/**
 * Script para sincronizar un cliente específico desde SIIGO
 * Uso: node sync_single_customer.js <customer_id_or_identification>
 */

require('dotenv').config();
const siigoService = require('../services/siigoService');
const customerService = require('../services/customerService');

async function syncSingleCustomer(searchTerm) {
    try {
        console.log(`🔍 Buscando cliente en SIIGO: ${searchTerm}\n`);

        // Autenticar con SIIGO
        await siigoService.authenticate();

        // Buscar el cliente en SIIGO
        const headers = await siigoService.getHeaders();
        const axios = require('axios');

        // Intentar buscar por ID primero
        let customerData = null;
        try {
            const response = await axios.get(
                `${siigoService.getBaseUrl()}/v1/customers/${searchTerm}`,
                { headers, timeout: 20000 }
            );
            customerData = response.data;
            console.log('✅ Cliente encontrado por ID en SIIGO');
        } catch (idError) {
            // Si falla, buscar por identificación
            console.log('⚠️  No encontrado por ID, buscando por identificación...');

            const searchResponse = await axios.get(
                `${siigoService.getBaseUrl()}/v1/customers`,
                {
                    headers,
                    params: { identification: searchTerm },
                    timeout: 20000
                }
            );

            if (searchResponse.data.results && searchResponse.data.results.length > 0) {
                customerData = searchResponse.data.results[0];
                console.log('✅ Cliente encontrado por identificación en SIIGO');
            }
        }

        if (!customerData) {
            console.error('❌ Cliente no encontrado en SIIGO');
            process.exit(1);
        }

        console.log('\n📋 Datos del cliente en SIIGO:');
        console.log(JSON.stringify(customerData, null, 2));

        // Guardar en base de datos local
        console.log('\n💾 Guardando cliente en base de datos local...');
        await customerService.saveCustomer(customerData);

        console.log('✅ Cliente sincronizado exitosamente!');

        // Verificar en BD local
        const { query } = require('../config/database');
        const saved = await query(
            'SELECT id, siigo_id, identification, name, commercial_name FROM customers WHERE siigo_id = ?',
            [customerData.id]
        );

        console.log('\n✅ Cliente en base de datos local:');
        console.log(JSON.stringify(saved[0], null, 2));

    } catch (error) {
        console.error('\n❌ Error sincronizando cliente:', error.message);
        if (error.response) {
            console.error('Respuesta SIIGO:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

const searchTerm = process.argv[2];
if (!searchTerm) {
    console.error('❌ Uso: node sync_single_customer.js <customer_id_or_identification>');
    console.error('Ejemplo: node sync_single_customer.js 1010017197');
    process.exit(1);
}

syncSingleCustomer(searchTerm).then(() => process.exit(0));
