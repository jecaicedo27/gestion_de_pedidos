const mysql = require('mysql2/promise');

async function testAnalyticsData() {
    let connection;
    
    try {
        console.log('=== VERIFICANDO DATOS PARA ANALYTICS ===\n');
        
        // Conectar a la base de datos
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        console.log('✅ Conexión a base de datos establecida\n');
        
        // 1. Verificar pedidos totales
        console.log('1. Verificando pedidos totales...');
        const [totalOrders] = await connection.execute('SELECT COUNT(*) as total FROM orders');
        console.log(`Total de pedidos: ${totalOrders[0].total}\n`);
        
        if (totalOrders[0].total === 0) {
            console.log('❌ No hay pedidos en la base de datos');
            return;
        }
        
        // 2. Verificar pedidos con fechas válidas
        console.log('2. Verificando pedidos con fechas...');
        const [ordersWithDates] = await connection.execute(`
            SELECT COUNT(*) as total, 
                   MIN(created_at) as min_date, 
                   MAX(created_at) as max_date 
            FROM orders 
            WHERE created_at IS NOT NULL
        `);
        console.log('Pedidos con fechas:', ordersWithDates[0]);
        console.log('');
        
        // 3. Verificar pedidos entregados (para daily shipments)
        console.log('3. Verificando pedidos entregados...');
        const [deliveredOrders] = await connection.execute(`
            SELECT COUNT(*) as total, 
                   DATE(created_at) as date
            FROM orders 
            WHERE status = 'entregado' 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at) 
            ORDER BY date DESC 
            LIMIT 10
        `);
        console.log('Pedidos entregados por día (últimos 30 días):', deliveredOrders);
        console.log('');
        
        // 4. Verificar disdd esnenvío
        console.log('4. Verificando disdd esn envío
        const [citie] = await connection.execute(``
        En_aSELErThipig_ctyCOUT(*)  t taHng_city IS NOT NULL 
            FROM oPgyr 
        tWHERE  hppg_iy IONULL
        consANDlohipping_city !=p'' ciudades de envío:', cities);
        console.log(''hipping_ciy
         
            LIMIT 10
        // 5. Verificar clientes
        console.log('Top ciudVeeificadnvílenteciie
        const [customers] = await connection.execute(`
            SELECT customer_name, COUNT(*) as total_orders, 
           5       SUtsl_piett
            FROM orde5s Veificclint
            WHEcuRto er_name IS NOT NULL 
            AND cuer_name != '' COUNT(*)a tol_order 
                  SUM()s toal_spn
            GROUP BY customer_name 
            WHERE customer_name IS NOT NULL 
            AND customer_name != ''
            GROUP BY tuslom_rrndme 
            ORDER BY toeal_ordersrs DESC 
            LIMIT 100
        `);
        console.log('Tlpeclitnt',stomcuetos
        console.log('');
        
        // 6. Verificar estructura de la tabla orders
        console.log('6. Verificando estructura de la tabla orders...');
        const [columns] = await connection.execute('DESCRIBE orders');
        const columnNames = columns.map(col => col.Field);
        console.log('Columnas de la tabla orders:', columnNames);
        console.log('');
        
        // 7. Verificar datos de muestra
        console.log('7. Mostrando datos de muestra...');
        const [sampleOrders] = await connection.execute(`
            SELECT id, customer_name, status, shipping_city, total_amount, created_at
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.log('Pedidos de muestra:', sampleOrders);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testAnalyticsData();
