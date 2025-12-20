const db = require('./config/database');

(async () => {
    try {
        console.log('\n🔍 VERIFICANDO CLIENTE NIT: 901620334\n');

        // Check local DB
        const results = await db.query(
            'SELECT id, name, identification, siigo_id, email FROM customers WHERE identification = ?',
            ['901620334']
        );

        console.log('═══════════════════════════════════════');
        console.log('1. BASE DE DATOS LOCAL:');
        console.log('═══════════════════════════════════════');

        if (results.length === 0) {
            console.log('❌ Cliente NO encontrado en BD local');
            console.log('\n💡 El cliente debe crearse primero en SIIGO');
            console.log('   y luego sincronizarse a la BD local\n');
        } else {
            const c = results[0];
            console.log('✅ Cliente ENCONTRADO:');
            console.log('   ID local:', c.id);
            console.log('   Nombre:', c.name);
            console.log('   NIT:', c.identification);
            console.log('   SIIGO ID:', c.siigo_id || '❌ NO ASIGNADO');
            console.log('   Email:', c.email || 'N/A');

            if (!c.siigo_id) {
                console.log('\n⚠️  PROBLEMA CRÍTICO:');
                console.log('   El cliente existe pero NO tiene siigo_id');
                console.log('   Esto impedirá crear facturas\n');
            } else {
                console.log('\n✅ Cliente listo para facturar\n');
            }
        }

        // Check SIIGO
        console.log('═══════════════════════════════════════');
        console.log('2. SIIGO:');
        console.log('═══════════════════════════════════════');

        const siigoService = require('./services/siigoService');
        const siigoCustomers = await siigoService.getCustomers({ identification: '901620334' });

        if (!siigoCustomers || siigoCustomers.length === 0) {
            console.log('❌ Cliente NO encontrado en SIIGO');
            console.log('\n💡 Debes crear el cliente en SIIGO primero:');
            console.log('   1. Ir a SIIGO → Clientes → Crear nuevo');
            console.log('   2. Ingresar NIT: 901620334');
            console.log('   3. Completar información requerida');
            console.log('   4. Sincronizar en la app\n');
        } else {
            const sc = siigoCustomers[0];
            console.log('✅ Cliente ENCONTRADO en SIIGO:');
            console.log('   SIIGO ID:', sc.id);
            console.log('   Nombre:', sc.name ? `${sc.name[0].first_name} ${sc.name[0].last_name}` : sc.commercial_name);
            console.log('   NIT:', sc.identification);
            console.log('   Tipo:', sc.person_type);
            console.log('\n✅ Cliente existe en SIIGO\n');
        }

        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.poolEnd();
        process.exit(0);
    }
})();
