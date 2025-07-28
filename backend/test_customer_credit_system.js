const mysql = require('mysql2/promise');

async function testCustomerCreditSystem() {
    console.log('🏦 PROBANDO SISTEMA DE CRÉDITO DE CLIENTES');
    console.log('='.repeat(70));

    try {
        // Conectar a la base de datos
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        console.log('✅ Conectado a la base de datos');

        // 1. Verificar que las tablas existen
        console.log('\n📋 1. Verificando estructura de las tablas...');
        
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME, TABLE_ROWS 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
            AND TABLE_NAME IN ('customer_credit', 'customer_credit_movements')
        `);

        tables.forEach(table => {
            console.log(`   ✓ Tabla ${table.TABLE_NAME}: ${table.TABLE_ROWS} registros`);
        });

        // 2. Verificar estructura de columnas
        console.log('\n🔍 2. Verificando estructura de columnas...');
        
        const [creditColumns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
            AND TABLE_NAME = 'customer_credit'
            ORDER BY ORDINAL_POSITION
        `);

        console.log('   📊 Columnas de customer_credit:');
        creditColumns.forEach(col => {
            console.log(`      - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });

        // 3. Verificar datos de ejemplo
        console.log('\n📊 3. Verificando datos de ejemplo...');
        
        const [customers] = await connection.execute(`
            SELECT id, customer_nit, customer_name, credit_limit, current_balance, available_credit, status
            FROM customer_credit 
            ORDER BY created_at DESC
        `);

        console.log(`   💳 ${customers.length} clientes de crédito encontrados:`);
        customers.forEach(customer => {
            console.log(`      • ${customer.customer_name} (${customer.customer_nit})`);
            console.log(`        Cupo: $${customer.credit_limit.toLocaleString('es-CO')}`);
            console.log(`        Usado: $${customer.current_balance.toLocaleString('es-CO')}`);
            console.log(`        Disponible: $${customer.available_credit.toLocaleString('es-CO')}`);
            console.log(`        Estado: ${customer.status}`);
            console.log('');
        });

        // 4. Probar búsqueda de cliente
        console.log('\n🔍 4. Probando búsqueda de clientes...');
        
        if (customers.length > 0) {
            const testCustomer = customers[0];
            
            // Búsqueda por NIT
            const [byNit] = await connection.execute(`
                SELECT * FROM customer_credit WHERE customer_nit LIKE ? AND status = 'active'
            `, [`%${testCustomer.customer_nit.substring(0, 3)}%`]);
            
            console.log(`   🔍 Búsqueda por NIT "${testCustomer.customer_nit.substring(0, 3)}": ${byNit.length} resultados`);
            
            // Búsqueda por nombre
            const [byName] = await connection.execute(`
                SELECT * FROM customer_credit WHERE customer_name LIKE ? AND status = 'active'
            `, [`%${testCustomer.customer_name.split(' ')[0]}%`]);
            
            console.log(`   🔍 Búsqueda por nombre "${testCustomer.customer_name.split(' ')[0]}": ${byName.length} resultados`);
        }

        // 5. Simular validación de crédito
        console.log('\n💰 5. Simulando validaciones de crédito...');
        
        if (customers.length > 0) {
            const testCustomer = customers[0];
            const testAmounts = [500000, 2000000, 15000000]; // Diferentes montos de prueba
            
            for (const amount of testAmounts) {
                const hasEnoughCredit = parseFloat(testCustomer.available_credit) >= amount;
                const status = hasEnoughCredit ? '✅' : '❌';
                
                console.log(`   ${status} Cliente: ${testCustomer.customer_name}`);
                console.log(`      Monto pedido: $${amount.toLocaleString('es-CO')}`);
                console.log(`      Crédito disponible: $${testCustomer.available_credit.toLocaleString('es-CO')}`);
                console.log(`      Resultado: ${hasEnoughCredit ? 'APROBADO' : 'RECHAZADO'}`);
                console.log('');
            }
        }

        // 6. Verificar historial de movimientos
        console.log('\n📈 6. Verificando historial de movimientos...');
        
        const [movements] = await connection.execute(`
            SELECT ccm.*, cc.customer_name, u.full_name as created_by_name
            FROM customer_credit_movements ccm
            LEFT JOIN customer_credit cc ON ccm.customer_credit_id = cc.id
            LEFT JOIN users u ON ccm.created_by = u.id
            ORDER BY ccm.created_at DESC
            LIMIT 10
        `);

        console.log(`   📋 ${movements.length} movimientos encontrados:`);
        movements.forEach(mov => {
            console.log(`      • ${mov.customer_name || 'Cliente desconocido'}`);
            console.log(`        Tipo: ${mov.movement_type}`);
            console.log(`        Monto: $${mov.amount.toLocaleString('es-CO')}`);
            console.log(`        Descripción: ${mov.description || 'Sin descripción'}`);
            console.log(`        Creado por: ${mov.created_by_name || 'Usuario desconocido'}`);
            console.log(`        Fecha: ${mov.created_at}`);
            console.log('');
        });

        // 7. Probar endpoints (simulación)
        console.log('\n🌐 7. Endpoints disponibles del sistema:');
        console.log('   📊 GET /api/customer-credit - Listar clientes de crédito (Admin)');
        console.log('   🔍 GET /api/customer-credit/search?search=NIT - Buscar clientes');
        console.log('   📋 GET /api/customer-credit/:id - Obtener cliente específico (Admin)');
        console.log('   ➕ POST /api/customer-credit - Crear cliente de crédito (Admin)');
        console.log('   ✏️  PUT /api/customer-credit/:id - Actualizar cliente (Admin)');
        console.log('   🗑️  DELETE /api/customer-credit/:id - Eliminar cliente (Admin)');
        console.log('   ✅ POST /api/customer-credit/validate - Validar crédito (Admin/Cartera)');

        // 8. Verificar roles y permisos
        console.log('\n🔐 8. Verificando roles y permisos...');
        
        const [users] = await connection.execute(`
            SELECT id, email, full_name, role 
            FROM users 
            WHERE role IN ('admin', 'cartera')
            ORDER BY role, full_name
        `);

        console.log(`   👥 Usuarios con acceso al sistema de crédito:`);
        users.forEach(user => {
            const access = user.role === 'admin' ? 'Gestión completa' : 'Solo validación';
            console.log(`      • ${user.full_name} (${user.email}) - ${user.role}: ${access}`);
        });

        await connection.end();
        
        console.log('\n✅ SISTEMA DE CRÉDITO DE CLIENTES VERIFICADO EXITOSAMENTE');
        console.log('\n💡 Próximos pasos:');
        console.log('   1. Acceder al panel admin en: http://localhost:3000/customer-credit');
        console.log('   2. Crear/editar clientes de crédito según sea necesario');
        console.log('   3. El personal de cartera puede validar créditos en tiempo real');
        console.log('   4. Los movimientos de crédito se registran automáticamente');

    } catch (error) {
        console.error('❌ Error durante la verificación:', error);
        process.exit(1);
    }
}

// Ejecutar el test
testCustomerCreditSystem();
