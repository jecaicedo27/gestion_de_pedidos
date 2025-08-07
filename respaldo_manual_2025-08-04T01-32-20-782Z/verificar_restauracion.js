const mysql = require('mysql2');

console.log('🔍 VERIFICANDO RESTAURACIÓN DE BASE DE DATOS');
console.log('==========================================\n');

async function verificarRestauracion() {
    let connection;
    
    try {
        const dbConfig = {
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        };
        
        connection = mysql.createConnection(dbConfig);
        
        const connect = () => new Promise((resolve, reject) => {
            connection.connect((err) => err ? reject(err) : resolve());
        });
        
        const query = (sql) => new Promise((resolve, reject) => {
            connection.query(sql, (err, results) => err ? reject(err) : resolve(results));
        });
        
        await connect();
        console.log('✅ Conexión a MySQL exitosa\n');
        
        // Verificar tablas principales
        const tables = await query('SHOW TABLES');
        console.log(`📊 Tablas encontradas: ${tables.length}`);
        
        // Verificar pedido 12580
        const pedido = await query('SELECT * FROM orders WHERE id = 12580');
        if (pedido.length > 0) {
            console.log('\n🎉 PEDIDO 12580 RESTAURADO CORRECTAMENTE:');
            console.log(`   Estado: ${pedido[0].status || 'SIN_ESTADO'}`);
            console.log(`   Cliente: ${pedido[0].customer_name || 'SIN_CLIENTE'}`);
            console.log(`   Total: $${pedido[0].total_amount || '0'}`);
            
            const items = await query('SELECT * FROM order_items WHERE order_id = 12580');
            console.log(`   Items: ${items.length}`);
        } else {
            console.log('\n❌ PEDIDO 12580 NO ENCONTRADO - PROBLEMA CRÍTICO');
        }
        
        // Verificar otros datos críticos
        const ordersCount = await query('SELECT COUNT(*) as count FROM orders');
        console.log(`\n📈 Total de pedidos: ${ordersCount[0].count}`);
        
        const usersCount = await query('SELECT COUNT(*) as count FROM users');
        console.log(`👥 Total de usuarios: ${usersCount[0].count}`);
        
        console.log('\n✅ VERIFICACIÓN COMPLETADA');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('🔧 MySQL no está ejecutándose - inicia XAMPP');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.log('🔧 Base de datos no existe - importa el respaldo');
        }
    } finally {
        if (connection) connection.end();
    }
}

verificarRestauracion();