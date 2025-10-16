const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runCustomerCreditMigration() {
    console.log('🏦 EJECUTANDO MIGRACIÓN DEL SISTEMA DE CRÉDITO DE CLIENTES');
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

        // Leer el archivo SQL
        const sqlFile = path.join(__dirname, 'create_customer_credit_system.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        // Dividir en statements individuales
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        console.log(`📋 Ejecutando ${statements.length} statements SQL...`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                try {
                    await connection.execute(statement);
                    console.log(`✅ Statement ${i + 1}/${statements.length} ejecutado correctamente`);
                } catch (error) {
                    if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_ENTRY') {
                        console.log(`⚠️  Statement ${i + 1}/${statements.length} ya existe, continuando...`);
                    } else {
                        console.error(`❌ Error en statement ${i + 1}:`, error.message);
                        throw error;
                    }
                }
            }
        }

        // Verificar que las tablas se crearon correctamente
        console.log('\n🔍 Verificando tablas creadas...');
        
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME, TABLE_ROWS 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
            AND TABLE_NAME IN ('customer_credit', 'customer_credit_movements')
        `);

        tables.forEach(table => {
            console.log(`✅ Tabla ${table.TABLE_NAME} creada con ${table.TABLE_ROWS} registros`);
        });

        // Verificar datos de ejemplo
        console.log('\n📊 Verificando datos de ejemplo...');
        const [customers] = await connection.execute('SELECT * FROM customer_credit');
        
        console.log(`✅ ${customers.length} clientes de crédito creados:`);
        customers.forEach(customer => {
            console.log(`   - ${customer.customer_name} (NIT: ${customer.customer_nit})`);
            console.log(`     Cupo: $${customer.credit_limit.toLocaleString('es-CO')}`);
            console.log(`     Disponible: $${customer.available_credit.toLocaleString('es-CO')}`);
        });

        await connection.end();
        console.log('\n✅ Migración del sistema de crédito completada exitosamente');

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    }
}

runCustomerCreditMigration();
