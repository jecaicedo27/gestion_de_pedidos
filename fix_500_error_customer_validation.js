const { query } = require('./backend/config/database');

async function fix500ErrorCustomerValidation() {
    console.log('🔧 FIXING 500 ERROR - CUSTOMER VALIDATION ISSUES');
    console.log('=======================================================\n');

    try {
        // 1. Analizar clientes en la base de datos que podrían causar el error
        console.log('🔍 PASO 1: Analizando clientes problemáticos...');
        
        const problematicCustomers = await query(`
            SELECT 
                id, siigo_id, identification, name, 
                document_type, active,
                CASE 
                    WHEN siigo_id IS NULL AND (identification IS NULL OR identification = '') THEN 'MISSING_BOTH'
                    WHEN siigo_id IS NULL THEN 'MISSING_SIIGO_ID'
                    WHEN identification IS NULL OR identification = '' THEN 'MISSING_IDENTIFICATION'
                    ELSE 'OK'
                END as status
            FROM customers 
            WHERE active = TRUE
            ORDER BY 
                CASE 
                    WHEN siigo_id IS NULL AND (identification IS NULL OR identification = '') THEN 1
                    WHEN siigo_id IS NULL THEN 2
                    WHEN identification IS NULL OR identification = '' THEN 3
                    ELSE 4
                END
            LIMIT 10
        `);

        console.log('📊 Clientes encontrados:');
        problematicCustomers.forEach((customer, index) => {
            console.log(`  ${index + 1}. ID: ${customer.id} | SIIGO: ${customer.siigo_id || 'NULL'} | DOC: ${customer.identification || 'NULL'} | Status: ${customer.status} | Name: ${customer.name}`);
        });

        const criticalCustomers = problematicCustomers.filter(c => c.status === 'MISSING_BOTH');
        console.log(`\n🔴 Clientes críticos (sin SIIGO_ID ni identification): ${criticalCustomers.length}`);
        
        if (criticalCustomers.length > 0) {
            console.log('⚠️ Estos clientes causarían error 500 al crear facturas\n');
        }

        // 2. Probar el método formatCustomerData con datos problemáticos
        console.log('🧪 PASO 2: Probando método formatCustomerData con datos problemáticos...');
        
        const SiigoInvoiceService = require('./backend/services/siigoInvoiceService');
        
        // Caso 1: Cliente sin siigo_id ni identification
        console.log('\n  🔸 Caso 1: Cliente sin siigo_id ni identification');
        try {
            const badCustomer = { id: 1, name: 'Cliente Sin Datos' };
            const result1 = SiigoInvoiceService.formatCustomerData(badCustomer);
            console.log('  📊 Resultado:', JSON.stringify(result1));
            console.log('  ⚠️ Este resultado causaría error en SIIGO (solo branch_office)');
        } catch (error) {
            console.log('  ❌ Error:', error.message);
        }

        // Caso 2: Cliente solo con identification
        console.log('\n  🔸 Caso 2: Cliente solo con identification');
        try {
            const okCustomer = { id: 1, name: 'Cliente OK', identification: '12345678' };
            const result2 = SiigoInvoiceService.formatCustomerData(okCustomer);
            console.log('  📊 Resultado:', JSON.stringify(result2));
            console.log('  ✅ Este resultado sería válido para SIIGO');
        } catch (error) {
            console.log('  ❌ Error:', error.message);
        }

        // 3. Revisar el frontend para ver qué datos se envían
        console.log('\n🔍 PASO 3: Identificando el punto de falla exacto...');
        console.log('El error 500 probablemente ocurre cuando:');
        console.log('  1. Frontend selecciona un cliente válido del dropdown');
        console.log('  2. Backend obtiene customer con getCustomerById()');
        console.log('  3. Customer tiene siigo_id pero NO tiene identification');
        console.log('  4. SiigoInvoiceService.formatCustomerData() usa person_id en lugar de identification');
        console.log('  5. SIIGO rechaza la request porque falta customer.identification');

        console.log('\n🛠️ SOLUCIONES REQUERIDAS:');
        console.log('  1. Mejorar validación en QuotationController antes de llamar a SIIGO');
        console.log('  2. Asegurar que formatCustomerData() siempre incluya identification válida');
        console.log('  3. Manejar casos donde customer no tiene datos suficientes');

        console.log('\n📋 RESUMEN DEL PROBLEMA:');
        console.log(`  • Total clientes: ${problematicCustomers.length}`);
        console.log(`  • Clientes críticos: ${criticalCustomers.length}`);
        console.log(`  • Clientes sin SIIGO_ID: ${problematicCustomers.filter(c => c.status.includes('SIIGO')).length}`);
        console.log(`  • Clientes sin identification: ${problematicCustomers.filter(c => c.status.includes('IDENTIFICATION')).length}`);

    } catch (error) {
        console.error('❌ Error durante el análisis:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar el análisis
fix500ErrorCustomerValidation().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});
