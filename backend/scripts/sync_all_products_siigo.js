require('dotenv').config({ path: '../.env' });
const siigoService = require('../services/siigoService');
const { query } = require('../config/database');

async function syncAllInventory() {
    try {
        console.log('🔄 Iniciando Sincronización TOTAL de Inventario desde Siigo...');

        // 1. Authenticate
        console.log('Keys configured:', process.env.SIIGO_USERNAME ? 'Yes' : 'No'); // Debug log
        await siigoService.authenticate();
        console.log('✅ Autenticado en Siigo.');

        const axios = require('axios');
        // 2. Fetch ALL products with explicit pagination
        console.log('📦 Descargando catálogo completo de Siigo (paginado)...');
        let allProducts = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            console.log(`   > Obteniendo página ${page}...`);
            // Use axios directly to avoid undefined methods in service
            const headers = await siigoService.getHeaders();
            const response = await axios.get(`${siigoService.baseURL}/v1/products`, {
                headers: headers,
                params: { page, page_size: 100 }
            });

            const results = response.data.results || [];

            if (results.length > 0) {
                allProducts = allProducts.concat(results);
                page++;
                // If we got less than requested, we are done
                if (results.length < 100) hasMore = false;
            } else {
                hasMore = false;
            }

            // Safety break
            if (page > 30) hasMore = false;
        }

        console.log(`📋 Descargados ${allProducts.length} productos TOTALES de Siigo.`);

        if (allProducts.length === 0) {
            console.warn('⚠️  La lista devolvió 0 productos. ¿Está vacío el ambiente de Siigo?');
            process.exit(1);
        }

        let updatedCount = 0;
        let notFoundCount = 0;
        let zeroCount = 0;

        // 3. Update local DB
        for (const sp of allProducts) {
            const siigoId = sp.id;
            const code = sp.code;
            const stock = Number(sp.available_quantity || 0);
            const active = sp.active !== false;

            // Match by siigo_id OR internal_code
            // We prioritize siigo_id
            let localProduct = null;

            // Try match by ID
            let rows = await query('SELECT id, product_name FROM products WHERE siigo_id = ?', [siigoId]);
            if (rows.length === 0 && code) {
                // Try match by code
                rows = await query('SELECT id, product_name FROM products WHERE internal_code = ?', [code]);
            }

            if (rows.length > 0) {
                const lp = rows[0];
                await query(`
                    UPDATE products 
                    SET available_quantity = ?, 
                        is_active = ?,
                        siigo_id = ?,
                        stock_updated_at = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                `, [stock, active, siigoId, lp.id]);

                // console.log(`✅ Act: ${lp.product_name} -> Stock: ${stock}`);
                updatedCount++;
                if (stock === 0) zeroCount++;
            } else {
                notFoundCount++;
                // console.warn(`⚠️  Producto Siigo no encontrado localmente: ${sp.name} (${code})`);
            }
        }

        console.log('------------------------------------------------');
        console.log(`✅ Sincronización Completada.`);
        console.log(`   Productos Actualizados: ${updatedCount}`);
        console.log(`   Productos con Stock 0: ${zeroCount}`);
        console.log(`   Productos en Siigo sin match local: ${notFoundCount}`);
        console.log('------------------------------------------------');

    } catch (error) {
        console.error('❌ Error fatal en sincronización:', error);
        if (error.response) {
            console.error('Data:', JSON.stringify(error.response.data));
        }
    } finally {
        process.exit();
    }
}

syncAllInventory();
