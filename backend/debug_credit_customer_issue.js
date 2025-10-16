const mysql = require('mysql2/promise');

async function debugCreditCustomerIssue() {
    console.log('🔍 INVESTIGANDO PROBLEMA DE CRÉDITO DEL CLIENTE');
    console.log('='.repeat(60));

    try {
        // Conectar a la base de datos
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos'
        });

        console.log('✅ Conectado a la base de datos');

        // 1. Verificar el pedido 12222
        console.log('\n1️⃣ Verificando pedido 12222...');
        const [orderRows] = await connection.execute(
            'SELECT * FROM orders WHERE order_number = ?',
            ['12222']
        );

        if (orderRows.length > 0) {
            const order = orderRows[0];
            console.log('📋 Pedido encontrado:');
            console.log('   - ID:', order.id);
            console.log('   - Cliente:', order.customer_name);
            console.log('   - Método de pago:', order.payment_method);
            console.log('   - Fecha de envío:', order.shipping_date);
            console.log('   - Estado:', order.status);
        } else {
            console.log('❌ Pedido 12222 no encontrado');
        }

        // 2. Verificar si existe tabla de crédito de clientes
        console.log('\n2️⃣ Verificando tabla de crédito de clientes...');
        const [tables] = await connection.execute(
            "SHOW TABLES LIKE 'customer_credit'"
        );

        if (tables.length > 0) {
            console.log('✅ Tabla customer_credit existe');
            
            // Verificar estructura
            const [structure] = await connection.execute(
                'DESCRIBE customer_credit'
            );
            console.log('📋 Estructura de la tabla:');
            structure.forEach(col => {
                console.log(`   - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });

            // Buscar información de crédito para este cliente
            const customerName = 'DISTRIBUCIONES EL PANADERO LA MAYORISTA S.A.S.';
            console.log(`\n3️⃣ Buscando crédito para: ${customerName}`);
            
            const [creditRows] = await connection.execute(
                'SELECT * FROM customer_credit WHERE customer_name = ?',
                [customerName]
            );

            if (creditRows.length > 0) {
                console.log('✅ Información de crédito encontrada:');
                creditRows.forEach(credit => {
                    console.log('   - Cupo total:', credit.credit_limit);
                    console.log('   - Saldo actual:', credit.current_balance);
                    console.log('   - Cupo disponible:', credit.available_credit);
                    console.log('   - Estado:', credit.status);
                });
            } else {
                console.log('❌ No se encontró información de crédito para este cliente');
                console.log('💡 Creando registro de crédito...');
                
                // Crear registro de crédito por defecto
                await connection.execute(
                    `INSERT INTO customer_credit (customer_name, credit_limit, current_balance, available_credit, status, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
                    [customerName, 10000000, 0, 10000000, 'active']
                );
                
                console.log('✅ Registro de crédito creado con cupo de $10,000,000');
            }
        } else {
            console.log('❌ Tabla customer_credit no existe');
            console.log('💡 Creando tabla customer_credit...');
            
            await connection.execute(`
                CREATE TABLE customer_credit (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    customer_name VARCHAR(255) NOT NULL,
                    credit_limit DECIMAL(15,2) DEFAULT 0,
                    current_balance DECIMAL(15,2) DEFAULT 0,
                    available_credit DECIMAL(15,2) DEFAULT 0,
                    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_customer (customer_name)
                )
            `);
            
            console.log('✅ Tabla customer_credit creada');
            
            // Crear registro para el cliente
            const customerName = 'DISTRIBUCIONES EL PANADERO LA MAYORISTA S.A.S.';
            await connection.execute(
                `INSERT INTO customer_credit (customer_name, credit_limit, current_balance, available_credit, status) 
                 VALUES (?, ?, ?, ?, ?)`,
                [customerName, 10000000, 0, 10000000, 'active']
            );
            
            console.log('✅ Registro de crédito creado para el cliente');
        }

        // 4. Verificar problema de fecha de envío
        console.log('\n4️⃣ Verificando problema de fecha de envío...');
        if (orderRows.length > 0) {
            const order = orderRows[0];
            console.log('📅 Fecha de envío actual:', order.shipping_date);
            
            if (!order.shipping_date || order.shipping_date === null) {
                console.log('❌ Fecha de envío es NULL, corrigiendo...');
                
                // Establecer fecha de hoy
                const today = new Date().toISOString().split('T')[0];
                await connection.execute(
                    'UPDATE orders SET shipping_date = ? WHERE id = ?',
                    [today, order.id]
                );
                
                console.log('✅ Fecha de envío actualizada a:', today);
            }
        }

        await connection.end();
        console.log('\n✅ Investigación completada');

    } catch (error) {
        console.error('❌ Error durante la investigación:', error);
    }
}

debugCreditCustomerIssue();
