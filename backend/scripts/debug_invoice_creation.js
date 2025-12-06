#!/usr/bin/env node

/**
 * Script para debuggear la creación de facturas desde inventario
 * Simula el proceso completo y muestra los datos que se envían a SIIGO
 */

require('dotenv').config();
const siigoInvoiceService = require('../services/siigoInvoiceService');
const customerService = require('../services/customerService');
const { query } = require('../config/database');

async function debugInvoiceCreation() {
    try {
        console.log('🔍 Iniciando debug de creación de factura...\n');

        // 1. Obtener un cliente de prueba
        console.log('1️⃣ Buscando cliente de prueba...');
        const customers = await query(`
      SELECT * FROM customers 
      WHERE identification IS NOT NULL 
      AND siigo_id IS NOT NULL
      LIMIT 1
    `);

        if (customers.length === 0) {
            console.error('❌ No se encontró ningún cliente con identificación y siigo_id');
            process.exit(1);
        }

        const customer = customers[0];
        console.log('✅ Cliente encontrado:', {
            id: customer.id,
            name: customer.name,
            identification: customer.identification,
            siigo_id: customer.siigo_id
        });

        // 2. Obtener un producto de prueba del inventario con precio > 0
        console.log('\n2️⃣ Buscando producto de prueba...');
        const products = await query(`
      SELECT * FROM products 
      WHERE available_quantity > 0 
      AND standard_price > 0
      AND (internal_code IS NOT NULL OR barcode IS NOT NULL)
      LIMIT 1
    `);

        if (products.length === 0) {
            console.error('❌ No se encontró ningún producto con stock');
            process.exit(1);
        }

        const product = products[0];
        console.log('✅ Producto encontrado:', {
            id: product.id,
            name: product.product_name,
            barcode: product.barcode,
            internal_code: product.internal_code,
            siigo_id: product.siigo_id,
            price: product.standard_price,
            stock: product.available_quantity
        });

        // 3. Preparar items para la factura (simulando lo que envía el frontend)
        console.log('\n3️⃣ Preparando items para factura...');
        const items = [{
            id: product.id,
            product_id: product.id,
            code: product.internal_code || product.barcode,
            internal_code: product.internal_code,
            barcode: product.barcode,
            product_name: product.product_name,
            quantity: 1,
            price: product.standard_price || 1000,
            unit_price: product.standard_price || 1000,
            discount: 0
        }];

        console.log('📦 Items preparados:', JSON.stringify(items, null, 2));

        // 4. Preparar datos de factura
        console.log('\n4️⃣ Preparando datos de factura para SIIGO...');
        const options = {
            documentId: 15047, // FV-1
            discount: 0,
            retefuente: false
        };

        const invoiceData = await siigoInvoiceService.prepareInvoiceData(
            customer,
            items,
            'Factura de prueba desde script de debug',
            'Productos del inventario: 1x ' + product.product_name,
            options
        );

        console.log('📊 Datos preparados para SIIGO:');
        console.log(JSON.stringify(invoiceData, null, 2));

        // 5. Validar estructura
        console.log('\n5️⃣ Validando estructura de datos...');

        // Validaciones básicas
        const validations = {
            'document.id existe': !!invoiceData.document?.id,
            'customer.identification existe': !!invoiceData.customer?.identification,
            'items tiene elementos': Array.isArray(invoiceData.items) && invoiceData.items.length > 0,
            'items[0].code existe': !!invoiceData.items[0]?.code,
            'items[0] tiene price o taxed_price': !!(invoiceData.items[0]?.price || invoiceData.items[0]?.taxed_price),
            'payments existe': Array.isArray(invoiceData.payments) && invoiceData.payments.length > 0,
            'payments[0].value existe': !!invoiceData.payments[0]?.value,
            'seller existe': !!invoiceData.seller
        };

        console.log('Validaciones:');
        Object.entries(validations).forEach(([key, value]) => {
            console.log(`  ${value ? '✅' : '❌'} ${key}`);
        });

        const allValid = Object.values(validations).every(v => v);

        if (!allValid) {
            console.error('\n❌ Hay validaciones que fallaron. Revise los datos.');
            process.exit(1);
        }

        console.log('\n✅ Todas las validaciones pasaron');
        console.log('\n✅ Todas las validaciones pasaron');

        // 6. Intentar crear factura en SIIGO
        console.log('\n6️⃣ Intentando crear factura en SIIGO (REAL)...');
        try {
            const result = await siigoInvoiceService.createInvoice(invoiceData);
            console.log('\n✅ Factura creada exitosamente en SIIGO!');
            console.log('Respuesta:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('\n❌ Error creando factura en SIIGO:');
            console.error('Mensaje:', error.message);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', JSON.stringify(error.response.data, null, 2));
            }
        }

    } catch (error) {
        console.error('\n❌ Error durante el debug:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

debugInvoiceCreation();
