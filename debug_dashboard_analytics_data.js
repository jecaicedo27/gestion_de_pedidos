const axios = require('axios');
const mysql = require('mysql2/promise');

async function debugDashboardAnalytics() {
    console.log('🔍 Diagnosticando problema de datos en dashboard analytics...\n');

    try {
        // 1. Probar conectividad de base de datos
        console.log('1. 📊 Verificando conectividad de base de datos...');
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        console.log('✅ Conexión a base de datos exitosa\n');

        // 2. Verificar estructura básica de datos
        console.log('2. 🗂️ Verificando estructura básica de datos...');
        
        // Contar pedidos
        const [ordersCount] = await connection.execute('SELECT COUNT(*) as count FROM orders');
        console.log(`📦 Total de pedidos en BD: ${ordersCount[0].count}`);
        
        // Contar clientes
        const [customersCount] = await connection.execute('SELECT COUNT(*) as count FROM customers');
        console.log(`👥 Total de clientes en BD: ${customersCount[0].count}`);
        
        // Verificar pedidos con fechas válidas
        const [ordersWithDates] = await connection.execute(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN shipping_date IS NOT NULL THEN 1 END) as with_shipping_date,
                COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as with_created_at
            FROM orders
        `);
        console.log(`📅 Pedidos con fechas - Total: ${ordersWithDates[0].total}, Con fecha envío: ${ordersWithDates[0].with_shipping_date}, Con fecha creación: ${ordersWithDates[0].with_created_at}`);

        // Verificar estados de pedidos
        const [orderStatuses] = await connection.execute(`
            SELECT status, COUNT(*) as count 
            FROM orders 
            GROUP BY status 
            ORDER BY count DESC
        `);
        console.log('📊 Estados de pedidos:');
        orderStatuses.forEach(row => {
            console.log(`   ${row.status}: ${row.count}`);
        });

        // Verificar relación orders-customers
        const [customerRelation] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT o.id) as orders_with_customers,
                COUNT(DISTINCT o.customer_document) as unique_customers_in_orders
            FROM orders o
            LEFT JOIN customers c ON o.customer_document = c.document
            WHERE c.document IS NOT NULL
        `);
        console.log(`🔗 Relación orders-customers: ${customerRelation[0].orders_with_customers} pedidos con clientes válidos, ${customerRelation[0].unique_customers_in_orders} clientes únicos\n`);

        await connection.end();

        // 3. Probar autenticación
        console.log('3. 🔐 Probando autenticación...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        if (loginResponse.data && loginResponse.data.token) {
            console.log('✅ Autenticación exitosa');
            const token = loginResponse.data.token;

            // 4. Probar endpoint de analytics
            console.log('\n4. 📈 Probando endpoint de analytics...');
            try {
                const analyticsResponse = await axios.get('http://localhost:3001/api/analytics/advanced-dashboard', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (analyticsResponse.data && analyticsResponse.data.success) {
                    console.log('✅ Endpoint de analytics responde correctamente');
                    console.log('\n📊 Datos recibidos:');
                    
                    const data = analyticsResponse.data.data;
                    
                    // Analizar cada sección
                    console.log(`\n🏆 Mejores Clientes: ${data.topCustomers ? data.topCustomers.length : 0} registros`);
                    if (data.topCustomers && data.topCustomers.length > 0) {
                        console.log(`   Ejemplo: ${data.topCustomers[0].name} - $${data.topCustomers[0].totalSpent}`);
                    }

                    console.log(`\n🔄 Recompras de Clientes: ${data.customerRepeatPurchases ? Object.keys(data.customerRepeatPurchases).length : 0} categorías`);
                    if (data.customerRepeatPurchases && data.customerRepeatPurchases.distribution) {
                        console.log(`   Distribución: ${data.customerRepeatPurchases.distribution.length} segmentos`);
                    }

                    console.log(`\n📊 Ciudades con más envíos: ${data.topShippingCities ? data.topShippingCities.length : 0} ciudades`);
                    if (data.topShippingCities && data.topShippingCities.length > 0) {
                        console.log(`   Top ciudad: ${data.topShippingCities[0].city} - ${data.topShippingCities[0].orderCount} pedidos`);
                    }

                    console.log(`\n👥 Nuevos clientes diarios: ${data.newCustomersDaily && data.newCustomersDaily.chartData ? data.newCustomersDaily.chartData.length : 0} días`);
                    
                    console.log(`\n⚠️ Clientes perdidos: ${data.lostCustomers && data.lostCustomers.summary ? data.lostCustomers.summary.totalLostCustomers : 0} clientes`);

                    // Revisar si hay datos vacíos
                    const emptySections = [];
                    if (!data.topCustomers || data.topCustomers.length === 0) emptySections.push('topCustomers');
                    if (!data.customerRepeatPurchases || !data.customerRepeatPurchases.distribution || data.customerRepeatPurchases.distribution.length === 0) emptySections.push('customerRepeatPurchases');
                    if (!data.topShippingCities || data.topShippingCities.length === 0) emptySections.push('topShippingCities');
                    if (!data.newCustomersDaily || !data.newCustomersDaily.chartData || data.newCustomersDaily.chartData.length === 0) emptySections.push('newCustomersDaily');
                    if (!data.lostCustomers || !data.lostCustomers.summary || data.lostCustomers.summary.totalLostCustomers === 0) emptySections.push('lostCustomers');

                    if (emptySections.length > 0) {
                        console.log(`\n❌ Secciones con datos vacíos: ${emptySections.join(', ')}`);
                    } else {
                        console.log('\n✅ Todas las secciones tienen datos');
                    }

                } else {
                    console.log('❌ Endpoint de analytics no devolvió datos válidos');
                    console.log('Response:', analyticsResponse.data);
                }

            } catch (analyticsError) {
                console.log('❌ Error al llamar endpoint de analytics:', analyticsError.message);
                if (analyticsError.response) {
                    console.log('Status:', analyticsError.response.status);
                    console.log('Data:', analyticsError.response.data);
                }
            }

        } else {
            console.log('❌ Fallo en autenticación');
        }

        // 5. Probar consultas individuales directamente
        console.log('\n5. 🔍 Probando consultas individuales directamente...');
        
        const directConnection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        // Consulta de mejores clientes (simplificada)
        console.log('\n👑 Probando consulta de mejores clientes...');
        const [topCustomersTest] = await directConnection.execute(`
            SELECT 
                o.customer_document,
                COUNT(o.id) as order_count,
                SUM(o.total_amount) as total_spent
            FROM orders o
            WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
              AND o.status NOT IN ('cancelado')
              AND o.customer_document IS NOT NULL
            GROUP BY o.customer_document
            ORDER BY total_spent DESC
            LIMIT 10
        `);
        console.log(`📊 Mejores clientes (consulta directa): ${topCustomersTest.length} resultados`);
        if (topCustomersTest.length > 0) {
            console.log(`   Top cliente: ${topCustomersTest[0].customer_document} - $${topCustomersTest[0].total_spent} en ${topCustomersTest[0].order_count} pedidos`);
        }

        await directConnection.end();

        console.log('\n🎯 DIAGNÓSTICO COMPLETO');
        console.log('=====================================');
        
        if (emptySections && emptySections.length > 0) {
            console.log('❌ PROBLEMAS IDENTIFICADOS:');
            console.log(`- Secciones sin datos: ${emptySections.join(', ')}`);
            console.log('\n💡 POSIBLES SOLUCIONES:');
            console.log('1. Verificar que existan pedidos con customer_document válido');
            console.log('2. Revisar que las fechas created_at y shipping_date estén pobladas');
            console.log('3. Verificar relación entre orders y customers');
            console.log('4. Revisar filtros de fechas en las consultas');
        } else {
            console.log('✅ Los datos están disponibles en el backend');
            console.log('💡 El problema podría estar en el frontend:');
            console.log('1. Verificar que el frontend llame correctamente al endpoint');
            console.log('2. Revisar autenticación en el frontend');
            console.log('3. Verificar componentes de renderizado de gráficas');
        }

    } catch (error) {
        console.error('❌ Error durante diagnóstico:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Backend no está corriendo en puerto 3001');
        }
    }
}

// Ejecutar diagnóstico
debugDashboardAnalytics().then(() => {
    console.log('\n🏁 Diagnóstico completado');
}).catch(err => {
    console.error('Error fatal:', err);
});
